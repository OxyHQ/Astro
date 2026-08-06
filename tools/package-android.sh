#!/usr/bin/env bash
ASTRO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ASTRO_ROOT
# shellcheck source=tools/lib/astro-common.sh
source "$ASTRO_ROOT/tools/lib/astro-common.sh"
BUILD_DIR="${1:-$ASTRO_ROOT/chromium/src/out/Release}"
RELEASE_DIR="$ASTRO_ROOT/releases"
astro::require_file "$ASTRO_ROOT/VERSION" "VERSION file"
VERSION="${ASTRO_VERSION:-$(cat "$ASTRO_ROOT/VERSION")}"

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
    # No `| head`: piping find into head sends it SIGPIPE once head is
    # satisfied, which pipefail turns into exit 141. An out/Release apks
    # directory holds a handful of files, so the slice bought nothing.
    find "$BUILD_DIR" -name "*.apk"
    exit 1
fi

echo "Found APK: $APK"

# An artifact named after the product must contain the product, and the verdict
# is reached before the APK is copied, aligned or signed.
#
# An APK is a zip, so it is scanned as one. The member filter is the whole
# decision: an APK carries the WebUI resources as well as the code, and an
# `astro-ntp` string in a packaged HTML file says nothing about whether the
# overlay was compiled into the browser — which is the entire question. So only
# native code is scanned, and the control marker has to be found in that same
# native code for the verdict to count.
#
# If a build lays its native libraries out some other way, no member matches,
# nothing is measured, and the packager refuses. That is the correct outcome
# rather than a reason to widen the filter until something matches: a filter
# widened to `*` would let the resources answer, and then an overlayless
# Android build would package itself as Astro.
#
# Verified against a synthetic zip fixture in all three directions, NOT against
# a real Chromium APK — none exists in this repository and none can be built
# here. Whether a real libmonochrome.so carries `chrome://version` is therefore
# UNMEASURED; if it does not, this packager will refuse until someone calibrates
# the probe against a real APK. Refusing is the safe direction, and it is loud.
astro::require_astro_overlay "android arm64" \
    --zip "$APK" --zip-member-glob '*.so'

mkdir -p "$RELEASE_DIR"

OUTPUT_NAME="astro-${VERSION}-android-arm64.apk"
if [ "$ASTRO_OVERLAY_VERDICT" = "overlayless" ]; then
    OUTPUT_NAME="$(astro::overlayless_artifact_name "${VERSION}-android-arm64" ".apk")"
fi
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

# An APK cannot carry the provenance inside it — adding a member after signing
# invalidates the signature, and adding one before it changes what was signed —
# so it travels beside the artifact.
astro::stage_provenance "$OUTPUT_PATH.provenance.json"

echo ""
echo "=== Android packaging complete ==="
echo "APK: $OUTPUT_PATH"
echo "Size: $(du -h "$OUTPUT_PATH" | cut -f1)"
