#!/usr/bin/env python3
"""Report how the GN args a build is about to use differ from the committed ones.

A build reads its args from a file in the WORKING TREE, so a one-character local
edit is indistinguishable from the repository's own configuration unless
something says otherwise. Nothing did, and it cost: an uncommitted
`safe_browsing_mode = 1` in `gn_args/linux.gn` produced a `gn gen` failure that
was nearly published as a defect in upstream ungoogled-chromium. See
`docs/astro-next/baseline/findings.md`, finding 2.

This REPORTS by default and exits 0. Editing GN args locally is ordinary work,
and the epic requires developer local work to be preserved. `--strict` makes any
difference fatal; release and CI builds should pass it.

Usage:
    gn_args_drift.py --repo ROOT --args-file FILE [--strict]
"""

from __future__ import annotations

import argparse
import pathlib
import re
import subprocess
import sys

ASSIGNMENT = re.compile(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?)\s*$")


def parse(text: str) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in text.splitlines():
        stripped = line.split("#", 1)[0].strip()
        if not stripped:
            continue
        match = ASSIGNMENT.match(stripped)
        if match:
            values[match.group(1)] = match.group(2)
    return values


def report(repo: pathlib.Path, args_file: pathlib.Path, strict: bool) -> int:
    """Exit status: 0 unless `strict` and the args are not exactly the committed ones."""
    unversioned = 1 if strict else 0

    try:
        relative = args_file.resolve().relative_to(repo.resolve()).as_posix()
    except ValueError:
        print(f"      args file is outside the repository: {args_file}")
        print("      Nothing to compare it against; its content is not versioned here.")
        return unversioned

    committed = subprocess.run(
        ["git", "-C", str(repo), "show", f"HEAD:{relative}"],
        capture_output=True,
        text=True,
    )
    if committed.returncode != 0:
        print(f"      {relative} is not committed at HEAD.")
        print("      Every key in it is a local decision that no revision records.")
        return unversioned

    before = parse(committed.stdout)
    after = parse(args_file.read_text(encoding="utf-8"))
    delta = [
        (key, before.get(key, "(unset)"), after.get(key, "(unset)"))
        for key in sorted(set(before) | set(after))
        if before.get(key) != after.get(key)
    ]

    if not delta:
        print(f"      {relative} matches HEAD ({len(after)} keys).")
        return 0

    print(f"      {relative} differs from HEAD in {len(delta)} key(s).")
    print("      This build is NOT configured the way the repository is:")
    for key, was, now in delta:
        print(f"        {key:34} HEAD {was}  ->  building with {now}")
    return 1 if strict else 0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", required=True, type=pathlib.Path)
    parser.add_argument("--args-file", required=True, type=pathlib.Path)
    parser.add_argument("--strict", action="store_true")
    args = parser.parse_args(argv[1:])
    return report(args.repo, args.args_file, args.strict)


if __name__ == "__main__":
    sys.exit(main(sys.argv))
