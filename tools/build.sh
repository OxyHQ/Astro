#!/usr/bin/env bash
# build.sh — build Astro from a verified Chromium checkout.
#
# What changed for #4:
#
#   * The overlay step no longer runs
#         rsync -av --delete "$ASTRO_ROOT/src/" "$CHROMIUM_SRC/" 2>/dev/null || true
#     which deleted every upstream file the overlay did not provide (including
#     the gclient-fetched third_party trees that live alongside it), hid its
#     own errors, and reported success unconditionally. Copying is delegated
#     to tools/sync-overlay.sh, which is allowlist-driven and never deletes.
#   * Missing required inputs — GN args, WebUI bundles, adblock filter lists,
#     build tools — stop the build instead of printing a warning and producing
#     a binary with the feature silently inert.
#   * gn gen, gn check and the compile are all required steps.
#   * The modified-tree summary is printed before build generation, so both
#     local and CI logs record exactly which tree was compiled.
#
# Usage:
#   tools/build.sh [Release|Debug] [linux|windows|windows-arm64|macos|android]
#                  [--dry-run]

ASTRO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ASTRO_ROOT
# shellcheck source=tools/lib/astro-common.sh
source "$ASTRO_ROOT/tools/lib/astro-common.sh"

BUILD_TYPE="Release"
PLATFORM="linux"
# Overrides the per-platform args file. Exists so a build can be made from the
# COMMITTED gn args while a developer's working tree carries an experiment —
# without touching their file. Reproducibility work (#5) needs to build what
# the repository says, not what one machine happens to have.
GN_ARGS_OVERRIDE=""

# WebUI pages compiled into the product. A missing bundle is a build failure:
# the page would render blank at runtime, which is not a warning-level event.
REQUIRED_WEBUI_PAGES=(ntp alia settings whats-new error)

usage() {
    cat >&2 <<'EOF'
Usage: tools/build.sh [Release|Debug] [platform] [--dry-run]

Platforms: linux, windows, windows-arm64, macos, android

Options:
  --dry-run   Print every planned operation and validate every required
              input; run no generation, compile or copy.
  --gn-args FILE
              Use FILE instead of the platform's gn_args/*.gn.

Environment:
  ASTRO_BUILD_JOBS               Parallel compile jobs (default: nproc)
  ASTRO_ALLOW_DIRTY_CHROMIUM=1   Developer-only override for the unrelated
                                 local-changes guard. Never set in CI.
  ASTRO_ALLOW_DIRTY_OVERLAY=1    Developer-only override permitting a build from
                                 an overlay that differs from HEAD. The build is
                                 recorded as not reproducible and normal
                                 packaging refuses it. Never set in CI.
EOF
}

while [ $# -gt 0 ]; do
    case "$1" in
        Release|Debug)  BUILD_TYPE="$1" ;;
        linux|windows|windows-arm64|macos|android) PLATFORM="$1" ;;
        --dry-run)      ASTRO_DRY_RUN=1 ;;
        --gn-args)      shift; GN_ARGS_OVERRIDE="${1:?--gn-args needs a file}" ;;
        -h|--help)      usage; exit 0 ;;
        *)              usage; astro::die "Unknown argument: $1" ;;
    esac
    shift
done

# depot_tools supplies gn and autoninja.
export PATH="$ASTRO_ROOT/depot_tools:$PATH"

# Hermetic Windows toolchain for cross-compilation.
if [[ "$PLATFORM" == windows* ]] && [ -f "$ASTRO_ROOT/win-sdk/VS_VERSION" ]; then
    export DEPOT_TOOLS_WIN_TOOLCHAIN=1
fi

astro::info "=== Astro browser build ==="
astro::info "Root:       $ASTRO_ROOT"
astro::info "Build type: $BUILD_TYPE"
astro::info "Platform:   $PLATFORM"
if astro::dry_run; then
    astro::info "Mode:       DRY RUN (validate inputs, change nothing)"
fi

# --------------------------------------------------------------------------
# Required inputs — every one of these is checked BEFORE anything is built,
# so a missing input costs seconds rather than surfacing hours into a compile
# or, worse, shipping as a silently inert feature.
# --------------------------------------------------------------------------

astro::resolve_chromium_src ""
CHROMIUM_SRC="$ASTRO_RESOLVED_CHROMIUM_SRC"
astro::info "Checkout:   $CHROMIUM_SRC"

case "$PLATFORM" in
    linux)
        if [ "$BUILD_TYPE" = "Debug" ]; then
            GN_ARGS_FILE="$ASTRO_ROOT/gn_args/linux_debug.gn"
        else
            GN_ARGS_FILE="$ASTRO_ROOT/gn_args/linux.gn"
        fi
        BUILD_TARGETS=(chrome chrome_sandbox)
        ;;
    windows)       GN_ARGS_FILE="$ASTRO_ROOT/gn_args/windows.gn";       BUILD_TARGETS=(mini_installer) ;;
    windows-arm64) GN_ARGS_FILE="$ASTRO_ROOT/gn_args/windows_arm64.gn"; BUILD_TARGETS=(mini_installer) ;;
    macos)         GN_ARGS_FILE="$ASTRO_ROOT/gn_args/macos.gn";         BUILD_TARGETS=(chrome) ;;
    android)       GN_ARGS_FILE="$ASTRO_ROOT/gn_args/android.gn";       BUILD_TARGETS=(chrome_public_apk) ;;
esac

if [ -n "$GN_ARGS_OVERRIDE" ]; then
    GN_ARGS_FILE="$GN_ARGS_OVERRIDE"
    astro::warn "override:gn-args" "using $GN_ARGS_FILE instead of the $PLATFORM default"
fi

astro::require_file "$GN_ARGS_FILE" "GN args file for $PLATFORM"
astro::require_cmd gn autoninja python3

# The two build gates, required as inputs like everything else here. A missing
# gate has to fail AS a missing gate: the first time gn_args_drift.py was absent
# the build died claiming the GN args violated policy, which is a false report
# about the tree rather than a true one about the toolbox.
astro::require_file "$ASTRO_ROOT/tools/lib/gn_args_drift.py" "GN args drift reporter"
astro::require_file "$ASTRO_ROOT/tools/lib/gn_check_baseline.py" "gn check ratchet"
astro::require_file "$ASTRO_ROOT/tools/gn-check-baseline.json" "committed gn check baseline"

# WebUI bundles. The old script warned and carried on; a build produced that
# way ships a page that renders nothing.
astro::info ">>> Checking required WebUI bundles..."
for page in "${REQUIRED_WEBUI_PAGES[@]}"; do
    page_dist="$ASTRO_ROOT/webui/$page/dist"
    if [ ! -d "$page_dist" ]; then
        astro::die_with_hint \
            "Required WebUI bundle missing: webui/$page/dist" \
            "astro://$page would render blank in the resulting build." \
            "Build it first:  cd webui/$page && bun install && bun run build"
    fi
    if [ ! -f "$page_dist/index.html" ]; then
        astro::die "Required WebUI bundle has no index.html: webui/$page/dist"
    fi
done
astro::info "    all ${#REQUIRED_WEBUI_PAGES[@]} bundles present"

# Ad blocker filter lists. AstroAdBlockService::GetFilterListResourcesPath()
# reads <exe_dir>/adblock_resources/. Without these files the engine holds no
# rules and ShouldBlockRequest() always returns false — the ad blocker is a
# no-op, and nothing at runtime says so.
ADBLOCK_RESOURCES="$ASTRO_ROOT/src/chrome/browser/oxy/adblock/resources"
astro::require_dir "$ADBLOCK_RESOURCES" "ad blocker filter lists"

# --------------------------------------------------------------------------
# Overlay
# --------------------------------------------------------------------------

astro::info ">>> Syncing the Astro overlay..."
SYNC_ARGS=()
if astro::dry_run; then
    SYNC_ARGS+=(--dry-run)
fi
"$ASTRO_ROOT/tools/sync-overlay.sh" "${SYNC_ARGS[@]+"${SYNC_ARGS[@]}"}" --dest "$CHROMIUM_SRC"

# --------------------------------------------------------------------------
# Modified-tree summary — required to be visible in local and CI logs before
# build generation, so the tree that produced a binary is always recorded.
# --------------------------------------------------------------------------

if astro::dry_run; then
    astro::plan "print the Chromium modified-tree summary"
else
    astro::summarize_chromium_tree "$CHROMIUM_SRC"
fi

# --------------------------------------------------------------------------
# Generate and build
# --------------------------------------------------------------------------

OUT_DIR="out/$BUILD_TYPE"
JOBS="${ASTRO_BUILD_JOBS:-$(nproc)}"

# --------------------------------------------------------------------------
# GN args provenance
# --------------------------------------------------------------------------
# The args come from a file in the WORKING TREE, so a one-character local edit
# is indistinguishable from the repository's own configuration unless something
# says otherwise. Nothing did, and it cost: an uncommitted
# `safe_browsing_mode = 1` in gn_args/linux.gn produced a `gn gen` failure that
# was nearly published as a defect in upstream ungoogled-chromium. See
# docs/astro-next/baseline/findings.md, finding 2.
#
# This reports; it does not refuse. Editing GN args locally is ordinary work and
# the epic requires developer local work to be preserved by default. Set
# ASTRO_REQUIRE_COMMITTED_GN_ARGS=1 (release and CI builds should) to make any
# difference fatal instead.
astro::info ">>> GN args provenance ($GN_ARGS_FILE)"
python3 "$ASTRO_ROOT/tools/lib/gn_args_drift.py" \
    --repo "$ASTRO_ROOT" --args-file "$GN_ARGS_FILE" \
    ${ASTRO_REQUIRE_COMMITTED_GN_ARGS:+--strict} \
    || astro::die "GN args are not the committed ones (ASTRO_REQUIRE_COMMITTED_GN_ARGS=1)"

if astro::dry_run; then
    astro::plan "gn gen $OUT_DIR --args=@$GN_ARGS_FILE"
    astro::plan "gn check $OUT_DIR"
    astro::plan "autoninja -C $OUT_DIR ${BUILD_TARGETS[*]} -j $JOBS"
else
    astro::info ">>> Running gn gen ($GN_ARGS_FILE)..."
    ( cd "$CHROMIUM_SRC" && gn gen "$OUT_DIR" --args="$(cat "$GN_ARGS_FILE")" )

    # `gn check` is advisory: Chromium's own build does not consume it, and the
    # inherited ungoogled stack rewrites 68 BUILD.gn/.gni files, so it reports
    # pre-existing include-edge complaints that no Astro change introduced.
    # Ignoring them silently is not an option either, so the count is ratcheted
    # against a committed number and BOTH directions are fatal: more errors is a
    # regression, fewer means the ratchet is stale and must be lowered in the
    # same change that fixed them. See findings.md, finding 8.
    astro::info ">>> Running gn check..."
    GN_CHECK_LOG="$ASTRO_ROOT/build/reports/gn-check-$PLATFORM.txt"
    mkdir -p "$(dirname "$GN_CHECK_LOG")"
    gn_check_status=0
    ( cd "$CHROMIUM_SRC" && gn check "$OUT_DIR" ) > "$GN_CHECK_LOG" 2>&1 \
        || gn_check_status=$?
    astro::info "    gn check exited $gn_check_status; report at $GN_CHECK_LOG"
    python3 "$ASTRO_ROOT/tools/lib/gn_check_baseline.py" \
        --baseline "$ASTRO_ROOT/tools/gn-check-baseline.json" \
        --log "$GN_CHECK_LOG" --platform "$PLATFORM" \
        || astro::die "gn check error count does not match the committed baseline"


    astro::info ">>> Building ${BUILD_TARGETS[*]} for $PLATFORM..."
    astro::info "    first build takes hours; incremental builds are minutes"
    ( cd "$CHROMIUM_SRC" && autoninja -C "$OUT_DIR" "${BUILD_TARGETS[@]}" -j "$JOBS" )
fi

# --------------------------------------------------------------------------
# Stage runtime resources beside the binary
# --------------------------------------------------------------------------

BUILD_OUT="$CHROMIUM_SRC/$OUT_DIR"

astro::info ">>> Staging WebUI resources..."
for page in "${REQUIRED_WEBUI_PAGES[@]}"; do
    page_dist="$ASTRO_ROOT/webui/$page/dist"
    if astro::dry_run; then
        astro::plan "stage webui/$page/dist -> $OUT_DIR/astro-$page/"
    else
        mkdir -p "$BUILD_OUT/astro-$page"
        # No --delete: the destination is inside the build directory, but the
        # rule is uniform so no future edit can turn one of these into the
        # destructive shape.
        rsync -a "$page_dist/" "$BUILD_OUT/astro-$page/"
    fi
done

astro::info ">>> Staging ad blocker filter lists..."
if astro::dry_run; then
    astro::plan "stage adblock resources -> $OUT_DIR/adblock_resources/"
else
    mkdir -p "$BUILD_OUT/adblock_resources"
    rsync -a "$ADBLOCK_RESOURCES/" "$BUILD_OUT/adblock_resources/"
fi


astro::info "=== Build complete ==="
astro::info "Platform: $PLATFORM"
astro::info "Output:   $BUILD_OUT/"
