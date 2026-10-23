#!/bin/bash
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
chrome="${CHROME:-}"
if [ -z "$chrome" ]; then
  while IFS= read -r c; do
    [ -x "$c" ] && { chrome="$c"; break; }
  done < <(ls -d "$HOME"/.cache/puppeteer/chrome-headless-shell/mac_arm-*/chrome-headless-shell-mac-arm64/chrome-headless-shell 2>/dev/null | sort -V -r
    echo "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    ls -d "$HOME"/.agent-browser/browsers/chrome-*/"Google Chrome for Testing.app" 2>/dev/null \
      | sort -V -r | sed 's|$|/Contents/MacOS/Google Chrome for Testing|')
fi
[ -n "$chrome" ] && [ -x "$chrome" ] || { echo "error: no Chrome found (set CHROME)" >&2; exit 1; }
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
flags=(--user-data-dir="$tmp/profile" --no-first-run --disable-gpu --hide-scrollbars --allow-file-access-from-files
  --window-size=660,460 --virtual-time-budget=8000)
[[ "$chrome" == */chrome-headless-shell ]] || flags+=(--headless=new)
headless() { timeout 60 "$chrome" "${flags[@]}" "$@" "file://$here/background.html" </dev/null 2>/dev/null; }

headless --dump-dom > "$tmp/dom.html" || { echo "error: Chrome failed or timed out ($chrome)" >&2; exit 1; }
for face in "Mona Sans Variable" "Martian Mono Variable"; do
  grep -q "data-fonts=\"[^\"]*$face" "$tmp/dom.html" || { echo "error: the $face typeface didn't load" >&2; exit 1; }
done

for scale in 1 2; do
  headless --force-device-scale-factor="$scale" --screenshot="$tmp/$scale.png" >/dev/null \
    || { echo "error: Chrome failed or timed out ($chrome)" >&2; exit 1; }
  [ "$(sips -g pixelWidth "$tmp/$scale.png" | awk '/pixelWidth/ { print $2 }')" = "$((660 * scale))" ] \
    || { echo "error: the ${scale}× render isn't $((660 * scale)) px wide" >&2; exit 1; }
  sips -s format tiff -s dpiWidth "$((72 * scale))" -s dpiHeight "$((72 * scale))" "$tmp/$scale.png" --out "$tmp/$scale.tiff" >/dev/null
done
tiffutil -cathidpicheck "$tmp/1.tiff" "$tmp/2.tiff" -out "$here/background.tiff"
echo "$here/background.tiff"
