#!/usr/bin/env bash
# Checks the built engine (helium-check-build.py, its architecture) and packs "Chromium Framework.framework" for the
# app's build as <dir>/astrocore-macos-<cpu>.tar.zst.
#
#   AC_MAC_TARGET_CPU=x64 scripts/ci/macos-engine-framework.sh <dir>
set -euo pipefail
[[ "${1:-}" == -h || "${1:-}" == --help ]] && { awk 'NR == 1 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "$0"; exit 0; }
dir=${1:?usage: macos-engine-framework.sh <dir>}

repo=$(cd "$(dirname "$0")/../.." && pwd)
cpu=${AC_MAC_TARGET_CPU:-arm64}
out="$HOME/chromium-build/chromium_git/chromium/src/out/Release_GN_$cpu"
framework="$out/Chromium Framework.framework"
binary="$framework/Versions/Current/Chromium Framework"
case $cpu in x64) arch=x86_64 ;; *) arch=$cpu ;; esac

[[ -f "$binary" ]] || { echo "no framework at $framework" >&2; exit 1; }
archs=$(lipo -archs "$binary")
[[ "$archs" == "$arch" ]] || { echo "the framework is $archs, not $arch" >&2; exit 1; }
python3 "$repo/engine/patches/build/helium-check-build.py" --out "$out" --framework "$framework"
plutil -p "$framework/Versions/Current/Resources/Info.plist" | grep -E 'CFBundleShortVersionString|SCMRevision|LSMinimumSystemVersion' || true

mkdir -p "$dir"
tar -C "$out" -cf - "Chromium Framework.framework" | zstd -T0 -10 -q -o "$dir/astrocore-macos-$cpu.tar.zst"
git -C "$repo" rev-parse HEAD:engine >"$dir/engine-tree"
du -sh "$framework" "$dir/astrocore-macos-$cpu.tar.zst"
