#!/usr/bin/env bash
# Two guards against mass or unintended change:
#
#   * an overlay larger than the declared ceiling fails before it reaches
#     Chromium, so an accidental mass copy cannot land;
#   * a Chromium checkout carrying local changes Astro did not write is
#     refused, preserving developer work by default, unless the explicit
#     developer-only override is supplied.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

tmp="$(harness::tmpdir)"
chromium="$tmp/chromium-src"
overlay="$tmp/overlay"
allowlist="$tmp/overlay.allowlist"

harness::make_chromium_fixture "$chromium"
harness::make_overlay_fixture "$overlay" "$allowlist"
mkdir -p "$tmp/patches"

before="$(harness::manifest "$chromium")"

# --- Overlay size ceiling ---------------------------------------------------

harness::run env ASTRO_CHROMIUM_SRC="$chromium" ASTRO_OVERLAY_MAX_FILES=2 \
    "$ASTRO_ROOT/tools/sync-overlay.sh" \
    --source "$overlay" --dest "$chromium" --allowlist "$allowlist" \
    --patches "$tmp/patches"

harness::assert_nonzero_status "overlay over the file-count ceiling"
harness::assert_output_contains "over the declared ceiling" "refusal reason"
harness::assert_tree_unchanged "$chromium" "$before"

# --- Unrelated local changes in the checkout --------------------------------

printf 'developer was working here\n' >> "$chromium/net/net_util.cc"
printf 'a new local file\n' > "$chromium/net/scratch_experiment.cc"

harness::run env ASTRO_CHROMIUM_SRC="$chromium" \
    "$ASTRO_ROOT/tools/sync-overlay.sh" \
    --source "$overlay" --dest "$chromium" --allowlist "$allowlist" \
    --patches "$tmp/patches"

harness::assert_nonzero_status "checkout with unrelated local changes"
harness::assert_output_contains "Astro did not write" "refusal reason"
harness::assert_output_contains "net/net_util.cc" "names the modified file"
harness::assert_output_contains "net/scratch_experiment.cc" "names the untracked file"
harness::assert_output_contains "ASTRO_ALLOW_DIRTY_CHROMIUM=1" "names the override"

# The developer's work is intact: nothing was overwritten or removed.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
grep -q "developer was working here" "$chromium/net/net_util.cc" \
    || harness::fail "developer's local edit was lost"
harness::assert_file_exists "$chromium/net/scratch_experiment.cc"
harness::assert_file_missing "$chromium/chrome/browser/oxy/oxy_auth_service.cc"

# --- The override is real, and scoped ---------------------------------------

harness::run env ASTRO_CHROMIUM_SRC="$chromium" ASTRO_ALLOW_DIRTY_CHROMIUM=1 \
    "$ASTRO_ROOT/tools/sync-overlay.sh" \
    --source "$overlay" --dest "$chromium" --allowlist "$allowlist" \
    --patches "$tmp/patches"

harness::assert_status 0 "explicit developer override"
harness::assert_output_contains "override:dirty-chromium" "structured override warning"
harness::assert_file_exists "$chromium/chrome/browser/oxy/oxy_auth_service.cc"

# Even under the override, nothing is deleted.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
grep -q "developer was working here" "$chromium/net/net_util.cc" \
    || harness::fail "developer's local edit was lost under the override"
harness::assert_file_exists "$chromium/SENTINEL-UPSTREAM.txt"
harness::assert_file_exists "$chromium/third_party/somedep/README.chromium"

harness::pass
