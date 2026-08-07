#!/usr/bin/env bash
# The overlay step must never delete an upstream file.
#
# This is the regression test for `rsync -av --delete src/ chromium/src/`,
# which removed every file in the Chromium tree the overlay did not provide —
# including the gclient-fetched third_party dependencies that live alongside
# the overlay's destination paths.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

tmp="$(harness::tmpdir)"
chromium="$tmp/chromium-src"
overlay="$tmp/overlay"
allowlist="$tmp/overlay.allowlist"

harness::make_chromium_fixture "$chromium"
harness::make_overlay_fixture "$overlay" "$allowlist"

# Record the exact bytes of every upstream file the overlay does not provide.
sentinel_hash="$(sha256sum "$chromium/SENTINEL-UPSTREAM.txt" | cut -d' ' -f1)"
dep_hash="$(sha256sum "$chromium/third_party/somedep/README.chromium" | cut -d' ' -f1)"
net_hash="$(sha256sum "$chromium/net/net_util.cc" | cut -d' ' -f1)"

mkdir -p "$tmp/patches"   # no patches, so no declared-collision noise

harness::run env ASTRO_CHROMIUM_SRC="$chromium" \
    "$ASTRO_ROOT/tools/sync-overlay.sh" \
    --source "$overlay" --dest "$chromium" --allowlist "$allowlist" \
    --patches "$tmp/patches"

harness::assert_status 0 "overlay sync against a valid checkout"

# Every upstream file still present, byte for byte.
harness::assert_file_exists "$chromium/SENTINEL-UPSTREAM.txt"
harness::assert_file_exists "$chromium/third_party/somedep/README.chromium"
harness::assert_file_exists "$chromium/net/net_util.cc"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 3))
[ "$(sha256sum "$chromium/SENTINEL-UPSTREAM.txt" | cut -d' ' -f1)" = "$sentinel_hash" ] \
    || harness::fail "upstream sentinel was modified"
[ "$(sha256sum "$chromium/third_party/somedep/README.chromium" | cut -d' ' -f1)" = "$dep_hash" ] \
    || harness::fail "gclient dependency was modified"
[ "$(sha256sum "$chromium/net/net_util.cc" | cut -d' ' -f1)" = "$net_hash" ] \
    || harness::fail "unrelated upstream source was modified"

# And the overlay actually landed, so the test is not passing by doing nothing.
harness::assert_file_exists "$chromium/chrome/browser/oxy/oxy_auth_service.cc"
harness::assert_files_identical \
    "$overlay/chrome/browser/oxy/oxy_auth_service.cc" \
    "$chromium/chrome/browser/oxy/oxy_auth_service.cc"
harness::assert_files_identical \
    "$overlay/chrome/app/vector_icons/alia_spark.icon" \
    "$chromium/chrome/app/vector_icons/alia_spark.icon"

harness::pass
