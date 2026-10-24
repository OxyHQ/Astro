#!/usr/bin/env bash
# Builds the Linux engine with apps/webui in its resources.pak and packages it as astro-browser-<version>-x86_64.tar.xz in ~/chromium-build/release.
# Usage: scripts/linux-package.sh   (AC_ENGINE_PROFILE picks the engine build, release by default)
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
source "$root/engine/patches/build/env.sh"
out="$CB/chromium_git/chromium/src/out/$GN_OUT_CONFIGS"
[[ -d "$out" ]] || { echo "linux-package.sh: no engine build at $out (AC_ENGINE_PROFILE=dev for the dev build)" >&2; exit 1; }
version="$(git -C "$root" describe --always --dirty)"
name="astro-browser-$version-x86_64"
release="$CB/release"
dir="$release/$name"
rm -rf "$dir"
mkdir -p "$dir/locales"

npx -y pnpm@11.1.3 -C "$root/apps/webui" build >/dev/null
TARGETS=chrome "$root/scripts/agent/locked" chromium --wait 600 -- "$root/engine/patches/build/05-build.sh" --apply >/dev/null
PATH="$root/scripts/agent:$PATH" "$root/packages/astrocore/scripts/ubo.sh" >/dev/null
mkdir -p "$dir/extensions"
cp -r "$root/packages/astrocore/vendor/ubo/ext" "$dir/extensions/ublock"

for file in chrome chrome_crashpad_handler chrome_100_percent.pak chrome_200_percent.pak resources.pak icudtl.dat \
  v8_context_snapshot.bin libEGL.so libGLESv2.so libvk_swiftshader.so libvulkan.so.1 vk_swiftshader_icd.json \
  libqt5_shim.so libqt6_shim.so; do
  cp "$out/$file" "$dir/"
done
cp "$out/locales/"*.pak "$dir/locales/"
find "$dir" -maxdepth 1 -type f \( -name chrome -o -name chrome_crashpad_handler -o -name '*.so' -o -name '*.so.1' \) \
  -exec strip --strip-unneeded {} +

cli_version="$(sed -n 's/.*MARKETING_VERSION = \(.*\);/\1/p' "$root/apps/browser/macos/Astro.xcodeproj/project.pbxproj" | head -1)"
cli_out="$(mktemp -d)"
sh "$root/apps/cli/scripts/build.sh" --platform linux-x64 "$cli_version" "$cli_out" >/dev/null
mkdir "$dir/cli"
tar -xzf "$cli_out/astro-cli-$cli_version-linux-x64.tar.gz" -C "$dir/cli" --strip-components=1
rm -rf "$cli_out"

install -m 755 "$root/engine/linux/astro-browser-wrapper.sh" "$dir/astro-browser"
cp "$root/engine/linux/astro-browser.desktop" "$root/engine/linux/apparmor.cfg" "$root/engine/linux/so.oxy.astro.policy" "$dir/"
cp "$root/engine/chromium/src/chrome/app/theme/chromium/product_logo_256.png" "$dir/astro-browser.png"

tar -C "$release" -cJf "$release/$name.tar.xz" "$name"
echo "$release/$name.tar.xz ($(du -h "$release/$name.tar.xz" | cut -f1))"
