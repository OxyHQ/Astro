#!/usr/bin/env bash
# "Every REQUIRED step that fails causes an immediate non-zero exit", applied
# to the layer that declares source revisions rather than the one that builds
# from them: tools/sync-sources.sh, browser.lock.json and the provenance
# writer, plus build.sh's gate on the lock.
#
# The build pipeline's own required failures — the overlay sync, the patch
# runner, build.sh's required inputs, the baseline capture tools — are the same
# property one layer down and live in required-failures-exit-non-zero.sh. The
# split is not cosmetic: none of the files this case exercises exist at that
# layer, so a single table could not run there at all. The two tables share
# their machinery (harness::register_failure / harness::run_failure_table)
# rather than duplicating it, and each declares its own vacuity floor.
#
# Every row asserts WHY the command failed as well as that it did. A row
# checking only "exit != 0" keeps passing once the script starts failing for
# an unrelated reason — a fixture that was never built, a renamed flag, a typo
# in an argument — and that is precisely how a suite goes green while the
# guarantee underneath it is gone.
#
# Everything runs against synthetic fixtures under the harness temporary
# directory. The real chromium/ checkout is never read and never written.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

tmp="$(harness::tmpdir)"
TOOLS="$ASTRO_ROOT/tools"

# A commit that exists in no fixture, used wherever a lock must name a
# revision the checkout is not on.
ABSENT_COMMIT="0000000000000000000000000000000000000001"

# ==========================================================================
# tools/sync-sources.sh
# ==========================================================================

sync_origins="$tmp/sync-origins"
mkdir -p "$sync_origins"
mapfile -t SYNC_CHROMIUM_SHAS < <(harness::make_source_repo "$sync_origins/chromium" chromium sentinels)
mapfile -t SYNC_DEPOT_SHAS < <(harness::make_source_repo "$sync_origins/depot_tools" depot_tools)
mapfile -t SYNC_UNGOOGLED_SHAS < <(harness::make_source_repo "$sync_origins/ungoogled" ungoogled)
SYNC_CHROMIUM_TIP="${SYNC_CHROMIUM_SHAS[2]}"
SYNC_CHROMIUM_OLD="${SYNC_CHROMIUM_SHAS[0]}"

sync_lock_dir="$tmp/sync-lock"
mkdir -p "$sync_lock_dir"
cp "$ASTRO_ROOT/browser.lock.schema.json" "$sync_lock_dir/"
sync_lock="$sync_lock_dir/browser.lock.json"
harness::write_lock "$sync_lock" \
    "file://$sync_origins/chromium" "$SYNC_CHROMIUM_TIP" \
    "file://$sync_origins/depot_tools" "${SYNC_DEPOT_SHAS[2]}" \
    "file://$sync_origins/ungoogled" "${SYNC_UNGOOGLED_SHAS[2]}"

# Brings a fresh work tree to the locked revisions, so each row below starts
# from a checkout that is correct and then breaks exactly one thing.
bootstrap_work_tree() {
    local work="$1"
    mkdir -p "$work/chromium"
    harness::setup_run env ASTRO_CHROMIUM_SRC="$work/chromium/src" "$TOOLS/sync-sources.sh" \
        --no-deps --lock "$sync_lock" \
        --chromium-src "$work/chromium/src" \
        --depot-tools "$work/depot_tools" \
        --ungoogled "$work/ungoogled"
}

# --- --verify-only against a wrong commit -----------------------------------

sync_wrong="$tmp/sync-wrong"
bootstrap_work_tree "$sync_wrong"
harness::setup_run git -C "$sync_wrong/chromium/src" checkout --quiet --detach "$SYNC_CHROMIUM_OLD"

run_sync_wrong_commit() {
    env ASTRO_CHROMIUM_SRC="$sync_wrong/chromium/src" "$TOOLS/sync-sources.sh" \
        --no-deps --verify-only --lock "$sync_lock" \
        --chromium-src "$sync_wrong/chromium/src" \
        --depot-tools "$sync_wrong/depot_tools" --ungoogled "$sync_wrong/ungoogled"
}

# --- --verify-only against an attached HEAD ---------------------------------
#
# The right commit is not enough: a branch can be advanced afterwards, and
# nothing would notice that the build stopped being pinned.

sync_branch="$tmp/sync-branch"
bootstrap_work_tree "$sync_branch"
harness::setup_run git -C "$sync_branch/chromium/src" checkout --quiet -b astro-146.0.7680.177

run_sync_attached_head() {
    env ASTRO_CHROMIUM_SRC="$sync_branch/chromium/src" "$TOOLS/sync-sources.sh" \
        --no-deps --verify-only --lock "$sync_lock" \
        --chromium-src "$sync_branch/chromium/src" \
        --depot-tools "$sync_branch/depot_tools" --ungoogled "$sync_branch/ungoogled"
}

# --- --verify-only when the checkout is absent ------------------------------

sync_absent="$tmp/sync-absent"
bootstrap_work_tree "$sync_absent"
rm -rf "${sync_absent:?}/chromium/src"

run_sync_absent_checkout() {
    env ASTRO_CHROMIUM_SRC="$sync_absent/chromium/src" "$TOOLS/sync-sources.sh" \
        --no-deps --verify-only --lock "$sync_lock" \
        --chromium-src "$sync_absent/chromium/src" \
        --depot-tools "$sync_absent/depot_tools" --ungoogled "$sync_absent/ungoogled"
}

# --- A lock that fails schema validation ------------------------------------
#
# An abbreviated SHA is the most plausible mistake and the most dangerous: it
# is not a syntax error, and abbreviations stop being unique as a repository
# grows. The lock is validated before anything else looks at it, so no
# checkout has to exist for this row.

sync_bad_lock_dir="$tmp/sync-bad-lock"
mkdir -p "$sync_bad_lock_dir"
cp "$ASTRO_ROOT/browser.lock.schema.json" "$sync_bad_lock_dir/"
sync_bad_lock="$sync_bad_lock_dir/browser.lock.json"
harness::write_lock "$sync_bad_lock" \
    "file://$sync_origins/chromium" "$SYNC_CHROMIUM_TIP" \
    "file://$sync_origins/depot_tools" "${SYNC_DEPOT_SHAS[2]}" \
    "file://$sync_origins/ungoogled" "${SYNC_UNGOOGLED_SHAS[2]}"
harness::setup_run python3 - "$sync_bad_lock" <<'PY'
import json, sys

path = sys.argv[1]
with open(path, encoding="utf-8") as handle:
    document = json.load(handle)
document["chromium"]["commit"] = document["chromium"]["commit"][:7]
with open(path, "w", encoding="utf-8") as handle:
    json.dump(document, handle, indent=2)
    handle.write("\n")
PY

run_sync_invalid_lock() {
    env ASTRO_CHROMIUM_SRC="$tmp/sync-bad-lock-work/chromium/src" "$TOOLS/sync-sources.sh" \
        --no-deps --verify-only --lock "$sync_bad_lock" \
        --chromium-src "$tmp/sync-bad-lock-work/chromium/src" \
        --depot-tools "$tmp/sync-bad-lock-work/depot_tools" \
        --ungoogled "$tmp/sync-bad-lock-work/ungoogled"
}

# --- A non-empty, non-checkout directory at the destination -----------------
#
# The shape this repository was actually found in: chromium/src held only the
# copied overlay. `git clone` into it fails with a message about the directory
# already existing, and the obvious reflex — deleting it — can destroy the only
# copy of something.

sync_occupied="$tmp/sync-occupied"
mkdir -p "$sync_occupied/chromium/src/chrome/browser/oxy"
printf '// the copied overlay, and nothing else\n' \
    > "$sync_occupied/chromium/src/chrome/browser/oxy/oxy_auth_service.cc"

run_sync_occupied_destination() {
    env ASTRO_CHROMIUM_SRC="$sync_occupied/chromium/src" "$TOOLS/sync-sources.sh" \
        --no-deps --lock "$sync_lock" \
        --chromium-src "$sync_occupied/chromium/src" \
        --depot-tools "$sync_occupied/depot_tools" --ungoogled "$sync_occupied/ungoogled"
}

# ==========================================================================
# tools/build.sh — the revision gate
#
# harness::make_locked_build_root supplies the fixture: everything a --dry-run
# requires, plus the gate's own inputs — the script that enforces it, the
# schema it is validated against, the provenance writer the same fixture would
# run on a real build, and the depot_tools/ungoogled checkouts --verify-only
# inspects. build-verifies-locked-revisions.sh, which asserts the gate's
# ordering and its override in depth, builds on the same fixture; this row
# exists so the gate also appears in the one table that enumerates every
# required failure of this layer.
# ==========================================================================

# --- Checkout off the locked revision ---------------------------------------

build_lock_root="$tmp/build-lock-root"
build_lock_chromium="$tmp/build-lock-chromium"
harness::make_locked_build_root "$build_lock_root" "$build_lock_chromium"
harness::write_build_lock "$build_lock_root" "$build_lock_chromium" "$ABSENT_COMMIT"

run_build_off_locked_revision() {
    env ASTRO_CHROMIUM_SRC="$build_lock_chromium" \
        "$build_lock_root/tools/build.sh" Release linux --dry-run
}

# ==========================================================================
# tools/generate-provenance.sh --require-match
# ==========================================================================

provenance_drift="$tmp/provenance-drift"
bootstrap_work_tree "$provenance_drift"
harness::setup_run git -C "$provenance_drift/chromium/src" checkout --quiet --detach "$SYNC_CHROMIUM_OLD"

run_provenance_drifted_revision() {
    env ASTRO_CHROMIUM_SRC="$provenance_drift/chromium/src" "$TOOLS/generate-provenance.sh" \
        --lock "$sync_lock" --output "$tmp/provenance-drift.json" \
        --platform linux --build-type Release --require-match \
        --chromium-src "$provenance_drift/chromium/src" \
        --depot-tools "$provenance_drift/depot_tools" \
        --ungoogled "$provenance_drift/ungoogled"
}

provenance_dirty="$tmp/provenance-dirty"
bootstrap_work_tree "$provenance_dirty"
printf 'local edit\n' >> "$provenance_dirty/chromium/src/content.txt"

run_provenance_dirty_worktree() {
    env ASTRO_CHROMIUM_SRC="$provenance_dirty/chromium/src" "$TOOLS/generate-provenance.sh" \
        --lock "$sync_lock" --output "$tmp/provenance-dirty.json" \
        --platform linux --build-type Release --require-match \
        --chromium-src "$provenance_dirty/chromium/src" \
        --depot-tools "$provenance_dirty/depot_tools" \
        --ungoogled "$provenance_dirty/ungoogled"
}

# ==========================================================================
# THE TABLE
#
# One line per required failure. Every entry names the reason the command must
# give, so the row cannot be satisfied by an unrelated failure.
# ==========================================================================

harness::register_failure "--verify-only against a wrong commit" \
    run_sync_wrong_commit \
    "chromium is at the wrong commit" "$SYNC_CHROMIUM_OLD" "$SYNC_CHROMIUM_TIP" \
    "stale self-hosted runner"
harness::register_failure "--verify-only against an attached HEAD" \
    run_sync_attached_head \
    "not detached" "astro-146.0.7680.177" "can be advanced after the sync"
harness::register_failure "--verify-only when the checkout is absent" \
    run_sync_absent_checkout \
    "chromium is not present at" "--verify-only never creates a checkout"
harness::register_failure "a lock that fails schema validation" \
    run_sync_invalid_lock \
    "does not satisfy browser.lock.schema.json" "abbreviated SHA"
harness::register_failure "a non-empty non-checkout directory at the destination" \
    run_sync_occupied_destination \
    "is not a git checkout, and is not empty" "Nothing is deleted automatically"

harness::register_failure "build against a checkout off the locked revision" \
    run_build_off_locked_revision \
    "chromium is at the wrong commit" "$ABSENT_COMMIT"

# The obvious fragment — "does not correspond to the lock" — is deliberately
# NOT used here. generate-provenance.sh emits its refusal from a python3
# heredoc, so when that program exits non-zero the ERR trap echoes the failing
# command, and the failing command is the program TEXT, which contains the
# refusal sentence as a string literal. The fragment therefore matches on any
# non-zero exit of that block, including a python crash that never reached the
# check. Only the runtime-formatted lines below distinguish the intended
# refusal from an unrelated failure.
harness::register_failure "provenance --require-match against a drifted revision" \
    run_provenance_drifted_revision \
    "DRIFT chromium: locked $SYNC_CHROMIUM_TIP, on disk $SYNC_CHROMIUM_OLD" \
    "command failed (exit 1)"
harness::register_failure "provenance --require-match against a dirty worktree" \
    run_provenance_dirty_worktree \
    "DIRTY chromium has uncommitted changes" "command failed (exit 1)"

# ==========================================================================
# Every required failure exits non-zero, and says why
#
# The floor is this case's own: 8 rows are registered above, and a truncated
# table, a mis-registered row or a broken loop would otherwise report a green
# case having asserted almost nothing.
# ==========================================================================

harness::run_failure_table 8

# ==========================================================================
# The fixtures were not vacuous either
#
# Every row above asserts a REFUSAL, and a refusal is exactly what a broken
# fixture also produces. Two facts separate the two, and neither is implied by
# any row: the lock the rows are pinned against names the tip commit the
# fixture repositories were actually built at, and bootstrap_work_tree really
# did place a checkout at that commit rather than leaving an empty directory
# that every later command would refuse for the wrong reason.
# ==========================================================================

harness::assert_file_exists "$sync_lock"

lock_chromium_commit="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["chromium"]["commit"])' "$sync_lock")"
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ "$lock_chromium_commit" != "$SYNC_CHROMIUM_TIP" ]; then
    harness::fail "the lock names $lock_chromium_commit, not the fixture tip $SYNC_CHROMIUM_TIP; every row above refused against a lock nobody built"
fi

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ "$SYNC_CHROMIUM_OLD" = "$SYNC_CHROMIUM_TIP" ]; then
    harness::fail "the fixture's first and last commits are identical, so the drift rows above cannot distinguish a pinned checkout from a drifted one"
fi

sync_control="$tmp/sync-control"
bootstrap_work_tree "$sync_control"
harness::run env ASTRO_CHROMIUM_SRC="$sync_control/chromium/src" "$TOOLS/sync-sources.sh" \
    --no-deps --verify-only --lock "$sync_lock" \
    --chromium-src "$sync_control/chromium/src" \
    --depot-tools "$sync_control/depot_tools" --ungoogled "$sync_control/ungoogled"
harness::assert_status 0 "control: --verify-only against the checkout the lock describes"

harness::pass
