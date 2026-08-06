#!/usr/bin/env bash
# --dry-run must print every planned operation and change nothing at all.

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

harness::run env ASTRO_CHROMIUM_SRC="$chromium" \
    "$ASTRO_ROOT/tools/sync-overlay.sh" --dry-run \
    --source "$overlay" --dest "$chromium" --allowlist "$allowlist" \
    --patches "$tmp/patches"

harness::assert_status 0 "dry run"

# Nothing changed, including files the real run would have created.
harness::assert_tree_unchanged "$chromium" "$before"
harness::assert_file_missing "$chromium/chrome/browser/oxy/oxy_auth_service.cc"
harness::assert_file_missing "$chromium/chrome/app/vector_icons/alia_spark.icon"

# The plan was actually printed, naming each destination and its action.
harness::assert_output_contains "DRY RUN" "mode banner"
harness::assert_output_contains "PLAN" "planned operations"
harness::assert_output_contains "create chrome/browser/oxy/oxy_auth_service.cc" "planned create"
harness::assert_output_contains "chrome/app/vector_icons/alia_spark.icon" "planned icon copy"

# The manifest is planned, not written.
harness::assert_output_contains "write overlay manifest" "planned manifest"
harness::assert_file_missing "$ASTRO_ROOT/build/reports/overlay-manifest.json.dryrun"

harness::pass
