#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

INSTALL_DIR="$HOME/.local/share/astro"
BIN_DIR="$HOME/.local/bin"
APPS_DIR="$HOME/.local/share/applications"
ICONS_DIR="$HOME/.local/share/icons/hicolor/512x512/apps"

BUILD_DIR="$PROJECT_ROOT/chromium/src/out/Release"
ICON_SRC="$PROJECT_ROOT/branding/web/icon-512.png"
DESKTOP_SRC="$PROJECT_ROOT/branding/astro-browser.desktop"

if [[ ! -d "$BUILD_DIR" ]]; then
    echo "Error: Build output not found at $BUILD_DIR"
    echo "Run 'tools/build.sh' first."
    exit 1
fi

echo "Installing Astro Browser locally..."

mkdir -p "$INSTALL_DIR" "$BIN_DIR" "$APPS_DIR" "$ICONS_DIR"

echo "  Copying build output to $INSTALL_DIR..."
rsync -a --delete "$BUILD_DIR/" "$INSTALL_DIR/"

if [[ -f "$ICON_SRC" ]]; then
    echo "  Installing icon..."
    cp "$ICON_SRC" "$ICONS_DIR/astro-browser.png"
fi

echo "  Installing desktop entry..."
sed "s|Exec=/opt/oxy/astro/astro-browser|Exec=$INSTALL_DIR/chrome|g" \
    "$DESKTOP_SRC" > "$APPS_DIR/astro-browser.desktop"

echo "  Creating symlink at $BIN_DIR/astro..."
ln -sf "$INSTALL_DIR/chrome" "$BIN_DIR/astro"

if command -v update-desktop-database &>/dev/null; then
    update-desktop-database "$APPS_DIR" 2>/dev/null || true
fi

if command -v gtk-update-icon-cache &>/dev/null; then
    gtk-update-icon-cache -f -t "$HOME/.local/share/icons/hicolor" 2>/dev/null || true
fi

echo ""
echo "Astro Browser installed successfully."
echo "  Binary:  $BIN_DIR/astro"
echo "  App dir: $INSTALL_DIR"
echo "  Desktop: $APPS_DIR/astro-browser.desktop"
echo ""
echo "Run 'astro' from the terminal or find 'Astro Web Browser' in your app launcher."
