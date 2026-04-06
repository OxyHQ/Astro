#!/usr/bin/env bash
set -euo pipefail

ASTRO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHROMIUM_SRC="$ASTRO_ROOT/chromium/src"
BUILD_TYPE="${1:-Release}"
PLATFORM="${2:-linux}"

# Add depot_tools to PATH (gn, autoninja, etc.)
export PATH="$ASTRO_ROOT/depot_tools:$PATH"

echo "=== Astro Browser Build ==="
echo "Root: $ASTRO_ROOT"
echo "Build type: $BUILD_TYPE"
echo "Platform: $PLATFORM"

# Verify chromium source exists
if [ ! -d "$CHROMIUM_SRC" ]; then
    echo "ERROR: Chromium source not found at $CHROMIUM_SRC"
    echo "Run tools/fetch-chromium.sh first"
    exit 1
fi

# Step 1: Copy Astro source files into the Chromium tree
echo ""
echo ">>> Copying Astro source files..."
rsync -av --delete "$ASTRO_ROOT/src/" "$CHROMIUM_SRC/" 2>/dev/null || true

# Step 2: Determine GN args file and build target
case "$PLATFORM" in
    linux)
        if [ "$BUILD_TYPE" = "Debug" ]; then
            GN_ARGS_FILE="$ASTRO_ROOT/gn_args/linux_debug.gn"
        else
            GN_ARGS_FILE="$ASTRO_ROOT/gn_args/linux.gn"
        fi
        BUILD_TARGET="chrome chrome_sandbox"
        ;;
    windows)
        GN_ARGS_FILE="$ASTRO_ROOT/gn_args/windows.gn"
        BUILD_TARGET="mini_installer"
        ;;
    windows-arm64)
        GN_ARGS_FILE="$ASTRO_ROOT/gn_args/windows_arm64.gn"
        BUILD_TARGET="mini_installer"
        ;;
    macos)
        GN_ARGS_FILE="$ASTRO_ROOT/gn_args/macos.gn"
        BUILD_TARGET="chrome"
        ;;
    android)
        GN_ARGS_FILE="$ASTRO_ROOT/gn_args/android.gn"
        BUILD_TARGET="chrome_public_apk"
        ;;
    *)
        echo "ERROR: Unknown platform '$PLATFORM'"
        echo "Usage: $0 [Release|Debug] [linux|windows|windows-arm64|macos|android]"
        exit 1
        ;;
esac

OUT_DIR="out/$BUILD_TYPE"

if [ ! -f "$GN_ARGS_FILE" ]; then
    echo "ERROR: GN args file not found: $GN_ARGS_FILE"
    exit 1
fi

# Step 3: Generate build files with GN
echo ""
echo ">>> Running GN ($GN_ARGS_FILE)..."
cd "$CHROMIUM_SRC"
gn gen "$OUT_DIR" --args="$(cat "$GN_ARGS_FILE")"

# Step 4: Build with Ninja
echo ""
echo ">>> Building $BUILD_TARGET for $PLATFORM (this may take several hours on first build)..."
JOBS="${ASTRO_BUILD_JOBS:-$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 8)}"
autoninja -C "$OUT_DIR" $BUILD_TARGET -j "$JOBS"

# Step 5: Copy WebUI resources alongside the binary
echo ""
echo ">>> Copying WebUI resources..."

for page in ntp alia settings whats-new error; do
    PAGE_DIST="$ASTRO_ROOT/webui/$page/dist"
    if [ -d "$PAGE_DIST" ]; then
        mkdir -p "$OUT_DIR/astro-$page"
        rsync -a "$PAGE_DIST/" "$OUT_DIR/astro-$page/"
        echo "  Copied $page resources"
    else
        echo "  WARNING: $page dist not found (run bun build in webui/$page first)"
    fi
done

echo ""
echo "=== Build complete ==="
echo "Platform: $PLATFORM"
echo "Output: $CHROMIUM_SRC/$OUT_DIR/"
