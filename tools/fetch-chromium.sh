#!/usr/bin/env bash
set -euo pipefail

ASTRO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHROMIUM_DIR="$ASTRO_ROOT/chromium"
DEPOT_TOOLS_DIR="$ASTRO_ROOT/depot_tools"

# Target Chromium version (update this when rebasing)
CHROMIUM_VERSION="${CHROMIUM_VERSION:-146.0.7680.177}"

echo "=== Fetching Chromium $CHROMIUM_VERSION ==="

# Step 1: Ensure depot_tools is available
if [ ! -d "$DEPOT_TOOLS_DIR" ]; then
    echo ">>> Cloning depot_tools..."
    git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git "$DEPOT_TOOLS_DIR"
else
    echo ">>> Updating depot_tools..."
    cd "$DEPOT_TOOLS_DIR" && git pull
fi

export PATH="$DEPOT_TOOLS_DIR:$PATH"

# Step 2: Create chromium directory and fetch
mkdir -p "$CHROMIUM_DIR"
cd "$CHROMIUM_DIR"

if [ ! -f ".gclient" ]; then
    echo ""
    echo ">>> Running fetch (this will take a while - ~30GB download)..."
    fetch --nohooks chromium
else
    echo ">>> Chromium already fetched, syncing..."
fi

# Step 3: Checkout target version
cd "$CHROMIUM_DIR/src"
echo ""
echo ">>> Checking out version $CHROMIUM_VERSION..."
git checkout "tags/$CHROMIUM_VERSION" -B "astro-$CHROMIUM_VERSION"

# Step 4: Sync dependencies
echo ""
echo ">>> Syncing dependencies (gclient sync)..."
gclient sync --with_branch_heads --with_tags -D

# Step 5: Run hooks
echo ""
echo ">>> Running hooks..."
gclient runhooks

echo ""
echo "=== Chromium $CHROMIUM_VERSION ready ==="
echo "Source at: $CHROMIUM_DIR/src"
echo ""
echo "Next steps:"
echo "  1. tools/sync-ungoogled.sh    # Get ungoogled-chromium patches"
echo "  2. tools/apply-patches.sh     # Apply all patches"
echo "  3. tools/build.sh             # Build Astro"
