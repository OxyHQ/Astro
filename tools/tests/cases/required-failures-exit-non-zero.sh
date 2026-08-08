#!/usr/bin/env bash
# The two properties the Astro Next epic (#3) demands, and issue #4 lists as
# acceptance criteria:
#
#   1. every REQUIRED step that fails causes an immediate non-zero exit;
#   2. the modified-tree summary is visible in the logs before generation.
#
# The other cases prove these one script at a time, which leaves "is every
# required failure actually covered?" answerable only by reading all of them.
# This case answers it in one place: a table enumerating the required failure
# modes of every mutating script in the build pipeline — the overlay sync, the
# patch runner and build.sh's required inputs — so adding a guard is one line
# and a guard that quietly stops failing cannot hide between cases.
#
# The same property holds one and two layers up, and is asserted where the
# tooling it describes actually exists, because a table mixing layers could not
# run at the earliest of them at all:
#
#   * lock-failures-exit-non-zero.sh — the source lock, the script that
#     enforces it and the provenance writer.
#   * baseline-harness-fails-closed.sh — the baseline smoke and network-capture
#     harnesses, whose refusals are asserted beside the stub-driven controls
#     that prove they do not simply refuse unconditionally.
#
# The tables share their machinery (harness::register_failure /
# harness::run_failure_table) rather than duplicating it.
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

# ==========================================================================
# tools/sync-overlay.sh
# ==========================================================================

# An empty patch tree: the overlay scans it for patch/overlay collisions, and
# pointing it at the repository's real patches/ would make every row read a
# thousand files it has no business reading.
patches_none="$tmp/patches-none"
mkdir -p "$patches_none"

overlay_src="$tmp/overlay"
overlay_allow="$tmp/overlay.allowlist"
harness::make_overlay_fixture "$overlay_src" "$overlay_allow"

# --- Destination is not a Chromium checkout ---------------------------------

overlay_bare="$tmp/overlay-dest-bare"
mkdir -p "$overlay_bare"
harness::setup_run git -C "$overlay_bare" init --quiet

run_overlay_unverified_destination() {
    env ASTRO_CHROMIUM_SRC="$overlay_bare" "$TOOLS/sync-overlay.sh" \
        --source "$overlay_src" --dest "$overlay_bare" \
        --allowlist "$overlay_allow" --patches "$patches_none"
}

# --- Destination is not its own git work tree -------------------------------
#
# The exact shape this repository was found in: chromium/src held only the
# copied overlay, so every git command aimed at the "Chromium checkout"
# operated on the Astro repository instead.

overlay_outer="$tmp/overlay-outer"
overlay_nested="$overlay_outer/chromium/src"
mkdir -p "$overlay_nested/chrome" "$overlay_nested/base" "$overlay_nested/build/config"
printf 'buildconfig = "//build/config/BUILDCONFIG.gn"\n' > "$overlay_nested/.gn"
printf 'MAJOR=146\n' > "$overlay_nested/chrome/VERSION"
printf 'group("base") {}\n' > "$overlay_nested/base/BUILD.gn"
printf '# BUILDCONFIG\n' > "$overlay_nested/build/config/BUILDCONFIG.gn"
harness::setup_run git -C "$overlay_outer" init --quiet

run_overlay_nested_destination() {
    env ASTRO_CHROMIUM_SRC="$overlay_nested" "$TOOLS/sync-overlay.sh" \
        --source "$overlay_src" --dest "$overlay_nested" \
        --allowlist "$overlay_allow" --patches "$patches_none"
}

# --- Overlay file with no declared destination ------------------------------

overlay_undeclared_chromium="$tmp/overlay-undeclared-chromium"
harness::make_chromium_fixture "$overlay_undeclared_chromium"
overlay_undeclared_src="$tmp/overlay-undeclared"
overlay_undeclared_allow="$tmp/overlay-undeclared.allowlist"
harness::make_overlay_fixture "$overlay_undeclared_src" "$overlay_undeclared_allow"
mkdir -p "$overlay_undeclared_src/components/policy"
printf '// undeclared\n' > "$overlay_undeclared_src/components/policy/policy_constants.cc"

run_overlay_undeclared_destination() {
    env ASTRO_CHROMIUM_SRC="$overlay_undeclared_chromium" "$TOOLS/sync-overlay.sh" \
        --source "$overlay_undeclared_src" --dest "$overlay_undeclared_chromium" \
        --allowlist "$overlay_undeclared_allow" --patches "$patches_none"
}

# --- Undeclared overwrite of a tracked upstream file ------------------------

overlay_overwrite_chromium="$tmp/overlay-overwrite-chromium"
harness::make_chromium_fixture "$overlay_overwrite_chromium"
overlay_overwrite_src="$tmp/overlay-overwrite"
mkdir -p "$overlay_overwrite_src/net"
printf '// astro replacement for an upstream file\n' > "$overlay_overwrite_src/net/net_util.cc"
overlay_overwrite_allow="$tmp/overlay-overwrite.allowlist"
printf 'dir net\n' > "$overlay_overwrite_allow"

run_overlay_undeclared_overwrite() {
    env ASTRO_CHROMIUM_SRC="$overlay_overwrite_chromium" "$TOOLS/sync-overlay.sh" \
        --source "$overlay_overwrite_src" --dest "$overlay_overwrite_chromium" \
        --allowlist "$overlay_overwrite_allow" --patches "$patches_none"
}

# --- Overlay above the declared file-count ceiling --------------------------

overlay_ceiling_chromium="$tmp/overlay-ceiling-chromium"
harness::make_chromium_fixture "$overlay_ceiling_chromium"

run_overlay_over_ceiling() {
    env ASTRO_CHROMIUM_SRC="$overlay_ceiling_chromium" ASTRO_OVERLAY_MAX_FILES=2 \
        "$TOOLS/sync-overlay.sh" \
        --source "$overlay_src" --dest "$overlay_ceiling_chromium" \
        --allowlist "$overlay_allow" --patches "$patches_none"
}

# --- Checkout carrying unrelated developer work -----------------------------

overlay_dirty_chromium="$tmp/overlay-dirty-chromium"
harness::make_chromium_fixture "$overlay_dirty_chromium"
printf 'developer was working here\n' >> "$overlay_dirty_chromium/net/net_util.cc"

run_overlay_dirty_checkout() {
    env ASTRO_CHROMIUM_SRC="$overlay_dirty_chromium" "$TOOLS/sync-overlay.sh" \
        --source "$overlay_src" --dest "$overlay_dirty_chromium" \
        --allowlist "$overlay_allow" --patches "$patches_none"
}

# ==========================================================================
# tools/apply-patches.sh
# ==========================================================================

# A Chromium fixture whose net/net_util.cc has known content, committed, so a
# patch either applies to it exactly or does not.
make_patch_base() {
    local dir="$1"
    harness::make_chromium_fixture "$dir"
    printf 'alpha\n' > "$dir/net/net_util.cc"
    harness::setup_run git -C "$dir" add -A
    harness::setup_run git -C "$dir" commit --quiet -m "patch base"
}

# --- A patch that does not apply exactly ------------------------------------

patch_noapply_src="$tmp/patch-noapply-src"
make_patch_base "$patch_noapply_src"
patch_noapply_dir="$tmp/patch-noapply"
mkdir -p "$patch_noapply_dir"
harness::write_patch "$patch_noapply_dir/001-context-drifted.patch" \
    "net/net_util.cc" "zulu" "yankee"
printf '001-context-drifted.patch\n' > "$patch_noapply_dir/series"

run_patch_does_not_apply() {
    env ASTRO_CHROMIUM_SRC="$patch_noapply_src" \
        ASTRO_PATCH_REPORT="$tmp/patch-noapply-report.json" \
        "$TOOLS/apply-patches.sh" astro --dest "$patch_noapply_src" \
        --astro-patches "$patch_noapply_dir"
}

# --- A series entry with no file behind it ----------------------------------

patch_missing_src="$tmp/patch-missing-src"
make_patch_base "$patch_missing_src"
patch_missing_dir="$tmp/patch-missing"
mkdir -p "$patch_missing_dir"
harness::write_patch "$patch_missing_dir/001-a.patch" "net/net_util.cc" "alpha" "bravo"
printf '001-a.patch\n099-vanished.patch\n' > "$patch_missing_dir/series"

run_patch_series_entry_missing() {
    env ASTRO_CHROMIUM_SRC="$patch_missing_src" \
        ASTRO_PATCH_REPORT="$tmp/patch-missing-report.json" \
        "$TOOLS/apply-patches.sh" astro --dest "$patch_missing_src" \
        --astro-patches "$patch_missing_dir"
}

# --- A patch on disk the series does not declare ----------------------------

patch_extra_src="$tmp/patch-extra-src"
make_patch_base "$patch_extra_src"
patch_extra_dir="$tmp/patch-extra"
mkdir -p "$patch_extra_dir"
harness::write_patch "$patch_extra_dir/001-a.patch" "net/net_util.cc" "alpha" "bravo"
harness::write_patch "$patch_extra_dir/002-undeclared.patch" "net/net_util.cc" "bravo" "charlie"
printf '001-a.patch\n' > "$patch_extra_dir/series"

run_patch_undeclared_on_disk() {
    env ASTRO_CHROMIUM_SRC="$patch_extra_src" \
        ASTRO_PATCH_REPORT="$tmp/patch-extra-report.json" \
        "$TOOLS/apply-patches.sh" astro --dest "$patch_extra_src" \
        --astro-patches "$patch_extra_dir"
}

# --- A .rej artifact left in the checkout -----------------------------------
#
# UNTRACKED, which is what a real .rej is and what the check keys on: Chromium
# tracks 181 `.orig` files of its own (cargo writes Cargo.toml.orig for every
# vendored crate), so a check that condemned tracked artifacts would condemn a
# pristine upstream checkout.
#
# The pristine guard fires on the same file first — that is the row below —
# so this row carries the developer override, which is what lets execution
# reach the post-application artifact scan this row is actually about. The two
# checks are asserted separately rather than one being assumed to cover both.

patch_artifact_src="$tmp/patch-artifact-src"
make_patch_base "$patch_artifact_src"
printf '***rejected hunk***\n' > "$patch_artifact_src/net/net_util.cc.rej"
patch_artifact_dir="$tmp/patch-artifact"
mkdir -p "$patch_artifact_dir"
harness::write_patch "$patch_artifact_dir/001-a.patch" "net/net_util.cc" "alpha" "bravo"
printf '001-a.patch\n' > "$patch_artifact_dir/series"

run_patch_artifact_present() {
    env ASTRO_CHROMIUM_SRC="$patch_artifact_src" \
        ASTRO_PATCH_REPORT="$tmp/patch-artifact-report.json" \
        ASTRO_ALLOW_DIRTY_CHROMIUM=1 \
        "$TOOLS/apply-patches.sh" astro --dest "$patch_artifact_src" \
        --astro-patches "$patch_artifact_dir"
}

# --- A non-pristine checkout ------------------------------------------------

patch_dirty_src="$tmp/patch-dirty-src"
make_patch_base "$patch_dirty_src"
printf 'work in progress\n' > "$patch_dirty_src/net/developer_scratch.cc"
patch_dirty_dir="$tmp/patch-dirty"
mkdir -p "$patch_dirty_dir"
harness::write_patch "$patch_dirty_dir/001-a.patch" "net/net_util.cc" "alpha" "bravo"
printf '001-a.patch\n' > "$patch_dirty_dir/series"

run_patch_dirty_checkout() {
    env ASTRO_CHROMIUM_SRC="$patch_dirty_src" \
        ASTRO_PATCH_REPORT="$tmp/patch-dirty-report.json" \
        "$TOOLS/apply-patches.sh" astro --dest "$patch_dirty_src" \
        --astro-patches "$patch_dirty_dir"
}

# --- Domain substitution without --skip-domain-substitution -----------------
#
# The step is declared broken rather than hidden: every previous build reported
# success while substituting nothing. The list contents are irrelevant because
# the refusal happens before either file is read; they exist only because the
# step requires them to be present.

patch_domains_src="$tmp/patch-domains-src"
make_patch_base "$patch_domains_src"
patch_domains_dir="$tmp/patch-domains"
mkdir -p "$patch_domains_dir"
printf 'placeholder regex list\n' > "$patch_domains_dir/domain_regex.list"
printf 'placeholder substitution list\n' > "$patch_domains_dir/domain_substitution.list"

run_patch_domain_substitution() {
    env ASTRO_CHROMIUM_SRC="$patch_domains_src" \
        ASTRO_PATCH_REPORT="$tmp/patch-domains-report.json" \
        "$TOOLS/apply-patches.sh" domains --dest "$patch_domains_src" \
        --ungoogled-patches "$patch_domains_dir"
}

# ==========================================================================
# tools/build.sh
#
# Each row gets its own miniature Astro repository, so the real webui/ and
# gn_args/ are never touched and no row can depend on another's damage.
#
# ASTRO_SKIP_LOCK_VERIFY=1 keeps these rows about the required INPUT that was
# removed. build.sh's revision gate runs before every input check, so without
# the override the fixture — which carries no lock, because the lock is not
# part of this layer — would fail at the gate and every row below would pass
# for the wrong reason. The gate has its own rows in
# lock-failures-exit-non-zero.sh. Where build.sh has no such gate the variable
# is simply unread, so setting it costs nothing.
# ==========================================================================

# --- Missing GN args --------------------------------------------------------

build_gn_root="$tmp/build-gn-root"
build_gn_chromium="$tmp/build-gn-chromium"
harness::make_build_root "$build_gn_root" "$build_gn_chromium"
rm -f "$build_gn_root/gn_args/linux.gn"

run_build_missing_gn_args() {
    env ASTRO_CHROMIUM_SRC="$build_gn_chromium" ASTRO_SKIP_LOCK_VERIFY=1 \
        "$build_gn_root/tools/build.sh" Release linux --dry-run
}

# --- Missing WebUI bundle ---------------------------------------------------

build_webui_root="$tmp/build-webui-root"
build_webui_chromium="$tmp/build-webui-chromium"
harness::make_build_root "$build_webui_root" "$build_webui_chromium"
rm -rf "${build_webui_root:?}/webui/whats-new/dist"

run_build_missing_webui_bundle() {
    env ASTRO_CHROMIUM_SRC="$build_webui_chromium" ASTRO_SKIP_LOCK_VERIFY=1 \
        "$build_webui_root/tools/build.sh" Release linux --dry-run
}

# --- Missing ad blocker filter lists ----------------------------------------
#
# Without them the Rust engine holds no rules and ShouldBlockRequest() always
# returns false: a shipped ad blocker that is a silent no-op.

build_adblock_root="$tmp/build-adblock-root"
build_adblock_chromium="$tmp/build-adblock-chromium"
harness::make_build_root "$build_adblock_root" "$build_adblock_chromium"
rm -rf "${build_adblock_root:?}/src/chrome/browser/oxy/adblock/resources"

run_build_missing_adblock_resources() {
    env ASTRO_CHROMIUM_SRC="$build_adblock_chromium" ASTRO_SKIP_LOCK_VERIFY=1 \
        "$build_adblock_root/tools/build.sh" Release linux --dry-run
}

# --- Missing build outcome gate ---------------------------------------------
#
# Without it the compile's status is whatever the caller reports, and the
# caller is the thing under suspicion: a wrapper exiting 0 around a failed
# build is the defect this gate exists for. A build.sh that skipped it would
# report success on precisely the evidence already shown to be worthless.

build_outcome_root="$tmp/build-outcome-root"
build_outcome_chromium="$tmp/build-outcome-chromium"
harness::make_build_root "$build_outcome_root" "$build_outcome_chromium"
rm -f "$build_outcome_root/tools/lib/build_outcome.py"

run_build_missing_outcome_detector() {
    env ASTRO_CHROMIUM_SRC="$build_outcome_chromium" ASTRO_SKIP_LOCK_VERIFY=1 \
        "$build_outcome_root/tools/build.sh" Release linux --dry-run
}

build_verifier_root="$tmp/build-verifier-root"
build_verifier_chromium="$tmp/build-verifier-chromium"
harness::make_build_root "$build_verifier_root" "$build_verifier_chromium"
rm -f "$build_verifier_root/tools/verify-build-outcome.sh"

run_build_missing_outcome_verifier() {
    env ASTRO_CHROMIUM_SRC="$build_verifier_chromium" ASTRO_SKIP_LOCK_VERIFY=1 \
        "$build_verifier_root/tools/build.sh" Release linux --dry-run
}

# ==========================================================================
# THE TABLE
#
# One line per required failure. Every entry names the reason the command must
# give, so the row cannot be satisfied by an unrelated failure.
# ==========================================================================

harness::register_failure "overlay destination is not a Chromium checkout" \
    run_overlay_unverified_destination \
    "does not look like a Chromium source checkout" "chrome/VERSION"
harness::register_failure "overlay destination is not its own git work tree" \
    run_overlay_nested_destination \
    "is not its own git work tree" "including any destructive one"
harness::register_failure "overlay file with no declared destination" \
    run_overlay_undeclared_destination \
    "no declared destination" "components/policy/policy_constants.cc"
harness::register_failure "undeclared overwrite of a tracked upstream file" \
    run_overlay_undeclared_overwrite \
    "would overwrite a Chromium-tracked file" "net/net_util.cc"
harness::register_failure "overlay above ASTRO_OVERLAY_MAX_FILES" \
    run_overlay_over_ceiling \
    "over the declared ceiling of 2"
harness::register_failure "overlay against a checkout carrying unrelated work" \
    run_overlay_dirty_checkout \
    "Astro did not write" "net/net_util.cc" "ASTRO_ALLOW_DIRTY_CHROMIUM=1"

harness::register_failure "a patch that does not apply exactly" \
    run_patch_does_not_apply \
    "does not apply exactly" "001-context-drifted.patch" "no three-way merge"
harness::register_failure "a series entry with no patch file" \
    run_patch_series_entry_missing \
    "series lists patches that do not exist" "099-vanished.patch" \
    "Refusing to apply a partial stack"
harness::register_failure "a patch on disk absent from the series" \
    run_patch_undeclared_on_disk \
    "series does not declare" "002-undeclared.patch" \
    "not a property of the filesystem"
harness::register_failure "a .rej artifact in the checkout" \
    run_patch_artifact_present \
    "Patch artifacts found" "net_util.cc.rej" "applied partially"
harness::register_failure "patching a non-pristine checkout" \
    run_patch_dirty_checkout \
    "must be pristine" "net/developer_scratch.cc" "ASTRO_ALLOW_DIRTY_CHROMIUM=1"
harness::register_failure "domain substitution without --skip-domain-substitution" \
    run_patch_domain_substitution \
    "Domain substitution is not implemented" "--skip-domain-substitution"

harness::register_failure "build with a missing GN args file" \
    run_build_missing_gn_args \
    "GN args file for linux"
harness::register_failure "build with a missing WebUI bundle" \
    run_build_missing_webui_bundle \
    "Required WebUI bundle missing" "webui/whats-new/dist" "would render blank"
harness::register_failure "build with missing ad blocker filter lists" \
    run_build_missing_adblock_resources \
    "ad blocker filter lists"

# The two build-outcome rows are registered only where build.sh declares those
# inputs. Which inputs it requires is read from build.sh itself, never assumed:
# the gate and the two files it needs are newer than this table, so at a layer
# that has neither, a row asserting the refusal fails with "expected a non-zero
# exit, got 0" — a red that says nothing about the guarantee and everything
# about which branch you are on. Measured, not foreseen: it happened.
#
# This is the same derivation harness::make_build_root uses to decide what to
# copy into the fixture, so the fixture and the table can never disagree about
# what this build.sh requires.
build_requires() {
    local path="$1"
    grep -qE "astro::require_file \"[^\"]*/tools/${path//./\\.}\"" "$TOOLS/build.sh"
}

MINIMUM_ROWS=15

if build_requires "lib/build_outcome.py"; then
    harness::register_failure "build outcome detector is missing" \
        run_build_missing_outcome_detector \
        "Required build outcome detector not found" "build_outcome.py"
    MINIMUM_ROWS=$((MINIMUM_ROWS + 1))
fi
if build_requires "verify-build-outcome.sh"; then
    harness::register_failure "build outcome verifier is missing" \
        run_build_missing_outcome_verifier \
        "Required build outcome verifier not found" "verify-build-outcome.sh"
    MINIMUM_ROWS=$((MINIMUM_ROWS + 1))
fi
# ==========================================================================
# Property 1: every required failure exits non-zero, and says why
#
# The floor is this case's own, and it is EXACT at every layer rather than set
# to the smallest layer's count: 15 rows are unconditional, and each row above
# that build.sh's own declarations enable raised it by one as it was
# registered. A floor pinned at 15 would have let a later layer silently lose
# its two extra rows; a floor pinned at 17 is the red this pass just removed.
# ==========================================================================

harness::run_failure_table "$MINIMUM_ROWS"

# ==========================================================================
# Property 2: the modified-tree summary is visible in the logs
#
# Every part of it, not merely that something was printed. A summary missing
# its diff or its HEAD line does not record which tree produced a binary,
# which is the only reason the summary exists.
# ==========================================================================

summary_src="$tmp/summary-src"
make_patch_base "$summary_src"
SUMMARY_HEAD="$(git -C "$summary_src" rev-parse HEAD)"
summary_patches="$tmp/summary-patches"
mkdir -p "$summary_patches"
harness::write_patch "$summary_patches/001-alpha-to-bravo.patch" \
    "net/net_util.cc" "alpha" "bravo"
printf '001-alpha-to-bravo.patch\n' > "$summary_patches/series"

harness::run env ASTRO_CHROMIUM_SRC="$summary_src" \
    ASTRO_PATCH_REPORT="$tmp/summary-report.json" \
    "$TOOLS/apply-patches.sh" astro --dest "$summary_src" \
    --astro-patches "$summary_patches"

harness::assert_status 0 "patch run against a clean fixture"
harness::assert_output_contains "=== Chromium checkout summary ($summary_src) ===" \
    "the summary names the tree it describes"
harness::assert_output_contains "--- git status --short ---" "status section is present"
harness::assert_output_contains "M net/net_util.cc" "status section carries the changed path"
harness::assert_output_contains "--- git diff --stat ---" "diff section is present"
harness::assert_output_contains "net/net_util.cc |" "diff --stat carries the changed path"
harness::assert_output_contains "--- HEAD ---" "HEAD section is present"
harness::assert_output_contains "$SUMMARY_HEAD" "HEAD section carries the commit"
harness::assert_output_contains "=== end summary ===" "the summary is closed"

# --- ...and BEFORE build generation -----------------------------------------
#
# A summary printed after `gn gen` describes a tree that has already been
# turned into a build. Position is the property, so position is asserted.

order_root="$tmp/build-order-root"
order_chromium="$tmp/build-order-chromium"
harness::make_build_root "$order_root" "$order_chromium"

harness::run env ASTRO_CHROMIUM_SRC="$order_chromium" ASTRO_SKIP_LOCK_VERIFY=1 \
    "$order_root/tools/build.sh" Release linux --dry-run

harness::assert_status 0 "dry run with every required input present"
harness::assert_output_contains "print the Chromium modified-tree summary" \
    "the summary is part of the plan"
harness::assert_output_contains "gn gen" "generation is part of the plan"
harness::assert_output_lacks "gn was executed during a dry run" \
    "a dry run must not invoke gn"

summary_line="$(grep -nF 'print the Chromium modified-tree summary' "$RUN_STDOUT" | head -1 | cut -d: -f1)"
generation_line="$(grep -nF 'gn gen' "$RUN_STDOUT" | head -1 | cut -d: -f1)"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 2))
for line_number in "$summary_line" "$generation_line"; do
    case "$line_number" in
        ''|*[!0-9]*)
            harness::fail "could not locate both plan lines (summary: '$summary_line', generation: '$generation_line')"
            ;;
    esac
done
if [ "$summary_line" -ge "$generation_line" ]; then
    harness::fail "the tree summary (line $summary_line) is not printed before generation (line $generation_line)"
fi

harness::pass
