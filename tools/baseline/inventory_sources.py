#!/usr/bin/env python3
"""Generate the source inventory for the Astro Next baseline (issue #6).

Records what the baseline was taken FROM: the locked revisions, and every place
Astro modifies Chromium outside the patch directories.

That second part is the one worth having. The patch stack is at least visible —
168 files in `patches/`, each reviewable. The overlay is not: it is copied over
the Chromium tree at build time, and until #4 introduced `tools/overlay.allowlist`
nothing enumerated what it wrote or whether any of it landed on top of an
upstream file. A baseline that inventories only the patches would miss the
larger half of Astro's delta.

The inventory is taken from `HEAD` through `committed_state`, so the committed
document describes the overlay a fresh clone gets. Overlay files that exist only
in this working tree are the very thing this document is about — a build here
copies them into Chromium and a build from a clean checkout does not — so they
are reported loudly, to stderr and into the JSON report, and kept out of the
committed document.

Usage:
    inventory_sources.py --json OUT.json --markdown OUT.md
    inventory_sources.py --verify
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

import committed_state

REPO_ROOT = Path(__file__).resolve().parents[2]
OVERLAY = "src"
ALLOWLIST = "tools/overlay.allowlist"
LOCK = "browser.lock.json"


def locked_revisions() -> dict:
    if not committed_state.exists(LOCK):
        raise SystemExit(f"ERROR committed lock file not found: {LOCK}")
    lock = json.loads(committed_state.read_text(LOCK))
    revisions = {}
    for name in ("chromium", "depot_tools", "ungoogled_chromium"):
        entry = lock.get(name)
        if entry:
            revisions[name] = {
                "commit": entry["commit"],
                "version": entry.get("version"),
                "url": entry["url"],
            }
    revisions["third_party"] = {
        name: {"pinned": entry.get("pinned", False), "commit": entry.get("commit")}
        for name, entry in lock.get("third_party", {}).items()
    }
    return revisions


def astro_revision() -> dict:
    """Astro's own revision, and whether the tree was clean when taken.

    Recorded here rather than in the lock: a file cannot contain the hash of
    the commit that contains it.
    """
    commit = subprocess.run(
        ["git", "-C", str(REPO_ROOT), "rev-parse", "HEAD"],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    dirty = subprocess.run(
        ["git", "-C", str(REPO_ROOT), "status", "--porcelain", "--untracked-files=no"],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    return {"commit": commit, "worktree": "dirty" if dirty else "clean"}


def parse_allowlist() -> list[dict]:
    entries = []
    if not committed_state.exists(ALLOWLIST):
        return entries
    for number, line in enumerate(
        committed_state.read_text(ALLOWLIST).splitlines(), 1
    ):
        stripped = line.split("#", 1)[0].strip()
        if not stripped:
            continue
        fields = stripped.split()
        entries.append(
            {
                "line": number,
                "kind": fields[0],
                "path": fields[1],
                "attributes": dict(
                    pair.split("=", 1) for pair in fields[2:] if "=" in pair
                ),
            }
        )
    return entries


def overlay_files() -> list[dict]:
    """Every committed overlay file, with the size of its committed blob.

    Sizes come from the object database rather than `stat()`: a tracked file
    edited in the working tree has a different size on disk, and a byte count
    that moves with somebody's unsaved experiment is not a baseline.
    """
    sizes = committed_state.file_sizes(OVERLAY)
    prefix = OVERLAY + "/"
    return [
        {"destination": path[len(prefix):], "bytes": sizes[path]}
        for path in sorted(sizes)
    ]


def build() -> dict:
    entries = parse_allowlist()
    files = overlay_files()
    overwrites = [e for e in entries if e["kind"] == "overwrite"]

    return {
        "tool": "tools/baseline/inventory_sources.py",
        "locked_revisions": locked_revisions(),
        "astro": astro_revision(),
        "overlay": {
            "committed_file_count": len(files),
            "committed_bytes": sum(f["bytes"] for f in files),
            "files": files,
        },
        "declared_destinations": entries,
        "upstream_overwrites": overwrites,
    }


def render_markdown(document: dict) -> str:
    """The COMMITTED document, which must be reproducible from a clean checkout.

    Every figure here is read from `HEAD`. Two things the JSON report carries
    are deliberately left out:

      * Astro's own commit, which changes with every commit, so a committed
        document naming it is stale the moment it lands;
      * the working-tree observations, which are a property of whoever ran the
        generator rather than of the repository.

    Both are real and both are reported — to stderr and into the JSON under
    build/reports/ — but putting either in a committed document would make the
    CI drift check fail for reasons unrelated to the baseline, and a check that
    fails for unrelated reasons is a check somebody deletes.
    """
    lines = [
        "<!-- Generated by tools/baseline/inventory_sources.py — do not edit by hand.",
        "     Regenerate with: tools/baseline/generate-all.sh -->",
        "",
        "# Source inventory",
        "",
        "What this baseline was taken from.",
        "",
        "## Locked revisions",
        "",
        "From `browser.lock.json`. These are declarations, not measurements: the",
        "baseline was not taken from a built tree, because there is none. What a",
        "build was actually made from is recorded separately by",
        "`tools/generate-provenance.sh`.",
        "",
        "| Source | Version | Commit |",
        "|---|---|---|",
    ]

    for name, entry in document["locked_revisions"].items():
        if name == "third_party":
            continue
        lines.append(
            "| `%s` | %s | `%s` |"
            % (name, entry.get("version") or "—", entry["commit"])
        )
    lines += [
        "",
        "Astro's own revision is deliberately not listed here: it changes with",
        "every commit, so a committed document naming it would be stale on",
        "arrival. It is recorded per run in `build/reports/source-inventory.json`",
        "and per build in `build/reports/provenance.json`.",
        "",
    ]

    third_party = document["locked_revisions"].get("third_party", {})
    if third_party:
        lines += ["### Third-party", "", "| Source | Pinned | Commit |", "|---|---|---|"]
        for name, entry in sorted(third_party.items()):
            lines.append(
                "| `%s` | %s | %s |"
                % (name, "yes" if entry["pinned"] else "**no**",
                   f"`{entry['commit']}`" if entry.get("commit") else "—")
            )
        lines.append("")

    overlay = document["overlay"]
    lines += [
        "## Direct edits and copied overlay files outside the patch directories",
        "",
        "The patch stack is visible: 168 files under `patches/`, each reviewable.",
        "The overlay is not — it is copied over the Chromium tree at build time,",
        "and until #4 added `tools/overlay.allowlist` nothing enumerated what it",
        "wrote or whether any of it landed on top of an upstream file. This is the",
        "larger half of Astro's delta.",
        "",
        "| | |",
        "|---|---|",
        "| Overlay files (committed) | %d |" % overlay["committed_file_count"],
        "| Overlay bytes (committed) | %s |" % f"{overlay['committed_bytes']:,}",
        "",
        "Counts and byte sizes are read from committed content, not from the",
        "working tree. A working tree may carry uncommitted overlay files, or",
        "edits to committed ones, that a fresh clone would not have; the generator",
        "reports those to stderr and records them in the JSON under",
        "`build/reports/`, but they are left out here so this document is",
        "reproducible from a clean checkout.",
        "",
        "### Declared destinations",
        "",
        "Every path the overlay is permitted to write, from `tools/overlay.allowlist`.",
        "",
        "| Kind | Destination | Attributes |",
        "|---|---|---|",
    ]
    for entry in document["declared_destinations"]:
        attributes = ", ".join(f"`{k}={v}`" for k, v in entry["attributes"].items()) or "—"
        lines.append("| `%s` | `%s` | %s |" % (entry["kind"], entry["path"], attributes))
    lines.append("")

    overwrites = document["upstream_overwrites"]
    lines += [f"### Whole-file overwrites of Chromium-owned files ({len(overwrites)})", ""]
    if overwrites:
        lines += [
            "Each of these replaces an upstream file wholesale. The epic's definition",
            "of done requires that no source-copy overlay remain, so every one is a",
            "temporary, owned exception with a removal issue.",
            "",
            "| Destination | Owner | Removal issue | Conflicts with |",
            "|---|---|---|---|",
        ]
        for entry in overwrites:
            attributes = entry["attributes"]
            conflicts = attributes.get("conflicts-with", "—").replace(",", ", ")
            lines.append(
                "| `%s` | %s | #%s | %s |"
                % (
                    entry["path"],
                    attributes.get("owner", "—"),
                    attributes.get("issue", "—"),
                    conflicts,
                )
            )
    else:
        lines.append("None.")
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

    # An uncommitted overlay file is copied into Chromium by a build here and
    # absent from a fresh clone, so two people building "the same" revision get
    # different browsers. Worth saying out loud on every run — and worth keeping
    # out of the document, which describes the clean checkout.
    observations = committed_state.working_tree_observations([OVERLAY, ALLOWLIST, LOCK])
    committed_state.report_working_tree_observations(
        "inventory_sources.py", observations
    )
    document["working_tree_observations"] = observations

    if args.verify:
        overlay = document["overlay"]
        print(
            "sources: %d committed overlay file(s), %d working-tree difference(s), "
            "%d declared destination(s), %d upstream overwrite(s)"
            % (
                overlay["committed_file_count"],
                len(observations),
                len(document["declared_destinations"]),
                len(document["upstream_overwrites"]),
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
