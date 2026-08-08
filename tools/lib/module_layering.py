#!/usr/bin/env python3
"""Run Chromium's checkdeps over `//astro` and turn it into a verdict.

`//astro` declares its layering in DEPS files: the module root grants Chromium's
public API and subtracts `-chrome`, `browser/DEPS` re-grants the single
`chrome/` header the integration hook needs, and `common/DEPS` restates the
subtraction so a future edit to the root cannot widen the bottom layer. None of
that is enforced by anything. `gn check` validates GN dependency EDGES, not
`include_rules`; nothing else in this repository reads a DEPS file at all. Until
something runs checkdeps, every rule in those files is a comment.

This is that something. It drives checkdeps as a library rather than shelling
out to its CLI, for three reasons — each one a way the plain CLI reports a clean
module here without having checked it:

  1. checkdeps takes ONE directory and walks all of it. Pointed at the module
     root it also walks the pre-module tree this repository still carries and
     reports its 39 `chrome/` includes: real, deliberate, and nothing to do with
     `//astro`. Scope has to come from a declaration
     (tools/astro-module.scope), and a declaration has to be joined against the
     tree in BOTH directions or it rots into a list of directories that no
     longer exist while new ones arrive unscanned.

  2. checkdeps prints `SUCCESS` and exits 0 when it walked nothing at all. A
     moved tool, a mistyped module path, a directory git does not track, a
     `skip_child_includes` that swallowed a layer — every one of them is
     reported exactly like a clean module. So the verdict carries what was
     MEASURED: every source file git tracks under a declared layer must appear
     in what checkdeps considered, and a run that considered nothing fails.

  3. One process, one enumeration. checkdeps memoises its git file list per
     instance; invoking the CLI once per layer re-reads Chromium's 400,000-file
     index every time.

Upstream's own `CheckDirectory` does the checking and upstream's own formatter
writes the message, so a Chromium roll that changes what a violation means
changes it here too. Nothing in this file decides whether an include is legal.

Exit codes:
  0  every declared layer obeys its include_rules
  1  a violation, or a scope declaration that does not match the tree
  2  unmeasurable — the checkout, the module, the tool or the files are missing
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys

# Distinct from 1 so "the rules were checked and something broke them" is never
# confused with "nothing was checked". A caller that treats every non-zero exit
# alike is still correct; one that wants to say WHY has the information.
EXIT_VIOLATION = 1
EXIT_UNMEASURABLE = 2

# The one place the module's own root is named. GN addresses this repository as
# `//astro` because gclient places it at `chromium/src/astro`.
MODULE_DIR_NAME = "astro"

CHECKDEPS_SUBPATH = os.path.join("buildtools", "checkdeps")

# How many offenders to name inline before the list is cut. The full set is
# always printed separately; this only bounds the one-line summaries.
NAMES_IN_SUMMARY = 5


class Unmeasurable(Exception):
    """Something needed to reach a verdict is absent."""

    def __init__(self, message: str, *hints: str) -> None:
        super().__init__(message)
        self.hints = hints


class ScopeError(Exception):
    """The scope declaration is malformed, or disagrees with the module tree."""


# ---------------------------------------------------------------------------
# The scope declaration
# ---------------------------------------------------------------------------


class Scope:
    """tools/astro-module.scope — which top-level directories are `//astro`."""

    def __init__(self, path: str) -> None:
        self.path = path
        self.layers: list[str] = []
        self.excluded: dict[str, dict[str, str]] = {}
        self._parse()

    def _parse(self) -> None:
        if not os.path.isfile(self.path):
            raise Unmeasurable(
                "no scope declaration at %s" % self.path,
                "It names which top-level directories are //astro. Without it "
                "there is nothing to check, and no way to notice that.",
            )

        seen: dict[str, int] = {}
        with open(self.path, encoding="utf-8") as handle:
            for lineno, raw in enumerate(handle, start=1):
                line = raw.split("#", 1)[0].strip()
                if not line:
                    continue

                where = "%s:%d" % (self.path, lineno)
                fields = line.split()
                kind = fields[0]
                name = fields[1] if len(fields) > 1 else ""

                if not name:
                    raise ScopeError("%s: '%s' names no directory" % (where, kind))
                if "/" in name or name in (".", ".."):
                    raise ScopeError(
                        "%s: '%s' must be a single top-level directory of the module"
                        % (where, name)
                    )
                if name in seen:
                    raise ScopeError(
                        "%s: '%s' is already declared at line %d" % (where, name, seen[name])
                    )
                seen[name] = lineno

                meta: dict[str, str] = {}
                for field in fields[2:]:
                    if "=" not in field:
                        raise ScopeError("%s: '%s' is not key=value" % (where, field))
                    key, value = field.split("=", 1)
                    meta[key] = value

                if kind == "layer":
                    self.layers.append(name)
                elif kind == "excluded":
                    # owner= is what keeps an exclusion temporary. Without it
                    # the list is just somewhere to put anything inconvenient.
                    if not meta.get("owner"):
                        raise ScopeError(
                            "%s: excluded '%s' needs owner=<issue>; an unowned "
                            "exclusion is source code nothing checks again"
                            % (where, name)
                        )
                    self.excluded[name] = meta
                else:
                    raise ScopeError(
                        "%s: unknown kind '%s' (expected 'layer' or 'excluded')"
                        % (where, kind)
                    )

        if not self.layers:
            raise ScopeError("%s declares no layers, so this gate would check nothing" % self.path)

    def declared(self) -> set[str]:
        return set(self.layers) | set(self.excluded)


# ---------------------------------------------------------------------------
# What git says is in the module
# ---------------------------------------------------------------------------


def tracked_files(module_root: str) -> list[str]:
    """Every path git tracks under the module, relative to its root.

    checkdeps decides what to walk from `git ls-files` as well, so asking git
    here makes "checkdeps considered everything it should have" a comparison
    between two views of one list rather than an assertion against a guess.
    """
    result = subprocess.run(
        ["git", "ls-files", "-z"],
        cwd=module_root,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if result.returncode != 0:
        raise Unmeasurable(
            "git could not list the module's files in %s" % module_root,
            "git said: %s" % result.stderr.decode("utf-8", "replace").strip(),
            "checkdeps walks only git-tracked directories, so without this "
            "there is no module for it to check.",
        )
    return [name for name in result.stdout.decode("utf-8", "replace").split("\0") if name]


def normalise(path: str) -> str:
    return os.path.normcase(os.path.abspath(path))


# ---------------------------------------------------------------------------
# checkdeps
# ---------------------------------------------------------------------------


def load_checkdeps(chromium_src: str):
    """Imports Chromium's checkdeps. Returns (module, source extensions)."""
    tool_dir = os.path.join(chromium_src, CHECKDEPS_SUBPATH)
    entry = os.path.join(tool_dir, "checkdeps.py")
    if not os.path.isfile(entry):
        raise Unmeasurable(
            "checkdeps is not at %s" % entry,
            "It ships inside the Chromium checkout. If it moved upstream this "
            "gate has to be pointed at the new path, not left reporting a clean "
            "module it never looked at.",
        )

    sys.path.insert(0, tool_dir)
    try:
        import checkdeps
        import cpp_checker
        import java_checker
        import proto_checker
    except ImportError as exc:
        raise Unmeasurable(
            "checkdeps at %s could not be imported: %s" % (tool_dir, exc),
            "It imports its siblings by bare name, so a partial copy of the "
            "directory imports and then checks nothing.",
        ) from exc
    finally:
        sys.path.pop(0)

    extensions: set[str] = set()
    for checker_class in (
        cpp_checker.CppChecker,
        java_checker.JavaChecker,
        proto_checker.ProtoChecker,
    ):
        extensions.update(checker_class.EXTENSIONS)
    return checkdeps, extensions


def recording_formatter(checkdeps):
    """Upstream's formatter, keeping the structured results it discards.

    NormalResultsFormatter stores only rendered strings. The rendering is
    exactly what should be printed — it names the file, the include and the rule
    — but the offending paths are wanted as data too, and re-parsing the prose
    to recover them would make this file's report depend on upstream's wording.
    """

    class RecordingResultsFormatter(checkdeps.results.NormalResultsFormatter):
        def __init__(self) -> None:
            super().__init__(verbose=False)
            self.dependees = []

        def AddError(self, dependee_status):  # noqa: N802 (upstream's name)
            self.dependees.append(dependee_status)
            super().AddError(dependee_status)

    return RecordingResultsFormatter()


def considered_files(checker, start_dir: str, extensions: set[str]) -> set[str]:
    """The source files checkdeps' own walk reaches under `start_dir`.

    Re-uses `GetAllRulesAndFiles`, the same enumeration `CheckDirectory`
    iterates, rather than re-deriving the walk: a count taken from a different
    traversal would happily report files nobody checked.
    """
    found = set()
    for _rules, file_paths in checker.GetAllRulesAndFiles(start_dir):
        for full_name in file_paths:
            if os.path.splitext(full_name)[1] in extensions:
                found.add(normalise(full_name))
    return found


def report_problems(problems: list[str], verdict: str) -> int:
    for problem in problems:
        print("SCOPE: %s" % problem, file=sys.stderr)
    print(file=sys.stderr)
    print(verdict, file=sys.stderr)
    return EXIT_VIOLATION


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Check //astro against the include_rules its DEPS files declare."
    )
    parser.add_argument(
        "--chromium-src",
        required=True,
        help="the Chromium checkout; //astro lives at <chromium-src>/%s" % MODULE_DIR_NAME,
    )
    parser.add_argument("--scope", required=True, help="path to astro-module.scope")
    args = parser.parse_args()

    # Absolute from here on. checkdeps normalises its own base directory but
    # joins a relative start directory onto it, so a relative path given here
    # would be resolved twice and silently walk nothing.
    chromium_src = os.path.abspath(args.chromium_src)
    if not os.path.isdir(chromium_src):
        raise Unmeasurable(
            "no Chromium checkout at %s" % chromium_src,
            "checkdeps ships inside it and //astro's rules resolve against its "
            "root DEPS. Run tools/sync-sources.sh to create one.",
        )

    module_root = os.path.join(chromium_src, MODULE_DIR_NAME)
    if not os.path.isdir(module_root):
        raise Unmeasurable(
            "no //%s module at %s" % (MODULE_DIR_NAME, module_root),
            "gclient places the Astro repository there. Its DEPS files are what "
            "this gate reads; with no module there is nothing to measure.",
        )

    scope = Scope(args.scope)
    checkdeps, extensions = load_checkdeps(chromium_src)

    print("Chromium checkout: %s" % chromium_src)
    print("Module:            %s  (//%s)" % (module_root, MODULE_DIR_NAME))
    print("Scope:             %s" % scope.path)
    print()

    # ---- the declaration against the tree, in both directions --------------
    problems: list[str] = []

    for name in scope.layers + sorted(scope.excluded):
        if not os.path.isdir(os.path.join(module_root, name)):
            problems.append(
                "'%s' is declared in %s but is not a directory in the module; a "
                "declaration that outlived what it described hides whatever "
                "replaced it" % (name, os.path.basename(scope.path))
            )

    # Bucket every tracked source file by its top-level directory. A file
    # directly at the module root has no directory and gets its own bucket:
    # per-layer scans would never reach it.
    sources_by_top: dict[str, list[str]] = {}
    for rel in tracked_files(module_root):
        if os.path.splitext(rel)[1] not in extensions:
            continue
        top = rel.split("/", 1)[0] if "/" in rel else ""
        sources_by_top.setdefault(top, []).append(rel)

    declared = scope.declared()
    for top in sorted(sources_by_top):
        if top in declared:
            continue
        names = sorted(sources_by_top[top])
        problems.append(
            "%s holds %d source file(s) that no line of %s accounts for, so "
            "nothing checks them: %s"
            % (
                "the module root" if top == "" else "'%s'" % top,
                len(names),
                os.path.basename(scope.path),
                ", ".join(names[:NAMES_IN_SUMMARY]),
            )
        )

    if problems:
        return report_problems(
            problems, "FAILED: the scope declaration and the module do not agree."
        )

    # ---- checkdeps itself --------------------------------------------------
    try:
        checker = checkdeps.DepsChecker(
            base_directory=chromium_src,
            extra_repos=[MODULE_DIR_NAME],
            verbose=False,
        )
    except Exception as exc:  # builddeps raises its own DepsBuilderError
        raise Unmeasurable(
            "checkdeps refused the checkout at %s: %s" % (chromium_src, exc),
            "It requires a repository root; a directory that merely looks like "
            "one is not enough.",
        ) from exc
    checker.results_formatter = recording_formatter(checkdeps)

    total_considered: set[str] = set()
    for layer in scope.layers:
        layer_abs = os.path.join(module_root, layer)
        checker.CheckDirectory(layer_abs)
        seen = considered_files(checker, layer_abs, extensions)
        total_considered |= seen
        print("  layer  %-10s %d file(s) considered" % (layer, len(seen)))

        expected = {
            normalise(os.path.join(module_root, rel)) for rel in sources_by_top.get(layer, [])
        }
        unscanned = sorted(os.path.relpath(path, module_root) for path in expected - seen)
        if unscanned:
            problems.append(
                "layer '%s': checkdeps did not consider %d of the %d source "
                "file(s) git tracks under it — %s. A layer that goes unwalked "
                "reports exactly like a clean one"
                % (
                    layer,
                    len(unscanned),
                    len(expected),
                    ", ".join(unscanned[:NAMES_IN_SUMMARY]),
                )
            )

    for name in sorted(scope.excluded):
        print(
            "  excl.  %-10s not scanned  (owner=%s)"
            % (name, scope.excluded[name].get("owner", "?"))
        )
    print()

    # The blunt floor, beneath the exact one. Both are needed: the per-layer
    # comparison passes trivially when git tracks nothing under a layer, which
    # is precisely the shape a mistyped module path produces.
    if not total_considered:
        raise Unmeasurable(
            "checkdeps considered 0 files across %d declared layer(s)" % len(scope.layers),
            "It exits 0 having walked nothing, which reads exactly like a clean "
            "module. Something between %s and the layers is wrong: the module "
            "path, the directories git tracks, or a skip_child_includes."
            % module_root,
        )

    if problems:
        return report_problems(problems, "FAILED: //astro was not fully checked.")

    formatter = checker.results_formatter
    if formatter.GetResults():
        # Upstream's own text, verbatim: it names the offending file, the
        # include, and the rule that forbids it.
        formatter.PrintResults()
        offenders = sorted(
            os.path.relpath(status.dependee_path, module_root) for status in formatter.dependees
        )
        print(
            "%d file(s) in //%s violate the include_rules their DEPS chain "
            "declares:" % (len(offenders), MODULE_DIR_NAME)
        )
        for offender in offenders:
            print("  %s" % offender)
        print()
        print(
            "A rule is granted in the DEPS file of the layer that needs it. "
            "checkdeps inherits grants DOWNWARD, so moving one up to the module "
            "root to silence this hands the same permission to every layer."
        )
        return EXIT_VIOLATION

    print(
        "OK: %d file(s) across %d layer(s) obey //%s's include_rules."
        % (len(total_considered), len(scope.layers), MODULE_DIR_NAME)
    )
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Unmeasurable as unmeasurable:
        print("unmeasurable: %s" % unmeasurable, file=sys.stderr)
        for hint_line in unmeasurable.hints:
            print("  %s" % hint_line, file=sys.stderr)
        sys.exit(EXIT_UNMEASURABLE)
    except ScopeError as scope_error:
        print("SCOPE: %s" % scope_error, file=sys.stderr)
        sys.exit(EXIT_VIOLATION)
