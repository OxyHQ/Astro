#!/usr/bin/env python3
"""Ratchet the `gn check` error count against a committed per-platform baseline.

`gn check` is advisory — Chromium's own build does not consume it — and the
inherited ungoogled stack rewrites 68 `BUILD.gn`/`.gni` files, so it reports
include-edge complaints that no Astro change introduced and that cannot
currently be attributed by differencing (see
`docs/astro-next/baseline/findings.md`, findings 7 and 8).

Ignoring them silently is the thing to avoid, so the count is ratcheted and
BOTH directions are fatal:

  * more errors than the baseline is a regression to attribute before the number
    is raised;
  * fewer means the baseline is stale and must be lowered in the same change
    that fixed them — a ratchet that is never lowered stops detecting anything.

A platform with no recorded baseline is a hard failure rather than a pass: an
unmeasured platform must not look like a clean one.

Usage:
    gn_check_baseline.py --baseline FILE --log FILE --platform NAME
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys

ERROR_RE = re.compile(r"^ERROR at //(\S+?):", re.MULTILINE)


def check(baseline_path: pathlib.Path, log_path: pathlib.Path, platform: str) -> int:
    log = log_path.read_text(encoding="utf-8", errors="replace")
    errors = ERROR_RE.findall(log)
    count = len(errors)

    baseline = json.loads(baseline_path.read_text(encoding="utf-8"))
    expected = baseline.get("platforms", {}).get(platform)

    if expected is None:
        print(f"      no gn check baseline recorded for platform {platform!r}.")
        print(f"      Measured {count} error(s). Record it in {baseline_path.name}")
        print("      with the reason, or this build carries an unreviewed number of")
        print("      include violations.")
        return 1

    print(
        f"      {count} error(s) across {len(set(errors))} file(s); "
        f"baseline expects {expected}."
    )
    if count > expected:
        print("      REGRESSION: more include violations than the committed baseline.")
        print("      Attribute the new ones before raising the number.")
        return 1
    if count < expected:
        print("      The baseline is stale — lower it in the change that fixed these.")
        print("      A ratchet that is never lowered stops detecting anything.")
        return 1
    return 0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline", required=True, type=pathlib.Path)
    parser.add_argument("--log", required=True, type=pathlib.Path)
    parser.add_argument("--platform", required=True)
    args = parser.parse_args(argv[1:])
    return check(args.baseline, args.log, args.platform)


if __name__ == "__main__":
    sys.exit(main(sys.argv))
