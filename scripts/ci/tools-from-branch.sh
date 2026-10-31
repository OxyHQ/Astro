#!/usr/bin/env bash
# Puts the macOS CI scripts (scripts/ci) from the ci/macos-intel branch into this checkout, so this branch's workflows
# run the same engine, app-build and smoke-test steps as that pipeline until it merges. A branch that already has
# scripts/ci keeps its own.
#
#   scripts/ci/tools-from-branch.sh [branch, default ci/macos-intel]
set -euo pipefail
[[ "${1:-}" == -h || "${1:-}" == --help ]] && { awk 'NR == 1 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "$0"; exit 0; }
branch=${1:-ci/macos-intel}
repo=$(cd "$(dirname "$0")/../.." && pwd)
cd "$repo"
if [[ -x scripts/ci/macos-app-build.sh ]]; then
  echo "scripts/ci is this checkout's own"
  exit 0
fi
git fetch --no-tags --depth 1 origin "$branch"
git archive FETCH_HEAD scripts/ci | tar -x
echo "scripts/ci from $branch at $(git rev-parse --short FETCH_HEAD): $(ls scripts/ci | tr '\n' ' ')"
