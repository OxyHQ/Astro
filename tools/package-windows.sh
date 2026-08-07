#!/usr/bin/env bash
ASTRO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ASTRO_ROOT
# shellcheck source=tools/lib/astro-common.sh
source "$ASTRO_ROOT/tools/lib/astro-common.sh"
BUILD_DIR="${1:-$ASTRO_ROOT/chromium/src/out/Release}"
RELEASE_DIR="$ASTRO_ROOT/releases"
astro::require_file "$ASTRO_ROOT/VERSION" "VERSION file"
VERSION="${ASTRO_VERSION:-$(cat "$ASTRO_ROOT/VERSION")}"
ARCH="${ASTRO_ARCH:-x64}"

echo "=== Packaging Astro $VERSION for Windows $ARCH ==="

# An artifact named after the product must contain the product, and the verdict
# is reached before either artifact below is written.
#
# WHICH file to scan was decided against a real artifact, not by analogy with
# Linux, and the obvious choice is the wrong one. Extracted from the shipped
# releases/astro-0.1.0-windows-arm64-portable.zip:
#
#   chrome.exe   2.5 MB   unmeasurable — a launcher stub, no control marker
#   chrome.dll   270 MB   present — astro-ntp x2, astro-error x2, chrome://alia x1
#
# Gating on chrome.exe alone would therefore have refused every Windows package
# forever, fail-closed but useless. Both are passed and the verdict is taken
# over the pair, so a future monolithic chrome.exe answers too.
#
# The string scan needs no PE-specific handling: the same ASCII printable-run
# scan that finds the markers in an ELF finds them in this PE. UTF-16LE is
# scanned as well, since a PE may hold wide string literals — measured on that
# same chrome.dll, `chrome://version` occurs once in UTF-16LE and the overlay
# markers zero times, so ASCII carried the verdict, but widening the scan can
# only remove false refusals.
#
# mini_installer.exe is deliberately NOT the probe: its payload is a compressed
# archive, so no string survives to be scanned. Measured on the shipped
# releases/astro-0.1.0-windows-arm64-installer.exe — exit 2, unmeasurable, the
# control marker absent. The installer is built by ninja from the chrome.dll in
# this same build directory, so that DLL is the honest thing to gate on; a
# stale installer beside a fresh DLL is a build-directory hygiene problem this
# check does not claim to catch.
astro::require_astro_overlay "windows $ARCH" \
    --binary "$BUILD_DIR/chrome.dll" --binary "$BUILD_DIR/chrome.exe"

mkdir -p "$RELEASE_DIR"

# --- Installer (mini_installer.exe) ---
INSTALLER="$BUILD_DIR/mini_installer.exe"
if [ -f "$INSTALLER" ]; then
    INSTALLER_NAME="astro-${VERSION}-windows-$ARCH-installer.exe"
    if [ "$ASTRO_OVERLAY_VERDICT" = "overlayless" ]; then
        INSTALLER_NAME="$(astro::overlayless_artifact_name \
            "${VERSION}-windows-${ARCH}-installer" ".exe")"
    fi
    echo ">>> Copying installer as $INSTALLER_NAME..."
    cp "$INSTALLER" "$RELEASE_DIR/$INSTALLER_NAME"
    # An installer is a single opaque file, so its provenance travels beside it
    # rather than inside it.
    astro::stage_provenance "$RELEASE_DIR/$INSTALLER_NAME.provenance.json"
    echo "Installer: $RELEASE_DIR/$INSTALLER_NAME"
    echo "Size: $(du -h "$RELEASE_DIR/$INSTALLER_NAME" | cut -f1)"
else
    echo "WARNING: mini_installer.exe not found, creating portable zip instead"
fi

# --- Portable zip ---
if [ -f "$BUILD_DIR/chrome.exe" ]; then
    ZIP_NAME="astro-${VERSION}-windows-$ARCH-portable.zip"
    if [ "$ASTRO_OVERLAY_VERDICT" = "overlayless" ]; then
        ZIP_NAME="$(astro::overlayless_artifact_name \
            "${VERSION}-windows-${ARCH}-portable" ".zip")"
    fi
    STAGING="$RELEASE_DIR/astro-win-staging"
    rm -rf "$STAGING"
    mkdir -p "$STAGING/astro"

    echo ">>> Collecting files for portable zip..."

    # Core binary
    astro::copy_required "$BUILD_DIR/chrome.exe"     "$STAGING/astro/" "browser binary"
    astro::copy_required "$BUILD_DIR/chrome_elf.dll" "$STAGING/astro/" "chrome_elf loader"
    astro::copy_required "$BUILD_DIR/chrome_crashpad_handler.exe" \
        "$STAGING/astro/" "crash handler"
    # These three are produced only by some configurations; their absence is a
    # build-config difference, not a broken package.
    astro::copy_optional "chrome-proxy"        "$BUILD_DIR/chrome_proxy.exe"        "$STAGING/astro/"
    astro::copy_optional "pwa-launcher"        "$BUILD_DIR/chrome_pwa_launcher.exe" "$STAGING/astro/"
    astro::copy_optional "elevation-service"   "$BUILD_DIR/elevation_service.exe"   "$STAGING/astro/"
    astro::copy_optional "notification-helper" "$BUILD_DIR/notification_helper.exe" "$STAGING/astro/"

    # DLLs (skip empty stubs from cross-compilation)
    for dll in "$BUILD_DIR"/*.dll; do
        [ -f "$dll" ] || continue
        size="$(astro::file_size "$dll")"
        if [ "$size" -gt 100 ]; then
            cp "$dll" "$STAGING/astro/"
        fi
    done

    # Data files
    astro::copy_glob "v8-snapshot-blobs" "$BUILD_DIR" '*.bin' "$STAGING/astro/"
    astro::copy_glob "resource-packs"    "$BUILD_DIR" '*.pak' "$STAGING/astro/"
    astro::copy_glob "data-files"        "$BUILD_DIR" '*.dat' "$STAGING/astro/"
    astro::copy_required "$BUILD_DIR/icudtl.dat" "$STAGING/astro/" "ICU data"

    # A release artifact must carry the exact source revisions, GN args and
    # toolchain identity it was produced from (ASTRO-NEXT-002, #5), plus the
    # overlay verdict.
    astro::stage_provenance "$STAGING/astro/provenance.json"

    # Locales
    if [ -d "$BUILD_DIR/locales" ]; then
        cp -r "$BUILD_DIR/locales" "$STAGING/astro/"
    else
        astro::warn "optional:locales" "no locales/ directory in $BUILD_DIR"
    fi

    # Resources
    if [ -d "$BUILD_DIR/resources" ]; then
        cp -r "$BUILD_DIR/resources" "$STAGING/astro/"
    fi
    if [ -d "$BUILD_DIR/MEIPreload" ]; then
        cp -r "$BUILD_DIR/MEIPreload" "$STAGING/astro/"
    fi

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
