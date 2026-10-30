#!/usr/bin/env bash
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
src=${CHROMIUM_SRC:-$HOME/chromium-build/chromium_git/chromium/src}
owned=(ui/ozone/platform/oxyos)

for dir in "${owned[@]}"; do
  if [[ "${1:-}" == --check ]]; then
    diff -r "$here/src/$dir" "$src/$dir" >/dev/null || { echo "drift: $dir" >&2; exit 1; }
  else
    mkdir -p "$src/$dir"
    rsync -rlp --delete --checksum "$here/src/$dir/" "$src/$dir/"
  fi
done
