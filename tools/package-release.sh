#!/usr/bin/env bash
set -euo pipefail

ASTRO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="${1:-$ASTRO_ROOT/chromium/src/out/Release}"
RELEASE_DIR="$ASTRO_ROOT/releases"
VERSION=$(cat "$ASTRO_ROOT/VERSION" 2>/dev/null || echo "0.1.0")

echo "=== Packaging Astro $VERSION ==="

if [ ! -f "$BUILD_DIR/chrome" ]; then
    echo "ERROR: Build not found at $BUILD_DIR/chrome"
    echo "Run tools/build.sh first"
    exit 1
fi

mkdir -p "$RELEASE_DIR"

# Create tar.gz archive
ARCHIVE_NAME="astro-${VERSION}-linux-x64.tar.gz"
echo ">>> Creating $ARCHIVE_NAME..."

cd "$BUILD_DIR"
tar czf "$RELEASE_DIR/$ARCHIVE_NAME" \
    chrome \
    chrome_sandbox \
    chrome_crashpad_handler \
    *.so \
    *.pak \
    *.dat \
    *.bin \
    icudtl.dat \
    locales/ \
    resources/ \
    MEIPreload/ \
    2>/dev/null || true

echo ""
echo "=== Package created ==="
echo "Archive: $RELEASE_DIR/$ARCHIVE_NAME"
echo "Size: $(du -h "$RELEASE_DIR/$ARCHIVE_NAME" | cut -f1)"
