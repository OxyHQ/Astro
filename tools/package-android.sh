#!/usr/bin/env bash
set -euo pipefail

ASTRO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="${1:-$ASTRO_ROOT/chromium/src/out/Release}"
RELEASE_DIR="$ASTRO_ROOT/releases"
VERSION="${ASTRO_VERSION:-$(cat "$ASTRO_ROOT/VERSION" 2>/dev/null || echo "0.1.0")}"

echo "=== Packaging Astro $VERSION for Android arm64 ==="

# Locate the APK (Chromium builds output to apks/ subdirectory)
APK=""
for candidate in \
    "$BUILD_DIR/apks/ChromePublic.apk" \
    "$BUILD_DIR/apks/Chrome.apk" \
    "$BUILD_DIR/apks/Astro.apk" \
    "$BUILD_DIR/ChromePublic.apk"; do
    if [ -f "$candidate" ]; then
        APK="$candidate"
        break
    fi
done

if [ -z "$APK" ]; then
    echo "ERROR: No APK found in $BUILD_DIR"
    echo "Expected ChromePublic.apk in $BUILD_DIR/apks/"
    echo ""
    echo "Available files:"
    find "$BUILD_DIR" -name "*.apk" 2>/dev/null | head -10 || echo "  (none)"
    exit 1
fi

echo "Found APK: $APK"
mkdir -p "$RELEASE_DIR"

OUTPUT_NAME="astro-${VERSION}-android-arm64.apk"
OUTPUT_PATH="$RELEASE_DIR/$OUTPUT_NAME"

# --- Sign APK (optional, requires keystore) ---
if [ -n "${ANDROID_KEYSTORE:-}" ] && [ -n "${ANDROID_KEYSTORE_PASSWORD:-}" ]; then
    echo ">>> Signing APK..."

    # Decode keystore from base64
    KEYSTORE_FILE="$RELEASE_DIR/astro-release.jks"
    echo "$ANDROID_KEYSTORE" | base64 --decode > "$KEYSTORE_FILE"

    KEY_ALIAS="${ANDROID_KEY_ALIAS:-astro}"
    KEY_PASSWORD="${ANDROID_KEY_PASSWORD:-$ANDROID_KEYSTORE_PASSWORD}"

    # Locate build tools
    ANDROID_SDK="$ASTRO_ROOT/chromium/src/third_party/android_sdk/public"
    BUILD_TOOLS_DIR=$(find "$ANDROID_SDK/build-tools" -maxdepth 1 -type d | sort -V | tail -1)

    if [ -n "$BUILD_TOOLS_DIR" ] && [ -f "$BUILD_TOOLS_DIR/apksigner" ]; then
        APKSIGNER="$BUILD_TOOLS_DIR/apksigner"
    elif command -v apksigner &>/dev/null; then
        APKSIGNER="apksigner"
    else
        echo "ERROR: apksigner not found"
        rm -f "$KEYSTORE_FILE"
        exit 1
    fi

    # zipalign first
    ZIPALIGN="${BUILD_TOOLS_DIR:+$BUILD_TOOLS_DIR/zipalign}"
    if [ -n "$ZIPALIGN" ] && [ -f "$ZIPALIGN" ]; then
        echo "  Aligning APK..."
        "$ZIPALIGN" -v -p 4 "$APK" "$OUTPUT_PATH.aligned"
        APK="$OUTPUT_PATH.aligned"
    elif command -v zipalign &>/dev/null; then
        zipalign -v -p 4 "$APK" "$OUTPUT_PATH.aligned"
        APK="$OUTPUT_PATH.aligned"
    fi

    # Sign
    echo "  Signing with key: $KEY_ALIAS"
    "$APKSIGNER" sign \
        --ks "$KEYSTORE_FILE" \
        --ks-pass "pass:$ANDROID_KEYSTORE_PASSWORD" \
        --ks-key-alias "$KEY_ALIAS" \
        --key-pass "pass:$KEY_PASSWORD" \
        --out "$OUTPUT_PATH" \
        "$APK"

    # Verify
    "$APKSIGNER" verify "$OUTPUT_PATH"
    echo "  APK signed and verified"

    # Clean up
    rm -f "$KEYSTORE_FILE" "$OUTPUT_PATH.aligned"
else
    echo ">>> No keystore configured, copying unsigned APK"
    cp "$APK" "$OUTPUT_PATH"
fi

echo ""
echo "=== Android packaging complete ==="
echo "APK: $OUTPUT_PATH"
echo "Size: $(du -h "$OUTPUT_PATH" | cut -f1)"
