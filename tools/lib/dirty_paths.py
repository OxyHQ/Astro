#!/usr/bin/env python3
"""Every path a git checkout reports as changed — submodule content included.

`git status --porcelain` is the question every "is this checkout pristine"
answer in this repository is built on, and in a gclient-managed Chromium
checkout it cannot answer it. gclient writes

    [diff]
        ignoreSubmodules = dirty

into `chromium/src/.git/config`, so a submodule carrying modified or untracked
content produces NO output line at all. Measured 2026-08-09: a reset that
satisfied both the dirty-checkout guard and `tools/check-upstream-delta.sh`
then died at ungoogled patch 12 of 112, because
`third_party/search_engines_data/resources/definitions/prepopulated_engines.json`
was already patched. Two independent pristine assertions agreeing, both wrong,
over a tree still carrying the previous run's work.

`--ignore-submodules=none` restores the line, but only ONE line per submodule:
the superproject reports `third_party/devtools-frontend/src` as modified and
says nothing about which of its files changed. That is not enough for the
guards that consume this. `astro::require_attributable_chromium` subtracts what
Astro recorded writing — patch target files and pruned files, both spelled
superproject-relative — so a coarse submodule path is unattributable on a tree
the pipeline itself produced, and a submodule-shaped verdict would have to be
either refused (a correct run blocked) or waved through wholesale (the
blindness back, one level up).

So this descends: each dirty submodule is asked the same question, and its
answers are re-rooted onto the superproject. The result is file-level and
already in the vocabulary every declaration in this repository uses, which is
why no list of "submodule paths the series may write" appears anywhere here or
in the guards. The 13 files the series really does write inside submodules are
attributed by the same patch report that attributes the other 3,900.

Usage:
    dirty_paths.py <checkout> [--untracked-only]

Prints one path per line, relative to <checkout>, in git's own order. Exits
non-zero if any git invocation fails: a checkout that cannot be measured is
not a clean one.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

# porcelain=v2 field layout, counted from 0. Only the position of the path
# differs between record types, and each is the LAST field, so the splits below
# are `maxsplit` values rather than indices into a fully split record — a path
# containing spaces must survive, and Chromium has plenty.
#
#   1 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <path>
#   2 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <X><score> <path> NUL <origPath>
#   u <XY> <sub> <m1> <m2> <m3> <mW> <h1> <h2> <h3> <path>
#   ? <path>
_ORDINARY_FIELDS = 8
_RENAMED_FIELDS = 9
_UNMERGED_FIELDS = 10

# Field 2 of a tracked record. `N...` for a plain path; `S<c><m><u>` for a
# gitlink, where each flag is its letter when set and `.` when not:
#   c  the submodule's HEAD differs from the commit the superproject records
#   m  the submodule work tree has modified content
#   u  the submodule work tree has untracked content
_SUBMODULE_PREFIX = "S"


class DirtyPathsError(RuntimeError):
    pass


def _status_records(checkout: Path) -> list[bytes]:
    """Raw NUL-separated porcelain=v2 records for one work tree.

    `--ignore-submodules=none` on the command line overrides the config value
    gclient wrote, and is the entire reason this module exists. It is passed
    explicitly rather than by unsetting the config, because a guard that
    depends on having previously edited the tree it is guarding is not a guard.
    """
    arguments = [
        "git",
        "-C",
        str(checkout),
        "-c",
        "core.quotePath=false",
        "status",
        "--porcelain=v2",
        "-z",
        "--ignore-submodules=none",
        "--untracked-files=all",
    ]
    result = subprocess.run(arguments, capture_output=True)
    if result.returncode != 0:
        raise DirtyPathsError(
            "git status failed (exit {}) in {}: {}".format(
                result.returncode,
                checkout,
                result.stderr.decode("utf-8", "replace").strip(),
            )
        )
    return result.stdout.split(b"\0")


def _decode(raw: bytes) -> str:
    return raw.decode("utf-8", "surrogateescape")


def collect(
    checkout: Path,
    untracked_only: bool = False,
    prefix: str = "",
    seen: set[str] | None = None,
) -> list[str]:
    """Changed paths in `checkout`, re-rooted under `prefix`.

    `seen` carries the resolved work trees already visited. A submodule cannot
    contain its own superproject, so this can only fire on a hand-built tree —
    but a guard that hangs is a guard nobody runs.
    """
    if seen is None:
        seen = set()
    resolved = str(checkout.resolve())
    if resolved in seen:
        return []
    seen.add(resolved)

    paths: list[str] = []
    records = _status_records(checkout)
    index = 0
    while index < len(records):
        record = records[index]
        index += 1
        if not record:
            continue

        kind = record[:1]
        if kind == b"?":
            paths.append(prefix + _decode(record[2:]))
            continue
        if kind == b"!":
            # Only emitted under --ignored, which is never passed. Skipping it
            # rather than treating it as a path keeps that true if it ever is.
            continue
        if kind == b"1":
            fields = record.split(b" ", _ORDINARY_FIELDS)
        elif kind == b"2":
            fields = record.split(b" ", _RENAMED_FIELDS)
        elif kind == b"u":
            fields = record.split(b" ", _UNMERGED_FIELDS)
        else:
            raise DirtyPathsError(
                "unrecognised porcelain=v2 record in {}: {!r}".format(checkout, record)
            )

        submodule_field = _decode(fields[2])
        path = _decode(fields[-1])

        if kind == b"2":
            # The origin path arrives as a bare extra record with no status
            # prefix. It is a path that changed too, and dropping it silently
            # is how a rename hides half of itself.
            if index < len(records) and records[index]:
                if not untracked_only:
                    paths.append(prefix + _decode(records[index]))
                index += 1

        if not submodule_field.startswith(_SUBMODULE_PREFIX):
            if not untracked_only:
                paths.append(prefix + path)
            continue

        commit_changed, modified, untracked = (
            submodule_field[1] != ".",
            submodule_field[2] != ".",
            submodule_field[3] != ".",
        )

        # A moved gitlink is a change to the SUPERPROJECT — no file inside the
        # submodule need differ — so it is reported as the submodule path
        # itself. Nothing else would name it.
        if commit_changed and not untracked_only:
            paths.append(prefix + path)

        descend = untracked if untracked_only else (modified or untracked)
        if descend:
            paths.extend(
                collect(
                    checkout / path,
                    untracked_only=untracked_only,
                    prefix=prefix + path + "/",
                    seen=seen,
                )
            )

    return paths


def main(argv: list[str]) -> int:
    untracked_only = False
    positional: list[str] = []
    for argument in argv:
        if argument == "--untracked-only":
            untracked_only = True
        elif argument.startswith("-"):
            sys.stderr.write("unknown option: {}\n".format(argument))
            return 2
        else:
            positional.append(argument)

    if len(positional) != 1:
        sys.stderr.write(__doc__.split("Usage:", 1)[1].strip() + "\n")
        return 2

    checkout = Path(positional[0])
    if not checkout.is_dir():
        sys.stderr.write("not a directory: {}\n".format(checkout))
        return 2

    try:
        for path in collect(checkout, untracked_only=untracked_only):
            sys.stdout.write(path + "\n")
    except DirtyPathsError as error:
        sys.stderr.write("{}\n".format(error))
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
