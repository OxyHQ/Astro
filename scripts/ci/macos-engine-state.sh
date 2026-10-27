#!/usr/bin/env bash
# Packs ~/chromium-build (the patched tree, its out dir and the build's own state) into zstd parts a CI artifact can
# carry to the next job, or unpacks them there. Unpacking also copies this checkout's engine layers into the tree
# (engine/chromium/apply.sh, engine/astrocore/apply.sh: only what differs), so a tree packed from an earlier commit
# with the same patch series resumes with the current code.
#
#   scripts/ci/macos-engine-state.sh pack <dir>
#   scripts/ci/macos-engine-state.sh unpack <dir>
set -euo pipefail

usage() { awk 'NR == 1 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "$0"; exit "${1:-0}"; }
[[ "${1:-}" == -h || "${1:-}" == --help ]] && usage
[[ $# == 2 ]] || usage 64
mode=$1 dir=$2
repo=$(cd "$(dirname "$0")/../.." && pwd)
cb="$HOME/chromium-build"

case $mode in
  pack)
    mkdir -p "$dir"
    rm -f "$dir"/state.tar.zst.*
    start=$(date +%s)
    tar -C "$HOME" -cf - chromium-build | zstd -T0 -3 -q | split -b 1900m - "$dir/state.tar.zst."
    (cd "$dir" && shasum -a 256 state.tar.zst.* >state.sha256)
    echo "packed $(du -sh "$dir" | cut -f1) in $(( $(date +%s) - start )) s"
    ;;
  unpack)
    start=$(date +%s)
    (cd "$dir" && shasum -a 256 -c state.sha256)
    rm -rf "$cb"
    cat "$dir"/state.tar.zst.* | zstd -d -q | tar -C "$HOME" -xf -
    rm -rf "$dir"
    echo "unpacked $(du -sh "$cb" | cut -f1) in $(( $(date +%s) - start )) s (from $(cat "$cb/ci-source-commit" 2>/dev/null || echo "an unknown commit"))"
    src="$cb/chromium_git/chromium/src"
    for layer in chromium astrocore; do
      "$repo/scripts/agent/locked" chromium --wait 60 -- env CHROMIUM_SRC="$src" "$repo/engine/$layer/apply.sh"
    done
    git -C "$repo" rev-parse HEAD >"$cb/ci-source-commit"
    df -h / | tail -1
    ;;
  *) usage 64 ;;
esac
