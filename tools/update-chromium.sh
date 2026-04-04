#!/usr/bin/env bash
set -euo pipefail

ASTRO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Chromium Version Update ==="
echo ""
echo "This script updates Astro to a new Chromium version."
echo "It will:"
echo "  1. Fetch the new Chromium version"
echo "  2. Sync matching ungoogled-chromium patches"
echo "  3. Attempt to apply all patches"
echo "  4. Report any conflicts"
echo ""

NEW_VERSION="${1:-}"
if [ -z "$NEW_VERSION" ]; then
    echo "Usage: $0 <chromium-version>"
    echo "Example: $0 136.0.7103.92"
    exit 1
fi

export CHROMIUM_VERSION="$NEW_VERSION"

echo ">>> Updating to Chromium $NEW_VERSION..."
echo ""

# Step 1: Fetch new Chromium version
"$ASTRO_ROOT/tools/fetch-chromium.sh"

# Step 2: Sync ungoogled patches
"$ASTRO_ROOT/tools/sync-ungoogled.sh"

# Step 3: Apply patches
echo ""
echo ">>> Applying patches to new version..."
"$ASTRO_ROOT/tools/apply-patches.sh" all

echo ""
echo "=== Update to Chromium $NEW_VERSION complete ==="
echo "Run tools/build.sh to build."
