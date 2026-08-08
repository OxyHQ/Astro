#!/usr/bin/env bash
# The sync command must produce exactly the revisions the lock declares, and
# `--verify-only` must reject anything else.
#
# This is the check a stale self-hosted runner has to fail. The previous CI did
# `if [ ! -d chromium/src/.git ]; then fetch; else echo "cached, skipping"; fi`,
# so a runner that had ever fetched Chromium compiled whatever commit it
# happened to hold, forever, with nothing validating it.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

SYNC="$ASTRO_ROOT/tools/sync-sources.sh"
tmp="$(harness::tmpdir)"

# --- Fixture origins ---------------------------------------------------------

origins="$tmp/origins"
mkdir -p "$origins"

mapfile -t CHROMIUM_SHAS < <(harness::make_source_repo "$origins/chromium" chromium sentinels)
CHROMIUM_TIP="${CHROMIUM_SHAS[2]}"
CHROMIUM_OLD="${CHROMIUM_SHAS[0]}"

mapfile -t DEPOT_SHAS < <(harness::make_source_repo "$origins/depot_tools" depot_tools)
DEPOT_TIP="${DEPOT_SHAS[2]}"

mapfile -t UNGOOGLED_SHAS < <(harness::make_source_repo "$origins/ungoogled" ungoogled)
UNGOOGLED_TIP="${UNGOOGLED_SHAS[2]}"

lock="$tmp/browser.lock.json"
cp "$ASTRO_ROOT/browser.lock.schema.json" "$tmp/browser.lock.schema.json"
harness::write_lock "$lock" \
    "file://$origins/chromium" "$CHROMIUM_TIP" \
    "file://$origins/depot_tools" "$DEPOT_TIP" \
    "file://$origins/ungoogled" "$UNGOOGLED_TIP"

work="$tmp/work"
mkdir -p "$work/chromium"

run_sync() {
    harness::run env ASTRO_CHROMIUM_SRC="$work/chromium/src" \
        "$SYNC" --no-deps --lock "$lock" \
        --chromium-src "$work/chromium/src" \
        --depot-tools "$work/depot_tools" \
        --ungoogled "$work/ungoogled" "$@"
}

# --- Bootstrap ---------------------------------------------------------------

run_sync
harness::assert_status 0 "bootstrap sync from empty"
harness::assert_output_contains "$CHROMIUM_TIP" "reports the chromium revision"
harness::assert_output_contains "$DEPOT_TIP" "reports the depot_tools revision"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 3))
[ "$(git -C "$work/chromium/src" rev-parse HEAD)" = "$CHROMIUM_TIP" ] \
    || harness::fail "chromium is not at the locked commit"
[ "$(git -C "$work/depot_tools" rev-parse HEAD)" = "$DEPOT_TIP" ] \
    || harness::fail "depot_tools is not at the locked commit"
[ "$(git -C "$work/ungoogled" rev-parse HEAD)" = "$UNGOOGLED_TIP" ] \
    || harness::fail "ungoogled is not at the locked commit"

# The checkout must be DETACHED. A branch can be advanced afterwards and
# nothing would notice; that is how a pinned build silently stops being pinned.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if git -C "$work/chromium/src" symbolic-ref --quiet HEAD >/dev/null; then
    harness::fail "chromium checkout is on a branch, not detached"
fi

# .gclient is rendered from the committed template.
harness::assert_file_exists "$work/chromium/.gclient"
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
grep -q 'managed.*False' "$work/chromium/.gclient" \
    || harness::fail ".gclient does not carry managed = False"

# --- Idempotence -------------------------------------------------------------

run_sync
first="$(cat "$RUN_STDOUT")"
harness::assert_status 0 "second sync"
harness::assert_output_contains "already at $CHROMIUM_TIP" "second run does no work"

run_sync
second="$(cat "$RUN_STDOUT")"
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ "$first" != "$second" ]; then
    printf -- '--- first ---\n%s\n--- second ---\n%s\n' "$first" "$second" >&2
    harness::fail "two consecutive syncs produced different revision output"
fi

# --- --verify-only accepts a correct tree ------------------------------------

run_sync --verify-only
harness::assert_status 0 "verify-only against a correct tree"
harness::assert_output_contains "VERIFY ONLY" "mode banner"

# --- The stale-runner case: wrong commit -------------------------------------

git -C "$work/chromium/src" checkout --quiet --detach "$CHROMIUM_OLD"

run_sync --verify-only
harness::assert_nonzero_status "verify-only against a checkout at the wrong commit"
harness::assert_output_contains "wrong commit" "refusal reason"
harness::assert_output_contains "$CHROMIUM_OLD" "names the commit found"
harness::assert_output_contains "$CHROMIUM_TIP" "names the commit locked"
harness::assert_output_contains "stale self-hosted runner" "explains what it is guarding"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
[ "$(git -C "$work/chromium/src" rev-parse HEAD)" = "$CHROMIUM_OLD" ] \
    || harness::fail "--verify-only modified the checkout"

# Default mode corrects it.
run_sync
harness::assert_status 0 "default mode corrects a wrong commit"
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
[ "$(git -C "$work/chromium/src" rev-parse HEAD)" = "$CHROMIUM_TIP" ] \
    || harness::fail "sync did not correct the checkout"

# --- A moving remote branch cannot change a locked build ---------------------

printf 'upstream moved on\n' > "$origins/chromium/content.txt"
git -C "$origins/chromium" add -A
git -C "$origins/chromium" commit --quiet -m "upstream advances main"
MOVED="$(git -C "$origins/chromium" rev-parse HEAD)"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
[ "$MOVED" != "$CHROMIUM_TIP" ] || harness::fail "premise broken: the branch did not move"

run_sync
harness::assert_status 0 "sync after the remote branch advanced"
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 2))
[ "$(git -C "$work/chromium/src" rev-parse HEAD)" = "$CHROMIUM_TIP" ] \
    || harness::fail "a moving remote branch changed the locked build"
[ "$(git -C "$work/chromium/src" rev-parse HEAD)" != "$MOVED" ] \
    || harness::fail "the checkout followed the remote branch"

harness::pass
