#!/usr/bin/env bash
# astro-launch.sh — runtime launcher, installed next to the browser binary.
#
# This is the one script in tools/ that is NOT part of the build pipeline: it
# ships to end users and runs at browser start, standalone, with no access to
# the repository. So it cannot source tools/lib/astro-common.sh and cannot use
# astro::optional to classify a best-effort step.
#
# Its three tolerated failures are marked individually below with the same
# `# astro-allow:` mechanism the build scripts use for reviewed exceptions, so
# they stay visible to the scanner and to review rather than being excluded
# wholesale.

INSTALL_DIR="$HOME/.local/share/astro"
DATA_DIR="$HOME/.config/astro"
PORT=19845

# Kill any existing server on this port. Nothing listening is the normal case
# on a first launch, and fuser reports that on stderr.
# astro-allow: no listener is the expected state, not a failure
fuser -k 19845/tcp 2>/dev/null
sleep 0.2

# Start server on fixed port. Its request log is noise in a browser launcher;
# a real startup failure surfaces as the page failing to load below.
# astro-allow: backgrounded helper server, request log is not diagnostic output
python3 -m http.server $PORT -d "$INSTALL_DIR/resources" --bind 127.0.0.1 &>/dev/null &
SERVER_PID=$!
sleep 0.3

NTP="http://127.0.0.1:$PORT/astro-ntp/index.html"

if [ $# -eq 0 ]; then
    "$INSTALL_DIR/chrome" --no-sandbox --user-data-dir="$DATA_DIR" "$NTP"
else
    "$INSTALL_DIR/chrome" --no-sandbox --user-data-dir="$DATA_DIR" "$@"
fi

# Cleanup after the browser exits. The server may already be gone.
# astro-allow: best-effort cleanup of an already-possibly-dead helper
kill $SERVER_PID 2>/dev/null
