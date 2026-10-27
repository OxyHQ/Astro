#!/usr/bin/env bash
# Copies Astro.app out of a disk image and runs scripts/ci/macos-ui-smoke.mjs on it: the window renders, Sign in with
# Oxy opens its dialog and Chat opens, with a picture of each step and the app's logs in <out dir>.
#
#   scripts/ci/macos-ui-smoke.sh <Astro.dmg> <out dir>
set -uo pipefail
[[ "${1:-}" == -h || "${1:-}" == --help ]] && { awk 'NR == 1 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "$0"; exit 0; }
dmg=${1:?usage: macos-ui-smoke.sh <Astro.dmg> <out dir>}
out=${2:?usage: macos-ui-smoke.sh <Astro.dmg> <out dir>}
mkdir -p "$out"
out=$(cd "$out" && pwd -P)
repo=$(cd "$(dirname "$0")/../.." && pwd)

mnt=$(mktemp -d)
hdiutil attach "$dmg" -nobrowse -readonly -noautoopen -mountpoint "$mnt" >/dev/null || { echo "::error::couldn't mount $dmg"; exit 1; }
apps=$(mktemp -d)
ditto "$mnt/Astro.app" "$apps/Astro.app"
hdiutil detach "$mnt" >/dev/null || hdiutil detach "$mnt" -force >/dev/null
{ sw_vers; uname -m; lipo -archs "$apps/Astro.app/Contents/MacOS/Astro"; } | tee "$out/environment.txt"

log_start=$(date '+%Y-%m-%d %H:%M:%S')
node "$repo/scripts/ci/macos-ui-smoke.mjs" "$apps/Astro.app" "$out"
status=$?
log show --style compact --start "$log_start" --predicate 'process BEGINSWITH "Astro" OR process CONTAINS "Chromium"' >"$out/system.log" 2>&1 || true
mkdir -p "$out/crash-reports"
find ~/Library/Logs/DiagnosticReports -newermt "$log_start" -name 'Astro*' -exec cp {} "$out/crash-reports/" \; 2>/dev/null || true
ls -la "$out"
exit "$status"
