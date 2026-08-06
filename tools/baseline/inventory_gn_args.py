#!/usr/bin/env python3
"""Generate the GN args matrix for the Astro Next baseline (issue #6).

Six GN files describe five platforms. A flag set on four of them and missing on
the fifth is almost always an oversight rather than a decision, but nothing
currently surfaces that — so the difference between "deliberately
platform-specific" and "somebody forgot" is invisible.

This builds the matrix and flags both shapes: a key whose VALUE differs across
platforms, and a key PRESENT on some platforms and absent on others.

The matrix is read from `HEAD` through `committed_state`, never from the working
tree, and the reason is not theoretical. Measured on this repository: the
committed files set `safe_browsing_mode = 0` on all six configurations, while an
uncommitted edit to `gn_args/linux.gn` sets it to `1`. Generated from disk, the
matrix reported `safe_browsing_mode` as a key whose value disagrees between
platforms — an inconsistency that does not exist in the repository, sitting in a
document later issues cite as evidence. Uncommitted GN edits are reported
separately, per key, with both values.

Usage:
    inventory_gn_args.py --json OUT.json --markdown OUT.md
    inventory_gn_args.py --verify
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import committed_state

REPO_ROOT = Path(__file__).resolve().parents[2]
GN_DIR = "gn_args"

ASSIGNMENT = re.compile(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?)\s*$")

# A debug or iteration configuration is expected to differ from release;
# comparing them together would report every deliberate difference as an
# inconsistency and bury the real ones. `linux_dev.gn` exists to trade release
# optimisation for build speed — is_official_build, use_thin_lto and
# is_component_build all differ from release BY DESIGN — so including it would
# manufacture exactly the kind of finding this document was just corrected for.
DEBUG_FILES = {"linux_debug.gn", "linux_dev.gn"}


def parse_gn(text: str) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in text.splitlines():
        stripped = line.split("#", 1)[0].strip()
        if not stripped:
            continue
        match = ASSIGNMENT.match(stripped)
        if match:
            values[match.group(1)] = match.group(2)
    return values


def committed_gn_files() -> list[str]:
    files = committed_state.list_files(GN_DIR, (".gn",))
    if not files:
        raise SystemExit(
            f"ERROR no committed GN args files under {GN_DIR}.\n"
            f"      The matrix is derived from committed content only; GN files that\n"
            f"      exist just in this working tree describe no revision."
        )
    return files


def build() -> dict:
    by_platform = {
        Path(path).stem: parse_gn(committed_state.read_text(path))
        for path in committed_gn_files()
    }
    release = {name: values for name, values in by_platform.items()
               if f"{name}.gn" not in DEBUG_FILES}

    all_keys = sorted({key for values in by_platform.values() for key in values})

    differing_values = []
    partially_set = []
    for key in all_keys:
        present = {name: values[key] for name, values in release.items() if key in values}
        absent = sorted(set(release) - set(present))
        if len(set(present.values())) > 1:
            differing_values.append({"key": key, "values": present})
        if present and absent:
            partially_set.append(
                {"key": key, "set_on": sorted(present), "missing_on": absent}
            )

    return {
        "tool": "tools/baseline/inventory_gn_args.py",
        "platforms": sorted(by_platform),
        "release_platforms": sorted(release),
        "key_count": len(all_keys),
        "args": {name: by_platform[name] for name in sorted(by_platform)},
        "differing_values": differing_values,
        "partially_set": partially_set,
    }


def worktree_key_delta() -> list[dict]:
    """Per-KEY differences between the committed GN files and this working tree.

    The file-level delta says `gn_args/linux.gn` changed. That is not the useful
    statement — this document's findings are per key, so the report has to be
    per key too: which key, on which platform, committed value against
    working-tree value. That is what tells a reader whether an inconsistency in
    the matrix would appear or disappear if the uncommitted work landed.
    """
    delta: list[dict] = []
    for path in committed_gn_files():
        platform = Path(path).stem
        committed = parse_gn(committed_state.read_text(path))
        on_disk = REPO_ROOT / path
        if not on_disk.is_file():
            delta.append(
                {
                    "platform": platform,
                    "key": "*",
                    "committed": "the whole file",
                    "worktree": "deleted",
                }
            )
            continue
        working = parse_gn(on_disk.read_text(encoding="utf-8"))
        for key in sorted(set(committed) | set(working)):
            before, after = committed.get(key), working.get(key)
            if before != after:
                delta.append(
                    {
                        "platform": platform,
                        "key": key,
                        "committed": before if before is not None else "(unset)",
                        "worktree": after if after is not None else "(unset)",
                    }
                )
    return delta


def report_worktree_key_delta(delta: list[dict], stream=sys.stderr) -> None:
    if not delta:
        return
    print(
        f"WORKING-TREE GN DELTA ({len(delta)} key(s)) — NOT part of the baseline.\n"
        f"          These GN args differ between {committed_state.REVISION} and this\n"
        f"          working tree. The matrix above is the committed one; each line here\n"
        f"          is a value that would change in it if the uncommitted work landed:",
        file=stream,
    )
    for entry in delta:
        print(
            "            %-16s %-34s %s -> %s"
            % (entry["platform"], entry["key"], entry["committed"], entry["worktree"]),
            file=stream,
        )


def render_markdown(document: dict) -> str:
    platforms = document["platforms"]
    lines = [
        "<!-- Generated by tools/baseline/inventory_gn_args.py — do not edit by hand.",
        "     Regenerate with: tools/baseline/generate-all.sh -->",
        "",
        "# GN args matrix",
        "",
        f"{document['key_count']} distinct keys across {len(platforms)} configurations.",
        "",
        "`linux_debug` is excluded from the consistency comparison: a debug",
        "configuration is *expected* to differ, and including it would report every",
        "deliberate difference as an inconsistency and bury the real ones.",
        "",
        "## Inconsistencies",
        "",
        f"### Keys set on some release platforms and not others ({len(document['partially_set'])})",
        "",
    ]

    if document["partially_set"]:
        lines += [
            "Each of these is either a deliberate platform difference or an oversight.",
            "Nothing in the repository currently records which — that is the point of",
            "listing them.",
            "",
            "| Key | Set on | Missing on |",
            "|---|---|---|",
        ]
        for item in document["partially_set"]:
            lines.append(
                "| `%s` | %s | %s |"
                % (item["key"], ", ".join(item["set_on"]), ", ".join(item["missing_on"]))
            )
    else:
        lines.append("None.")

    lines += ["", f"### Keys whose value differs across release platforms ({len(document['differing_values'])})", ""]
    if document["differing_values"]:
        lines += ["| Key | Values |", "|---|---|"]
        for item in document["differing_values"]:
            rendered = ", ".join(f"{k} = `{v}`" for k, v in sorted(item["values"].items()))
            lines.append(f"| `{item['key']}` | {rendered} |")
    else:
        lines.append("None.")

    lines += ["", "## Full matrix", "", "| Key | " + " | ".join(platforms) + " |",
              "|---|" + "---|" * len(platforms)]
    for key in sorted({k for values in document["args"].values() for k in values}):
        cells = []
        for platform in platforms:
            value = document["args"][platform].get(key)
            cells.append(f"`{value}`" if value is not None else "—")
        lines.append(f"| `{key}` | " + " | ".join(cells) + " |")
    lines.append("")
    return "\n".join(lines) + "\n"


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json")
    parser.add_argument("--markdown")
    parser.add_argument("--verify", action="store_true")
    args = parser.parse_args(argv[1:])

    committed_state.require_repository()
    document = build()

    # Two reports, both separate from the document: the file-level set
    # difference, and the per-key one this document's findings are made of.
    committed_state.report_working_tree_observations(
        "inventory_gn_args.py", committed_state.working_tree_observations([GN_DIR])
    )
    delta = worktree_key_delta()
    report_worktree_key_delta(delta)
    document["working_tree_key_delta"] = delta

    if args.verify:
        print(
            "gn args: %d keys across %d configurations; "
            "%d partially set, %d differing values; "
            "%d key(s) differ in the working tree"
            % (
                document["key_count"],
                len(document["platforms"]),
                len(document["partially_set"]),
                len(document["differing_values"]),
                len(delta),
            )
        )

    if args.json:
        path = Path(args.json)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8") as handle:
            json.dump(document, handle, indent=2, sort_keys=True)
            handle.write("\n")
        print(f"wrote {path}")

    if args.markdown:
        path = Path(args.markdown)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(render_markdown(document), encoding="utf-8")
        print(f"wrote {path}")

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
