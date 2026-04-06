#!/usr/bin/env bash
set -euo pipefail

ASTRO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="${1:-$ASTRO_ROOT/chromium/src/out/Release}"
RELEASE_DIR="$ASTRO_ROOT/releases"
VERSION="${ASTRO_VERSION:-$(cat "$ASTRO_ROOT/VERSION" 2>/dev/null || echo "0.1.0")}"

echo "=== Packaging Astro $VERSION for Linux x64 ==="

if [ ! -f "$BUILD_DIR/chrome" ]; then
    echo "ERROR: Build not found at $BUILD_DIR/chrome"
    echo "Run 'tools/build.sh Release linux' first"
    exit 1
fi

mkdir -p "$RELEASE_DIR"

# Create tar.gz archive with all required files
ARCHIVE_NAME="astro-${VERSION}-linux-x64.tar.gz"
STAGING="$RELEASE_DIR/astro-staging"
rm -rf "$STAGING"
mkdir -p "$STAGING/astro"

echo ">>> Collecting files..."

# Core binary and helpers
cp "$BUILD_DIR/chrome" "$STAGING/astro/"
cp "$BUILD_DIR/chrome_sandbox" "$STAGING/astro/" 2>/dev/null || true
cp "$BUILD_DIR/chrome_crashpad_handler" "$STAGING/astro/" 2>/dev/null || true

# Shared libraries
cp "$BUILD_DIR"/*.so "$STAGING/astro/" 2>/dev/null || true

# Data files
cp "$BUILD_DIR"/*.pak "$STAGING/astro/" 2>/dev/null || true
cp "$BUILD_DIR"/*.dat "$STAGING/astro/" 2>/dev/null || true
cp "$BUILD_DIR"/*.bin "$STAGING/astro/" 2>/dev/null || true
cp "$BUILD_DIR/icudtl.dat" "$STAGING/astro/" 2>/dev/null || true

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
for page in ntp alia settings whats-new error; do
    if [ -d "$BUILD_DIR/astro-$page" ]; then
        mkdir -p "$STAGING/astro/resources/astro-$page"
        cp -r "$BUILD_DIR/astro-$page/"* "$STAGING/astro/resources/astro-$page/"
    fi
done

# Launcher script
cp "$ASTRO_ROOT/tools/astro-launch.sh" "$STAGING/astro/" 2>/dev/null || true
chmod +x "$STAGING/astro/astro-launch.sh" 2>/dev/null || true

# Desktop entry and icon
cp "$ASTRO_ROOT/branding/astro-browser.desktop" "$STAGING/astro/" 2>/dev/null || true
cp "$ASTRO_ROOT/branding/web/icon-512.png" "$STAGING/astro/astro-browser.png" 2>/dev/null || true

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
chmod +x "$INSTALL_DIR/chrome" "$INSTALL_DIR/chrome_sandbox" 2>/dev/null || true

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

echo ">>> Creating $ARCHIVE_NAME..."
cd "$STAGING"
tar czf "$RELEASE_DIR/$ARCHIVE_NAME" astro/

# Clean up staging
rm -rf "$STAGING"

echo ""
echo "=== Package created ==="
echo "Archive: $RELEASE_DIR/$ARCHIVE_NAME"
echo "Size: $(du -h "$RELEASE_DIR/$ARCHIVE_NAME" | cut -f1)"
