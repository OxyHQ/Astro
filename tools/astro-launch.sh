#!/usr/bin/env bash
INSTALL_DIR="$HOME/.local/share/astro"
DATA_DIR="$HOME/.config/astro"

# Start local server for custom pages
PORT=$(python3 -c "import socket; s=socket.socket(); s.bind(('',0)); print(s.getsockname()[1]); s.close()")
python3 -m http.server "$PORT" -d "$INSTALL_DIR/resources" --bind 127.0.0.1 &>/dev/null &
SERVER_PID=$!
sleep 0.3

NTP="http://127.0.0.1:$PORT/astro-ntp/index.html"

if [ $# -eq 0 ]; then
    "$INSTALL_DIR/chrome" --no-sandbox --user-data-dir="$DATA_DIR" "$NTP"
else
    "$INSTALL_DIR/chrome" --no-sandbox --user-data-dir="$DATA_DIR" "$@"
fi

kill "$SERVER_PID" 2>/dev/null
