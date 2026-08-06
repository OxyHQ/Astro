#!/usr/bin/env bash
# An artifact named after the product must contain the product.
#
# tools/package-release.sh produced `astro-0.1.0-linux-x64.tar.gz` from a binary
# with no Oxy Identity, no Alia, no ad blocker and none of the five WebUI
# controllers, reported success, and left it in releases/ beside genuine
# artifacts. The only hint was an optional-member warning about
# `adblock_resources/`, which is a warning by design.
#
# The detector is checked in all THREE directions, because "absent" and "the
# scan measured nothing" are different answers and collapsing them would make a
# wrong path indistinguishable from the real defect.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

DETECTOR="$ASTRO_ROOT/tools/lib/overlay_in_binary.py"
tmp="$(harness::tmpdir)"

harness::assert_file_exists "$DETECTOR"

# --- present -----------------------------------------------------------------
printf 'pad chrome://version pad chrome://alia pad astro-ntp pad astro-error pad' \
    > "$tmp/with-overlay.bin"
harness::run python3 "$DETECTOR" --binary "$tmp/with-overlay.bin"
harness::assert_status 0 "a binary carrying the overlay markers"
harness::assert_output_contains "overlay present" "says so"
harness::assert_output_contains "astro-ntp" "names what it found"

# --- absent, and measurably so ----------------------------------------------
# The control marker is present, so a verdict of "absent" is evidence rather
# than a guess. This is the shape of the real overlayless build.
printf 'pad chrome://version pad chrome://settings pad chrome://history pad' \
    > "$tmp/no-overlay.bin"
harness::run python3 "$DETECTOR" --binary "$tmp/no-overlay.bin"
harness::assert_status 1 "a Chromium binary without the overlay"
harness::assert_output_contains "overlay ABSENT" "says so"
harness::assert_output_contains "control" "cites the control marker as its warrant"

# --- unmeasurable ------------------------------------------------------------
# Neither marker. Without this branch the detector would answer "absent" here,
# which is the same answer as the real defect and therefore worthless.
printf 'nothing relevant in this file at all, four printable chars minimum' \
    > "$tmp/unmeasurable.bin"
harness::run python3 "$DETECTOR" --binary "$tmp/unmeasurable.bin"
harness::assert_status 2 "a binary the scan cannot measure"
harness::assert_output_contains "measured nothing" "distinguishes it from absent"
harness::assert_output_lacks "overlay ABSENT" "must not report absence it cannot support"

harness::run python3 "$DETECTOR" --binary "$tmp/does-not-exist.bin"
harness::assert_status 2 "a binary that is not there"
harness::assert_output_contains "no such binary" "names the problem"

# A marker split across the detector's read boundary must still be found, or the
# verdict depends on where an 8 MiB chunk happens to end — and a real `chrome`
# is 465 MB, so every marker sits near some boundary.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
python3 - "$tmp/boundary.bin" <<'PY'
import sys
# 8 MiB is the detector's chunk size; straddle it with both markers.
chunk = 8 << 20
head = b"chrome://version " + b"x" * (chunk - 25)
sys.argv[1]
with open(sys.argv[1], "wb") as handle:
    handle.write(head + b"astro-ntp" + b"y" * 4096)
PY
harness::run python3 "$DETECTOR" --binary "$tmp/boundary.bin"
harness::assert_status 0 "a marker straddling the read boundary is still found"

# --- the packager consumes it ------------------------------------------------
# Every assertion above tests a tool nothing runs, unless this holds.
packager="$ASTRO_ROOT/tools/package-release.sh"
harness::assert_file_exists "$packager"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
python3 - "$packager" <<'PY' || exit 1
import pathlib, sys

text = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
assert "tools/lib/overlay_in_binary.py" in text, "the packager does not run the detector"
# Refusal is the default; the override must be explicit and must rename.
assert "ASTRO_ALLOW_OVERLAYLESS_PACKAGE" in text, "no explicit override exists"
assert "NO-ASTRO-OVERLAY" in text, "the overridden archive is not renamed"
# Unmeasurable must not be treated as permission to proceed.
assert "Cannot determine whether the overlay is present" in text, \
    "an unmeasurable scan does not stop the packager"
PY

harness::pass
