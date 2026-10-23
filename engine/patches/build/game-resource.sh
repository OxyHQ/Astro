#!/usr/bin/env bash
# Packs the app's offline game (apps/browser/assets/offline-game in $AC_REPO) into
# the single file chromium-neterror-game.patch's resource names,
# components/neterror/resources/game/game.html (untracked in the Chromium tree).
# apply-chromium-patches.sh and step 5 run it, so a build always ships the game as it is.
set -euo pipefail
case "${1:-}" in
  -h | --help) awk 'NR == 1 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "$0"; exit 0 ;;
  --apply) ;;
  *) echo "game-resource.sh: pass --apply to write the offline game (--help for usage)" >&2; exit 64 ;;
esac
[[ -n "${CHROMIUM_SRC:-}" ]] || { echo "game-resource.sh: set CHROMIUM_SRC to the tree to write" >&2; exit 64; }
game_tree="$(cd "$CHROMIUM_SRC" 2>/dev/null && pwd -P)" || { echo "game-resource.sh: no tree at $CHROMIUM_SRC" >&2; exit 64; }
game_home=$(python3 -c 'import os, pwd; print(pwd.getpwuid(os.getuid()).pw_dir)')
game_out="$CHROMIUM_SRC/components/neterror/resources/game/game.html"
if ! python3 "$(dirname "$0")/pathguard.py" classify "$CHROMIUM_SRC" "$game_out" >/dev/null; then
  AC_CHROMIUM_BUILD="$(cd "$game_tree/../../.." && pwd -P)" source "$(dirname "$0")/step-guard.sh" --apply
fi
game_repo="$(cd "$(dirname "$0")/../../.." && pwd)"
[[ -f "$game_repo/apps/browser/assets/offline-game-pipeline/inline.py" ]] || game_repo="$game_home/Documents/astro"
python3 "${AC_REPO:-$game_repo}/apps/browser/assets/offline-game-pipeline/inline.py" "$game_out"
