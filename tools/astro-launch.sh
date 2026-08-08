#!/usr/bin/env bash
INSTALL_DIR="$HOME/.local/share/astro"
DATA_DIR="$HOME/.config/astro"

# All pages are served natively via chrome:// URLs.
# No HTTP server needed.

"$INSTALL_DIR/chrome" --no-sandbox --user-data-dir="$DATA_DIR" "$@"
