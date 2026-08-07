#!/usr/bin/env bash
# A cached self-hosted runner accumulates state: leftover branches, rejected
# patch files, half-reverted edits. None of it is visible in a commit SHA, and
# all of it changes what gets compiled.
#
# The previous CI treated the cache as source-of-truth state — it skipped
# synchronization entirely whenever `chromium/src/.git` existed — so every one
# of these survived indefinitely and silently.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

SYNC="$ASTRO_ROOT/tools/sync-sources.sh"
tmp="$(harness::tmpdir)"

origins="$tmp/origins"
mkdir -p "$origins"
mapfile -t CHROMIUM_SHAS < <(harness::make_source_repo "$origins/chromium" chromium sentinels)
CHROMIUM_TIP="${CHROMIUM_SHAS[2]}"
mapfile -t DEPOT_SHAS < <(harness::make_source_repo "$origins/depot_tools" depot_tools)
mapfile -t UNGOOGLED_SHAS < <(harness::make_source_repo "$origins/ungoogled" ungoogled)

lock="$tmp/browser.lock.json"
cp "$ASTRO_ROOT/browser.lock.schema.json" "$tmp/browser.lock.schema.json"
harness::write_lock "$lock" \
    "file://$origins/chromium" "$CHROMIUM_TIP" \
    "file://$origins/depot_tools" "${DEPOT_SHAS[2]}" \
    "file://$origins/ungoogled" "${UNGOOGLED_SHAS[2]}"

work="$tmp/work"
mkdir -p "$work/chromium"

run_sync() {
    harness::run env ASTRO_CHROMIUM_SRC="$work/chromium/src" \
        "$SYNC" --no-deps --lock "$lock" \
        --chromium-src "$work/chromium/src" \
        --depot-tools "$work/depot_tools" \
        --ungoogled "$work/ungoogled" "$@"
}

run_sync
harness::assert_status 0 "initial sync"

src="$work/chromium/src"

# --- Uncommitted developer work --------------------------------------------

printf 'work in progress\n' > "$src/developer_scratch.cc"
printf 'edited\n' >> "$src/content.txt"

run_sync
harness::assert_nonzero_status "checkout carrying local changes"
harness::assert_output_contains "uncommitted change" "refusal names the state"
harness::assert_output_contains "preserves developer work" "explains the policy"
harness::assert_output_contains "ASTRO_ALLOW_DIRTY_CHROMIUM=1" "names the override"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 2))
grep -q 'work in progress' "$src/developer_scratch.cc" \
    || harness::fail "developer's file was modified"
grep -q 'edited' "$src/content.txt" \
    || harness::fail "developer's edit was discarded"

# The override must NOT apply to --verify-only: a CI gate that can be waved
# through by an environment variable is not a gate.
harness::run env ASTRO_CHROMIUM_SRC="$src" ASTRO_ALLOW_DIRTY_CHROMIUM=1 \
    "$SYNC" --no-deps --verify-only --lock "$lock" \
    --chromium-src "$src" --depot-tools "$work/depot_tools" --ungoogled "$work/ungoogled"
harness::assert_nonzero_status "verify-only must ignore the dirty override"
harness::assert_output_contains "uncommitted change" "still reports the dirty state"

# In default mode the override is honoured.
harness::run env ASTRO_CHROMIUM_SRC="$src" ASTRO_ALLOW_DIRTY_CHROMIUM=1 \
    "$SYNC" --no-deps --lock "$lock" \
    --chromium-src "$src" --depot-tools "$work/depot_tools" --ungoogled "$work/ungoogled"
harness::assert_status 0 "explicit developer override in default mode"
harness::assert_output_contains "override:dirty-chromium" "structured override warning"

rm -f "$src/developer_scratch.cc"
git -C "$src" checkout --quiet -- content.txt

# --- Leftover patch artifacts ------------------------------------------------

printf '***rejected hunk***\n' > "$src/some_file.cc.rej"

run_sync
harness::assert_nonzero_status "checkout carrying a .rej artifact"
harness::assert_output_contains "leftover patch artifacts" "refusal names the artifacts"
harness::assert_output_contains "some_file.cc.rej" "names the artifact"

rm -f "$src/some_file.cc.rej"

# --- Leftover branch ---------------------------------------------------------
#
# The old fetch created `astro-<version>` as a BRANCH. A runner that ran it
# once keeps that branch forever, and a checkout sitting on it is not pinned.

git -C "$src" checkout --quiet -b astro-146.0.7680.177

harness::run env ASTRO_CHROMIUM_SRC="$src" \
    "$SYNC" --no-deps --verify-only --lock "$lock" \
    --chromium-src "$src" --depot-tools "$work/depot_tools" --ungoogled "$work/ungoogled"
harness::assert_nonzero_status "verify-only against a checkout on a branch"
harness::assert_output_contains "not detached" "refusal reason"
harness::assert_output_contains "astro-146.0.7680.177" "names the branch"

# Default mode detaches it.
run_sync
harness::assert_status 0 "default mode detaches a branch checkout"
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 2))
if git -C "$src" symbolic-ref --quiet HEAD >/dev/null; then
    harness::fail "checkout is still on a branch after sync"
fi
[ "$(git -C "$src" rev-parse HEAD)" = "$CHROMIUM_TIP" ] \
    || harness::fail "checkout is not at the locked commit"

# --- --dry-run changes nothing ----------------------------------------------

git -C "$src" checkout --quiet --detach "${CHROMIUM_SHAS[0]}"
before="$(harness::manifest "$src")"

run_sync --dry-run
harness::assert_status 0 "dry run against a wrong-commit checkout"
harness::assert_output_contains "PLAN" "prints the plan"
harness::assert_tree_unchanged "$src" "$before"
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
[ "$(git -C "$src" rev-parse HEAD)" = "${CHROMIUM_SHAS[0]}" ] \
    || harness::fail "dry run moved the checkout"

harness::pass
