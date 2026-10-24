#!/usr/bin/env bash
# Builds the Windows installer (Chromium's mini_installer, with apps/webui in resources.pak, and uBlock Origin) as
# Astro-<version>-windows-x64-setup.exe in $CB/release (the version is MARKETING_VERSION), with
# Astro-<version>-windows-x64-setup.exe.commit naming the commit it was built from (scripts/release.sh
# checks it). It installs per user into %LOCALAPPDATA%\Oxy\Astro\Application and registers Astro with Windows;
# running a newer one over it while Astro is closed is how Astro updates itself.
# Usage: AC_TARGET_PLATFORM=windows scripts/windows-installer.sh   (AC_ENGINE_PROFILE picks the engine build, release by default)
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
export AC_TARGET_PLATFORM="${AC_TARGET_PLATFORM:-windows}"
source "$root/engine/patches/build/env.sh"
[[ "$AC_PLATFORM" == windows ]] || { echo "windows-installer.sh: AC_PLATFORM is $AC_PLATFORM, not windows" >&2; exit 1; }
src="$CB/chromium_git/chromium/src"
out="$src/out/$GN_OUT_CONFIGS"
commit="$(git -C "$root" rev-parse HEAD)$(git -C "$root" diff --quiet HEAD -- apps packages engine scripts || echo -dirty)"
release="$CB/release"
mkdir -p "$release"
version="$(sed -n 's/.*MARKETING_VERSION = \(.*\);/\1/p' "$root/apps/browser/macos/Astro.xcodeproj/project.pbxproj" | head -1)"
setup="$release/Astro-$version-windows-x64-setup.exe"

npx -y pnpm@11.1.3 -C "$root/apps/webui" build >/dev/null
PATH="$root/scripts/agent:$PATH" "$root/packages/astrocore/scripts/ubo.sh" >/dev/null
rm -rf "$out/astro-ui" "$out/extensions/ublock" "$out/cli" "$out/chrome.7z" "$out/mini_installer.exe"
mkdir -p "$out/extensions"
cp -r "$root/packages/astrocore/vendor/ubo/ext" "$out/extensions/ublock"
cli_out="$(mktemp -d)"
sh "$root/apps/cli/scripts/build.sh" --platform windows-x64 "$version" "$cli_out" >/dev/null
mkdir "$out/cli"
tar -xzf "$cli_out/astro-cli-$version-windows-x64.tar.gz" -C "$out/cli" --strip-components=1
rm -rf "$cli_out"

TARGETS="chrome mini_installer" "$root/scripts/agent/locked" chromium --wait 600 -- "$root/engine/patches/build/05-build.sh" --apply
cp "$out/mini_installer.exe" "$setup"
echo "$commit" > "$setup.commit"
echo "$setup ($(du -h "$setup" | cut -f1))"
