#!/usr/bin/env python3
"""Install the licence files Astro supplies to vendored Rust crates, and prove none is missing.

Chromium's `gnrt gen` writes a `README.chromium` per vendored crate and refuses
the WHOLE run when one of them has no licence file in its vendor directory.
Thirteen of the crates the adblock dependency pulls in ship none: the text
exists in each project's repository and was left out of the crates.io tarball.

`tools/vendor/rust-licenses.manifest` declares, for each of them, a byte-exact
copy taken from upstream at a pinned commit, and where it goes. This module is
the join between that declaration and the checkout, and it is strict in both
directions so neither side can rot:

  * every `install` must name a declared `source`;
  * every `source` must be used by at least one `install`;
  * every source file's sha256 must match what the manifest recorded;
  * every `install`'s vendor directory must exist, so a crate that has gone
    away — or started shipping its own licence — is reported as a stale record
    to delete rather than silently skipped;
  * and after installing, no non-placeholder vendor directory may be left
    without a licence file.

That last check is the one that catches the NEXT crate rather than the ones
already known, which is why it runs over the whole vendor tree and not just the
manifest. It is deliberately looser than gnrt's own resolution — it accepts any
`LICEN[SC]E*` file, where gnrt wants a name matching the crate's resolved
licence kind — so gnrt stays the authority and this stays a fast, readable
pre-check that cannot pass vacuously.

Usage:
    vendor_licenses.py --manifest FILE --licenses-dir DIR --vendor-dir DIR
                       [--json FILE]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import re
import shutil
import sys

# The gnrt filename convention, loosened: gnrt tries `LICENSE-<Kind>`,
# `LICENSE-<KIND>` and a bare `LICENSE`, each with an optional `.md`/`.txt` and
# a `LICENCE` spelling. Anything starting with either spelling is accepted here.
LICENSE_NAME = re.compile(r"^licen[sc]e", re.IGNORECASE)

# A crate gnrt has REPLACED with an empty stand-in (`tools/crates/gnrt` writes
# these from `removed_Cargo.toml.hbs`). It carries no upstream code, so it needs
# no licence and gnrt never asks for one.
PLACEHOLDER = "is_placeholder = true"


class ManifestError(Exception):
    pass


def sha256(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 16), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_manifest(path: pathlib.Path) -> tuple[dict[str, dict[str, str]], list[dict[str, str]]]:
    sources: dict[str, dict[str, str]] = {}
    installs: list[dict[str, str]] = []

    for number, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        line = raw.split("#", 1)[0].strip()
        if not line:
            continue
        fields = line.split()
        kind = fields[0]
        if kind == "source":
            if len(fields) != 4:
                raise ManifestError(
                    f"{path}:{number}: a source record is "
                    f"'source <path> <sha256> <origin>', got {len(fields)} fields"
                )
            _, source_path, digest, origin = fields
            if source_path in sources:
                raise ManifestError(f"{path}:{number}: source declared twice: {source_path}")
            sources[source_path] = {"sha256": digest, "origin": origin}
        elif kind == "install":
            if len(fields) != 4:
                raise ManifestError(
                    f"{path}:{number}: an install record is "
                    f"'install <vendor-dir> <dest-filename> <source-path>', "
                    f"got {len(fields)} fields"
                )
            _, vendor_dir, dest, source_path = fields
            if "/" in vendor_dir or "/" in dest or ".." in vendor_dir or ".." in dest:
                raise ManifestError(
                    f"{path}:{number}: vendor directory and destination are bare names"
                )
            installs.append({"crate": vendor_dir, "dest": dest, "source": source_path})
        else:
            raise ManifestError(f"{path}:{number}: unknown record type {kind!r}")

    if not sources or not installs:
        raise ManifestError(
            f"{path}: parsed {len(sources)} source and {len(installs)} install records. "
            "An empty manifest would install nothing and report success, which is the "
            "one outcome this file exists to prevent."
        )
    return sources, installs


def crate_needs_license(crate_dir: pathlib.Path) -> bool:
    """True when gnrt will demand a licence file this crate does not have."""
    cargo_toml = crate_dir / "Cargo.toml"
    if not cargo_toml.is_file():
        return False
    if PLACEHOLDER in cargo_toml.read_text(encoding="utf-8", errors="replace"):
        return False
    return not any(LICENSE_NAME.match(entry.name) for entry in crate_dir.iterdir())


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, type=pathlib.Path)
    parser.add_argument("--licenses-dir", required=True, type=pathlib.Path)
    parser.add_argument("--vendor-dir", required=True, type=pathlib.Path)
    parser.add_argument("--json", type=pathlib.Path, help="write the result as JSON")
    args = parser.parse_args(argv)

    try:
        sources, installs = parse_manifest(args.manifest)
    except (ManifestError, OSError) as error:
        print(f"vendor-licenses: {error}", file=sys.stderr)
        return 1

    problems: list[str] = []

    if not args.vendor_dir.is_dir():
        print(
            f"vendor-licenses: no vendor directory at {args.vendor_dir}. "
            "Run `gnrt vendor` before installing licences.",
            file=sys.stderr,
        )
        return 1

    # --- The sources, against the bytes on disk -----------------------------
    for source_path, record in sorted(sources.items()):
        resolved = args.licenses_dir / source_path
        if not resolved.is_file():
            problems.append(
                f"declared source is missing from the repository: {resolved}\n"
                f"    it was taken from {record['origin']}"
            )
            continue
        measured = sha256(resolved)
        if measured != record["sha256"]:
            problems.append(
                f"source {source_path} does not match its declared sha256.\n"
                f"    declared: {record['sha256']}\n"
                f"    measured: {measured}\n"
                f"    origin:   {record['origin']}\n"
                "    A licence text that changed under the declaration is not evidence of "
                "anything. Re-fetch from the origin and record what you measured."
            )

    used = {install["source"] for install in installs}
    for unused in sorted(set(sources) - used):
        problems.append(
            f"source {unused} is declared and no install uses it. "
            "Delete the record, or add the install it was written for."
        )

    # --- The installs, against the checkout ---------------------------------
    installed: list[str] = []
    for install in installs:
        source_path = install["source"]
        if source_path not in sources:
            problems.append(
                f"install for {install['crate']} names an undeclared source: {source_path}"
            )
            continue
        crate_dir = args.vendor_dir / install["crate"]
        if not crate_dir.is_dir():
            problems.append(
                f"install for {install['crate']} names a vendor directory that is not in the "
                "checkout.\n"
                "    Either the dependency graph no longer reaches that crate — delete the "
                "record — or `gnrt vendor` has not run yet."
            )
            continue

        destination = crate_dir / install["dest"]
        source_file = args.licenses_dir / source_path
        if not source_file.is_file():
            continue  # already reported above

        if destination.is_file() and sha256(destination) == sources[source_path]["sha256"]:
            installed.append(f"{install['crate']}/{install['dest']}")
            continue

        existing = [
            entry.name
            for entry in crate_dir.iterdir()
            if LICENSE_NAME.match(entry.name) and entry.name != install["dest"]
        ]
        if existing:
            problems.append(
                f"{install['crate']} now ships its own licence file ({', '.join(sorted(existing))}), "
                "so Astro must not supply one.\n"
                "    Delete this install record; delete its source too if nothing else uses it."
            )
            continue

        shutil.copyfile(source_file, destination)
        installed.append(f"{install['crate']}/{install['dest']}")

    # --- Whatever the manifest did not cover --------------------------------
    #
    # The vacuity floor for this loop is the scanned count: a traversal that
    # found nothing would otherwise report a clean tree.
    scanned = 0
    uncovered: list[str] = []
    for crate_dir in sorted(args.vendor_dir.iterdir()):
        if not crate_dir.is_dir():
            continue
        scanned += 1
        if crate_needs_license(crate_dir):
            uncovered.append(crate_dir.name)

    if scanned == 0:
        problems.append(
            f"scanned 0 crate directories under {args.vendor_dir}. Nothing was measured."
        )

    for crate in uncovered:
        problems.append(
            f"{crate} has no licence file and no record in the manifest.\n"
            "    `gnrt gen` will refuse the whole run over it. Read the crate's `repository`\n"
            "    field, take its licence text from there at a commit you can name, and add a\n"
            "    source and an install to tools/vendor/rust-licenses.manifest. Do not write\n"
            "    the text yourself: a copyright line naming the wrong holder is a false claim."
        )

    result = {
        "scanned_crates": scanned,
        "installed": sorted(installed),
        "uncovered": uncovered,
        "problems": problems,
    }
    if args.json:
        args.json.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")

    if problems:
        print("vendor-licenses: the licence declaration and the checkout disagree.", file=sys.stderr)
        for problem in problems:
            print(f"  * {problem}", file=sys.stderr)
        return 1

    print(
        f"vendor-licenses: {len(installed)} Astro-supplied licence file(s) in place; "
        f"{scanned} vendored crates scanned, none left without one."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
