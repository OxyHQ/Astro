#!/usr/bin/env bash
set -euo pipefail

ASTRO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="${1:-$ASTRO_ROOT/chromium/src/out/Release}"
RELEASE_DIR="$ASTRO_ROOT/releases"
VERSION="${ASTRO_VERSION:-$(cat "$ASTRO_ROOT/VERSION" 2>/dev/null || echo "0.1.0")}"

echo "=== Packaging Astro $VERSION for macOS arm64 ==="

# Locate the .app bundle (Chromium builds produce Chromium.app by default)
APP_BUNDLE=""
for candidate in "$BUILD_DIR/Astro.app" "$BUILD_DIR/Chromium.app"; do
    if [ -d "$candidate" ]; then
        APP_BUNDLE="$candidate"
        break
    fi
done

if [ -z "$APP_BUNDLE" ]; then
    echo "ERROR: No .app bundle found in $BUILD_DIR"
    echo "Expected Astro.app or Chromium.app"
    exit 1
fi

APP_NAME=$(basename "$APP_BUNDLE")
echo "Found app bundle: $APP_NAME"

mkdir -p "$RELEASE_DIR"

# --- Copy WebUI resources into the bundle ---
RESOURCES_DIR="$APP_BUNDLE/Contents/Resources"
for page in ntp alia settings whats-new error; do
    if [ -d "$BUILD_DIR/astro-$page" ]; then
        mkdir -p "$RESOURCES_DIR/astro-$page"
        cp -r "$BUILD_DIR/astro-$page/"* "$RESOURCES_DIR/astro-$page/"
    fi
done

# --- Code signing (optional, requires Apple Developer certificate) ---
if [ -n "${MACOS_CERTIFICATE_P12:-}" ] && [ -n "${MACOS_CERTIFICATE_PASSWORD:-}" ]; then
    echo ">>> Setting up code signing..."

    KEYCHAIN="astro-build.keychain-db"
    KEYCHAIN_PASSWORD="$(openssl rand -base64 32)"

    # Create temporary keychain
    security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN"
    security set-keychain-settings -lut 21600 "$KEYCHAIN"
    security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN"

    # Import certificate
    echo "$MACOS_CERTIFICATE_P12" | base64 --decode > cert.p12
    security import cert.p12 -k "$KEYCHAIN" -P "$MACOS_CERTIFICATE_PASSWORD" \
        -T /usr/bin/codesign -T /usr/bin/productsign
    rm cert.p12

    security list-keychains -d user -s "$KEYCHAIN" login.keychain
    security set-key-partition-list -S apple-tool:,apple: -s -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN"

    # Find signing identity
    IDENTITY=$(security find-identity -v -p codesigning "$KEYCHAIN" | head -1 | awk -F'"' '{print $2}')

    if [ -n "$IDENTITY" ]; then
        echo ">>> Signing with: $IDENTITY"
        codesign --deep --force --options runtime \
            --sign "$IDENTITY" \
            --keychain "$KEYCHAIN" \
            "$APP_BUNDLE"
        echo "  App signed successfully"
    else
        echo "WARNING: No signing identity found in certificate"
    fi
else
    echo ">>> Skipping code signing (no certificate configured)"
fi

# --- Create DMG ---
DMG_NAME="astro-${VERSION}-macos-arm64.dmg"
DMG_PATH="$RELEASE_DIR/$DMG_NAME"
DMG_STAGING="$RELEASE_DIR/dmg-staging"

echo ">>> Creating DMG..."
rm -rf "$DMG_STAGING" "$DMG_PATH"
mkdir -p "$DMG_STAGING"

# Copy app bundle
cp -R "$APP_BUNDLE" "$DMG_STAGING/"

# Create Applications symlink for drag-to-install
ln -s /Applications "$DMG_STAGING/Applications"

# Create DMG
hdiutil create -volname "Astro" \
    -srcfolder "$DMG_STAGING" \
    -ov -format UDZO \
    "$DMG_PATH"

rm -rf "$DMG_STAGING"

# --- Notarize (optional, requires Apple ID credentials) ---
if [ -n "${MACOS_NOTARY_APPLE_ID:-}" ] && [ -n "${MACOS_NOTARY_PASSWORD:-}" ] && [ -n "${MACOS_NOTARY_TEAM_ID:-}" ]; then
    echo ">>> Notarizing DMG..."
    xcrun notarytool submit "$DMG_PATH" \
        --apple-id "$MACOS_NOTARY_APPLE_ID" \
        --password "$MACOS_NOTARY_PASSWORD" \
        --team-id "$MACOS_NOTARY_TEAM_ID" \
        --wait

    echo ">>> Stapling notarization ticket..."
    xcrun stapler staple "$DMG_PATH"
    echo "  Notarization complete"
else
    echo ">>> Skipping notarization (no credentials configured)"
fi

# --- Cleanup keychain ---
if [ -n "${KEYCHAIN:-}" ]; then
    security delete-keychain "$KEYCHAIN" 2>/dev/null || true
fi

echo ""
echo "=== macOS packaging complete ==="
echo "DMG: $DMG_PATH"
echo "Size: $(du -h "$DMG_PATH" | cut -f1)"
