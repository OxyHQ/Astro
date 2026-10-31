#!/usr/bin/env bash
# Writes a stand-in "Chromium Framework.framework" for one architecture: a dylib with the framework's install name and
# the resources the app's build stages and prunes, so the app compiles, links (with -undefined dynamic_lookup) and
# packages without an engine build. The app it makes can't run.
#
#   scripts/ci/macos-stub-engine.sh arm64|x86_64 <dir>
set -euo pipefail
[[ "${1:-}" == -h || "${1:-}" == --help ]] && { awk 'NR == 1 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "$0"; exit 0; }
arch=${1:?usage: macos-stub-engine.sh arm64|x86_64 <dir>}
dir=${2:?usage: macos-stub-engine.sh arm64|x86_64 <dir>}

fw="$dir/Chromium Framework.framework"
v="$fw/Versions/A"
rm -rf "$fw"
mkdir -p "$v/Resources/en.lproj" "$v/Helpers" "$v/Libraries"
src=$(mktemp -d)
echo 'int ac_stub_engine(void) { return 0; }' >"$src/stub.c"
xcrun clang -arch "$arch" -mmacosx-version-min=13.0 -dynamiclib -install_name "@rpath/Chromium Framework.framework/Chromium Framework" \
  -o "$v/Chromium Framework" "$src/stub.c"
xcrun clang -arch "$arch" -mmacosx-version-min=13.0 -dynamiclib -install_name "@rpath/libstub.dylib" -o "$v/Libraries/libstub.dylib" "$src/stub.c"
python3 -c 'import struct, sys; open(sys.argv[1], "wb").write(struct.pack("<IB3xHH", 5, 1, 0, 0) + struct.pack("<HI", 0, 18))' "$v/Resources/resources.pak"
touch "$v/Resources/en.lproj/locale.pak"
plutil -create xml1 "$v/Resources/Info.plist"
plutil -insert CFBundleIdentifier -string so.oxy.astro.stub "$v/Resources/Info.plist"
plutil -insert CFBundleExecutable -string "Chromium Framework" "$v/Resources/Info.plist"
plutil -insert CFBundlePackageType -string FMWK "$v/Resources/Info.plist"
plutil -insert CFBundleShortVersionString -string 155.0.8059.84 "$v/Resources/Info.plist"
ln -s A "$fw/Versions/Current"
ln -s "Versions/Current/Chromium Framework" "$fw/Chromium Framework"
ln -s Versions/Current/Resources "$fw/Resources"
ln -s Versions/Current/Libraries "$fw/Libraries"
rm -rf "$src"
lipo -archs "$v/Chromium Framework"
