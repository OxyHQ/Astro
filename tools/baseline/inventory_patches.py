#!/usr/bin/env python3
"""Generate the patch inventory for the Astro Next baseline (issue #6).

Astro Next has to be able to tell an intentional product change from an
accidental regression. That starts with knowing what the 168 patches currently
do, which files they touch, and what is meant to happen to each one.

The inventory is GENERATED, never hand-maintained. A hand-written list of 168
patches is wrong within a week and nobody can tell when it went wrong; a
generated one is regenerated in CI and its diff is reviewable.

The one thing that cannot be generated is the *disposition* — what a patch is
for and whether it is kept, replaced, removed or still to be investigated.
That lives in `patch-dispositions.json` and is JOINED here, and the join is
strict in both directions:

  * a patch on disk with no disposition is an error
  * a disposition naming a patch that does not exist is an error

which is the same series-must-match-directory property the patch runner
enforces (#4), applied to documentation so this inventory cannot rot silently.

Every byte of the committed document is read from `HEAD` through
`committed_state`, never from the working tree, so a clean checkout regenerates
it identically. Uncommitted patch edits are still reported — separately, as
working-tree observations.

Usage:
    inventory_patches.py --json OUT.json --markdown OUT.md
    inventory_patches.py --verify        Check the join; write nothing.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

import committed_state

SERIES = {
    "astro": "patches/astro",
    "ungoogled": "patches/ungoogled",
}
DISPOSITIONS = "docs/astro-next/baseline/patch-dispositions.json"

VALID_DISPOSITIONS = {"keep", "replace", "remove", "investigate"}

TARGET_RE = re.compile(r"^\+\+\+ b/(\S+)", re.MULTILINE)
HUNK_RE = re.compile(r"^@@ ", re.MULTILINE)


def read_series(directory: str) -> list[str]:
    """The declared order. Filesystem order is not a reviewed decision."""
    series_file = f"{directory}/series"
    if not committed_state.exists(series_file):
        raise SystemExit(f"ERROR no committed series file at {series_file}")
    entries = []
    for line in committed_state.read_text(series_file).splitlines():
        line = line.split("#", 1)[0].strip()
        if line:
            entries.append(line)
    return entries


def describe_patch(directory: str, relative: str, order: int) -> dict:
    path = f"{directory}/{relative}"
    if not committed_state.exists(path):
        raise SystemExit(
            f"ERROR series entry has no committed file: {path}\n"
            f"      A patch that exists only in the working tree cannot be applied by\n"
            f"      anyone else, so it is not part of the baseline. Commit it."
        )
    raw = committed_state.read_bytes(path)
    text = raw.decode("utf-8", "replace")
    files = sorted({match.split()[0] for match in TARGET_RE.findall(text)})
    return {
        "order": order,
        "name": Path(relative).name,
        "path": relative,
        "sha256": hashlib.sha256(raw).hexdigest(),
        "files": files,
        "hunks": len(HUNK_RE.findall(text)),
        "lines": text.count("\n"),
    }


def find_overlaps(patches: list[dict]) -> list[dict]:
    """Patches that touch the same file.

    The issue calls these "duplicate or overlapping patches that alter the same
    behavior". Touching one file is not proof two patches conflict, but it is
    the only signal available without running the browser, and every real
    conflict is in this set — so it is reported as a candidate list rather than
    as a verdict.
    """
    by_file: dict[str, list[str]] = {}
    for patch in patches:
        for name in patch["files"]:
            by_file.setdefault(name, []).append(patch["name"])
    return [
        {"file": name, "patches": sorted(names)}
        for name, names in sorted(by_file.items())
        if len(names) > 1
    ]


def load_dispositions(raw: str) -> dict:
    """Parse the dispositions document. The caller decides where the text came from.

    Passed in rather than read here so a test can exercise the join against a
    constructed document without the tool growing a "read this file instead of
    the committed one" switch — which is exactly the escape hatch that let the
    working tree into the baseline in the first place.
    """
    document = json.loads(raw)

    entries: dict[str, dict] = {}
    for name, entry in document.get("patches", {}).items():
        entries[name] = entry
    return {"groups": document.get("groups", {}), "patches": entries}


def resolve_disposition(patch: dict, series: str, dispositions: dict) -> dict:
    """A per-patch entry wins; otherwise the group entry for its directory.

    Group entries exist for the 112 inherited ungoogled patches: writing 112
    individually-reasoned dispositions for patches Astro did not author is
    volume without added confidence, and #8 owns curating them properly. Astro's
    own 56 are all individual.
    """
    entry = dispositions["patches"].get(patch["name"])
    if entry:
        return {**entry, "source": "patch"}

    if series == "astro":
        raise SystemExit(
            f"ERROR no disposition for Astro patch {patch['name']!r}.\n"
            f"      Every Astro patch needs one in {Path(DISPOSITIONS).name}. If its\n"
            f"      purpose is not clear from the patch, record it as\n"
            f"      \"investigate\" with the specific question — a guess is worse\n"
            f"      than a recorded unknown."
        )

    group = str(Path(patch["path"]).parent)
    entry = dispositions["groups"].get(group)
    if not entry:
        raise SystemExit(
            f"ERROR no disposition for {patch['name']!r} and no group entry for {group!r}"
        )
    return {**entry, "source": f"group:{group}"}


def build(verify_only: bool, dispositions_text: str | None = None) -> dict:
    if dispositions_text is None:
        if not committed_state.exists(DISPOSITIONS):
            raise SystemExit(f"ERROR committed dispositions file not found: {DISPOSITIONS}")
        dispositions_text = committed_state.read_text(DISPOSITIONS)
    dispositions = load_dispositions(dispositions_text)
    document: dict = {"tool": "tools/baseline/inventory_patches.py", "series": {}}
    known_names: set[str] = set()

    for series, directory in SERIES.items():
        patches = []
        for order, relative in enumerate(read_series(directory), start=1):
            patch = describe_patch(directory, relative, order)
            patch["disposition"] = resolve_disposition(patch, series, dispositions)
            invalid = patch["disposition"].get("disposition")
            if invalid not in VALID_DISPOSITIONS:
                raise SystemExit(
                    f"ERROR {patch['name']}: disposition {invalid!r} is not one of "
                    f"{sorted(VALID_DISPOSITIONS)}"
                )
            patches.append(patch)
            known_names.add(patch["name"])

        document["series"][series] = {
            "directory": directory,
            "count": len(patches),
            "patches": patches,
            "file_overlaps": find_overlaps(patches),
        }

    # The other direction of the join: a disposition for a patch that no longer
    # exists is stale documentation pointing at nothing.
    orphans = sorted(set(dispositions["patches"]) - known_names)
    if orphans:
        raise SystemExit(
            "ERROR dispositions name patches that do not exist:\n"
            + "\n".join(f"      {name}" for name in orphans)
        )

    document["totals"] = {
        series: data["count"] for series, data in document["series"].items()
    }
    if verify_only:
        print(
            "patch inventory: %s"
            % ", ".join(f"{k} {v}" for k, v in document["totals"].items())
        )
        for series, data in document["series"].items():
            print(f"  {series}: {len(data['file_overlaps'])} file overlap(s)")
    return document


def render_markdown(document: dict) -> str:
    lines = [
        "<!-- Generated by tools/baseline/inventory_patches.py — do not edit by hand.",
        "     Regenerate with: tools/baseline/generate-all.sh -->",
        "",
        "# Patch inventory",
        "",
        "Every patch Astro applies, in the order its `series` file declares, with",
        "what it touches and what is meant to happen to it.",
        "",
        "Dispositions live in `patch-dispositions.json` and are joined in strictly:",
        "a patch with no disposition, or a disposition for a patch that no longer",
        "exists, fails generation. This inventory therefore cannot silently rot.",
        "",
    ]

    for series, data in document["series"].items():
        lines += [
            f"## `{data['directory']}` — {data['count']} patches",
            "",
        ]

        if series == "ungoogled":
            lines += [
                "Dispositions here are assigned per upstream group rather than per",
                "patch. Writing 112 individually-reasoned dispositions for patches",
                "Astro did not author is volume without added confidence; curating",
                "them properly is [#8](https://github.com/OxyHQ/Astro/issues/8).",
                "",
            ]

        lines += ["| # | Patch | Files | Hunks | Disposition | Purpose |", "|---|---|---|---|---|---|"]
        for patch in data["patches"]:
            disposition = patch["disposition"]
            files = "<br>".join(f"`{f}`" for f in patch["files"]) or "—"
            lines.append(
                "| {order} | `{name}` | {files} | {hunks} | **{disposition}** | {purpose} |".format(
                    order=patch["order"],
                    name=patch["name"],
                    files=files,
                    hunks=patch["hunks"],
                    disposition=disposition["disposition"],
                    purpose=disposition.get("purpose", "—"),
                )
            )
        lines.append("")

        overlaps = data["file_overlaps"]
        lines += [f"### Overlapping patches ({len(overlaps)})", ""]
        if overlaps:
            lines += [
                "Files touched by more than one patch. Touching one file is not proof",
                "two patches conflict, but every real conflict is in this set, so it is",
                "a candidate list rather than a verdict.",
                "",
                "| File | Patches |",
                "|---|---|",
            ]
            for overlap in overlaps:
                lines.append(
                    "| `%s` | %s |"
                    % (overlap["file"], ", ".join(f"`{p}`" for p in overlap["patches"]))
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
    document = build(args.verify)

    # Reported, never merged. An edited patch changes what a local build applies
    # and changes nothing about what this document describes, and conflating the
    # two is what made the committed baseline unreproducible.
    observations = committed_state.working_tree_observations(
        [*SERIES.values(), DISPOSITIONS]
    )
    committed_state.report_working_tree_observations(
        "inventory_patches.py", observations
    )
    document["working_tree_observations"] = observations

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
