#!/bin/sh
# Builds the astro CLI tarball: a relocatable CPython 3.13 with astro_cli, its pinned dependencies and esbuild.
#
#   apps/cli/scripts/build.sh [--platform macos-arm64|linux-x64|windows-x64] <version> <out dir>
#   apps/cli/scripts/build.sh -h | --help
#
# Writes <out dir>/astro-cli-<version>-<platform>.tar.gz and its .sha256 (macos-arm64 by default). Needs the network
# (python-build-standalone from GitHub, wheels and esbuild from npm) and uv (~/.local/bin/uv or on PATH). The Python
# and esbuild downloads are pinned by sha256 (esbuild also by npm's sha512 integrity) and cached in
# ~/Library/Caches/astro-cli-build (~/.cache/astro-cli-build elsewhere). linux-x64 and windows-x64 install their
# wheels for the target platform, so they build on any host; they carry a VERSION file and the launcher is bin/astro
# (bin/astro.cmd on Windows). Linux and Windows ship the tree beside the engine as cli/ instead of downloading it.
set -eu

python_release=20261013
python_version=3.13.16
esbuild_version=0.28.2
platform=macos-arm64

case ${1:-} in
  -h|--help) awk 'NR == 1 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "$0"; exit 0 ;;
  --platform) [ $# -ge 2 ] || { echo "build.sh: --platform needs a value" >&2; exit 64; }; platform=$2; shift 2 ;;
esac
[ $# -eq 2 ] || { sed -n '4,5p' "$0" | sed 's/^# *//' >&2; exit 64; }
version=$1
out=$2
printf '%s\n' "$version" | grep -Eq '^[0-9]{1,4}\.[0-9]{1,4}\.[0-9]{1,4}(-[a-z]{1,16}\.[0-9]{1,4})?$' \
  || { echo "build.sh: bad version: $version" >&2; exit 64; }

case $platform in
  macos-arm64)
    python_triple=aarch64-apple-darwin
    python_sha256=16a5332fb0dcb77f163fc8f8cbccd95be1644cc53e68e5d2a79f50afd6680a0e
    esbuild_package=darwin-arm64
    esbuild_sha256=1980cde09749094452b20d36ff267585ccb3f72749c7bc97291cd9996ccf5a2a
    esbuild_sha512=n4KqkOQrraxHJcgjM1RvwbigfQKIKJVpM7xp+KsxiyUSrRdIXnt73VhrPAx0fV44hgfmIVKjxMN9J1t5jySVkw==
    esbuild_member=package/bin/esbuild
    esbuild_name=esbuild
    wheel_platform=
    host_runs=$([ "$(uname -s)-$(uname -m)" = Darwin-arm64 ] && echo 1 || echo 0)
    ;;
  linux-x64)
    python_triple=x86_64-unknown-linux-gnu
    python_sha256=d0080766b6b74aeb81e1949ef0d9a20e6c17f7b160fb295a69b936ccb17660be
    esbuild_package=linux-x64
    esbuild_sha256=9573bb2233aab0f9ea7647d5cca9726113cc1768de61d66b17267f4db84488f6
    esbuild_sha512=4xTZr1FUmSoQW4XIWmit3tzQrUTZM+N3P0XV8xROKYF50XfI7xeO90+1bZvNwxIufQ9hDQVRJH5YhgPVF8A/HQ==
    esbuild_member=package/bin/esbuild
    esbuild_name=esbuild
    wheel_platform=x86_64-manylinux_2_28
    host_runs=$([ "$(uname -s)-$(uname -m)" = Linux-x86_64 ] && echo 1 || echo 0)
    ;;
  windows-x64)
    python_triple=x86_64-pc-windows-msvc
    python_sha256=7aba3985d4cee1c7cacb963ca6aa08a5d3e695d7f9609d9fabc56f22ddcf5a06
    esbuild_package=win32-x64
    esbuild_sha256=7286c3611b6f1f4c4d9ec90adcbc478407ff0d28ead96567f361d53e67613e19
    esbuild_sha512=5ebpxr3nWMzrL/rnUI755Jkuee0bHL/Gq0WTF9lvcpv73wAp5eu8MfBUgWK9bhWvZjj7yX8etf/8tI8Ney695g==
    esbuild_member=package/esbuild.exe
    esbuild_name=esbuild.exe
    wheel_platform=x86_64-pc-windows-msvc
    host_runs=0
    ;;
  *) echo "build.sh: unknown platform: $platform" >&2; exit 64 ;;
esac
python_asset=cpython-$python_version+$python_release-$python_triple-install_only_stripped.tar.gz
python_url=https://github.com/astral-sh/python-build-standalone/releases/download/$python_release/$(printf %s "$python_asset" | sed 's/+/%2B/')
esbuild_asset=esbuild-$esbuild_package-$esbuild_version.tgz
esbuild_url=https://registry.npmjs.org/@esbuild/$esbuild_package/-/$esbuild_package-$esbuild_version.tgz
pyver=${python_version%.*}

sha256() {
  if command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1"; else sha256sum "$1"; fi | awk '{ print $1 }'
}

cli_dir=$(cd "$(dirname "$0")/.." && pwd)
uv=$(command -v uv 2>/dev/null || true)
[ -n "$uv" ] || uv=$HOME/.local/bin/uv
[ -x "$uv" ] || { echo "build.sh: uv not found" >&2; exit 1; }

if [ "$(uname -s)" = Darwin ]; then
  cache=$HOME/Library/Caches/astro-cli-build
else
  cache=${XDG_CACHE_HOME:-$HOME/.cache}/astro-cli-build
fi
mkdir -p "$cache" "$out"
out=$(cd "$out" && pwd)
if ! [ -f "$cache/$python_asset" ] || [ "$(sha256 "$cache/$python_asset")" != "$python_sha256" ]; then
  curl -fsSL --proto =https -o "$cache/$python_asset.part" "$python_url"
  mv "$cache/$python_asset.part" "$cache/$python_asset"
fi
actual=$(sha256 "$cache/$python_asset")
[ "$actual" = "$python_sha256" ] || { echo "build.sh: $python_asset checksum mismatch ($actual)" >&2; exit 1; }
if ! [ -f "$cache/$esbuild_asset" ] || [ "$(sha256 "$cache/$esbuild_asset")" != "$esbuild_sha256" ]; then
  curl -fsSL --proto =https -o "$cache/$esbuild_asset.part" "$esbuild_url"
  mv "$cache/$esbuild_asset.part" "$cache/$esbuild_asset"
fi
actual=$(sha256 "$cache/$esbuild_asset")
[ "$actual" = "$esbuild_sha256" ] || { echo "build.sh: $esbuild_asset checksum mismatch ($actual)" >&2; exit 1; }
actual=$(openssl dgst -sha512 -binary "$cache/$esbuild_asset" | base64 | tr -d '\n')
[ "$actual" = "$esbuild_sha512" ] || { echo "build.sh: $esbuild_asset sha512 mismatch ($actual)" >&2; exit 1; }

work=$(mktemp -d "${TMPDIR:-/tmp}/astro-cli-build.XXXXXX")
trap 'rm -rf "$work"' EXIT
root=$work/astro-cli-$version
mkdir -p "$root/bin"
tar -xzf "$cache/$python_asset" -C "$root"
if [ "$platform" = windows-x64 ]; then
  python=$root/python/python.exe
  lib=$root/python/Lib
else
  python=$root/python/bin/python3
  lib=$root/python/lib/python$pyver
fi
site=$lib/site-packages

if [ -z "$wheel_platform" ]; then
  UV_CACHE_DIR=$cache/uv "$uv" pip install --quiet --python "$python" --break-system-packages --link-mode copy \
    --no-build --require-hashes -r "$cli_dir/requirements.lock"
else
  UV_CACHE_DIR=$cache/uv "$uv" pip install --quiet --target "$site" --python-platform "$wheel_platform" \
    --python-version "$pyver" --link-mode copy --no-build --require-hashes -r "$cli_dir/requirements.lock"
  rm -rf "$site/bin"
fi
cp -R "$cli_dir/astro_cli" "$site/astro_cli"
printf '__version__ = "%s"\n' "$version" >"$site/astro_cli/__init__.py"
mkdir "$work/esbuild" "$site/astro_cli/bin"
tar -xzf "$cache/$esbuild_asset" -C "$work/esbuild" "$esbuild_member"
cp "$work/esbuild/$esbuild_member" "$site/astro_cli/bin/$esbuild_name"
chmod 755 "$site/astro_cli/bin/$esbuild_name"
rm -rf "$work/esbuild"
if [ "$host_runs" = 1 ]; then
  [ "$("$site/astro_cli/bin/esbuild" --version)" = "$esbuild_version" ] || { echo "build.sh: the bundled esbuild doesn't run" >&2; exit 1; }
fi

rm -rf "$lib/test" "$lib/idlelib" "$lib/tkinter" "$lib/turtledemo" "$lib/ensurepip" "$lib/lib2to3" \
  "$lib/turtle.py" "$lib/pydoc_data" "$lib"/config-* "$lib/lib-dynload"/_tkinter* \
  "$site"/pip "$site"/pip-* \
  "$root/python/include" "$root/python/share"
case $platform in
  windows-x64)
    rm -rf "$root/python/tcl" "$root/python/libs" "$root/python/Scripts" "$root/python/DLLs"/_tkinter* \
      "$root/python/DLLs"/tcl* "$root/python/DLLs"/tk* "$root/python"/pythonw.exe
    ;;
  *)
    rm -rf "$root/python/lib/pkgconfig" "$root/python/lib"/tcl* "$root/python/lib"/tk* "$root/python/lib"/itcl* \
      "$root/python/lib"/thread* "$root/python/lib"/libtcl* "$root/python/lib"/libtk* \
      "$root/python/bin"/idle* "$root/python/bin"/pydoc* "$root/python/bin"/2to3* "$root/python/bin"/pip* \
      "$root/python/bin"/python*-config
    rm -f "$root/python/lib"/libpython*.dylib "$root/python/lib"/libpython*.so*
    find "$root/python/bin" -type f ! -name "python$pyver" -delete
    ;;
esac
find "$root" \( -name tests -o -name test \) -type d -path '*/site-packages/*' -prune -exec rm -rf {} +
find "$root" \( -name '*.pyc' -o -name '*.a' -o -name RECORD -o -name INSTALLER -o -name REQUESTED -o -name direct_url.json \) -type f -delete
find "$root" -type l | while IFS= read -r link; do
  case $(readlink "$link") in
    /*|..|../*|*/../*|*/..) rm -f "$link" ;;
  esac
done
if [ "$host_runs" = 1 ]; then
  "$python" -I -c 'import astro_cli.cli, astro_cli.scripts_cli, astro_cli.scripts_test, astro_cli.scripts_store, astro_cli.browsing, pydoll, sqlite3, ssl, zoneinfo, ctypes, lzma; from astro_cli.userscript import find_esbuild; assert find_esbuild().endswith("astro_cli/bin/esbuild")' >/dev/null
fi

if [ "$platform" = windows-x64 ]; then
  printf '@echo off\r\n"%%~dp0..\\python\\python.exe" -I -m astro_cli %%*\r\n' >"$root/bin/astro.cmd"
  [ -f "$python" ] && [ -f "$site/astro_cli/bin/esbuild.exe" ] && [ -d "$site/pydoll" ] \
    || { echo "build.sh: the Windows tree is incomplete" >&2; exit 1; }
else
  cat >"$root/bin/astro" <<'EOF'
#!/bin/sh
self=$0
while [ -L "$self" ]; do
  link=$(readlink "$self")
  case $link in
    /*) self=$link ;;
    *) self=$(dirname "$self")/$link ;;
  esac
done
root=$(cd -P "$(dirname "$self")/.." && pwd -P)
exec "$root/python/bin/python3" -I -m astro_cli "$@"
EOF
  chmod 755 "$root/bin/astro"
fi
[ "$platform" = macos-arm64 ] || printf '%s\n' "$version" >"$root/VERSION"
mkdir "$root/.leases"
if [ "$host_runs" = 1 ]; then
  "$root/bin/astro" --version >/dev/null
fi
find "$root" -name __pycache__ -type d -prune -exec rm -rf {} +

tarball=astro-cli-$version-$platform.tar.gz
if tar --version 2>/dev/null | grep -q bsdtar; then
  COPYFILE_DISABLE=1 tar --no-mac-metadata --no-xattrs --uid 0 --gid 0 --uname root --gname wheel \
    -czf "$out/$tarball.part" -C "$work" "astro-cli-$version"
else
  tar --owner=0 --group=0 --numeric-owner -czf "$out/$tarball.part" -C "$work" "astro-cli-$version"
fi
mv "$out/$tarball.part" "$out/$tarball"
(cd "$out" && printf '%s  %s\n' "$(sha256 "$tarball")" "$tarball" >"$tarball.sha256")
printf '%s\n' "$out/$tarball"
