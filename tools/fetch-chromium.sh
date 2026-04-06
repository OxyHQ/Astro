#!/usr/bin/env bash
set -euo pipefail

ASTRO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHROMIUM_DIR="$ASTRO_ROOT/chromium"
DEPOT_TOOLS_DIR="$ASTRO_ROOT/depot_tools"

# Target Chromium version (update this when rebasing)
CHROMIUM_VERSION="${CHROMIUM_VERSION:-146.0.7680.177}"

# Cross-compilation targets: space-separated list of OS targets
# Supported: linux, win, android, mac
# Set via env or --targets flag
CROSS_TARGETS="${CROSS_TARGETS:-linux}"

# Parse --targets flag
for arg in "$@"; do
    case "$arg" in
        --targets=*) CROSS_TARGETS="${arg#*=}" ;;
        --targets)   shift; CROSS_TARGETS="${1:-linux}" ;;
    esac
done

echo "=== Fetching Chromium $CHROMIUM_VERSION ==="
echo "Target platforms: $CROSS_TARGETS"

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
fi

# Step 3: Configure target_os for cross-compilation in .gclient
# This MUST be set before gclient sync/runhooks so toolchains are downloaded
echo ""
echo ">>> Configuring cross-compilation targets..."

# Build target_os list from CROSS_TARGETS
TARGET_OS_LIST=""
for target in $CROSS_TARGETS; do
    case "$target" in
        linux)   TARGET_OS_LIST="$TARGET_OS_LIST\"linux\", " ;;
        win)     TARGET_OS_LIST="$TARGET_OS_LIST\"win\", " ;;
        android) TARGET_OS_LIST="$TARGET_OS_LIST\"android\", " ;;
        mac)     TARGET_OS_LIST="$TARGET_OS_LIST\"mac\", " ;;
        *)       echo "WARNING: Unknown target '$target', skipping" ;;
    esac
done

# Remove trailing comma+space
TARGET_OS_LIST="${TARGET_OS_LIST%, }"

# Write .gclient with target_os
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

echo "  .gclient configured with target_os = [$TARGET_OS_LIST]"

# Step 4: Checkout target version
cd "$CHROMIUM_DIR/src"
echo ""
echo ">>> Checking out version $CHROMIUM_VERSION..."
git checkout "tags/$CHROMIUM_VERSION" -B "astro-$CHROMIUM_VERSION"

# Step 5: Sync dependencies (downloads platform-specific SDKs/toolchains)
echo ""
echo ">>> Syncing dependencies (gclient sync)..."
echo "  This downloads SDKs and toolchains for: $CROSS_TARGETS"
gclient sync --with_branch_heads --with_tags -D

# Step 6: Run hooks (installs build tools, SDKs, NDK, Windows SDK, etc.)
# This is where cross-compilation toolchains get downloaded.
# MUST run BEFORE any de-Googling patches (domain substitution) are applied.
echo ""
echo ">>> Running hooks (downloading toolchains)..."
gclient runhooks

echo ""
echo "=== Chromium $CHROMIUM_VERSION ready ==="
echo "Source at: $CHROMIUM_DIR/src"
echo "Targets: $CROSS_TARGETS"
echo ""
echo "Next steps:"
echo "  1. tools/sync-ungoogled.sh    # Get ungoogled-chromium patches"
echo "  2. tools/apply-patches.sh     # Apply all patches"
echo "  3. tools/build.sh             # Build Astro"
