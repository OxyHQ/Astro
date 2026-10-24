#!/usr/bin/env bash
# Packages the Windows engine and apps/webui as astro-browser-<version>-windows-x64.zip in $CB/release.
# Usage: AC_TARGET_PLATFORM=windows scripts/windows-package.sh   (AC_ENGINE_PROFILE picks the engine build, release by default)
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
export AC_TARGET_PLATFORM="${AC_TARGET_PLATFORM:-windows}"
source "$root/engine/patches/build/env.sh"
[[ "$AC_PLATFORM" == windows ]] || { echo "windows-package.sh: AC_PLATFORM is $AC_PLATFORM, not windows" >&2; exit 1; }
src="$CB/chromium_git/chromium/src"
out="$src/out/$GN_OUT_CONFIGS"
[[ -f "$out/chrome.exe" ]] || { echo "windows-package.sh: no engine at $out/chrome.exe (AC_ENGINE_PROFILE=dev for the dev build)" >&2; exit 1; }
version="$(git -C "$root" describe --always --dirty)"
name="astro-browser-$version-windows-x64"
release="$CB/release"
dir="$release/$name"
rm -rf "$dir" "$release/$name.zip"
mkdir -p "$dir"

npx -y pnpm@11.1.3 -C "$root/apps/webui" build >/dev/null
cp -r "$root/apps/webui/dist" "$dir/astro-ui"
PATH="$root/scripts/agent:$PATH" "$root/packages/astrocore/scripts/ubo.sh" >/dev/null
mkdir -p "$dir/extensions"
cp -r "$root/packages/astrocore/vendor/ubo/ext" "$dir/extensions/ublock"

files=$(python3 "$HELIUM_DIR/utils/filescfg.py" -c "$src/chrome/tools/build/win/FILES.cfg" \
  --build-outputs "$out" --cpu-arch 64bit list | grep -vxE 'mini_installer\.exe|mini_installer_exe_version\.rc|setup\.exe|.*\.packed\.7z')
for required in chrome.exe chrome.dll chrome_elf.dll resources.pak icudtl.dat; do
  grep -qx "$required" <<<"$files" || { echo "windows-package.sh: $required missing from $out" >&2; exit 1; }
done
[[ -f "$out/snapshot_blob.bin" ]] && ! grep -qx snapshot_blob.bin <<<"$files" && files+=$'\nsnapshot_blob.bin'
grep -qxE 'v8_context_snapshot\.bin|snapshot_blob\.bin' <<<"$files" || { echo "windows-package.sh: no V8 snapshot in $out" >&2; exit 1; }
while IFS= read -r file; do
  mkdir -p "$dir/$(dirname "$file")"
  cp -r "$out/$file" "$dir/$file"
done <<<"$files"

(cd "$release" && zip -qr9 "$name.zip" "$name")
echo "$release/$name.zip ($(du -h "$release/$name.zip" | cut -f1))"
