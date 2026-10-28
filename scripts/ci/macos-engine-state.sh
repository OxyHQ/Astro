#!/usr/bin/env bash
# Packs ~/chromium-build (the patched tree, its out dir and the build's own state) into zstd parts a CI artifact can
# carry to the next job, fetches that artifact in the next job, and unpacks it there. Unpacking also copies this
# checkout's engine layers into the tree (engine/chromium/apply.sh, engine/astrocore/apply.sh: only what differs), so
# a tree packed from an earlier commit with the same patch series resumes with the current code.
#
#   scripts/ci/macos-engine-state.sh pack <dir>
#   GH_TOKEN=… scripts/ci/macos-engine-state.sh fetch <dir> <run id> <artifact name>
#   scripts/ci/macos-engine-state.sh unpack <dir>
#
# fetch downloads the artifact's zip itself and checks every part's SHA-256, retrying, since
# actions/download-artifact@v4 once reported success with only 5 of a 13.7 GB artifact's 7 parts on disk.
set -euo pipefail

usage() { awk 'NR == 1 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "$0"; exit "${1:-0}"; }
[[ "${1:-}" == -h || "${1:-}" == --help ]] && usage
[[ $# == 2 || ( $# == 4 && $1 == fetch ) ]] || usage 64
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
  fetch)
    run=$3 name=$4
    id=$(gh api "repos/$GITHUB_REPOSITORY/actions/runs/$run/artifacts?name=$name" --jq '.artifacts[0].id // empty')
    [[ -n "$id" ]] || { echo "no artifact $name in run $run" >&2; exit 1; }
    for attempt in 1 2 3; do
      start=$(date +%s)
      rm -rf "$dir" && mkdir -p "$dir"
      if curl -fL --retry 5 --retry-all-errors -sS -H "Authorization: Bearer $GH_TOKEN" -o "$dir/state.zip" \
          "https://api.github.com/repos/$GITHUB_REPOSITORY/actions/artifacts/$id/zip" \
        && (cd "$dir" && ditto -x -k state.zip . && rm state.zip && shasum -a 256 -c --quiet state.sha256); then
        echo "fetched $(du -sh "$dir" | cut -f1) from run $run in $(( $(date +%s) - start )) s"
        exit 0
      fi
      echo "::warning::fetching $name (attempt $attempt) failed"
    done
    exit 1
    ;;
  unpack)
    start=$(date +%s)
    (cd "$dir" && shasum -a 256 -c --quiet state.sha256)
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
