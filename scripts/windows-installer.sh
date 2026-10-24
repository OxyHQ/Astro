#!/usr/bin/env bash
# Builds the Windows installer (Chromium's mini_installer carrying apps/webui and uBlock Origin) as
# astro-browser-<version>-windows-x64-setup.exe in $CB/release. It installs per user into
# %LOCALAPPDATA%\Oxy\Astro\Application and registers Astro with Windows.
# Usage: AC_TARGET_PLATFORM=windows scripts/windows-installer.sh   (AC_ENGINE_PROFILE picks the engine build, release by default)
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
export AC_TARGET_PLATFORM="${AC_TARGET_PLATFORM:-windows}"
source "$root/engine/patches/build/env.sh"
[[ "$AC_PLATFORM" == windows ]] || { echo "windows-installer.sh: AC_PLATFORM is $AC_PLATFORM, not windows" >&2; exit 1; }
src="$CB/chromium_git/chromium/src"
out="$src/out/$GN_OUT_CONFIGS"
version="$(git -C "$root" describe --always --dirty)"
release="$CB/release"
mkdir -p "$release"

npx -y pnpm@11.1.3 -C "$root/apps/webui" build >/dev/null
PATH="$root/scripts/agent:$PATH" "$root/packages/astrocore/scripts/ubo.sh" >/dev/null
rm -rf "$out/astro-ui" "$out/extensions/ublock" "$out/chrome.7z" "$out/mini_installer.exe"
cp -r "$root/apps/webui/dist" "$out/astro-ui"
mkdir -p "$out/extensions"
cp -r "$root/packages/astrocore/vendor/ubo/ext" "$out/extensions/ublock"

TARGETS="chrome mini_installer" "$root/scripts/agent/locked" chromium --wait 600 -- "$root/engine/patches/build/05-build.sh" --apply
cp "$out/mini_installer.exe" "$release/astro-browser-$version-windows-x64-setup.exe"
echo "$release/astro-browser-$version-windows-x64-setup.exe ($(du -h "$release/astro-browser-$version-windows-x64-setup.exe" | cut -f1))"
