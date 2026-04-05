#!/usr/bin/env bash
INSTALL_DIR="$HOME/.local/share/astro"
RESOURCES="$INSTALL_DIR/resources"
DATA_DIR="$HOME/.config/astro"

# Start local server for custom pages
PORT=$(python3 -c "import socket; s=socket.socket(); s.bind(('',0)); print(s.getsockname()[1]); s.close()")
python3 -m http.server "$PORT" -d "$RESOURCES" --bind 127.0.0.1 &>/dev/null &
SERVER_PID=$!
sleep 0.5

NTP="http://127.0.0.1:$PORT/astro-ntp/index.html"
SETTINGS="http://127.0.0.1:$PORT/astro-settings/index.html"
WHATS_NEW="http://127.0.0.1:$PORT/astro-whats-new/index.html"

# Write port file so pages can discover each other
echo "$PORT" > "$DATA_DIR/astro-server-port"

# Patch preferences to use our NTP on startup
mkdir -p "$DATA_DIR/Default"
if [ -f "$DATA_DIR/Default/Preferences" ]; then
    python3 -c "
import json, sys
try:
    with open('$DATA_DIR/Default/Preferences', 'r') as f:
        prefs = json.load(f)
    prefs.setdefault('session', {})['restore_on_startup'] = 4
    prefs.setdefault('session', {})['startup_urls'] = ['$NTP']
    prefs['homepage'] = '$NTP'
    prefs['homepage_is_newtabpage'] = False
    prefs.setdefault('browser', {})['show_home_button'] = True
    prefs.setdefault('ntp', {})['custom_background_dict'] = {}
    with open('$DATA_DIR/Default/Preferences', 'w') as f:
        json.dump(prefs, f)
except: pass
" 2>/dev/null
fi

# Launch
if [ \$# -eq 0 ]; then
    "$INSTALL_DIR/chrome" --no-sandbox --user-data-dir="$DATA_DIR" --no-first-run "$NTP"
else
    "$INSTALL_DIR/chrome" --no-sandbox --user-data-dir="$DATA_DIR" --no-first-run "\$@"
fi

# Cleanup
kill "$SERVER_PID" 2>/dev/null
rm -f "$DATA_DIR/astro-server-port"
