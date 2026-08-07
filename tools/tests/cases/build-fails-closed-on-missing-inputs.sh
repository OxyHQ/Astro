#!/usr/bin/env bash
# Every required build input must be checked before generation, and a missing
# one must stop the build with a non-zero exit.
#
# The old script warned about a missing WebUI bundle and carried on, producing
# a browser whose astro:// page rendered blank, and copied the ad blocker's
# filter lists only "if the directory exists" — without them the Rust engine
# holds no rules and every ShouldBlockRequest() returns false, so the ad
# blocker is a silent no-op in a binary that built and ran perfectly.
#
# Scope is the inputs that exist at this layer: the GN args file, the two build
# gates and their committed baseline, the build tools themselves, the WebUI
# bundles, the ad blocker filter lists, and the overlay sync. build.sh's gate
# on the SOURCE LOCK is a separate layer with its own script and its own lock
# file, and is asserted in build-verifies-locked-revisions.sh — a table mixing
# the two could not run here at all, because none of that machinery exists.
#
# ASTRO_SKIP_LOCK_VERIFY=1 is set on every run for the same reason. Where
# build.sh carries the lock gate it runs before every input check, so without
# the override the fixture — which has no lock, the lock not being part of this
# layer — would fail at the gate and every assertion below would pass for the
# wrong reason. Where build.sh has no such gate the variable is unread, so
# setting it costs nothing.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

tmp="$(harness::tmpdir)"

# A minimal Astro repo layout the build script can be pointed at, so the real
# repository's own webui/ and gn_args/ are never touched by this case. The
# fixture copies the whole tools/lib/ rather than a list of names: a name list
# means every tool added there silently breaks the fixture, and the build then
# fails for a reason that has nothing to do with what is being asserted, which
# is exactly how gn_args_drift.py first surfaced here.
fake_root="$tmp/astro-root"
chromium="$tmp/chromium-src"
harness::make_build_root "$fake_root" "$chromium"

before="$(harness::manifest "$chromium")"

run_build() {
    harness::run env ASTRO_CHROMIUM_SRC="$chromium" ASTRO_SKIP_LOCK_VERIFY=1 \
        "$fake_root/tools/build.sh" Release linux --dry-run
}

# --- Baseline: with every input present, the dry run validates and passes ---
#
# Every refusal below is satisfied by a build.sh that refuses unconditionally.
# This is the control that tells the two apart, so it runs first.

run_build

harness::assert_status 0 "dry run with every required input present"
harness::assert_output_contains "Syncing the Astro overlay" "the overlay sync is a required step"
harness::assert_output_contains "all 5 bundles present" "webui bundle check ran"
harness::assert_output_contains "gn gen" "planned generation"
harness::assert_output_contains "gn check" "gn check is a required step"
harness::assert_output_lacks "gn was executed during a dry run" "dry run must not invoke gn"
harness::assert_tree_unchanged "$chromium" "$before"

# --- A missing WebUI bundle stops the build, before generation --------------

rm -rf "${fake_root:?}/webui/settings/dist"

run_build

harness::assert_nonzero_status "missing WebUI bundle"
harness::assert_output_contains "Required WebUI bundle missing" "refusal reason"
harness::assert_output_contains "webui/settings/dist" "names the missing bundle"
harness::assert_output_contains "would render blank" "explains the consequence"
harness::assert_output_lacks "gn gen" "must fail before build generation"
harness::assert_tree_unchanged "$chromium" "$before"

mkdir -p "$fake_root/webui/settings/dist"
printf '<!doctype html>\n' > "$fake_root/webui/settings/dist/index.html"

# --- A bundle directory without index.html is equally fatal -----------------

rm -f "$fake_root/webui/ntp/dist/index.html"

run_build

harness::assert_nonzero_status "WebUI bundle without index.html"
harness::assert_output_contains "no index.html" "refusal reason"

printf '<!doctype html>\n' > "$fake_root/webui/ntp/dist/index.html"

# --- Missing ad blocker filter lists stop the build -------------------------

rm -rf "${fake_root:?}/src/chrome/browser/oxy/adblock/resources"

run_build

harness::assert_nonzero_status "missing ad blocker filter lists"
harness::assert_output_contains "ad blocker filter lists" "names the missing input"
harness::assert_output_lacks "gn gen" "must fail before build generation"

mkdir -p "$fake_root/src/chrome/browser/oxy/adblock/resources"
printf '! filter list\n' > "$fake_root/src/chrome/browser/oxy/adblock/resources/easylist.txt"

# --- A missing GN args file stops the build ---------------------------------

rm -f "$fake_root/gn_args/linux.gn"

run_build

harness::assert_nonzero_status "missing GN args file"
harness::assert_output_contains "GN args file for linux" "names the missing input"
harness::assert_output_lacks "gn gen" "must fail before build generation"

harness::assert_tree_unchanged "$chromium" "$before"

printf 'is_debug = false\n' > "$fake_root/gn_args/linux.gn"

# --- The two build gates and their committed baseline -----------------------
#
# These are required INPUTS like everything else here, and the reason is
# measured rather than theoretical: the first time gn_args_drift.py was absent
# the build died claiming the GN args violated policy. That is a false report
# about the developer's tree in place of a true one about the toolbox, and it
# is the most expensive kind of error message — it sends someone to look at
# the wrong file. So each one must fail AS a missing file, naming itself.

gate_missing_case() {
    local path="$1" description="$2" needle="$3"
    local stash="$tmp/stashed-gate"

    mkdir -p "$stash"
    mv "$path" "$stash/"

    run_build
    harness::assert_nonzero_status "$description"
    harness::assert_output_contains "$needle" "names the missing gate"
    harness::assert_output_lacks "gn gen" "must fail before build generation"

    mv "$stash/$(basename "$path")" "$path"
}

gate_missing_case "$fake_root/tools/lib/gn_args_drift.py" \
    "missing GN args drift reporter" "GN args drift reporter"
gate_missing_case "$fake_root/tools/lib/gn_check_baseline.py" \
    "missing gn check ratchet" "gn check ratchet"
gate_missing_case "$fake_root/tools/gn-check-baseline.json" \
    "missing committed gn check baseline" "committed gn check baseline"

# Restoring them has to be verified, or every assertion after this point could
# be passing for a reason that was introduced here rather than by the case.
run_build
harness::assert_status 0 "the gates were restored intact"

# --- The build tools themselves ---------------------------------------------
#
# depot_tools supplies gn and autoninja. build.sh prepends its own depot_tools
# to PATH, so removing the fixture's copies is only half the test: PATH is
# pinned as well, otherwise a machine with depot_tools installed globally
# resolves them anyway and the row reports a failure that is a property of the
# operator's machine rather than of build.sh.

rm -f "$fake_root/depot_tools/gn" "$fake_root/depot_tools/autoninja"

# The precondition is asserted, not assumed. A row that cannot fire must say
# so rather than quietly report whatever it finds.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if PATH="/usr/bin:/bin" command -v gn > /dev/null; then
    harness::fail "gn resolves from /usr/bin:/bin on this machine, so removing the fixture's copy cannot exercise the build-tools requirement; the row below would be inconclusive"
fi

harness::run env ASTRO_CHROMIUM_SRC="$chromium" ASTRO_SKIP_LOCK_VERIFY=1 \
    PATH="/usr/bin:/bin" "$fake_root/tools/build.sh" Release linux --dry-run

harness::assert_nonzero_status "missing build tools"
harness::assert_output_contains "Required command not found: gn" "names the missing tool"
harness::assert_output_lacks "gn gen" "must fail before build generation"

harness::assert_tree_unchanged "$chromium" "$before"

harness::pass
