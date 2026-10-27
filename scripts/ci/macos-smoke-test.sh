#!/usr/bin/env bash
# Installs Astro from a disk image the way a person would (into /Applications), launches it on a scratch profile and
# keeps what a first launch shows: a screenshot, the app's own log, the system log, the DevTools targets and any crash
# report. Fails when the app quits, crashes or never opens its DevTools port.
#
#   scripts/ci/macos-smoke-test.sh <Astro.dmg> <out dir> [seconds to run, default 40]
set -uo pipefail
[[ "${1:-}" == -h || "${1:-}" == --help ]] && { awk 'NR == 1 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "$0"; exit 0; }
dmg=${1:?usage: macos-smoke-test.sh <Astro.dmg> <out dir> [seconds]}
out=${2:?usage: macos-smoke-test.sh <Astro.dmg> <out dir> [seconds]}
run_for=${3:-40}
mkdir -p "$out"
out=$(cd "$out" && pwd -P)
with_limit() { local limit=$1; shift; perl -e 'alarm shift; exec { $ARGV[0] } @ARGV or die "$ARGV[0]: $!\n"' "$limit" "$@"; }
fail() { echo "::error::$*"; status=1; }
status=0

mnt=$(mktemp -d)
hdiutil attach "$dmg" -nobrowse -readonly -noautoopen -mountpoint "$mnt" >/dev/null || { echo "::error::couldn't mount $dmg"; exit 1; }
ls -la "$mnt" >"$out/dmg-contents.txt"
rm -rf /Applications/Astro.app
ditto "$mnt/Astro.app" /Applications/Astro.app
hdiutil detach "$mnt" >/dev/null || hdiutil detach "$mnt" -force >/dev/null
app=/Applications/Astro.app
binary="$app/Contents/MacOS/Astro"
{
  sw_vers
  echo "machine: $(uname -m), $(sysctl -n machdep.cpu.brand_string)"
  echo "Astro: $(lipo -archs "$binary"), $(plutil -extract CFBundleShortVersionString raw "$app/Contents/Info.plist") ($(plutil -extract CFBundleVersion raw "$app/Contents/Info.plist")), minimum macOS $(plutil -extract LSMinimumSystemVersion raw "$app/Contents/Info.plist")"
  codesign --verify --deep --strict "$app" && echo "signature: valid (ad hoc)"
  codesign -dvv "$app" 2>&1 | grep -E '^(Signature|TeamIdentifier|Format)'
  spctl --assess --type execute -vv "$app" 2>&1 || true
} | tee "$out/environment.txt"

data=$(mktemp -d)
port=$(python3 -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])')
reports_before=$(ls ~/Library/Logs/DiagnosticReports 2>/dev/null | sort)
started=$(date +%s)
log_start=$(date '+%Y-%m-%d %H:%M:%S')
ASTRO_DATA_DIR="$data" ASTRO_REMOTE_DEBUGGING_PORT="$port" ASTRO_CHROMIUM_SWITCHES="--enable-logging=stderr --v=0" \
  "$binary" >"$out/astro.log" 2>&1 &
pid=$!
echo "launched pid $pid, DevTools port $port, data dir $data"

cdp=0
while (($(date +%s) - started < 120)); do
  kill -0 "$pid" 2>/dev/null || break
  if curl -fsS --max-time 2 "http://127.0.0.1:$port/json/version" >"$out/cdp-version.json" 2>/dev/null; then
    cdp=1
    break
  fi
  sleep 1
done
if [[ $cdp == 1 ]]; then
  echo "DevTools up after $(( $(date +%s) - started )) s"
else
  fail "DevTools never answered on port $port"
fi

while (($(date +%s) - started < run_for)) && kill -0 "$pid" 2>/dev/null; do sleep 1; done
alive=0
kill -0 "$pid" 2>/dev/null && alive=1
with_limit 15 osascript -e 'tell application "System Events" to get name of every window of (every process whose unix id is '"$pid"')' \
  >"$out/windows.txt" 2>&1 || true
with_limit 20 screencapture -x "$out/screenshot.png" || fail "screencapture failed"
curl -fsS --max-time 5 "http://127.0.0.1:$port/json/list" >"$out/cdp-targets.json" 2>/dev/null || true
ps -axww -o pid,ppid,rss,etime,command | grep -F "$app" | grep -v grep >"$out/processes.txt" || true
[[ $alive == 1 ]] || fail "Astro quit or crashed within $run_for s (exit status in astro.log's tail)"

kill -TERM "$pid" 2>/dev/null
for _ in $(seq 1 30); do kill -0 "$pid" 2>/dev/null || break; sleep 1; done
kill -KILL "$pid" 2>/dev/null
wait "$pid" 2>/dev/null
echo "exit status: $?" >>"$out/astro.log"
pkill -KILL -f "^$app/" 2>/dev/null || true

log show --style compact --start "$log_start" --predicate 'process BEGINSWITH "Astro" OR process CONTAINS "Chromium" OR (process == "kernel" AND eventMessage CONTAINS "Astro")' \
  >"$out/system.log" 2>&1 || true
mkdir -p "$out/crash-reports"
comm -13 <(echo "$reports_before") <(ls ~/Library/Logs/DiagnosticReports 2>/dev/null | sort) | while IFS= read -r report; do
  [[ -n "$report" ]] && cp ~/Library/Logs/DiagnosticReports/"$report" "$out/crash-reports/"
done
cp "$data"/*.log "$out/" 2>/dev/null || true
echo "--- the app's log, first 80 lines"
head -80 "$out/astro.log"
ls -la "$out" "$out/crash-reports"
exit "$status"
