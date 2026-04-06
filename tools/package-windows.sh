#!/usr/bin/env bash
set -euo pipefail

ASTRO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="${1:-$ASTRO_ROOT/chromium/src/out/Release}"
RELEASE_DIR="$ASTRO_ROOT/releases"
VERSION="${ASTRO_VERSION:-$(cat "$ASTRO_ROOT/VERSION" 2>/dev/null || echo "0.1.0")}"
ARCH="${ASTRO_ARCH:-x64}"

echo "=== Packaging Astro $VERSION for Windows $ARCH ==="

mkdir -p "$RELEASE_DIR"

# --- Installer (mini_installer.exe) ---
INSTALLER="$BUILD_DIR/mini_installer.exe"
if [ -f "$INSTALLER" ]; then
    INSTALLER_NAME="astro-${VERSION}-windows-$ARCH-installer.exe"
    echo ">>> Copying installer as $INSTALLER_NAME..."
    cp "$INSTALLER" "$RELEASE_DIR/$INSTALLER_NAME"
    echo "Installer: $RELEASE_DIR/$INSTALLER_NAME"
    echo "Size: $(du -h "$RELEASE_DIR/$INSTALLER_NAME" | cut -f1)"
else
    echo "WARNING: mini_installer.exe not found, creating portable zip instead"
fi

# --- Portable zip ---
if [ -f "$BUILD_DIR/chrome.exe" ]; then
    ZIP_NAME="astro-${VERSION}-windows-$ARCH-portable.zip"
    STAGING="$RELEASE_DIR/astro-win-staging"
    rm -rf "$STAGING"
    mkdir -p "$STAGING/astro"

    echo ">>> Collecting files for portable zip..."

    # Core binary
    cp "$BUILD_DIR/chrome.exe" "$STAGING/astro/"
    cp "$BUILD_DIR/chrome_proxy.exe" "$STAGING/astro/" 2>/dev/null || true
    cp "$BUILD_DIR/chrome_pwa_launcher.exe" "$STAGING/astro/" 2>/dev/null || true
    cp "$BUILD_DIR/chrome_elf.dll" "$STAGING/astro/" 2>/dev/null || true
    cp "$BUILD_DIR/elevation_service.exe" "$STAGING/astro/" 2>/dev/null || true
    cp "$BUILD_DIR/notification_helper.exe" "$STAGING/astro/" 2>/dev/null || true
    cp "$BUILD_DIR/chrome_crashpad_handler.exe" "$STAGING/astro/" 2>/dev/null || true

    # DLLs
    cp "$BUILD_DIR"/*.dll "$STAGING/astro/" 2>/dev/null || true

    # Data files
    cp "$BUILD_DIR"/*.pak "$STAGING/astro/" 2>/dev/null || true
    cp "$BUILD_DIR"/*.dat "$STAGING/astro/" 2>/dev/null || true
    cp "$BUILD_DIR"/*.bin "$STAGING/astro/" 2>/dev/null || true
    cp "$BUILD_DIR/icudtl.dat" "$STAGING/astro/" 2>/dev/null || true

    # Locales
    [ -d "$BUILD_DIR/locales" ] && cp -r "$BUILD_DIR/locales" "$STAGING/astro/"

    # Resources
    [ -d "$BUILD_DIR/resources" ] && cp -r "$BUILD_DIR/resources" "$STAGING/astro/"
    [ -d "$BUILD_DIR/MEIPreload" ] && cp -r "$BUILD_DIR/MEIPreload" "$STAGING/astro/"

    # WebUI pages
    for page in ntp alia settings whats-new error; do
        if [ -d "$BUILD_DIR/astro-$page" ]; then
            mkdir -p "$STAGING/astro/resources/astro-$page"
            cp -r "$BUILD_DIR/astro-$page/"* "$STAGING/astro/resources/astro-$page/"
        fi
    done

    echo ">>> Creating $ZIP_NAME..."
    cd "$STAGING"
    if command -v 7z &>/dev/null; then
        7z a -tzip "$RELEASE_DIR/$ZIP_NAME" astro/
    elif command -v zip &>/dev/null; then
        zip -r "$RELEASE_DIR/$ZIP_NAME" astro/
    else
        # Fallback: tar + gzip (works on Windows Git Bash)
        tar czf "$RELEASE_DIR/${ZIP_NAME%.zip}.tar.gz" astro/
        echo "NOTE: zip not available, created .tar.gz instead"
    fi

    rm -rf "$STAGING"
    echo "Portable: $RELEASE_DIR/$ZIP_NAME"
fi

echo ""
echo "=== Windows packaging complete ==="
