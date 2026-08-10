#!/usr/bin/env bash
ASTRO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ASTRO_ROOT
# shellcheck source=tools/lib/astro-common.sh
source "$ASTRO_ROOT/tools/lib/astro-common.sh"
BUILD_DIR="${1:-$ASTRO_ROOT/chromium/src/out/Release}"
RELEASE_DIR="$ASTRO_ROOT/releases"
astro::require_file "$ASTRO_ROOT/VERSION" "VERSION file"
VERSION="${ASTRO_VERSION:-$(cat "$ASTRO_ROOT/VERSION")}"

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

# An artifact named after the product must contain the product, and the verdict
# is reached BEFORE the WebUI copy below, which writes into the bundle in place
# inside the build directory. Two reasons, and the ordering alone does not cover
# both: a second run of this script would find the resources from the first one
# already there, so gating first is necessary but not sufficient.
#
# Hence --bundle rather than a path: it walks the bundle and scans only files
# carrying a Mach-O magic number, so only compiled CODE can answer the question.
# A resources tree containing `astro-ntp/index.html` — which an overlayless
# build gets simply by being packaged twice — cannot vote.
#
# Walking is also what makes the probe correct at all. macOS splits the browser
# the same way Windows does: Contents/MacOS/<name> is a launcher stub and the
# code lives in Contents/Frameworks/<name>.framework. That split is measured on
# the Windows equivalent — real chrome.exe reports unmeasurable while the
# chrome.dll beside it reports present — so naming one path here would have been
# a coin flip. Verified against a fixture, not a real .app: no macOS artifact
# exists in this repository and none can be produced on Linux.
astro::require_astro_overlay "macos arm64" --bundle "$APP_BUNDLE"

mkdir -p "$RELEASE_DIR"

# No per-page resource tree is staged. Every astro:// surface is compiled into
# astro_webui_resources.pak and repacked into the browser's own resources.pak by
# 067-astro-webui-pak-repack.patch, so the pages travel inside the binary this
# artifact already carries. What stood here copied `resources/astro-<page>/`
# directories that no controller reads any more.

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
if [ "$ASTRO_OVERLAY_VERDICT" = "overlayless" ]; then
    DMG_NAME="$(astro::overlayless_artifact_name "${VERSION}-macos-arm64" ".dmg")"
fi
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

# A DMG is a single opaque file, so its provenance — including the overlay
# verdict — travels beside it rather than inside it.
astro::stage_provenance "$DMG_PATH.provenance.json"

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
    astro::optional "keychain-cleanup" security delete-keychain "$KEYCHAIN"
fi

echo ""
echo "=== macOS packaging complete ==="
echo "DMG: $DMG_PATH"
echo "Size: $(du -h "$DMG_PATH" | cut -f1)"
