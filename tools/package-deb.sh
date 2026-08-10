#!/usr/bin/env bash
ASTRO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ASTRO_ROOT
# shellcheck source=tools/lib/astro-common.sh
source "$ASTRO_ROOT/tools/lib/astro-common.sh"
BUILD_DIR="${1:-$ASTRO_ROOT/chromium/src/out/Release}"
RELEASE_DIR="$ASTRO_ROOT/releases"
astro::require_file "$ASTRO_ROOT/VERSION" "VERSION file"
VERSION="${ASTRO_VERSION:-$(cat "$ASTRO_ROOT/VERSION")}"
ARCH="amd64"
PKG_NAME="astro-browser"

echo "=== Building Astro $VERSION .deb package ==="

if [ ! -f "$BUILD_DIR/chrome" ]; then
    echo "ERROR: Build not found at $BUILD_DIR/chrome"
    echo "Run 'tools/build.sh Release linux' first"
    exit 1
fi

# An artifact named after the product must contain the product, and the verdict
# is reached before the staging tree exists. A .deb payload is the same ELF the
# Linux archive ships, so the same direct scan applies with no per-format
# handling — verified against the `chrome` inside the shipped
# astro-browser_0.1.0_amd64.deb, which reports present.
astro::require_astro_overlay "deb" --binary "$BUILD_DIR/chrome"

# A .deb carries its identity twice: in the filename and in the control file's
# Package field, which is what `dpkg -l` and every dependency resolver report
# afterwards. Renaming only the file would leave `astro-browser` installed on
# the machine, so both are changed together.
DEB_FILE="$RELEASE_DIR/${PKG_NAME}_${VERSION}_${ARCH}.deb"
PKG_SUMMARY="Astro Web Browser by Oxy"
if [ "$ASTRO_OVERLAY_VERDICT" = "overlayless" ]; then
    PKG_NAME="pipeline-validation-browser"
    PKG_SUMMARY="PIPELINE VALIDATION BUILD - NO ASTRO OVERLAY"
    DEB_FILE="$RELEASE_DIR/$(astro::overlayless_artifact_name "${VERSION}_${ARCH}" ".deb")"
fi

mkdir -p "$RELEASE_DIR"

# --- Build the .deb directory structure ---
DEB_ROOT="$RELEASE_DIR/deb-staging"
rm -rf "$DEB_ROOT"

INSTALL_PREFIX="$DEB_ROOT/opt/astro"
mkdir -p "$INSTALL_PREFIX"
mkdir -p "$DEB_ROOT/DEBIAN"
mkdir -p "$DEB_ROOT/usr/bin"
mkdir -p "$DEB_ROOT/usr/share/applications"
mkdir -p "$DEB_ROOT/usr/share/metainfo"

# --- Control file ---
cat > "$DEB_ROOT/DEBIAN/control" << EOF
Package: $PKG_NAME
Version: $VERSION
Section: web
Priority: optional
Architecture: $ARCH
Depends: libasound2, libatk-bridge2.0-0, libatk1.0-0, libatspi2.0-0, libc6 (>= 2.17), libcairo2, libcups2, libdbus-1-3, libdrm2, libexpat1, libgbm1, libglib2.0-0, libgtk-3-0, libnspr4, libnss3, libpango-1.0-0, libx11-6, libxcb1, libxcomposite1, libxdamage1, libxext6, libxfixes3, libxkbcommon0, libxrandr2, wget
Maintainer: Oxy <hello@oxy.so>
Homepage: https://oxy.so
Description: $PKG_SUMMARY
 A privacy-focused, de-Googled Chromium browser with built-in
 ad blocker, Oxy platform integration, and Alia AI assistant.
 .
 Features:
  - All Google services removed
  - Built-in ad blocker (adblock-rust)
  - Oxy authentication and services
  - Alia AI sidebar
  - DuckDuckGo as default search
  - Widevine DRM support for streaming
EOF

# --- Post-install script ---
cat > "$DEB_ROOT/DEBIAN/postinst" << 'EOF'
#!/bin/bash
set -e

# Update icon cache
if command -v update-icon-caches &>/dev/null; then
    update-icon-caches /usr/share/icons/hicolor 2>/dev/null || true
fi
if command -v gtk-update-icon-cache &>/dev/null; then
    gtk-update-icon-cache -f -t /usr/share/icons/hicolor 2>/dev/null || true
fi

# Update desktop database
if command -v update-desktop-database &>/dev/null; then
    update-desktop-database /usr/share/applications 2>/dev/null || true
fi

# Set correct permissions on chrome-sandbox
if [ -f /opt/astro/chrome_sandbox ]; then
    chown root:root /opt/astro/chrome_sandbox
    chmod 4755 /opt/astro/chrome_sandbox
fi
EOF
chmod 755 "$DEB_ROOT/DEBIAN/postinst"

# --- Post-remove script ---
cat > "$DEB_ROOT/DEBIAN/postrm" << 'EOF'
#!/bin/bash
set -e
if command -v update-desktop-database &>/dev/null; then
    update-desktop-database /usr/share/applications 2>/dev/null || true
fi
EOF
chmod 755 "$DEB_ROOT/DEBIAN/postrm"

# --- Copy browser files ---
echo ">>> Copying browser files..."

# Core binary and helpers
astro::copy_required "$BUILD_DIR/chrome"         "$INSTALL_PREFIX/" "browser binary"
astro::copy_required "$BUILD_DIR/chrome_sandbox" "$INSTALL_PREFIX/" "SUID sandbox binary"
astro::copy_required "$BUILD_DIR/chrome_crashpad_handler" "$INSTALL_PREFIX/" "crash handler"

# Shared libraries: a component build produces these, a static release build
# does not, so an empty match set is a legitimate configuration difference.
astro::copy_glob "component-build-libraries" "$BUILD_DIR" '*.so' "$INSTALL_PREFIX/"

# Data files
astro::copy_glob "v8-snapshot-blobs" "$BUILD_DIR" '*.bin' "$INSTALL_PREFIX/"
astro::copy_glob "resource-packs"    "$BUILD_DIR" '*.pak' "$INSTALL_PREFIX/"
astro::copy_glob "data-files"        "$BUILD_DIR" '*.dat' "$INSTALL_PREFIX/"
astro::copy_required "$BUILD_DIR/icudtl.dat" "$INSTALL_PREFIX/" "ICU data"

# A release artifact must carry the exact source revisions, GN args and
# toolchain identity it was produced from (ASTRO-NEXT-002, #5), plus the overlay
# verdict, so an installed tree says what it is even once its filename is gone.
astro::stage_provenance "$INSTALL_PREFIX/provenance.json"

# Locales
if [ -d "$BUILD_DIR/locales" ]; then
    cp -r "$BUILD_DIR/locales" "$INSTALL_PREFIX/"
fi

# Resources
if [ -d "$BUILD_DIR/resources" ]; then
    cp -r "$BUILD_DIR/resources" "$INSTALL_PREFIX/"
fi
if [ -d "$BUILD_DIR/MEIPreload" ]; then
    cp -r "$BUILD_DIR/MEIPreload" "$INSTALL_PREFIX/"
fi

# --- WebUI pages ---
echo ">>> Copying WebUI pages..."
# No per-page resource tree is staged. Every astro:// surface is compiled into
# astro_webui_resources.pak and repacked into the browser's own resources.pak by
# 067-astro-webui-pak-repack.patch, so the pages travel inside the binary this
# artifact already carries. What stood here copied `resources/astro-<page>/`
# directories that no controller reads any more.

# --- Launcher script (system-installed version, uses /opt/astro paths) ---
#
# It matches tools/astro-launch.sh, which the other Linux artifacts ship
# verbatim, and differs from it only in INSTALL_DIR. What it replaces started a
# `python3 -m http.server` on port 19845 over the installation's resources
# directory and opened `http://127.0.0.1:19845/astro-ntp/index.html` as the new
# tab — so the browser's own new tab page ran as an ordinary http:// origin with
# no WebUI privileges, out of a directory the machine was serving to anything
# that could reach loopback, for the life of the browser. It was already stale
# before that: the pages have been served from `chrome://` since the app was
# packed into the pak, and this was the last thing in the repository still
# reading resources/astro-*.
cat > "$INSTALL_PREFIX/astro-launch.sh" << 'LAUNCH_EOF'
#!/usr/bin/env bash
INSTALL_DIR="/opt/astro"
DATA_DIR="$HOME/.config/astro"

# All pages are served natively via chrome:// URLs.
# No HTTP server needed.

"$INSTALL_DIR/chrome" --no-sandbox --user-data-dir="$DATA_DIR" "$@"
LAUNCH_EOF
chmod 755 "$INSTALL_PREFIX/astro-launch.sh"

# --- Symlink in /usr/bin ---
cat > "$DEB_ROOT/usr/bin/astro" << 'LAUNCHER'
#!/bin/bash
exec /opt/astro/astro-launch.sh "$@"
LAUNCHER
chmod 755 "$DEB_ROOT/usr/bin/astro"

# --- Desktop entry ---
cat > "$DEB_ROOT/usr/share/applications/astro-browser.desktop" << EOF
[Desktop Entry]
Version=1.0
Name=Astro Web Browser
GenericName=Web Browser
Comment=Privacy-focused browser by Oxy
Exec=/opt/astro/astro-launch.sh %U
Terminal=false
Icon=astro-browser
Type=Application
Categories=Network;WebBrowser;
MimeType=text/html;text/xml;application/xhtml+xml;x-scheme-handler/http;x-scheme-handler/https;x-scheme-handler/astro;
StartupNotify=true
StartupWMClass=astro-browser
Actions=new-window;new-private-window;

[Desktop Action new-window]
Name=Open a New Window
Exec=/opt/astro/astro-launch.sh

[Desktop Action new-private-window]
Name=Open a New Private Window
Exec=/opt/astro/astro-launch.sh --incognito
EOF

# --- Icons ---
echo ">>> Installing icons..."
ICON_SRC="$ASTRO_ROOT/branding/web/icon-512.png"
if [ -f "$ICON_SRC" ]; then
    for size in 16 24 32 48 64 128 256 512; do
        icon_dir="$DEB_ROOT/usr/share/icons/hicolor/${size}x${size}/apps"
        mkdir -p "$icon_dir"
        if [ "$size" -eq 512 ]; then
            cp "$ICON_SRC" "$icon_dir/astro-browser.png"
        elif command -v convert &>/dev/null; then
            convert "$ICON_SRC" -resize "${size}x${size}" "$icon_dir/astro-browser.png"
        fi
    done
fi

# --- AppStream metadata ---
cat > "$DEB_ROOT/usr/share/metainfo/so.oxy.Astro.metainfo.xml" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<component type="desktop-application">
  <id>so.oxy.Astro</id>
  <name>Astro Web Browser</name>
  <summary>Privacy-focused, de-Googled browser by Oxy</summary>
  <metadata_license>CC0-1.0</metadata_license>
  <project_license>BSD-3-Clause</project_license>
  <url type="homepage">https://oxy.so</url>
  <description>
    <p>
      Astro is a Chromium-based browser that removes all Google services
      and replaces them with privacy-respecting Oxy alternatives. It includes
      a built-in ad blocker, Alia AI assistant, and DuckDuckGo as the default
      search engine.
    </p>
  </description>
  <launchable type="desktop-id">astro-browser.desktop</launchable>
  <releases>
    <release version="$VERSION" date="$(date +%Y-%m-%d)"/>
  </releases>
</component>
EOF

# --- Build the .deb ---
echo ">>> Building .deb package..."

# Calculate installed size in KB
INSTALLED_SIZE=$(du -sk "$DEB_ROOT" | cut -f1)
echo "Installed-Size: $INSTALLED_SIZE" >> "$DEB_ROOT/DEBIAN/control"

dpkg-deb --build --root-owner-group "$DEB_ROOT" "$DEB_FILE"

# Clean up
rm -rf "$DEB_ROOT"

echo ""
echo "=== .deb package created ==="
echo "Package: $DEB_FILE"
echo "Size: $(du -h "$DEB_FILE" | cut -f1)"
echo ""
echo "Install with: sudo dpkg -i $DEB_FILE"
echo "Or: sudo apt install ./$DEB_FILE"
