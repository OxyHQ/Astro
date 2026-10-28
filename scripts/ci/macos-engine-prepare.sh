#!/usr/bin/env bash
# Makes a fresh, patched Chromium tree in ~/chromium-build on a CI runner, through the engine's own steps
# (docs/engine-build.md › "Rebuilding"): depot_tools and the pinned Helium checkouts, then steps 1, 3, 4 and 2,
# each under the chromium lock. Step 1 is retried, since a googlesource fetch can drop mid-transfer. The out dir builds
# with ninja (use_siso = false): it records each finished step as it goes, so a build stopped at a job's deadline
# resumes where it stopped; siso started over.
#
#   AC_MAC_TARGET_CPU=x64 scripts/ci/macos-engine-prepare.sh
set -euo pipefail
[[ "${1:-}" == -h || "${1:-}" == --help ]] && { awk 'NR == 1 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "$0"; exit 0; }

repo=$(cd "$(dirname "$0")/../.." && pwd)
build="$repo/engine/patches/build"
cb="$HOME/chromium-build"
locked=("$repo/scripts/agent/locked" chromium --wait 60 --)
mkdir -p "$cb/logs"

retry() {
  local attempts=$1 attempt
  shift
  for attempt in $(seq 1 "$attempts"); do
    "$@" && return 0
    echo "::warning::attempt $attempt of $* failed"
    [[ $attempt == "$attempts" ]] || sleep 30
  done
  return 1
}

stage() { echo "::group::$1"; date; }
done_stage() { date; echo "::endgroup::"; }

stage depot_tools
if [[ ! -d "$cb/depot_tools/.git" ]]; then
  retry 3 git clone --depth 1 https://chromium.googlesource.com/chromium/tools/depot_tools.git "$cb/depot_tools"
fi
if [[ -x "$cb/depot_tools/ensure_bootstrap" ]]; then
  (cd "$cb/depot_tools" && retry 3 ./ensure_bootstrap)
else
  (cd "$cb/depot_tools" && retry 3 ./update_depot_tools)
fi
done_stage

stage "Helium checkouts"
pin() { python3 -I -c 'import configparser, sys; c = configparser.ConfigParser(interpolation=None); c.read(sys.argv[1]); print(c[sys.argv[2]][sys.argv[3]])' "$build/helium-pins.ini" "$@"; }
for section in helium-chromium:helium helium-macos:helium-macos; do
  name=${section%%:*} dir="$cb/${section#*:}"
  url=$(pin "$name" url) commit=$(pin "$name" commit)
  rm -rf "$dir"
  git init -q "$dir"
  git -C "$dir" remote add origin "$url"
  retry 3 git -C "$dir" fetch -q --depth 1 origin "$commit"
  git -C "$dir" -c advice.detachedHead=false checkout -q FETCH_HEAD
  echo "$name $(git -C "$dir" rev-parse HEAD)"
done
done_stage

stage "Step 1: Chromium and its deps"
sync_once() {
  rm -rf "$cb/chromium_git/chromium/_bad_scm"
  "${locked[@]}" "$build/01-sync.sh" --apply
}
retry 3 sync_once
done_stage

stage "Step 3: Helium"
"${locked[@]}" python3 "$build/03-helium.py" --apply
done_stage

stage "Step 4: Astro's series"
"${locked[@]}" "$build/04-series.sh" --apply
done_stage

stage "Step 2: GN args, built with ninja"
"${locked[@]}" "$build/02-gn-args.sh" --apply
out_dir="out/Release_GN_${AC_MAC_TARGET_CPU:-arm64}"
echo 'use_siso = false' >>"$cb/chromium_git/chromium/src/$out_dir/args.gn"
"${locked[@]}" env PATH="$cb/depot_tools:$PATH" DEPOT_TOOLS_UPDATE=0 bash -c 'cd "$1" && gn gen "$2"' _ \
  "$cb/chromium_git/chromium/src" "$out_dir"
cat "$cb/chromium_git/chromium/src/$out_dir/args.gn"
done_stage

git -C "$repo" rev-parse HEAD >"$cb/ci-source-commit"
df -h / | tail -1
