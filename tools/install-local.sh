#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

INSTALL_DIR="$HOME/.local/share/astro"
BIN_DIR="$HOME/.local/bin"
APPS_DIR="$HOME/.local/share/applications"
ICON_BASE="$HOME/.local/share/icons/hicolor"

BUILD_DIR="$PROJECT_ROOT/chromium/src/out/Release"
ICON_SRC="$PROJECT_ROOT/branding/web/icon-512.png"
DESKTOP_SRC="$PROJECT_ROOT/branding/astro-browser.desktop"

if [[ ! -d "$BUILD_DIR" ]]; then
    echo "Error: Build output not found at $BUILD_DIR"
    echo "Run 'tools/build.sh' first."
    exit 1
fi

echo "Installing Astro Browser locally..."

mkdir -p "$INSTALL_DIR" "$BIN_DIR" "$APPS_DIR"

# Copy build output
echo "  Copying build output to $INSTALL_DIR..."
rsync -a --delete "$BUILD_DIR/" "$INSTALL_DIR/"

# Install icons at ALL standard sizes (Debian/GNOME needs these)
if [[ -f "$ICON_SRC" ]] && command -v convert &>/dev/null; then
    echo "  Installing icons (all sizes)..."
    for size in 16 24 32 48 64 128 256 512; do
        icon_dir="$ICON_BASE/${size}x${size}/apps"
        mkdir -p "$icon_dir"
        if [[ "$size" -eq 512 ]]; then
            cp "$ICON_SRC" "$icon_dir/astro-browser.png"
        else
            convert "$ICON_SRC" -resize "${size}x${size}" "$icon_dir/astro-browser.png"
        fi
    done
    # Also install SVG if available
    if [[ -f "$PROJECT_ROOT/branding/astro-logo.svg" ]]; then
        mkdir -p "$ICON_BASE/scalable/apps"
        cp "$PROJECT_ROOT/branding/astro-logo.svg" "$ICON_BASE/scalable/apps/astro-browser.svg"
    fi
elif [[ -f "$ICON_SRC" ]]; then
    echo "  Installing icon (512px only, install imagemagick for all sizes)..."
    mkdir -p "$ICON_BASE/512x512/apps"
    cp "$ICON_SRC" "$ICON_BASE/512x512/apps/astro-browser.png"
fi

# Install .desktop file
echo "  Installing desktop entry..."
sed "s|Exec=/opt/oxy/astro/astro-browser|Exec=$INSTALL_DIR/chrome|g" \
    "$DESKTOP_SRC" > "$APPS_DIR/astro-browser.desktop"

# Create symlink
echo "  Creating symlink at $BIN_DIR/astro..."
ln -sf "$INSTALL_DIR/chrome" "$BIN_DIR/astro"

# Update caches
if command -v update-desktop-database &>/dev/null; then
    update-desktop-database "$APPS_DIR" 2>/dev/null || true
fi
if command -v gtk-update-icon-cache &>/dev/null; then
    gtk-update-icon-cache -f -t "$ICON_BASE" 2>/dev/null || true
fi

echo ""
echo "Astro Browser installed successfully."
echo "  Binary:  $BIN_DIR/astro"
echo "  App dir: $INSTALL_DIR"
echo "  Desktop: $APPS_DIR/astro-browser.desktop"
echo ""
echo "Run 'astro' from the terminal or find 'Astro Web Browser' in your app launcher."
