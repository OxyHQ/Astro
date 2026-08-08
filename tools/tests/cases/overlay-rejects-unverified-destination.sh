#!/usr/bin/env bash
# The destination must be proven to be a Chromium checkout before a single
# byte is written. Two distinct refusals are covered here.
#
# Case A: the destination is missing Chromium's sentinel files.
# Case B: the destination is not its own git work tree — it sits inside some
#         other repository. This is the exact shape found live in this repo
#         (issue #4): chromium/src held only the copied overlay, so
#         `git -C chromium/src rev-parse --show-toplevel` resolved to the
#         Astro repository, and any git command aimed at the "Chromium
#         checkout" would have operated on the developer's own working tree.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

tmp="$(harness::tmpdir)"
overlay="$tmp/overlay"
allowlist="$tmp/overlay.allowlist"
harness::make_overlay_fixture "$overlay" "$allowlist"
mkdir -p "$tmp/patches"

# --- Case A: no Chromium sentinels ------------------------------------------

not_chromium="$tmp/not-chromium"
mkdir -p "$not_chromium"
git -C "$not_chromium" init --quiet
printf 'irrelevant\n' > "$not_chromium/README.md"
git -C "$not_chromium" add -A
git -C "$not_chromium" commit --quiet -m "not chromium"

before_a="$(harness::manifest "$not_chromium")"

harness::run env ASTRO_CHROMIUM_SRC="$not_chromium" \
    "$ASTRO_ROOT/tools/sync-overlay.sh" \
    --source "$overlay" --dest "$not_chromium" --allowlist "$allowlist" \
    --patches "$tmp/patches"

harness::assert_nonzero_status "destination without Chromium sentinels"
harness::assert_output_contains "does not look like a Chromium source checkout" "refusal reason"
harness::assert_output_contains "chrome/VERSION" "named missing sentinel"
harness::assert_tree_unchanged "$not_chromium" "$before_a"

# --- Case B: destination is inside another repository ------------------------

outer="$tmp/outer-repo"
mkdir -p "$outer"
git -C "$outer" init --quiet
printf 'outer repo work\n' > "$outer/developer-work.txt"
git -C "$outer" add -A
git -C "$outer" commit --quiet -m "outer"

# A directory inside the outer repo that carries every Chromium sentinel but
# is NOT its own work tree. Sentinels alone must not be enough.
nested="$outer/chromium/src"
mkdir -p "$nested/chrome" "$nested/base" "$nested/build/config"
printf 'buildconfig = "//build/config/BUILDCONFIG.gn"\n' > "$nested/.gn"
printf 'MAJOR=146\n' > "$nested/chrome/VERSION"
printf 'group("base") {}\n' > "$nested/base/BUILD.gn"
printf '# BUILDCONFIG\n' > "$nested/build/config/BUILDCONFIG.gn"

before_b="$(harness::manifest "$outer")"

harness::run env ASTRO_CHROMIUM_SRC="$nested" \
    "$ASTRO_ROOT/tools/sync-overlay.sh" \
    --source "$overlay" --dest "$nested" --allowlist "$allowlist" \
    --patches "$tmp/patches"

harness::assert_nonzero_status "destination nested inside another repository"
harness::assert_output_contains "is not its own git work tree" "refusal reason"
harness::assert_output_contains "$outer" "names the enclosing repository"
harness::assert_tree_unchanged "$outer" "$before_b"

harness::pass
