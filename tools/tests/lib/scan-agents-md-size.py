#!/usr/bin/env python3
"""scan-agents-md-size.py — hold every AGENTS.md in a repository to its budget.

AGENTS.md is prepended to EVERY agent session, so its bytes are paid on every
task forever. This one reached 83 KB / 1,298 lines by accretion: a pipeline
walkthrough or a file inventory appended by the change that produced it, none of
them wrong on its own, none visible except in the sum. That is the shape a gate
catches and a convention does not.

Two rules:

  1. SIZE. The root file is the loaded-everywhere one and gets the larger
     allowance; a nested one is a DELTA on top of it and gets very little,
     because a child needing 8 KB is usually repeating its parent.

  2. PER-ISSUE HEADINGS. A heading naming an issue number (`## Foo (#57)`) is
     per-issue documentation by definition, and per-issue documentation is what
     docs/ is for. This is the mechanism, so naming it directly lets the failure
     say where the material goes rather than only "too big". Issue numbers in
     BODY text are fine and common; only headings fire, and a one-digit `#1` is
     far likelier to be a step number than an issue, so two digits are required.

Bytes, not lines. The widely-repeated "keep it under 150 lines" figure is an
uncited blog claim; the one published measurement (arXiv 2601.20404) reports the
opposite direction — having an AGENTS.md at all reduced tokens and wall-clock.
The justification here is arithmetic rather than a study: the file is prepended
to every session, so its BYTES are what gets paid. A second line-count bound
would be a second representation of one fact that could disagree with the first.

Exit codes, matching the other scanners in this directory:

  0  every AGENTS.md is within budget and carries no per-issue heading
  1  at least one finding, each named with its file and the rule it broke
  2  NOTHING WAS SCANNED — a broken git listing, or a tree with no root
     AGENTS.md at all. Both are failures rather than clean trees: "I found no
     oversized file" and "I read no files" produce the same output otherwise.

Usage:
  scan-agents-md-size.py --repo <dir> [--rev HEAD]
                         [--root-budget N] [--nested-budget N]
                         [--no-issue-headings]
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys

KIB = 1024
DEFAULT_ROOT_BUDGET = 12 * KIB
DEFAULT_NESTED_BUDGET = 8 * KIB

# A heading naming an issue. Two digits minimum: `## Step #1` is a step.
ISSUE_HEADING = re.compile(r"^#{1,6} .*#\d{2,4}\b")


def tracked_agents_files(repo: str, rev: str | None) -> list[str]:
    """Every tracked AGENTS.md, from the index or from a revision."""
    if rev:
        out = subprocess.run(
            ["git", "-C", repo, "ls-tree", "-r", "--name-only", rev],
            capture_output=True, text=True, check=True,
        ).stdout
        paths = [p for p in out.split("\n") if p.endswith("AGENTS.md")]
    else:
        out = subprocess.run(
            ["git", "-C", repo, "ls-files", "-z", "AGENTS.md", "**/AGENTS.md"],
            capture_output=True, text=True, check=True,
        ).stdout
        paths = [p for p in out.split("\0") if p]
    return sorted(paths)


def read(repo: str, rev: str | None, path: str) -> bytes:
    if rev:
        return subprocess.run(
            ["git", "-C", repo, "show", f"{rev}:{path}"],
            capture_output=True, check=True,
        ).stdout
    with open(f"{repo}/{path}", "rb") as handle:
        return handle.read()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", required=True)
    parser.add_argument("--rev", default=None)
    parser.add_argument("--root-budget", type=int, default=DEFAULT_ROOT_BUDGET)
    parser.add_argument("--nested-budget", type=int, default=DEFAULT_NESTED_BUDGET)
    parser.add_argument("--no-issue-headings", action="store_true")
    args = parser.parse_args()

    paths = tracked_agents_files(args.repo, args.rev)

    # The vacuity floors. Both of these are what a broken listing looks like,
    # and both would otherwise render as a clean tree.
    if not paths:
        print("nothing was scanned: no tracked AGENTS.md found", file=sys.stderr)
        return 2
    if "AGENTS.md" not in paths:
        print(
            "nothing was scanned: the root AGENTS.md is absent from the listing",
            file=sys.stderr,
        )
        return 2

    findings: list[str] = []

    for path in paths:
        raw = read(args.repo, args.rev, path)
        budget = args.root_budget if path == "AGENTS.md" else args.nested_budget

        if len(raw) > budget:
            findings.append(
                f"{path}: {len(raw) / KIB:.1f} KB, over its "
                f"{budget / KIB:.0f} KB budget by {(len(raw) - budget) / KIB:.1f} KB. "
                "Compress something in the SAME edit, or move the material to "
                "docs/ and leave a one-line pointer."
            )

        if not args.no_issue_headings:
            for number, line in enumerate(raw.decode("utf-8", "replace").split("\n"), 1):
                if ISSUE_HEADING.match(line):
                    findings.append(
                        f"{path}:{number}: per-issue heading: {line.strip()}\n"
                        "    Per-issue notes go in docs/. AGENTS.md gets the RULE "
                        "and a pointer."
                    )

    print(f"scanned {len(paths)} AGENTS.md file(s): {', '.join(paths)}")

    if findings:
        print("")
        for finding in findings:
            print(f"  - {finding}")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
