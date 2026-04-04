#!/usr/bin/env bash
set -euo pipefail

ASTRO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHROMIUM_SRC="$ASTRO_ROOT/chromium/src"
BUILD_TYPE="${1:-Release}"

# Add depot_tools to PATH (gn, autoninja, etc.)
export PATH="$ASTRO_ROOT/depot_tools:$PATH"

echo "=== Astro Browser Build ==="
echo "Root: $ASTRO_ROOT"
echo "Build type: $BUILD_TYPE"

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

# Step 2: Determine GN args file
if [ "$BUILD_TYPE" = "Debug" ]; then
    GN_ARGS_FILE="$ASTRO_ROOT/gn_args/linux_debug.gn"
    OUT_DIR="out/Debug"
else
    GN_ARGS_FILE="$ASTRO_ROOT/gn_args/linux.gn"
    OUT_DIR="out/Release"
fi

if [ ! -f "$GN_ARGS_FILE" ]; then
    echo "ERROR: GN args file not found: $GN_ARGS_FILE"
    exit 1
fi

# Step 3: Generate build files with GN
echo ""
echo ">>> Running GN..."
cd "$CHROMIUM_SRC"
gn gen "$OUT_DIR" --args="$(cat "$GN_ARGS_FILE")"

# Step 4: Build with Ninja
echo ""
echo ">>> Building with Ninja (this may take several hours on first build)..."
JOBS="${ASTRO_BUILD_JOBS:-$(nproc)}"
autoninja -C "$OUT_DIR" chrome -j "$JOBS"

echo ""
echo "=== Build complete ==="
echo "Binary: $CHROMIUM_SRC/$OUT_DIR/chrome"
