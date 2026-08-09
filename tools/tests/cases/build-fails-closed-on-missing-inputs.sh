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
harness::assert_output_contains "all 3 bundles present" "webui bundle check ran"
harness::assert_output_contains "gn gen" "planned generation"
harness::assert_output_contains "gn check" "gn check is a required step"
harness::assert_output_lacks "gn was executed during a dry run" "dry run must not invoke gn"
harness::assert_tree_unchanged "$chromium" "$before"

# --- A missing WebUI bundle stops the build, before generation --------------

rm -rf "${fake_root:?}/webui/whats-new/dist"

run_build

harness::assert_nonzero_status "missing WebUI bundle"
harness::assert_output_contains "Required WebUI bundle missing" "refusal reason"
harness::assert_output_contains "webui/whats-new/dist" "names the missing bundle"
harness::assert_output_contains "would render blank" "explains the consequence"
harness::assert_output_lacks "gn gen" "must fail before build generation"
harness::assert_tree_unchanged "$chromium" "$before"

mkdir -p "$fake_root/webui/whats-new/dist"
printf '<!doctype html>\n' > "$fake_root/webui/whats-new/dist/index.html"

# --- A bundle directory without index.html is equally fatal -----------------

rm -f "$fake_root/webui/ntp/dist/index.html"

run_build

harness::assert_nonzero_status "WebUI bundle without index.html"
harness::assert_output_contains "no index.html" "refusal reason"

printf '<!doctype html>\n' > "$fake_root/webui/ntp/dist/index.html"

# --- The Astro WebUI app's dependencies are a build precondition ------------
#
# The GN action that packs astro_webui_resources.pak runs `bun run build` with
# no network, so it cannot install them. Unchecked, the absence surfaces as a
# Vite resolution error inside a ninja step, minutes to hours into a compile,
# under a stack trace — for a condition that is one `test -d` away here.

rm -rf "${fake_root:?}/webui/app/node_modules"

run_build

harness::assert_nonzero_status "Astro WebUI app dependencies not installed"
harness::assert_output_contains "webui/app/node_modules" "names what is missing"
harness::assert_output_contains "bun install" "names the command that fixes it"
harness::assert_output_lacks "gn gen" "must fail before build generation"
harness::assert_tree_unchanged "$chromium" "$before"

mkdir -p "$fake_root/webui/app/node_modules"

# The manifest is the committed authority for the resource set, and the action
# refuses a build whose output disagrees with it. Absent, there is nothing to
# disagree with.

rm -f "$fake_root/webui/app/manifest.json"

run_build

harness::assert_nonzero_status "Astro WebUI app has no resource manifest"
harness::assert_output_contains "Astro WebUI app resource manifest" "names the missing input"
harness::assert_output_lacks "gn gen" "must fail before build generation"

printf '{"builds":{"app":{"out_dir":"dist/app","entry":"index.html","files":["index.html"]}}}\n' \
    > "$fake_root/webui/app/manifest.json"

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

# The set of gates is READ OUT OF build.sh rather than listed here, and each
# entry carries the very words build.sh will print, because
# astro::require_file's message is "Required <what> not found: <path>". So the
# needle cannot drift from the message, and a gate added to build.sh is
# exercised here the day it is added rather than the day someone remembers.
#
# It also keeps this case layer-following, which a written list cannot be when
# the same file ships across layers: a build.sh with no build-outcome gate
# simply yields no row for it, instead of failing a row that asserts a refusal
# its build.sh never makes. That is not a hypothetical — a hand-written pair of
# rows for those two inputs turned this case red at the earliest layer, where
# neither the verifier nor its detector exists.
gates=0
while IFS=' ' read -r gate_path gate_what; do
    [ -n "$gate_path" ] || continue
    gate_missing_case "$fake_root/tools/$gate_path" "missing $gate_what" "$gate_what"
    gates=$((gates + 1))
done < <(grep -oE 'astro::require_file "[^"]*/tools/[^"]+" "[^"]+"' \
             "$fake_root/tools/build.sh" \
         | sed -E 's|.*/tools/([^"]+)" "([^"]+)"|\1 \2|')

# A derivation that matched nothing would assert nothing while still reaching
# harness::pass with the rest of the case's assertions intact. Every build.sh
# requires at least the GN args drift reporter, the gn check ratchet and the
# committed baseline.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ "$gates" -lt 3 ]; then
    harness::fail "only $gates build gate(s) derived from build.sh; expected at least 3"
fi

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
