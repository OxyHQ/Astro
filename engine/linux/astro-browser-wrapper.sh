#!/bin/sh
CHROME_WRAPPER="$(readlink -f "$0")"
HERE="$(dirname "$CHROME_WRAPPER")"
export CHROME_WRAPPER
export LD_LIBRARY_PATH="$HERE${LD_LIBRARY_PATH:+:${LD_LIBRARY_PATH}}"
exec "$HERE/chrome" "$@"
