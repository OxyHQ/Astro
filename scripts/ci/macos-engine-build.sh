#!/usr/bin/env bash
# Builds the engine (step 5, 05-build.sh) on a CI runner until it's done or a deadline passes, so a chain of jobs under
# GitHub's 6-hour limit can finish it. At the deadline the build is interrupted as ⌃C would (its state survives), and
# the next job resumes it from the packed tree (macos-engine-state.sh). The first phase builds Astro's own layers
# first, so their compile errors show within the hour instead of at the end.
#
#   AC_MAC_TARGET_CPU=x64 scripts/ci/macos-engine-build.sh --deadline <epoch seconds>
#
# Writes status=finished or status=running to $GITHUB_OUTPUT. Exits 1 when a build step failed (compile errors are
# collected across the whole tree first: -k 0).
set -uo pipefail

deadline=""
case "${1:-}" in
  -h | --help) awk 'NR == 1 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "$0"; exit 0 ;;
  --deadline) deadline=${2:-} ;;
esac
[[ "$deadline" =~ ^[0-9]+$ ]] || { echo "usage: macos-engine-build.sh --deadline <epoch seconds>" >&2; exit 64; }

repo=$(cd "$(dirname "$0")/../.." && pwd)
cb="$HOME/chromium-build"
out="$cb/chromium_git/chromium/src/out/Release_GN_${AC_MAC_TARGET_CPU:-arm64}"
layers_done="$cb/logs/ci-layers-built"
ulimit -n 65536 2>/dev/null || ulimit -n 10240 2>/dev/null || true

report() { [[ -n "${GITHUB_OUTPUT:-}" ]] && echo "status=$1" >>"$GITHUB_OUTPUT"; echo "engine build: $1"; }
remaining() { echo $((deadline - $(date +%s))); }

until_deadline() {
  set -m
  "$@" &
  local pid=$! status
  set +m
  while kill -0 "$pid" 2>/dev/null; do
    if (($(date +%s) >= deadline)); then
      echo "::notice::deadline reached: interrupting the build to hand it to the next job"
      kill -INT -- "-$pid" 2>/dev/null
      for _ in $(seq 1 120); do kill -0 "$pid" 2>/dev/null || break; sleep 5; done
      kill -KILL -- "-$pid" 2>/dev/null
      wait "$pid" 2>/dev/null
      return 124
    fi
    sleep 15
  done
  wait "$pid"
  status=$?
  return "$status"
}

step5() {
  "$repo/scripts/agent/locked" chromium --wait 60 -- env TARGETS="$1" "$repo/engine/patches/build/05-build.sh" --apply
}

failed=0
if [[ ! -f "$layers_done" ]]; then
  echo "::group::Astro's layers first (astro/core, chrome/browser/astro)"
  until_deadline step5 "astro/core:core chrome/browser/astro:astro"
  status=$?
  echo "::endgroup::"
  case $status in
    0) touch "$layers_done" ;;
    124) report running; exit 0 ;;
    *) echo "::error::Astro's engine layers don't compile for this target (above); building the rest of the tree anyway"; failed=1 ;;
  esac
fi

echo "::group::chrome_framework ($(( $(remaining) / 60 )) min left in this job)"
until_deadline step5 chrome_framework
status=$?
echo "::endgroup::"
case $status in
  0)
    if [[ $failed == 1 ]]; then report running; exit 1; fi
    report finished
    ;;
  124) report running; [[ $failed == 1 ]] && exit 1; exit 0 ;;
  *) report running; echo "::error::the engine build failed (exit $status)"; exit 1 ;;
esac
du -sh "$out" 2>/dev/null
