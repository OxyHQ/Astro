#!/usr/bin/env bash
# Builds Astro.app for one architecture against a prebuilt AstroCore framework and packages it as release.sh does
# (licences, stripped and pruned engine, the same disk image layout), signed ad hoc: no Developer ID, notarization,
# Sparkle key or appcast. For CI runners and anyone without Oxy's signing identity.
#
#   scripts/ci/macos-app-build.sh --arch x86_64|arm64 --framework <Chromium Framework.framework> --out <dir> [SETTING=value…]
#
# SETTING=value pairs go to xcodebuild as extra build settings. Writes <dir>/Astro.app, <dir>/Astro-<version>-<arch>.dmg
# and <dir>/build.log.
set -euo pipefail

usage() { awk 'NR == 1 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "$0"; exit "${1:-0}"; }
arch="" framework="" out=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -h | --help) usage ;;
    --arch) arch=$2; shift 2 ;;
    --framework) framework=$2; shift 2 ;;
    --out) out=$2; shift 2 ;;
    *=*) break ;;
    *) echo "macos-app-build: unknown argument $1" >&2; usage 64 ;;
  esac
done
[[ "$arch" == x86_64 || "$arch" == arm64 ]] || usage 64
[[ -f "$framework/Versions/Current/Chromium Framework" ]] || { echo "macos-app-build: no framework at $framework" >&2; exit 1; }
[[ -n "$out" ]] || usage 64

root=$(cd "$(dirname "$0")/../.." && pwd -P)
app_dir="$root/apps/browser"
macos="$app_dir/macos"
astrocore="$root/packages/astrocore"
mkdir -p "$out"
out=$(cd "$out" && pwd -P)
framework=$(cd "$framework" && pwd -P)
dd="$app_dir/build-ci-$arch"
log="$out/build.log"
die() { echo "error: $*" >&2; exit 1; }
group() { echo "::group::$1"; }
endgroup() { echo "::endgroup::"; }

pbx="$macos/Astro.xcodeproj/project.pbxproj"
version="$(sed -n 's/.*MARKETING_VERSION = "\{0,1\}\([^";]*\)"\{0,1\};/\1/p' "$pbx" | sort -u)"
dmg="$out/Astro-$version-$arch.dmg"

group "JS dependencies"
(cd "$root" && pnpm install --frozen-lockfile)
endgroup

group "Pods"
(cd "$macos" && pod install)
endgroup

group "Content blocker"
"$astrocore/scripts/ubo.sh"
endgroup

group "xcodebuild ($arch, Release, ad hoc)"
start=$(date +%s)
(cd "$app_dir" && ASTROCORE_FRAMEWORK="$framework" xcodebuild -workspace macos/Astro.xcworkspace -scheme Astro-macOS \
  -configuration Release -destination 'generic/platform=macOS' -derivedDataPath "$dd" -xcconfig macos/AdHoc.xcconfig \
  -hideShellScriptEnvironment ARCHS="$arch" ONLY_ACTIVE_ARCH=NO AC_UPDATE_CHANNEL=stable \
  ASTROCORE_STAGE_DIR="$dd/AstroCoreFramework" "$@" build) >"$log" 2>&1 || {
  grep -E "(^|\s)(fatal )?error:|The following build commands failed" -A3 "$log" | grep -v MACOSX_DEPLOYMENT_TARGET | head -80 >&2
  die "xcodebuild failed ($log)"
}
echo "built in $(( $(date +%s) - start )) s; $(grep -c 'warning:' "$log" || true) warnings"
endgroup

group "Bundle"
rm -rf "$out/Astro.app"
ditto "$dd/Build/Products/Release/Astro.app" "$out/Astro.app"
app="$out/Astro.app"
[[ "$(lipo -archs "$app/Contents/MacOS/Astro")" == "$arch" ]] || die "Astro is $(lipo -archs "$app/Contents/MacOS/Astro"), not $arch"
licenses="$app/Contents/Resources/Licenses"
mkdir -p "$licenses"
cp "$root"/LICENSE* "$root/NOTICE" "$licenses/"
"$astrocore/scripts/strip-engine.sh" "$app" "$out/symbols"
"$astrocore/scripts/prune-bundle.sh" "$app"
endgroup

group "Sign ad hoc"
sign() { codesign --force --timestamp=none --sign - "$@"; }
fw="$app/Contents/Frameworks/Chromium Framework.framework"
fwv="$(cd "$fw/Versions/Current" && pwd -P)"
for lib in "$fwv"/Libraries/*.dylib; do sign "$lib"; done
for helper in "$fwv"/Helpers/*.app "$fwv"/Helpers/chrome_crashpad_handler "$fwv"/Helpers/app_mode_loader "$fwv"/Helpers/web_app_shortcut_copier; do
  [[ -e "$helper" ]] && sign "$helper"
done
sign "$fw"
[[ -d "$app/Contents/Frameworks/hermes.framework" ]] && sign "$app/Contents/Frameworks/hermes.framework"
sign "$app"
codesign --verify --deep --strict "$app"
while IFS= read -r -d '' code; do
  file "$code" | grep -q 'Mach-O' || continue
  have=$(lipo -archs "$code" 2>/dev/null || true)
  [[ " $have " == *" $arch "* ]] || die "$code has no $arch code ($have)"
done < <(find "$app" -type f -perm -u+x -print0)
du -sh "$app"
endgroup

group "Disk image"
staging="$out/dmg"
rm -rf "$staging" "$dmg"
mkdir -p "$staging"
ditto "$app" "$staging/Astro.app"
ln -s /Applications "$staging/Applications"
cp "$root/scripts/dmg/background.tiff" "$staging/.background.tiff"
cp "$root/scripts/dmg/DS_Store" "$staging/.DS_Store"
[[ -f "$app/Contents/Resources/AppIcon.icns" ]] && cp "$app/Contents/Resources/AppIcon.icns" "$staging/.VolumeIcon.icns"
mkdir -p "$staging/.fseventsd" && touch "$staging/.fseventsd/no_log"
dmg_rw="$out/dmg-rw.dmg" dmg_mnt="$out/dmg-mnt"
rm -rf "$dmg_rw" "$dmg_mnt" && mkdir "$dmg_mnt"
for attempt in 1 2 3; do
  hdiutil create -volname Astro -srcfolder "$staging" -format UDRW -ov "$dmg_rw" >/dev/null && break
  [[ $attempt == 3 ]] && die "hdiutil create failed"
  sleep 5
done
rm -rf "$staging"
hdiutil attach "$dmg_rw" -nobrowse -noautoopen -noverify -mountpoint "$dmg_mnt" >/dev/null
SetFile -a C "$dmg_mnt" || { hdiutil detach "$dmg_mnt" -force >/dev/null; die "couldn't flag the volume's icon"; }
for attempt in 1 2 3 4 5; do
  hdiutil detach "$dmg_mnt" >/dev/null 2>&1 && break
  [[ $attempt == 5 ]] && { hdiutil detach "$dmg_mnt" -force >/dev/null || die "couldn't eject $dmg_mnt"; }
  sleep 2
done
hdiutil convert "$dmg_rw" -format ULMO -imagekey udif-chunk-size=8192 -ov -o "$dmg" >/dev/null
rm -rf "$dmg_rw" "$dmg_mnt"
sign "$dmg"
shasum -a 256 "$dmg" | tee "$dmg.sha256"
du -h "$dmg"
endgroup
