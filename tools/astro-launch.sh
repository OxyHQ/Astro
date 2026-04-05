#!/usr/bin/env bash
INSTALL_DIR="$HOME/.local/share/astro"
DATA_DIR="$HOME/.config/astro"
PORT=19845

# Kill any existing server on this port
fuser -k 19845/tcp 2>/dev/null
sleep 0.2

# Start server on fixed port
python3 -m http.server $PORT -d "$INSTALL_DIR/resources" --bind 127.0.0.1 &>/dev/null &
SERVER_PID=$!
sleep 0.3

NTP="http://127.0.0.1:$PORT/astro-ntp/index.html"

if [ $# -eq 0 ]; then
    "$INSTALL_DIR/chrome" --no-sandbox --user-data-dir="$DATA_DIR" "$NTP"
else
    "$INSTALL_DIR/chrome" --no-sandbox --user-data-dir="$DATA_DIR" "$@"
fi

kill $SERVER_PID 2>/dev/null
