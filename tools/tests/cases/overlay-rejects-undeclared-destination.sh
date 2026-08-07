#!/usr/bin/env bash
# An overlay file whose destination is not declared in the allowlist must be
# refused, and nothing may be written.
#
# The old pipeline copied the whole overlay root at whatever paths happened to
# exist, so a stray file anywhere under src/ landed in the Chromium tree with
# no review and no record.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

tmp="$(harness::tmpdir)"
chromium="$tmp/chromium-src"
overlay="$tmp/overlay"
allowlist="$tmp/overlay.allowlist"

harness::make_chromium_fixture "$chromium"
harness::make_overlay_fixture "$overlay" "$allowlist"
mkdir -p "$tmp/patches"

# A file nobody declared, at a destination Chromium owns.
mkdir -p "$overlay/components/policy"
printf '// undeclared\n' > "$overlay/components/policy/policy_constants.cc"

before="$(harness::manifest "$chromium")"

harness::run env ASTRO_CHROMIUM_SRC="$chromium" \
    "$ASTRO_ROOT/tools/sync-overlay.sh" \
    --source "$overlay" --dest "$chromium" --allowlist "$allowlist" \
    --patches "$tmp/patches"

harness::assert_nonzero_status "undeclared overlay destination"
harness::assert_output_contains "no declared destination" "refusal reason"
harness::assert_output_contains "components/policy/policy_constants.cc" "offending path"

# Validation happens before any copying, so the checkout is untouched.
harness::assert_tree_unchanged "$chromium" "$before"
harness::assert_file_missing "$chromium/components/policy/policy_constants.cc"

harness::pass
