#!/usr/bin/env python3
"""Decide whether a built `chrome` actually contains the Astro overlay.

`tools/package-release.sh` produced `astro-0.1.0-linux-x64.tar.gz` from a binary
with no Oxy Identity, no Alia, no ad blocker and none of the five WebUI
controllers, and said nothing. The only hint was one optional-member warning
(`adblock_resources/ not present`), which is downgraded to a warning by design.
An artefact named after the product but not containing it is the single most
misleading thing this pipeline can emit — see
`docs/astro-next/baseline/findings.md`, finding 1.

The check is a string scan of the binary for the WebUI hosts the overlay
registers. It is deliberately NOT vacuity-blind: a control marker that must be
present in any Chromium binary is scanned for too, and its absence is reported
as `unmeasurable` rather than as `absent`. Without that, a wrong path, a
stripped binary or a broken scan all read as "the overlay is missing", which is
the same answer as the real defect and therefore useless.

Exit status:
    0   overlay present
    1   overlay absent (the binary is Chromium plus the patch base)
    2   the scan could not measure anything — the control marker is missing too

Usage:
    overlay_in_binary.py --binary out/Release/chrome
"""

from __future__ import annotations

import argparse
import pathlib
import re
import sys

# WebUI hosts registered by src/chrome/browser/oxy/webui/. If the overlay is
# compiled in, these are in the binary; if it is not, none of them can be.
OVERLAY_MARKERS = ("astro-ntp", "astro-error", "chrome://alia")

# Present in every Chromium binary ever built. Its absence means the scan is
# not reading what it thinks it is reading.
CONTROL_MARKER = "chrome://version"

# `strings(1)` without the subprocess: same rule (runs of >=4 printable bytes).
PRINTABLE = re.compile(rb"[\x20-\x7e]{4,}")


def scan(binary: pathlib.Path, needles: tuple[str, ...]) -> dict[str, int]:
    wanted = {needle: needle.encode() for needle in needles}
    counts = {needle: 0 for needle in needles}
    overlap = max(len(b) for b in wanted.values())
    tail = b""
    with binary.open("rb") as handle:
        while chunk := handle.read(8 << 20):
            window = tail + chunk
            for run in PRINTABLE.findall(window):
                for needle, raw in wanted.items():
                    counts[needle] += run.count(raw)
            tail = window[-overlap:]
    return counts


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", required=True, type=pathlib.Path)
    args = parser.parse_args(argv[1:])

    if not args.binary.is_file():
        print(f"      no such binary: {args.binary}")
        return 2

    counts = scan(args.binary, OVERLAY_MARKERS + (CONTROL_MARKER,))
    control = counts[CONTROL_MARKER]
    found = {m: counts[m] for m in OVERLAY_MARKERS if counts[m]}

    if not control:
        print(f"      the control marker {CONTROL_MARKER!r} is absent from {args.binary}.")
        print("      Every Chromium binary contains it, so this scan measured nothing —")
        print("      wrong path, unexpected format, or a broken read. Reporting the")
        print("      overlay as absent on this evidence would be a guess.")
        return 2

    if found:
        detail = ", ".join(f"{m} x{n}" for m, n in sorted(found.items()))
        print(f"      Astro overlay present ({detail}).")
        return 0

    print(f"      Astro overlay ABSENT from {args.binary.name}.")
    print(f"      None of {', '.join(OVERLAY_MARKERS)} occur in it, while the control")
    print(f"      marker {CONTROL_MARKER!r} occurs {control} time(s) — so the scan works")
    print("      and the overlay genuinely is not compiled in. This binary is Chromium")
    print("      plus the legacy patch base: no Oxy Identity, no Alia, no ad blocker,")
    print("      none of the five WebUI controllers. See findings.md, finding 1.")
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
