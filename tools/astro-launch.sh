#!/usr/bin/env bash
ASTRO_DIR="$(dirname "$(readlink -f "$0")")/.."
INSTALL_DIR="${ASTRO_HOME:-$HOME/.local/share/astro}"
RESOURCES="$INSTALL_DIR/resources"
DATA_DIR="$HOME/.config/astro"

# Start a tiny python HTTP server for our custom pages
if [ -d "$RESOURCES/astro-ntp" ]; then
    # Find a free port
    PORT=$(python3 -c "import socket; s=socket.socket(); s.bind(('',0)); print(s.getsockname()[1]); s.close()")
    python3 -m http.server "$PORT" -d "$RESOURCES" --bind 127.0.0.1 &>/dev/null &
    SERVER_PID=$!
    NTP_URL="http://127.0.0.1:$PORT/astro-ntp/index.html"
    SETTINGS_URL="http://127.0.0.1:$PORT/astro-settings/index.html"
    WHATS_NEW_URL="http://127.0.0.1:$PORT/astro-whats-new/index.html"
else
    NTP_URL=""
fi

# Launch Astro
"$INSTALL_DIR/chrome" \
    --no-sandbox \
    --user-data-dir="$DATA_DIR" \
    --homepage="$NTP_URL" \
    --no-first-run \
    ${NTP_URL:+--new-tab-page="$NTP_URL"} \
    "$@"

# Cleanup server on exit
[ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null
