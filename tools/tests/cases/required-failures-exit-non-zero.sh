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
# modes of every mutating script, so adding a guard is one line and a guard
# that quietly stops failing cannot hide between cases.
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

# --------------------------------------------------------------------------
# Fixture preparation
#
# Preparation runs OUTSIDE harness::run, so a failure in it produces no
# captured output and no status anyone looks at. Without this wrapper a case
# whose fixture was never built goes on to assert a message against nothing and
# fails somewhere else entirely, which is the wrong-reason failure this whole
# file exists to make impossible.
# --------------------------------------------------------------------------

setup_run() {
    local log="$tmp/setup.log"
    local status=0
    "$@" >"$log" 2>&1 || status=$?
    if [ "$status" -ne 0 ]; then
        printf -- '--- setup output ---\n' >&2
        cat "$log" >&2
        harness::fail "fixture setup failed (exit $status): $*"
    fi
}

# --------------------------------------------------------------------------
# The table
#
# register_failure <description> <runner-function> <expected-fragment>...
#
# At least one fragment is mandatory: a row that named no reason would assert
# only that something went wrong, which is the assertion this case replaces.
# --------------------------------------------------------------------------

declare -a CASE_DESC=() CASE_RUN=() CASE_NEEDLES=()

register_failure() {
    local description="$1" runner="$2"
    shift 2
    if [ "$#" -lt 1 ]; then
        harness::fail "row '$description' declares no expected message fragment"
    fi
    CASE_DESC+=("$description")
    CASE_RUN+=("$runner")
    CASE_NEEDLES+=("$(printf '%s\n' "$@")")
}

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
setup_run git -C "$overlay_bare" init --quiet

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
setup_run git -C "$overlay_outer" init --quiet

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
    setup_run git -C "$dir" add -A
    setup_run git -C "$dir" commit --quiet -m "patch base"
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
    setup_run env ASTRO_CHROMIUM_SRC="$work/chromium/src" "$TOOLS/sync-sources.sh" \
        --no-deps --lock "$sync_lock" \
        --chromium-src "$work/chromium/src" \
        --depot-tools "$work/depot_tools" \
        --ungoogled "$work/ungoogled"
}

# --- --verify-only against a wrong commit -----------------------------------

sync_wrong="$tmp/sync-wrong"
bootstrap_work_tree "$sync_wrong"
setup_run git -C "$sync_wrong/chromium/src" checkout --quiet --detach "$SYNC_CHROMIUM_OLD"

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
setup_run git -C "$sync_branch/chromium/src" checkout --quiet -b astro-146.0.7680.177

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
setup_run python3 - "$sync_bad_lock" <<'PY'
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
# tools/build.sh
#
# Each row gets its own miniature Astro repository, so the real webui/ and
# gn_args/ are never touched and no row can depend on another's damage.
# ==========================================================================

write_build_lock() {
    local root="$1" chromium="$2" chromium_commit="$3"
    harness::write_lock "$root/browser.lock.json" \
        "file://$chromium" "$chromium_commit" \
        "file://$root/depot_tools" "$(git -C "$root/depot_tools" rev-parse HEAD)" \
        "file://$root/.ungoogled-chromium" "$(git -C "$root/.ungoogled-chromium" rev-parse HEAD)"
}

make_build_root() {
    local root="$1" chromium="$2"

    harness::make_chromium_fixture "$chromium"
    setup_run git -C "$chromium" checkout --quiet --detach HEAD

    mkdir -p "$root/tools/lib" "$root/gn_args" "$root/depot_tools" "$root/patches" \
             "$root/src/chrome/browser/oxy/adblock/resources"
    cp "$TOOLS/build.sh" "$TOOLS/sync-overlay.sh" "$TOOLS/sync-sources.sh" \
       "$TOOLS/generate-provenance.sh" "$TOOLS/overlay.allowlist" \
       "$TOOLS/gclient.template" "$root/tools/"
    cp "$TOOLS/lib/astro-common.sh" "$TOOLS/lib/lock.py" "$root/tools/lib/"
    cp "$ASTRO_ROOT/browser.lock.schema.json" "$root/"

    printf 'is_debug = false\n' > "$root/gn_args/linux.gn"
    printf '! filter list\n' > "$root/src/chrome/browser/oxy/adblock/resources/easylist.txt"

    local page
    for page in ntp alia settings whats-new error; do
        mkdir -p "$root/webui/$page/dist"
        printf '<!doctype html><title>%s</title>\n' "$page" > "$root/webui/$page/dist/index.html"
    done

    # gn and autoninja must RESOLVE — build.sh requires them — but must never
    # run during a dry run, so they announce themselves and fail loudly.
    printf '#!/usr/bin/env bash\necho "gn was executed during a dry run" >&2\nexit 99\n' \
        > "$root/depot_tools/gn"
    cp "$root/depot_tools/gn" "$root/depot_tools/autoninja"
    chmod +x "$root/depot_tools/gn" "$root/depot_tools/autoninja"

    # build.sh gates on sync-sources.sh --verify-only, which inspects every
    # locked source, so depot_tools and ungoogled have to be real checkouts
    # sitting detached at the commits the lock names.
    setup_run git -C "$root/depot_tools" init --quiet --initial-branch=main
    setup_run git -C "$root/depot_tools" add -A
    setup_run git -C "$root/depot_tools" commit --quiet -m "depot_tools fixture"
    setup_run git -C "$root/depot_tools" checkout --quiet --detach HEAD

    mkdir -p "$root/.ungoogled-chromium"
    printf 'patches\n' > "$root/.ungoogled-chromium/README"
    setup_run git -C "$root/.ungoogled-chromium" init --quiet --initial-branch=main
    setup_run git -C "$root/.ungoogled-chromium" add -A
    setup_run git -C "$root/.ungoogled-chromium" commit --quiet -m "ungoogled fixture"
    setup_run git -C "$root/.ungoogled-chromium" checkout --quiet --detach HEAD

    write_build_lock "$root" "$chromium" "$(git -C "$chromium" rev-parse HEAD)"
}

# --- Missing GN args --------------------------------------------------------

build_gn_root="$tmp/build-gn-root"
build_gn_chromium="$tmp/build-gn-chromium"
make_build_root "$build_gn_root" "$build_gn_chromium"
rm -f "$build_gn_root/gn_args/linux.gn"

run_build_missing_gn_args() {
    env ASTRO_CHROMIUM_SRC="$build_gn_chromium" ASTRO_SKIP_LOCK_VERIFY=1 \
        "$build_gn_root/tools/build.sh" Release linux --dry-run
}

# --- Missing WebUI bundle ---------------------------------------------------

build_webui_root="$tmp/build-webui-root"
build_webui_chromium="$tmp/build-webui-chromium"
make_build_root "$build_webui_root" "$build_webui_chromium"
rm -rf "${build_webui_root:?}/webui/settings/dist"

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
make_build_root "$build_adblock_root" "$build_adblock_chromium"
rm -rf "${build_adblock_root:?}/src/chrome/browser/oxy/adblock/resources"

run_build_missing_adblock_resources() {
    env ASTRO_CHROMIUM_SRC="$build_adblock_chromium" ASTRO_SKIP_LOCK_VERIFY=1 \
        "$build_adblock_root/tools/build.sh" Release linux --dry-run
}

# --- Checkout off the locked revision ---------------------------------------

build_lock_root="$tmp/build-lock-root"
build_lock_chromium="$tmp/build-lock-chromium"
make_build_root "$build_lock_root" "$build_lock_chromium"
write_build_lock "$build_lock_root" "$build_lock_chromium" "$ABSENT_COMMIT"

run_build_off_locked_revision() {
    env ASTRO_CHROMIUM_SRC="$build_lock_chromium" \
        "$build_lock_root/tools/build.sh" Release linux --dry-run
}

# ==========================================================================
# tools/generate-provenance.sh --require-match
# ==========================================================================

provenance_drift="$tmp/provenance-drift"
bootstrap_work_tree "$provenance_drift"
setup_run git -C "$provenance_drift/chromium/src" checkout --quiet --detach "$SYNC_CHROMIUM_OLD"

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
# tools/baseline/smoke.sh and tools/baseline/capture-network.sh
#
# A baseline document citing an empty-but-successful report is worse than one
# citing an honest gap: later issues quote the baseline as their compatibility
# reference.
# ==========================================================================

baseline_absent_binary="$tmp/baseline-absent-chrome"

run_smoke_without_binary() {
    "$TOOLS/baseline/smoke.sh" --binary "$baseline_absent_binary" \
        --report "required-failures-smoke.json"
}

run_capture_without_binary() {
    "$TOOLS/baseline/capture-network.sh" --binary "$baseline_absent_binary" \
        --phase idle --seconds 1 --report "required-failures-capture.json"
}

# ==========================================================================
# THE TABLE
#
# One line per required failure. Every entry names the reason the command must
# give, so the row cannot be satisfied by an unrelated failure.
# ==========================================================================

register_failure "overlay destination is not a Chromium checkout" \
    run_overlay_unverified_destination \
    "does not look like a Chromium source checkout" "chrome/VERSION"
register_failure "overlay destination is not its own git work tree" \
    run_overlay_nested_destination \
    "is not its own git work tree" "including any destructive one"
register_failure "overlay file with no declared destination" \
    run_overlay_undeclared_destination \
    "no declared destination" "components/policy/policy_constants.cc"
register_failure "undeclared overwrite of a tracked upstream file" \
    run_overlay_undeclared_overwrite \
    "would overwrite a Chromium-tracked file" "net/net_util.cc"
register_failure "overlay above ASTRO_OVERLAY_MAX_FILES" \
    run_overlay_over_ceiling \
    "over the declared ceiling of 2"
register_failure "overlay against a checkout carrying unrelated work" \
    run_overlay_dirty_checkout \
    "Astro did not write" "net/net_util.cc" "ASTRO_ALLOW_DIRTY_CHROMIUM=1"

register_failure "a patch that does not apply exactly" \
    run_patch_does_not_apply \
    "does not apply exactly" "001-context-drifted.patch" "no three-way merge"
register_failure "a series entry with no patch file" \
    run_patch_series_entry_missing \
    "series lists patches that do not exist" "099-vanished.patch" \
    "Refusing to apply a partial stack"
register_failure "a patch on disk absent from the series" \
    run_patch_undeclared_on_disk \
    "series does not declare" "002-undeclared.patch" \
    "not a property of the filesystem"
register_failure "a .rej artifact in the checkout" \
    run_patch_artifact_present \
    "Patch artifacts found" "net_util.cc.rej" "applied partially"
register_failure "patching a non-pristine checkout" \
    run_patch_dirty_checkout \
    "must be pristine" "net/developer_scratch.cc" "ASTRO_ALLOW_DIRTY_CHROMIUM=1"
register_failure "domain substitution without --skip-domain-substitution" \
    run_patch_domain_substitution \
    "Domain substitution is not implemented" "--skip-domain-substitution"

register_failure "--verify-only against a wrong commit" \
    run_sync_wrong_commit \
    "chromium is at the wrong commit" "$SYNC_CHROMIUM_OLD" "$SYNC_CHROMIUM_TIP" \
    "stale self-hosted runner"
register_failure "--verify-only against an attached HEAD" \
    run_sync_attached_head \
    "not detached" "astro-146.0.7680.177" "can be advanced after the sync"
register_failure "--verify-only when the checkout is absent" \
    run_sync_absent_checkout \
    "chromium is not present at" "--verify-only never creates a checkout"
register_failure "a lock that fails schema validation" \
    run_sync_invalid_lock \
    "does not satisfy browser.lock.schema.json" "abbreviated SHA"
register_failure "a non-empty non-checkout directory at the destination" \
    run_sync_occupied_destination \
    "is not a git checkout, and is not empty" "Nothing is deleted automatically"

register_failure "build with a missing GN args file" \
    run_build_missing_gn_args \
    "GN args file for linux"
register_failure "build with a missing WebUI bundle" \
    run_build_missing_webui_bundle \
    "Required WebUI bundle missing" "webui/settings/dist" "would render blank"
register_failure "build with missing ad blocker filter lists" \
    run_build_missing_adblock_resources \
    "ad blocker filter lists"
register_failure "build against a checkout off the locked revision" \
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
register_failure "provenance --require-match against a drifted revision" \
    run_provenance_drifted_revision \
    "DRIFT chromium: locked $SYNC_CHROMIUM_TIP, on disk $SYNC_CHROMIUM_OLD" \
    "command failed (exit 1)"
register_failure "provenance --require-match against a dirty worktree" \
    run_provenance_dirty_worktree \
    "DIRTY chromium has uncommitted changes" "command failed (exit 1)"

register_failure "baseline smoke run with no browser binary" \
    run_smoke_without_binary \
    "Browser binary not found" "will not emit an empty or placeholder report"
register_failure "baseline network capture with no browser binary" \
    run_capture_without_binary \
    "Browser binary not found" "will not write a trace it did not record"

# ==========================================================================
# Vacuity floor
#
# A truncated table, a mis-registered row or a broken loop would otherwise
# report a green case having asserted almost nothing.
# ==========================================================================

MINIMUM_ROWS=18

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 2))
if [ "${#CASE_DESC[@]}" -lt "$MINIMUM_ROWS" ]; then
    harness::fail "table has ${#CASE_DESC[@]} row(s), below the floor of $MINIMUM_ROWS"
fi
if [ "${#CASE_RUN[@]}" != "${#CASE_DESC[@]}" ] || [ "${#CASE_NEEDLES[@]}" != "${#CASE_DESC[@]}" ]; then
    harness::fail "table arrays disagree: ${#CASE_DESC[@]} descriptions, ${#CASE_RUN[@]} runners, ${#CASE_NEEDLES[@]} needle sets"
fi

# ==========================================================================
# Property 1: every required failure exits non-zero, and says why
# ==========================================================================

printf 'Required failure modes under test: %s\n' "${#CASE_DESC[@]}"

for index in "${!CASE_DESC[@]}"; do
    description="${CASE_DESC[$index]}"
    harness::run "${CASE_RUN[$index]}"
    harness::assert_nonzero_status "$description"
    while IFS= read -r needle; do
        [ -n "$needle" ] || continue
        harness::assert_output_contains "$needle" "$description"
    done <<< "${CASE_NEEDLES[$index]}"
done

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
make_build_root "$order_root" "$order_chromium"

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
