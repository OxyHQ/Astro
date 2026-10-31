#!/usr/bin/env bash
# Readies a GitHub-hosted macOS runner for Astro's builds: selects Xcode, installs its Metal toolchain, puts a
# `timeout` on PATH (the engine steps call it; macOS has none), stops Spotlight indexing and frees disk.
#
#   scripts/ci/macos-runner-prep.sh [--free-disk]
#
# --free-disk deletes the Android SDK, the iOS simulator runtimes and every other Xcode, in the background.
# `scripts/ci/macos-runner-prep.sh --wait-free [GB]` waits (15 minutes at most) until that's done or GB (default 150)
# are free.
set -euo pipefail

xcode=${AC_CI_XCODE:-/Applications/Xcode_26.3.app}
marker=${RUNNER_TEMP:-/tmp}/ac-free-disk

case "${1:-}" in
  -h | --help) awk 'NR == 1 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "$0"; exit 0 ;;
  --wait-free)
    want_gb=${2:-150}
    for _ in $(seq 1 180); do
      avail_gb=$(df -g / | awk 'NR == 2 { print $4 }')
      if [[ -f "$marker.done" ]] || ((avail_gb >= want_gb)); then df -h / | tail -1; exit 0; fi
      sleep 5
    done
    echo "::warning::only ${avail_gb} GB free after 15 minutes of freeing disk"
    df -h / | tail -1
    exit 0
    ;;
  "" | --free-disk) ;;
  *) echo "macos-runner-prep: unknown option $1" >&2; exit 64 ;;
esac

[[ -d "$xcode" ]] || { echo "macos-runner-prep: no $xcode on this image" >&2; ls -d /Applications/Xcode* >&2; exit 1; }
sudo xcode-select -s "$xcode"
xcodebuild -version
sudo mdutil -a -i off >/dev/null 2>&1 || true

bin=${RUNNER_TEMP:-/tmp}/ac-bin
mkdir -p "$bin"
cat >"$bin/timeout" <<'SH'
#!/bin/sh
limit=$1
shift
exec perl -e 'my $limit = shift; alarm $limit; exec { $ARGV[0] } @ARGV or die "timeout: $ARGV[0]: $!\n"' "$limit" "$@"
SH
chmod +x "$bin/timeout"
[[ -n "${GITHUB_PATH:-}" ]] && echo "$bin" >>"$GITHUB_PATH"

for attempt in 1 2 3; do
  xcodebuild -downloadComponent MetalToolchain && break
  [[ $attempt == 3 ]] && { echo "macos-runner-prep: couldn't download the Metal toolchain" >&2; exit 1; }
  sleep 15
done

if [[ "${1:-}" == --free-disk ]]; then
  rm -f "$marker.done"
  (
    date; sudo rm -rf "$HOME/Library/Android" /usr/local/share/android-sdk 2>/dev/null; date
    "$bin/timeout" 180 xcrun simctl runtime delete all || true
    sudo rm -rf "$HOME/Library/Developer/CoreSimulator" 2>/dev/null
    for other in /Applications/Xcode_*.app; do
      [[ -L "$other" || "$(cd "$other" && pwd -P)" == "$(cd "$xcode" && pwd -P)" ]] && continue
      sudo rm -rf "$other"
    done
    touch "$marker.done"
  ) >"$marker.log" 2>&1 &
  disown
fi
df -h / | tail -1
