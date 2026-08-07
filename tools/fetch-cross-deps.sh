#!/usr/bin/env bash
ASTRO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ASTRO_ROOT
# shellcheck source=tools/lib/astro-common.sh
source "$ASTRO_ROOT/tools/lib/astro-common.sh"

# Downloads cross-compilation toolchains for Chromium.
#
# IMPORTANT: The Windows SDK is stored in Google's PRIVATE GCS bucket.
# External developers cannot download it directly. You have two options:
#
#   Option A: Package the SDK from a Windows machine (one-time setup)
#     1. On a Windows machine with Visual Studio + Windows SDK installed:
#        cd depot_tools/win_toolchain
#        python package_from_installed.py 2022 -w 10.0.22621.0
#     2. Copy the resulting <hash>.zip to this machine
#     3. Run: tools/fetch-cross-deps.sh win --sdk-zip /path/to/<hash>.zip
#
#   Option B: Build on Windows directly (recommended for CI)
#     Use a Windows self-hosted runner with the GitHub Actions release workflow.
#
# Android cross-compilation works out of the box (SDK is public).

ASTRO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHROMIUM_SRC="$ASTRO_ROOT/chromium/src"
CHROMIUM_DIR="$ASTRO_ROOT/chromium"

export PATH="$ASTRO_ROOT/depot_tools:$PATH"

if [ ! -d "$CHROMIUM_SRC" ]; then
    echo "ERROR: Chromium source not found. Run tools/fetch-chromium.sh first."
    exit 1
fi

# Parse arguments
TARGETS=""
WIN_SDK_ZIP=""
SKIP_PATCHES=false

while [ $# -gt 0 ]; do
    case "$1" in
        --sdk-zip)   shift; WIN_SDK_ZIP="$1" ;;
        --skip-patches) SKIP_PATCHES=true ;;
        all)         TARGETS="linux win android" ;;
        win|android|mac) TARGETS="$TARGETS $1" ;;
        -h|--help)
            echo "Usage: $0 <targets...> [--sdk-zip path] [--skip-patches]"
            echo ""
            echo "Targets: win, android, mac, all"
            echo ""
            echo "Options:"
            echo "  --sdk-zip PATH     Path to Windows SDK zip (packaged from a Windows machine)"
            echo "  --skip-patches     Don't re-apply patches after fetching deps"
            echo ""
            echo "Windows cross-compilation requires a packaged Windows SDK."
            echo "See this script's header comments for instructions."
            exit 0
            ;;
        *) echo "Unknown argument: $1"; exit 1 ;;
    esac
    shift
done

TARGETS="linux $TARGETS"
TARGETS=$(echo "$TARGETS" | tr ' ' '\n' | sort -u | tr '\n' ' ' | xargs)

if [ "$TARGETS" = "linux" ]; then
    echo "Usage: $0 <targets...>"
    echo "Targets: win, android, mac, all"
    exit 1
fi

echo "=== Fetching cross-compilation deps for: $TARGETS ==="

# Step 1: Update .gclient with target_os
echo ">>> Updating .gclient target_os..."
TARGET_OS_LIST=""
for target in $TARGETS; do
    TARGET_OS_LIST="$TARGET_OS_LIST\"$target\", "
done
TARGET_OS_LIST="${TARGET_OS_LIST%, }"

cat > "$CHROMIUM_DIR/.gclient" << GCLIENT_EOF
solutions = [
  {
    "name": "src",
    "url": "https://chromium.googlesource.com/chromium/src.git",
    "managed": False,
    "custom_deps": {},
    "custom_vars": {},
  },
]
target_os = [$TARGET_OS_LIST]
GCLIENT_EOF
echo "  target_os = [$TARGET_OS_LIST]"

# Step 2: Reset domain substitution in the source tree
# Domain substitution replaces Google URLs with non-functional placeholders,
# which breaks toolchain download scripts. We need to temporarily undo it.
echo ""
echo ">>> Resetting source tree for clean toolchain download..."

# This step DISCARDS local modifications in the Chromium checkout and every
# nested dependency repository. It is the most destructive operation in the
# tool tree, so it verifies its target and refuses to run over unrelated
# developer work unless that is explicitly authorised.
astro::resolve_chromium_src "$CHROMIUM_SRC"
CHROMIUM_SRC="$ASTRO_RESOLVED_CHROMIUM_SRC"

astro::info "  Target checkout: $CHROMIUM_SRC"
astro::info "  Revision before reset:"
git -C "$CHROMIUM_SRC" --no-pager log -1 --format='    %H %s'

astro::require_attributable_chromium \
    "$CHROMIUM_SRC" \
    "$ASTRO_ROOT/tools/overlay.allowlist" \
    "$ASTRO_REPORT_DIR/patch-report.json"

git -C "$CHROMIUM_SRC" checkout -- .

# Nested dependency repositories have their own .git and are untouched by the
# reset above.
while IFS= read -r -d '' gitdir; do
    repo_dir="$(dirname "$gitdir")"
    if [ -n "$(git -C "$repo_dir" status --porcelain)" ]; then
        git -C "$repo_dir" checkout -- .
    fi
done < <(find "$CHROMIUM_SRC" -maxdepth 4 -name ".git" -type d \
             -not -path "$CHROMIUM_SRC/.git" -print0)

astro::info "  Source tree reset to clean state"

# Step 3: Handle Windows SDK
for target in $TARGETS; do
    case "$target" in
        win)
            if [ -n "$WIN_SDK_ZIP" ]; then
                echo ""
                echo ">>> Installing Windows SDK from $WIN_SDK_ZIP..."
                if [ ! -f "$WIN_SDK_ZIP" ]; then
                    echo "ERROR: SDK zip not found: $WIN_SDK_ZIP"
                    exit 1
                fi

                # Extract the hash from filename (format: <hash>.zip)
                SDK_HASH=$(basename "$WIN_SDK_ZIP" .zip)

                # Determine toolchain dir
                TOOLCHAIN_DIR="$CHROMIUM_SRC/third_party/depot_tools/win_toolchain/vs_files/$SDK_HASH"
                mkdir -p "$TOOLCHAIN_DIR"

                echo "  Extracting to $TOOLCHAIN_DIR..."
                unzip -qo "$WIN_SDK_ZIP" -d "$TOOLCHAIN_DIR"

                # Create the toolchain JSON that the build system expects
                cat > "$CHROMIUM_SRC/build/win_toolchain.json" << SDK_JSON
{
  "path": "$TOOLCHAIN_DIR",
  "version": "2022",
  "win_sdk": "10.0.22621.0"
}
SDK_JSON
                echo "  Windows SDK installed"
            else
                echo ""
                echo ">>> Attempting Windows SDK download..."
                echo "  NOTE: This requires Google Cloud Storage access."
                echo "  If it fails, use --sdk-zip to provide a pre-packaged SDK."
                # The status read here is the FETCH's, captured directly, not a
                # pipeline's: the previous form ended `| tail -10 || { ... }`,
                # which took its verdict from `tail` (correct only because
                # `set -o pipefail` happens to be on) and threw away all but the
                # last ten lines of the one output whose whole purpose is to say
                # what went wrong. The full log is kept instead.
                #
                # This step is genuinely allowed to fail — the SDK lives in a
                # private Google bucket and external developers cannot reach it,
                # which is what --sdk-zip exists for — so the tolerated failure
                # is declared rather than swallowed. Everything at the call site
                # below still runs on the failure path.
                sdk_log="$ASTRO_REPORT_DIR/win-sdk-download.log"
                mkdir -p "$(dirname "$sdk_log")"
                sdk_status=0
                DEPOT_TOOLS_WIN_TOOLCHAIN=1 python3 build/vs_toolchain.py update --force \
                    > "$sdk_log" 2>&1 || sdk_status=$?
                tail -20 "$sdk_log"
                if [ "$sdk_status" -ne 0 ]; then
                    astro::warn "optional:win-sdk-download" \
                        "vs_toolchain.py update exited $sdk_status; full log at $sdk_log"
                    echo ""
                    echo "  FAILED: Cannot download Windows SDK (requires Google access)"
                    echo ""
                    echo "  To fix, on a Windows machine with Visual Studio installed:"
                    echo "    cd depot_tools/win_toolchain"
                    echo "    python package_from_installed.py 2022 -w 10.0.22621.0"
                    echo "  Then copy the <hash>.zip here and run:"
                    echo "    tools/fetch-cross-deps.sh win --sdk-zip /path/to/<hash>.zip"
                    echo ""
                fi
            fi
            ;;
        android)
            echo ""
            echo ">>> Fetching Android dependencies..."
            ;;
    esac
done

# Step 4: Run gclient sync to fetch platform-specific deps
echo ""
echo ">>> Running gclient sync..."
cd "$CHROMIUM_DIR"
# A failed sync leaves the toolchain incomplete; the build then fails much
# later with an error that does not name this step.
gclient sync --with_branch_heads --with_tags -D

# Step 5: Run hooks
echo ""
echo ">>> Running gclient hooks..."
# Skip win_toolchain hook if we set it up manually
if [ -f "$CHROMIUM_SRC/build/win_toolchain.json" ]; then
    export DEPOT_TOOLS_WIN_TOOLCHAIN=0
fi
gclient runhooks

# Step 6: Re-apply all patches (unless skipped)
if [ "$SKIP_PATCHES" = false ]; then
    echo ""
    echo ">>> Re-applying all patches..."
    cd "$ASTRO_ROOT"
    # Was `tools/apply-patches.sh all 2>&1 | tail -10`, which is the shape this
    # whole guard exists for. Two defects in one line: the status that reached
    # the caller was the PIPELINE's — correct here only because `set -o
    # pipefail` happens to be on, and silently wrong the moment this line is
    # copied into a CI `run:` block, where GitHub's default shell is `bash -e`
    # with no pipefail — and `tail -10` threw away the diagnosis, so whatever
    # survived could not be checked against anything.
    astro::run_build_step "apply-patches" \
        "$ASTRO_REPORT_DIR/fetch-cross-deps-apply-patches.log" -- \
        tools/apply-patches.sh all
else
    echo ""
    echo ">>> Skipping patch re-application (--skip-patches)"
fi

# Step 7: Verify
echo ""
echo ">>> Verification:"
for target in $TARGETS; do
    case "$target" in
        win)
            if [ -f "$CHROMIUM_SRC/build/win_toolchain.json" ]; then
                echo "  Windows: OK (toolchain configured)"
                head -5 "$CHROMIUM_SRC/build/win_toolchain.json"
            else
                echo "  Windows: NOT CONFIGURED"
            fi
            ;;
        android)
            if [ -d "$CHROMIUM_SRC/third_party/android_sdk" ]; then
                echo "  Android: OK (SDK found)"
            else
                echo "  Android: SDK not found"
            fi
            ;;
        mac)
            echo "  macOS: requires macOS host for Xcode SDK"
            ;;
    esac
done

echo ""
echo "=== Done ==="
