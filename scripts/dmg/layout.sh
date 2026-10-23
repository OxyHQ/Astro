#!/bin/bash
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
tmp="$(mktemp -d)"
trap 'hdiutil detach "$tmp/mnt" >/dev/null 2>&1 || true; rm -rf "$tmp"' EXIT
run() { "$@" > "$tmp/log" 2>&1 || { cat "$tmp/log" >&2; echo "error: $1 failed" >&2; exit 1; }; }

[ ! -e /Volumes/Astro ] || { echo "error: eject the mounted Astro volume first" >&2; exit 1; }

py="$(PATH="/opt/homebrew/bin:$PATH" command -v python3)"
"$py" -c 'import sys; sys.exit(sys.version_info < (3, 10))' || { echo "error: needs Python 3.10 or later (brew install python)" >&2; exit 1; }
"$py" -m venv "$tmp/venv"
run "$tmp/venv/bin/pip" install -q --disable-pip-version-check dmgbuild==1.6.7
mkdir -p "$tmp/Astro.app" "$tmp/mnt"
cat > "$tmp/settings.py" <<EOF
files = ["$tmp/Astro.app"]
symlinks = {"Applications": "/Applications"}
background = "$here/background.tiff"
window_rect = ((200, 160), (660, 384))
default_view = "icon-view"
show_icon_preview = False
show_status_bar = False
show_tab_view = False
show_toolbar = False
show_pathbar = False
show_sidebar = False
arrange_by = None
label_pos = "bottom"
text_size = 13
icon_size = 112
icon_locations = {"Astro.app": (176, 208), "Applications": (484, 208)}
EOF
run "$tmp/venv/bin/dmgbuild" -s "$tmp/settings.py" Astro "$tmp/layout.dmg"
run hdiutil attach "$tmp/layout.dmg" -nobrowse -readonly -mountpoint "$tmp/mnt"
cp "$tmp/mnt/.DS_Store" "$here/DS_Store"
echo "$here/DS_Store"
