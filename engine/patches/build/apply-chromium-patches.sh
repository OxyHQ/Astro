#!/usr/bin/env bash
# The `chromium` and `layer` lines of engine/patches/series, in order (idempotent), then the generated
# offline page. Run after domain substitution (step 4 does): the patches are made against that tree.
set -euo pipefail
source "$(dirname "$0")/step-guard.sh" "$@"
source "$(dirname "$0")/env.sh"
export CHROMIUM_SRC="$CB/chromium_git/chromium/src" AC_SERIES_BASE="$CB/series-base"
series="$AC_REPO/engine/patches/series.py"
# The base `series.py check` compares against: Chromium's files as the series finds them (once per checkout).
python3 "$series" capture-base --phase chromium
python3 "$series" apply --phase chromium
