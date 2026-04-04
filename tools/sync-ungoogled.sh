#!/usr/bin/env bash
set -euo pipefail

ASTRO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UNGOOGLED_DIR="$ASTRO_ROOT/.ungoogled-chromium"
PATCHES_DIR="$ASTRO_ROOT/patches/ungoogled"

# Match this to the Chromium version we're building against
CHROMIUM_VERSION="${CHROMIUM_VERSION:-146.0.7680.177}"
UNGOOGLED_BRANCH="master"

echo "=== Syncing ungoogled-chromium patches ==="

# Clone or update ungoogled-chromium
if [ ! -d "$UNGOOGLED_DIR" ]; then
    echo ">>> Cloning ungoogled-chromium..."
    git clone https://github.com/ungoogled-software/ungoogled-chromium.git "$UNGOOGLED_DIR"
else
    echo ">>> Updating ungoogled-chromium..."
    cd "$UNGOOGLED_DIR" && git fetch origin && git checkout "$UNGOOGLED_BRANCH" && git pull
fi

cd "$UNGOOGLED_DIR"

# Find the closest matching version tag
echo ""
echo ">>> Looking for patches matching Chromium $CHROMIUM_VERSION..."
MAJOR_VERSION=$(echo "$CHROMIUM_VERSION" | cut -d. -f1)

# Try exact tag first, then closest major version
MATCHING_TAG=$(git tag -l "${CHROMIUM_VERSION}-*" | sort -V | tail -1)
if [ -z "$MATCHING_TAG" ]; then
    MATCHING_TAG=$(git tag -l "${MAJOR_VERSION}.*" | sort -V | tail -1)
fi

if [ -n "$MATCHING_TAG" ]; then
    echo "  Found matching tag: $MATCHING_TAG"
    git checkout "$MATCHING_TAG"
else
    echo "  No exact match found, using latest $UNGOOGLED_BRANCH"
    echo "  WARNING: Patches may not apply cleanly to Chromium $CHROMIUM_VERSION"
fi

# Copy patches to our patches directory
echo ""
echo ">>> Copying patches..."

# Core patches (domain substitution, binary pruning, etc.)
rm -rf "$PATCHES_DIR/core" "$PATCHES_DIR/extra"
mkdir -p "$PATCHES_DIR/core" "$PATCHES_DIR/extra"

if [ -d "patches/core" ]; then
    cp -r patches/core/* "$PATCHES_DIR/core/" 2>/dev/null || true
fi

if [ -d "patches/extra" ]; then
    cp -r patches/extra/* "$PATCHES_DIR/extra/" 2>/dev/null || true
fi

# Also copy domain substitution and pruning configs
if [ -f "domain_regex.list" ]; then
    cp domain_regex.list "$PATCHES_DIR/"
fi
if [ -f "domain_substitution.list" ]; then
    cp domain_substitution.list "$PATCHES_DIR/"
fi
if [ -f "pruning.list" ]; then
    cp pruning.list "$PATCHES_DIR/"
fi

CORE_COUNT=$(find "$PATCHES_DIR/core" -name "*.patch" 2>/dev/null | wc -l)
EXTRA_COUNT=$(find "$PATCHES_DIR/extra" -name "*.patch" 2>/dev/null | wc -l)

echo ""
echo "=== Sync complete ==="
echo "Core patches: $CORE_COUNT"
echo "Extra patches: $EXTRA_COUNT"
echo "Patches at: $PATCHES_DIR/"
echo ""
echo "Next: tools/apply-patches.sh"
