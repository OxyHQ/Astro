#!/usr/bin/env python3
"""scan-settings-routes.py — does Astro's settings page cover Chromium's?

The denominator is measured, never listed: docs/astro-next/baseline/
settings-parity.json is generated from Chromium's own router.ts by
tools/baseline/inventory_settings_parity.py. This tool checks the numerator
against it, and the numerator is the app's own source — no build, no
node_modules, no dev server. That matters more than it sounds: a gate that
needed an install would be skipped on the machine where it was needed.

A route is COVERED when a screen in webui/app/src/pages/settings names it in its
`upstream` list, which is a claim that a user looking for Chromium's screen of
that name finds Astro's. Coverage here is ROUTING, not depth: a screen that
renders a pending state still covers its route, because the fragment resolves,
the rail is honest about it, and the alternative — leaving it out until the
controls are written — is a page that looks finished while most of the browser's
settings are missing from it.

A route that is deliberately NOT covered is declared in
webui/app/settings-route-dispositions.json with a reason and a note. That file is
the one hand-maintained input, so it is checked in BOTH directions: an entry for
a route that does not exist upstream is stale, and an entry for a route the page
DOES cover is a contradiction — one of the two is wrong, and neither may pass.

Claims are read out of STRING LITERALS ONLY, by a scanner that knows where a
string starts and ends. A route name written in a comment — including this
paragraph's worth of prose about, say, PRIVACY_SANDBOX — is not a claim, and
must not read as one.

Exit status:
  0  every upstream route is covered or declared
  1  a route is neither, or the declarations disagree with the source
  2  the scan itself is broken (below a vacuity floor); nothing was measured
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys

ROUTE_NAME = re.compile(r"^[A-Z][A-Z0-9_]*$")
REASON = re.compile(r"^(google-service|oxy-replacement|later-issue-[0-9]+|chromeos-only)$")

SOURCE_SUFFIXES = (".ts", ".tsx")

# Floors. Each answers a different way the scan can measure nothing and look
# clean: no files walked, no literals parsed, or a claim extraction that matched
# none of them. A single count cannot tell those apart.
DEFAULT_MIN_FILES = 20
DEFAULT_MIN_LITERALS = 200
DEFAULT_MIN_CLAIMS = 50


class Claim:
    __slots__ = ("route", "path", "line", "text")

    def __init__(self, route: str, path: str, line: int, text: str) -> None:
        self.route = route
        self.path = path
        self.line = line
        self.text = text

    def where(self) -> str:
        return f"{self.path}:{self.line}: {self.text.strip()}"


def string_literals(source: str) -> list[tuple[str, int, str]]:
    """Every string literal in a TypeScript source, with its line and that line.

    A character scanner rather than a regex, because the question it answers is
    exactly the one a regex cannot: whether a `//` opens a comment or sits inside
    a string, and whether a quote closes a literal or was escaped. Getting that
    wrong in either direction is a silent miscount — a comment read as source
    invents claims, a string read as a comment loses them.
    """
    lines = source.splitlines()
    found: list[tuple[str, int, str]] = []
    index = 0
    line = 1
    length = len(source)

    while index < length:
        char = source[index]

        if char == "\n":
            line += 1
            index += 1
            continue

        if char == "/" and index + 1 < length:
            following = source[index + 1]
            if following == "/":
                while index < length and source[index] != "\n":
                    index += 1
                continue
            if following == "*":
                index += 2
                while index + 1 < length and not (source[index] == "*" and source[index + 1] == "/"):
                    if source[index] == "\n":
                        line += 1
                    index += 1
                index += 2
                continue

        if char in "'\"`":
            quote = char
            start_line = line
            index += 1
            value: list[str] = []
            while index < length:
                current = source[index]
                if current == "\\":
                    index += 2
                    continue
                if current == quote:
                    index += 1
                    break
                if current == "\n":
                    line += 1
                value.append(current)
                index += 1
            found.append(("".join(value), start_line, lines[start_line - 1] if start_line <= len(lines) else ""))
            continue

        index += 1

    return found


def scan(app_dir: str, upstream: set[str]) -> tuple[list[Claim], int, int]:
    claims: list[Claim] = []
    files = 0
    literals = 0

    for root, _dirs, names in os.walk(app_dir):
        for name in sorted(names):
            if not name.endswith(SOURCE_SUFFIXES):
                continue
            path = os.path.join(root, name)
            with open(path, encoding="utf-8") as handle:
                source = handle.read()
            files += 1
            for value, line, text in string_literals(source):
                literals += 1
                if ROUTE_NAME.match(value) and value in upstream:
                    claims.append(Claim(value, os.path.relpath(path, app_dir), line, text))

    return claims, files, literals


def load_dispositions(path: str) -> dict[str, dict[str, str]]:
    with open(path, encoding="utf-8") as handle:
        document = json.load(handle)
    routes = document.get("routes")
    if not isinstance(routes, dict):
        raise SystemExit(
            f"ERROR {path} has no 'routes' object.\n"
            f"      Every declaration lives under that key; without it the file\n"
            f"      declares nothing and every uncovered route would be reported."
        )
    return routes


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline", required=True,
                        help="docs/astro-next/baseline/settings-parity.json")
    parser.add_argument("--app-dir", required=True,
                        help="webui/app/src/pages/settings")
    parser.add_argument("--dispositions", required=True,
                        help="webui/app/settings-route-dispositions.json")
    parser.add_argument("--min-files", type=int, default=DEFAULT_MIN_FILES)
    parser.add_argument("--min-literals", type=int, default=DEFAULT_MIN_LITERALS)
    parser.add_argument("--min-claims", type=int, default=DEFAULT_MIN_CLAIMS)
    args = parser.parse_args()

    with open(args.baseline, encoding="utf-8") as handle:
        baseline = json.load(handle)
    routes = baseline.get("routes")
    if not isinstance(routes, list) or len(routes) < 100:
        print(
            f"ERROR {args.baseline} lists {len(routes) if isinstance(routes, list) else 0} route(s).\n"
            f"      Chromium's settings has 110. The denominator is broken, and a\n"
            f"      coverage check against a broken denominator always passes.",
            file=sys.stderr)
        return 2
    upstream = set(routes)

    if not os.path.isdir(args.app_dir):
        print(f"ERROR no such directory: {args.app_dir}", file=sys.stderr)
        return 2

    claims, files, literals = scan(args.app_dir, upstream)
    claimed: dict[str, list[Claim]] = {}
    for claim in claims:
        claimed.setdefault(claim.route, []).append(claim)

    # --- Vacuity floors ------------------------------------------------------
    if files < args.min_files:
        print(
            f"ERROR the scan walked {files} source file(s) under {args.app_dir},\n"
            f"      below the floor of {args.min_files}. The walk is broken; nothing was\n"
            f"      measured, and 'no uncovered routes' would mean 'no routes read'.",
            file=sys.stderr)
        return 2
    if literals < args.min_literals:
        print(
            f"ERROR the scan parsed {literals} string literal(s), below the floor of\n"
            f"      {args.min_literals}. The literal scanner is broken.",
            file=sys.stderr)
        return 2
    if len(claimed) < args.min_claims:
        print(
            f"ERROR the scan found {len(claimed)} claimed route(s), below the floor of\n"
            f"      {args.min_claims}. Either the registry lost most of its screens or\n"
            f"      the claim extraction stopped matching; both report the same way.",
            file=sys.stderr)
        return 2

    dispositions = load_dispositions(args.dispositions)
    problems: list[str] = []

    # --- The declarations must describe THIS repository ----------------------
    for route in sorted(dispositions):
        entry = dispositions[route]
        if route not in upstream:
            problems.append(
                f"  {route}: declared in {os.path.basename(args.dispositions)} but is not an\n"
                f"    upstream route. Chromium no longer has it, or it is misspelled.")
            continue
        if route in claimed:
            problems.append(
                f"  {route}: declared as NOT covered, and covered anyway by\n"
                f"    {claimed[route][0].where()}\n"
                f"    One of the two is wrong; a stale disposition hides a real screen.")
        reason = entry.get("reason", "") if isinstance(entry, dict) else ""
        if not REASON.match(reason):
            problems.append(
                f"  {route}: reason {reason!r} is not one of google-service,\n"
                f"    oxy-replacement, later-issue-<N>, chromeos-only.")
        note = entry.get("note", "") if isinstance(entry, dict) else ""
        if not isinstance(note, str) or len(note.strip()) < 20:
            problems.append(
                f"  {route}: no note. The note is what tells a later reader whether\n"
                f"    the disposition is still true.")

    # --- Every upstream route is one or the other ----------------------------
    uncovered = sorted(route for route in upstream
                       if route not in claimed and route not in dispositions)
    for route in uncovered:
        problems.append(
            f"  {route}: no screen claims it, and it is not declared in\n"
            f"    {os.path.basename(args.dispositions)}. Either add it to a screen's\n"
            f"    `upstream` list, or declare why Astro does not have it.")

    if problems:
        print(f"Settings parity: {len(problems)} unaccounted route(s).\n", file=sys.stderr)
        for problem in problems:
            print(problem, file=sys.stderr)
        print(
            f"\nMeasured against {args.baseline}\n"
            f"  {len(upstream)} upstream routes, {len(claimed)} covered,"
            f" {len(dispositions)} declared.",
            file=sys.stderr)
        return 1

    print(f"Settings parity is complete: {len(upstream)} upstream route(s), "
          f"{len(claimed)} covered by a screen, {len(dispositions)} declared.")
    print(f"  scanned {files} source file(s), {literals} string literal(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
