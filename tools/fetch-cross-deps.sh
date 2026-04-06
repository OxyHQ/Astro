#!/usr/bin/env bash
set -euo pipefail

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
UNGOOGLED_PATCHES="$ASTRO_ROOT/patches/ungoogled"

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

cd "$CHROMIUM_SRC"
git checkout -- . 2>/dev/null || true

# Also reset all sub-repos (they have separate .git and aren't affected by main reset)
find . -name ".git" -type d -not -path "./.git" -maxdepth 4 2>/dev/null | while read gitdir; do
    repo_dir=$(dirname "$gitdir")
    cd "$CHROMIUM_SRC/$repo_dir"
    dirty=$(git diff --name-only 2>/dev/null | wc -l)
    if [ "$dirty" -gt 0 ]; then
        git checkout -- . 2>/dev/null || true
    fi
done
echo "  Source tree reset to clean state"

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
                TOOLCHAIN_HASH=$(grep "TOOLCHAIN_HASH" "$CHROMIUM_SRC/build/vs_toolchain.py" | head -1 | grep -oP "'[a-f0-9]+'" | tr -d "'")

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
                DEPOT_TOOLS_WIN_TOOLCHAIN=1 python3 build/vs_toolchain.py update --force 2>&1 | tail -10 || {
                    echo ""
                    echo "  FAILED: Cannot download Windows SDK (requires Google access)"
                    echo ""
                    echo "  To fix, on a Windows machine with Visual Studio installed:"
                    echo "    cd depot_tools/win_toolchain"
                    echo "    python package_from_installed.py 2022 -w 10.0.22621.0"
                    echo "  Then copy the <hash>.zip here and run:"
                    echo "    tools/fetch-cross-deps.sh win --sdk-zip /path/to/<hash>.zip"
                    echo ""
                }
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
gclient sync --with_branch_heads --with_tags -D 2>&1 | tail -10 || true

# Step 5: Run hooks
echo ""
echo ">>> Running gclient hooks..."
# Skip win_toolchain hook if we set it up manually
if [ -f "$CHROMIUM_SRC/build/win_toolchain.json" ]; then
    export DEPOT_TOOLS_WIN_TOOLCHAIN=0
fi
gclient runhooks 2>&1 | tail -10 || true

# Step 6: Re-apply all patches (unless skipped)
if [ "$SKIP_PATCHES" = false ]; then
    echo ""
    echo ">>> Re-applying all patches..."
    cd "$ASTRO_ROOT"
    tools/apply-patches.sh all 2>&1 | tail -10
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
                cat "$CHROMIUM_SRC/build/win_toolchain.json" 2>/dev/null | head -5
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
