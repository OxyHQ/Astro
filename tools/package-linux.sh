#!/usr/bin/env bash
# package-linux.sh — build the Linux x64 distribution archive.
#
# For #4: the artifact collection was written as `cp … 2>/dev/null || true`,
# which cannot distinguish "this file is not produced on this platform" from
# "the build did not produce it". A package could ship without its sandbox
# binary, its .pak resources or its ICU data and still report success. Required
# artifacts now fail the packaging run; genuinely optional ones warn.

ASTRO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ASTRO_ROOT
# shellcheck source=tools/lib/astro-common.sh
source "$ASTRO_ROOT/tools/lib/astro-common.sh"

BUILD_DIR="${1:-$ASTRO_ROOT/chromium/src/out/Release}"
RELEASE_DIR="$ASTRO_ROOT/releases"
astro::require_file "$ASTRO_ROOT/VERSION" "VERSION file"
VERSION="${ASTRO_VERSION:-$(cat "$ASTRO_ROOT/VERSION")}"

astro::info "=== Packaging Astro $VERSION for Linux x64 ==="

if [ ! -f "$BUILD_DIR/chrome" ]; then
    astro::die_with_hint \
        "Build not found at $BUILD_DIR/chrome" \
        "Run 'tools/build.sh Release linux' first."
fi

# An artifact named after the product must contain the product, and the verdict
# is reached before anything is staged. The Linux payload is the ELF the build
# produced, so it is scanned directly; verified in both directions against real
# artifacts (see tools/package-release.sh for the two).
astro::require_astro_overlay "linux x64" --binary "$BUILD_DIR/chrome"

mkdir -p "$RELEASE_DIR"

# Create tar.gz archive with all required files
ARCHIVE_NAME="astro-${VERSION}-linux-x64.tar.gz"
if [ "$ASTRO_OVERLAY_VERDICT" = "overlayless" ]; then
    ARCHIVE_NAME="$(astro::overlayless_artifact_name "${VERSION}-linux-x64" ".tar.gz")"
fi
STAGING="$RELEASE_DIR/astro-staging"
rm -rf "$STAGING"
mkdir -p "$STAGING/astro"

echo ">>> Collecting files..."

# Core binary and helpers. The sandbox binary is required on Linux: without it
# the browser either refuses to start or runs with a weaker sandbox.
astro::copy_required "$BUILD_DIR/chrome"            "$STAGING/astro/" "browser binary"
astro::copy_required "$BUILD_DIR/chrome_sandbox"    "$STAGING/astro/" "SUID sandbox binary"
astro::copy_required "$BUILD_DIR/chrome_crashpad_handler" "$STAGING/astro/" "crash handler"

# Shared libraries. A component build produces these; a static release build
# does not, so an empty match set is a legitimate configuration difference.
astro::copy_glob "component-build-libraries" "$BUILD_DIR" '*.so' "$STAGING/astro/"

# Data files. Resource packs and ICU data are required — a package without
# them starts and then fails to render.
astro::copy_glob "v8-snapshot-blobs" "$BUILD_DIR" '*.bin' "$STAGING/astro/"
astro::copy_glob "resource-packs"    "$BUILD_DIR" '*.pak' "$STAGING/astro/"
astro::copy_glob "data-files"        "$BUILD_DIR" '*.dat' "$STAGING/astro/"
astro::copy_required "$BUILD_DIR/icudtl.dat" "$STAGING/astro/" "ICU data"

if [ ! -e "$STAGING/astro/chrome_100_percent.pak" ] && [ ! -e "$STAGING/astro/resources.pak" ]; then
    astro::die "No resource packs were staged; the package would not render any UI."
fi

# Locales
if [ -d "$BUILD_DIR/locales" ]; then
    cp -r "$BUILD_DIR/locales" "$STAGING/astro/"
fi

# Resources and MEIPreload
if [ -d "$BUILD_DIR/resources" ]; then
    cp -r "$BUILD_DIR/resources" "$STAGING/astro/"
fi
if [ -d "$BUILD_DIR/MEIPreload" ]; then
    cp -r "$BUILD_DIR/MEIPreload" "$STAGING/astro/"
fi

# WebUI pages
# No per-page resource tree is staged. Every astro:// surface is compiled into
# astro_webui_resources.pak and repacked into the browser's own resources.pak by
# 067-astro-webui-pak-repack.patch, so the pages travel inside the binary this
# artifact already carries. What stood here copied `resources/astro-<page>/`
# directories that no controller reads any more.

# Build provenance: a release artifact must carry the exact source revisions,
# GN args and toolchain identity it was produced from (ASTRO-NEXT-002, #5), plus
# the overlay verdict, so an unpacked artifact says what it is even once its
# filename has been lost.
astro::stage_provenance "$STAGING/astro/provenance.json"

# Launcher script. The generated install.sh symlinks to it, so a package
# without it installs a broken `astro` command.
astro::copy_required "$ASTRO_ROOT/tools/astro-launch.sh" "$STAGING/astro/" "launcher script"
chmod +x "$STAGING/astro/astro-launch.sh"

# Desktop entry and icon
astro::copy_required "$ASTRO_ROOT/branding/astro-browser.desktop" \
    "$STAGING/astro/" "desktop entry"
astro::copy_required "$ASTRO_ROOT/branding/web/icon-512.png" \
    "$STAGING/astro/astro-browser.png" "application icon"

# Install script
cat > "$STAGING/astro/install.sh" << 'INSTALL_EOF'
#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INSTALL_DIR="$HOME/.local/share/astro"
BIN_DIR="$HOME/.local/bin"
APPS_DIR="$HOME/.local/share/applications"

echo "Installing Astro Browser..."
mkdir -p "$INSTALL_DIR" "$BIN_DIR" "$APPS_DIR"
cp -r "$SCRIPT_DIR/"* "$INSTALL_DIR/"
chmod +x "$INSTALL_DIR/chrome" "$INSTALL_DIR/chrome_sandbox"

# Desktop entry
if [ -f "$INSTALL_DIR/astro-browser.desktop" ]; then
    sed "s|Exec=.*|Exec=$INSTALL_DIR/astro-launch.sh %U|" \
        "$INSTALL_DIR/astro-browser.desktop" > "$APPS_DIR/astro-browser.desktop"
fi

# Symlink
ln -sf "$INSTALL_DIR/astro-launch.sh" "$BIN_DIR/astro"

echo "Astro installed. Run 'astro' or find it in your app launcher."
INSTALL_EOF
chmod +x "$STAGING/astro/install.sh"

astro::info ">>> Creating $ARCHIVE_NAME..."
( cd "$STAGING" && tar czf "$RELEASE_DIR/$ARCHIVE_NAME" astro/ )
astro::require_file "$RELEASE_DIR/$ARCHIVE_NAME" "release archive"

rm -rf "$STAGING"

astro::info "=== Package created ==="
astro::info "Archive: $RELEASE_DIR/$ARCHIVE_NAME"
astro::info "Size: $(du -h "$RELEASE_DIR/$ARCHIVE_NAME" | cut -f1)"
