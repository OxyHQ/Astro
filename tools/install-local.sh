#!/usr/bin/env bash
# install-local.sh — install a local Astro build into the user's home.
#
# What changed for #4: every load-bearing step was hiding its own failures.
# `bun run build 2>/dev/null`, `ninja … 2>/dev/null` and `cp … 2>/dev/null` all
# discarded the reason they failed and let the script continue, so a failed
# WebUI build or a failed recompile produced a "successfully installed" message
# over a stale or incomplete installation. Those are now required steps.
#
# The `rsync --delete` here is retained deliberately: its destination is the
# install directory under $HOME, never the Chromium source tree, and an install
# directory accumulating files from previous builds is its own problem. The
# destination is verified before it runs.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ASTRO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
export ASTRO_ROOT
# shellcheck source=tools/lib/astro-common.sh
source "$ASTRO_ROOT/tools/lib/astro-common.sh"

PROJECT_ROOT="$ASTRO_ROOT"

INSTALL_DIR="$HOME/.local/share/astro"
BIN_DIR="$HOME/.local/bin"
APPS_DIR="$HOME/.local/share/applications"
ICON_BASE="$HOME/.local/share/icons/hicolor"

BUILD_DIR="$PROJECT_ROOT/chromium/src/out/Release"
ICON_SRC="$PROJECT_ROOT/branding/web/icon-512.png"
DESKTOP_SRC="$PROJECT_ROOT/branding/astro-browser.desktop"

WEBUI_PAGES=(ntp alia settings whats-new error)

astro::require_cmd rsync bun ninja sed find
astro::require_dir "$BUILD_DIR" "build output (run tools/build.sh first)"
astro::require_file "$BUILD_DIR/chrome" "browser binary"
astro::require_file "$DESKTOP_SRC" "desktop entry template"

# The install destination must be inside the user's home and must not be a
# source checkout: `rsync --delete` runs against it below.
verify_install_dir() {
    case "$INSTALL_DIR" in
        "$HOME"/*) ;;
        *) astro::die "Refusing to install outside \$HOME: $INSTALL_DIR" ;;
    esac
    if [ -e "$INSTALL_DIR/.git" ] || [ -e "$INSTALL_DIR/.gn" ]; then
        astro::die "Refusing to install over what looks like a source checkout: $INSTALL_DIR"
    fi
}
verify_install_dir

astro::info "Installing Astro Browser locally..."
mkdir -p "$INSTALL_DIR" "$BIN_DIR" "$APPS_DIR"

astro::info "  Copying build output to $INSTALL_DIR..."
# The destination is the install directory under $HOME, verified by
# verify_install_dir above, and is never the Chromium source tree.
# astro-allow:rsync-delete install destination under $HOME, verified before this line
rsync -a --delete "$BUILD_DIR/" "$INSTALL_DIR/"

# --------------------------------------------------------------------------
# Icons
# --------------------------------------------------------------------------

if [ -f "$ICON_SRC" ]; then
    if command -v convert >/dev/null; then
        astro::info "  Installing icons (all sizes)..."
        for size in 16 24 32 48 64 128 256 512; do
            icon_dir="$ICON_BASE/${size}x${size}/apps"
            mkdir -p "$icon_dir"
            if [ "$size" -eq 512 ]; then
                cp "$ICON_SRC" "$icon_dir/astro-browser.png"
            else
                convert "$ICON_SRC" -resize "${size}x${size}" "$icon_dir/astro-browser.png"
            fi
        done
    else
        astro::warn "optional:imagemagick" \
            "'convert' not found; installing the 512px icon only"
        mkdir -p "$ICON_BASE/512x512/apps"
        cp "$ICON_SRC" "$ICON_BASE/512x512/apps/astro-browser.png"
    fi
else
    astro::warn "optional:branding-icon" "icon source not found: $ICON_SRC"
fi

astro::info "  Installing desktop entry..."
sed "s|Exec=/opt/oxy/astro/astro-browser|Exec=$INSTALL_DIR/chrome|g" \
    "$DESKTOP_SRC" > "$APPS_DIR/astro-browser.desktop"

# Desktop-environment cache refreshes are cosmetic: the install is complete and
# usable whether or not they run.
if command -v update-desktop-database >/dev/null; then
    astro::optional "desktop-database" update-desktop-database "$APPS_DIR"
fi
if command -v gtk-update-icon-cache >/dev/null; then
    astro::optional "icon-cache" gtk-update-icon-cache -f -t "$ICON_BASE"
fi

# --------------------------------------------------------------------------
# WebUI pages
#
# Each page is built and post-processed. A failure here previously produced a
# blank astro:// page inside an installation that reported success.
# --------------------------------------------------------------------------

astro::info "  Building WebUI pages..."
for page in "${WEBUI_PAGES[@]}"; do
    page_dir="$PROJECT_ROOT/webui/$page"
    astro::require_file "$page_dir/package.json" "webui/$page manifest"

    ( cd "$page_dir" && bun run build )

    dist="$page_dir/dist"
    astro::require_file "$dist/index.html" "webui/$page build output"

    # chrome:// pages cannot load cross-origin sub-resources.
    sed -i 's/ crossorigin//g' "$dist/index.html"
    # Strip external font links — chrome:// pages cannot load https:// sub-resources.
    sed -i '/<link.*fonts.googleapis\|<link.*fonts.gstatic\|preconnect.*fonts/d' "$dist/index.html"
    # Strip crossOrigin from Vite's preload helper — chrome:// pages reject it.
    while IFS= read -r -d '' asset; do
        sed -i 's/\.crossOrigin=``//g' "$asset"
    done < <(find "$dist" \( -name '*.js' -o -name '*.html' \) -print0)

    rm -rf "$INSTALL_DIR/resources/astro-$page"
    mkdir -p "$INSTALL_DIR/resources/astro-$page"
    cp -r "$dist"/. "$INSTALL_DIR/resources/astro-$page/"
done

# --------------------------------------------------------------------------
# Recompile resource packs
#
# The NTP merge can change the HTML after the initial build, so the .pak files
# are regenerated and re-copied.
# --------------------------------------------------------------------------

astro::info "  Recompiling resource packs..."
astro::resolve_chromium_src ""
CHROMIUM_SRC="$ASTRO_RESOLVED_CHROMIUM_SRC"

touch "$CHROMIUM_SRC/chrome/browser/resources/new_tab_page_third_party/new_tab_page_third_party.html"
( cd "$CHROMIUM_SRC" && ninja -C out/Release chrome -j"$(nproc)" )

astro::copy_glob "resource-packs" "$BUILD_DIR" '*.pak' "$INSTALL_DIR/"
astro::copy_required "$BUILD_DIR/chrome" "$INSTALL_DIR/chrome" "browser binary"

# --------------------------------------------------------------------------
# Launcher
# --------------------------------------------------------------------------

astro::copy_required "$PROJECT_ROOT/tools/astro-launch.sh" \
    "$INSTALL_DIR/astro-launch.sh" "launcher script"
chmod +x "$INSTALL_DIR/astro-launch.sh"
ln -sf "$INSTALL_DIR/astro-launch.sh" "$BIN_DIR/astro"

astro::info ""
astro::info "Astro Browser installed successfully."
astro::info "  Binary:  $BIN_DIR/astro"
astro::info "  App dir: $INSTALL_DIR"
astro::info "  Desktop: $APPS_DIR/astro-browser.desktop"
astro::info ""
astro::info "Run 'astro' from the terminal, or find 'Astro Web Browser' in your app launcher."
