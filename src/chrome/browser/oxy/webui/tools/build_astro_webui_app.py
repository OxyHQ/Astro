#!/usr/bin/env python3
# Copyright 2026 Oxy. All rights reserved.
# Use of this source code is governed by a BSD-style license.

"""Builds the Astro WebUI app and hands its output to GRIT.

Run as a GN action. Three things happen here, in this order:

  1. `bun run build` in the Vite app, which emits a directory of static files.
  2. The emitted set is checked against the app's committed `manifest.json`,
     which is the single authority for what the app emits.
  3. The set is copied into the target's gen directory and described by a
     second manifest in the shape `generate_grd.py` reads, so the ordinary
     Chromium generate_grd -> grit -> .pak pipeline takes it from there.

THE ONE INPUT THAT IS NOT IN THE ASTRO REPOSITORY

The app imports the TypeScript Mojo bindings, and those are generated into a
Chromium build's `gen/` rather than committed — the message ordinals are hashed
from the .mojom text, so a vendored copy still compiles and still sends, it
just sends messages the browser discards. `--mojom-gen-dir` names the directory
holding them and reaches Vite as `ASTRO_MOJOM_GEN_DIR`; the GN action passes
its own `root_gen_dir` and depends on `:mojo_bindings_ts__generator`, which is
what makes the bundle and the browser around it come out of the same .mojom
files. Without both halves the build reads whichever gen/ directory the app's
tsconfig.json happens to name, which is a different build's, or none.

WHY THE APP IS NOT IN THE CHROMIUM TREE, AND WHAT THAT COSTS

The app lives at `webui/app` in the Astro repository. The Chromium checkout is
a subdirectory of that repository, so the app is OUTSIDE the GN source root and
GN cannot name it: `inputs`, `sources` and `script` all have to resolve under
`//`. Moving the app under the overlay is not an option either — the overlay is
copied wholesale by tools/sync-overlay.sh, which enumerates every file it finds
and refuses a tree over a declared ceiling, so `node_modules` alone would end
the copy.

So the action has no declared inputs, and ninja would never re-run it. That is
the Metro-staleness shape: a bundle that is silently one edit behind the source
it claims to be built from. It is repaired with a DEPFILE — this script writes
every file the build depends on, by absolute path, and ninja re-runs the action
when any of them changes. Absolute paths outside the build root are ordinary in
a depfile (it is how compilers report system headers).

WHAT THE DEPFILE DOES NOT COVER, DELIBERATELY

The contents of `node_modules`. Walking it would add tens of thousands of stats
to every build for a tree the build cannot install anyway: `bun install` needs
the network, and a GN action must not. So `bun install` is a PRECONDITION,
asserted here and again in tools/build.sh's preflight, and `bun.lock` is in the
depfile — a dependency VERSION change re-runs the build, a hand-edit inside
`node_modules` does not. That is the one staleness hole in this design and it
is named rather than papered over.
"""

import argparse
import errno
import fcntl
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile

# Files outside `src/` whose content changes what the build emits. Listed
# rather than globbed: the app directory also holds `dist/` (this build's own
# output) and `node_modules/`, and a glob over the directory would put the
# build's output into the build's own dependency list.
_APP_ROOT_DEPENDENCIES = (
    "bun.lock",
    "index.html",
    "package.json",
    "tsconfig.json",
    "vite.config.ts",
)

# Directories under the app whose every file is a dependency.
_APP_SOURCE_DIRECTORIES = ("src", "scripts")


class BuildError(Exception):
    """A failure that must be reported to the developer, not to a stack trace."""


def _fail(summary, *details):
    lines = ["", "Astro WebUI app build: " + summary, ""]
    lines.extend("  " + str(detail) for detail in details)
    lines.append("")
    raise BuildError("\n".join(lines))


def _derive_app_directory(script_path):
    """Locates `webui/app` from this script's own position in the tree.

    The script is copied into the Chromium checkout at
    `chrome/browser/oxy/webui/tools/`, and the checkout is `chromium/src`
    inside the Astro repository, so the app is six levels up and across. That
    holds for the layout tools/sync-sources.sh creates and nothing else, which
    is why a checkout somewhere else has to say so with the `astro_webui_app_dir`
    GN argument rather than have a wrong path guessed for it.
    """
    chromium_src = os.path.abspath(os.path.join(os.path.dirname(script_path), *([os.pardir] * 5)))
    astro_root = os.path.dirname(os.path.dirname(chromium_src))
    return os.path.join(astro_root, "webui", "app")


def _require_app_directory(app_directory, derived):
    if not os.path.isdir(app_directory):
        _fail(
            "the Vite app directory does not exist.",
            "Looked in: %s" % app_directory,
            "This path was %s." % ("derived from the checkout layout" if derived else "given as astro_webui_app_dir"),
            "",
            "If the Chromium checkout is not <astro repo>/chromium/src, set the",
            "GN argument astro_webui_app_dir to the absolute path of webui/app.",
        )
    for required in ("package.json", "manifest.json"):
        if not os.path.isfile(os.path.join(app_directory, required)):
            _fail(
                "%s is not a Vite app directory." % app_directory,
                "It has no %s." % required,
            )
    if not os.path.isdir(os.path.join(app_directory, "node_modules")):
        _fail(
            "the app's dependencies are not installed.",
            "Missing: %s" % os.path.join(app_directory, "node_modules"),
            "",
            "A GN action must not reach the network, so this build cannot install",
            "them for you. Run it once, by hand:",
            "",
            "    cd %s && bun install" % app_directory,
        )


def _read_manifest(app_directory):
    path = os.path.join(app_directory, "manifest.json")
    with open(path, "r", encoding="utf-8") as handle:
        return handle.read()


def _declared_build(manifest_text, build_name, app_directory):
    try:
        manifest = json.loads(manifest_text)
    except ValueError as error:
        _fail(
            "the app's manifest.json is not valid JSON.",
            "File: %s" % os.path.join(app_directory, "manifest.json"),
            "Parser said: %s" % error,
        )
    builds = manifest.get("builds")
    if not isinstance(builds, dict) or build_name not in builds:
        _fail(
            "the app's manifest.json declares no '%s' build." % build_name,
            "File: %s" % os.path.join(app_directory, "manifest.json"),
            "Declares: %s" % ", ".join(sorted(builds)) if isinstance(builds, dict) else "nothing",
            "",
            "Regenerate it with:  cd %s && bun run build" % app_directory,
        )
    declared = builds[build_name]
    files = declared.get("files")
    out_dir = declared.get("out_dir")
    entry = declared.get("entry")
    if not isinstance(files, list) or not files or not out_dir or not entry:
        _fail(
            "the app's manifest.json describes the '%s' build incompletely." % build_name,
            "Needs out_dir, entry and a non-empty files list; got: %s" % json.dumps(declared),
        )
    return out_dir, entry, sorted(files)


def _run_vite(app_directory, bun_script, mojom_gen_directory):
    if shutil.which("bun") is None:
        _fail(
            "bun is not on PATH.",
            "The Astro WebUI app is built by Vite through bun, so the build",
            "cannot proceed without it. Install bun, or run the build from a",
            "shell where `bun --version` works.",
        )
    environment = dict(os.environ)
    if mojom_gen_directory:
        # Overrides the gen/ directory webui/app/tsconfig.json names, so the
        # bundle is compiled against THIS build's bindings rather than whatever
        # some other output directory last generated. See the `mojomGenDir`
        # comment in webui/app/vite.config.ts.
        environment["ASTRO_MOJOM_GEN_DIR"] = mojom_gen_directory
    completed = subprocess.run(
        ["bun", "run", bun_script],
        cwd=app_directory,
        env=environment,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    output = completed.stdout.decode("utf-8", "replace")
    if completed.returncode != 0:
        _fail(
            "`bun run %s` failed (exit %d)." % (bun_script, completed.returncode),
            "Working directory: %s" % app_directory,
            "",
            *output.splitlines()
        )
    return output


def _assert_manifest_unchanged(before, after, app_directory, build_name):
    """The committed manifest is the contract; a build that disagrees stops.

    The Vite config rewrites manifest.json on every build, so a change here
    means the emitted set really moved. The new manifest is left on disk
    because it is exactly what has to be committed — and because GN reads
    nothing from it at generation time, the next ninja run picks the new set up
    on its own once it is committed.
    """
    if before == after:
        return
    _, _, was = _declared_build(before, build_name, app_directory)
    _, _, now = _declared_build(after, build_name, app_directory)
    added = sorted(set(now) - set(was))
    removed = sorted(set(was) - set(now))
    _fail(
        "the app emitted a different set of files than manifest.json declared.",
        "Manifest: %s" % os.path.join(app_directory, "manifest.json"),
        "Added:    %s" % (", ".join(added) if added else "(none)"),
        "Removed:  %s" % (", ".join(removed) if removed else "(none)"),
        "",
        "manifest.json is the single authority for what this app emits, and it",
        "is committed so that a review sees the resource set change. The build",
        "has already rewritten it with the new set — commit that change and",
        "build again.",
    )


def _assert_emitted_set(out_directory, entry, declared):
    if not os.path.isdir(out_directory):
        _fail(
            "the app build produced no output directory.",
            "Expected: %s" % out_directory,
        )
    emitted = sorted(
        name for name in os.listdir(out_directory)
        if os.path.isfile(os.path.join(out_directory, name))
    )
    if emitted != declared:
        missing = sorted(set(declared) - set(emitted))
        extra = sorted(set(emitted) - set(declared))
        _fail(
            "the app's output directory does not hold the declared set.",
            "Directory: %s" % out_directory,
            "Missing:   %s" % (", ".join(missing) if missing else "(none)"),
            "Unexpected:%s" % (" " + ", ".join(extra) if extra else " (none)"),
        )
    # A vacuity floor. Everything above compares the output against the
    # manifest, so an app that emitted nothing and a manifest that declared
    # nothing agree perfectly — and the .pak would be empty with every check
    # green. The entry document is the one file whose absence is never valid.
    if entry not in declared:
        _fail(
            "the declared set does not contain the entry document.",
            "Entry:    %s" % entry,
            "Declared: %d file(s), none of them the entry" % len(declared),
        )


def _copy_into_gen(out_directory, declared, destination):
    if os.path.isdir(destination):
        shutil.rmtree(destination)
    os.makedirs(destination)
    for name in declared:
        shutil.copyfile(
            os.path.join(out_directory, name), os.path.join(destination, name)
        )


def _write_grd_manifest(path, base_dir, declared):
    """The manifest generate_grd.py reads: a base directory and a file list."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="") as handle:
        json.dump({"base_dir": base_dir, "files": declared}, handle, indent=2, sort_keys=True)
        handle.write("\n")


def _dependency_paths(app_directory):
    paths = []
    for name in _APP_ROOT_DEPENDENCIES:
        candidate = os.path.join(app_directory, name)
        if os.path.isfile(candidate):
            paths.append(candidate)
    for directory in _APP_SOURCE_DIRECTORIES:
        root = os.path.join(app_directory, directory)
        for current, _subdirectories, files in os.walk(root):
            for name in files:
                paths.append(os.path.join(current, name))
    return sorted(paths)


def _write_depfile(path, output, app_directory):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    dependencies = " ".join(
        candidate.replace("\\", "/").replace(" ", "\\ ")
        for candidate in _dependency_paths(app_directory)
    )
    with open(path, "w", encoding="utf-8", newline="") as handle:
        handle.write("%s: %s\n" % (output.replace("\\", "/"), dependencies))


class _AppDirectoryLock:
    """Serialises builds of one app directory across concurrent ninja runs.

    Every output directory's action runs `bun run build` in the SAME app
    directory and writes the same `dist/`. Two builds at once tear it, and the
    resulting .pak holds a mixture of two bundles with nothing reporting it.
    The lock is keyed on the app directory and kept out of it, so it never
    shows up as an untracked file in the developer's repository.
    """

    def __init__(self, app_directory):
        digest = hashlib.sha256(os.path.realpath(app_directory).encode("utf-8")).hexdigest()[:16]
        self._path = os.path.join(tempfile.gettempdir(), "astro-webui-app-%s.lock" % digest)
        self._handle = None

    def __enter__(self):
        self._handle = open(self._path, "a+")
        try:
            fcntl.flock(self._handle.fileno(), fcntl.LOCK_EX)
        except OSError as error:
            # A filesystem without advisory locks must not stop the build; the
            # race it protects against needs two concurrent builds to occur.
            if error.errno not in (errno.EINVAL, errno.ENOLCK, errno.EOPNOTSUPP):
                raise
        return self

    def __exit__(self, *_exception):
        if self._handle is not None:
            self._handle.close()
            self._handle = None
        return False


def main(argv):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--app-dir", default="",
                        help="Vite app directory; derived from the checkout layout when empty.")
    parser.add_argument("--build", required=True,
                        help="manifest.json build key to package (for example: app).")
    parser.add_argument("--bun-script", required=True,
                        help="package.json script that produces that build.")
    parser.add_argument("--out-dir", required=True,
                        help="Directory the emitted set is copied into.")
    parser.add_argument("--manifest", required=True,
                        help="generate_grd manifest to write.")
    parser.add_argument("--depfile", required=True,
                        help="Ninja depfile to write.")
    parser.add_argument("--mojom-gen-dir", default="",
                        help="This build's gen/ directory, holding the generated Mojo "
                             "TypeScript bindings the app imports.")
    arguments = parser.parse_args(argv)

    derived = not arguments.app_dir
    app_directory = os.path.abspath(
        _derive_app_directory(os.path.abspath(__file__)) if derived else arguments.app_dir
    )
    _require_app_directory(app_directory, derived)

    mojom_gen_directory = (
        os.path.abspath(arguments.mojom_gen_dir) if arguments.mojom_gen_dir else ""
    )

    with _AppDirectoryLock(app_directory):
        before = _read_manifest(app_directory)
        _run_vite(app_directory, arguments.bun_script, mojom_gen_directory)
        after = _read_manifest(app_directory)
        _assert_manifest_unchanged(before, after, app_directory, arguments.build)

        out_dir, entry, declared = _declared_build(after, arguments.build, app_directory)
        emitted_directory = os.path.join(app_directory, out_dir)
        _assert_emitted_set(emitted_directory, entry, declared)

        destination = os.path.abspath(arguments.out_dir)
        _copy_into_gen(emitted_directory, declared, destination)

    _write_grd_manifest(os.path.abspath(arguments.manifest), destination, declared)
    _write_depfile(os.path.abspath(arguments.depfile), arguments.manifest, app_directory)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except BuildError as failure:
        sys.stderr.write(str(failure) + "\n")
        sys.exit(1)
