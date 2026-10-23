#!/usr/bin/env bash
# Step 5: compile at normal priority; autoninja picks the job count (JOBS overrides).
# -k 0 keeps going past failures so one pass surfaces every broken file.
set -euo pipefail
source "$(dirname "$0")/step-guard.sh" "$@"
source "$(dirname "$0")/env.sh"
CHROMIUM_SRC="$CB/chromium_git/chromium/src" "$(dirname "$0")/game-resource.sh" --apply
cd "$CB/chromium_git/chromium/src"
# On macOS, AstroCore is Chrome's own framework (the app stages it from out/Release_GN_arm64); elsewhere it is chrome.
if [[ $AC_PLATFORM == macos ]]; then default_targets=chrome_framework; else default_targets=chrome; fi
TARGETS="${TARGETS:-$default_targets}"
exec autoninja ${JOBS:+-j "$JOBS"} -k "${KEEP_GOING:-0}" -C "out/$GN_OUT_CONFIGS" $TARGETS
