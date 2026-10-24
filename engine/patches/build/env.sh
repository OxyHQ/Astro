# Shared environment for the Astro engine build: plain Chromium + ungoogled-chromium + our
# series (docs/engine-build.md). Source this file.
export CB="${AC_CHROMIUM_BUILD:-$HOME/chromium-build}"
# The Astro checkout (game-resource.sh reads the offline game from it): the one this file is in, or
# ~/Documents/astro for the copy in ~/chromium-build/scripts that the step scripts source.
_ac_repo="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/../../.." && pwd)"
[[ -f "$_ac_repo/engine/patches/series" ]] || _ac_repo="$HOME/Documents/astro"
export AC_REPO="${AC_REPO:-$_ac_repo}"
unset _ac_repo
export DEPOT_TOOLS_UPDATE=0
export PATH="$CB/depot_tools:$PATH"
# The Chromium tag step 1 checks out, and the Helium tags made for exactly it
# (its patches and domain substitution lists are version-specific).
export CHROMIUM_VERSION=155.0.8059.84
export HELIUM_TAG=0.19.4
export HELIUM_DIR="$CB/helium"
# The platform the engine is built for: this host's. Helium's platform series and our output dir follow it.
# AC_TARGET_PLATFORM=windows cross-builds Windows from a Linux host (docs/engine-build.md › "Windows").
case "$(uname -s)/${AC_TARGET_PLATFORM:-}" in
  Darwin/) export AC_PLATFORM=macos AC_TARGET_OS=mac AC_TARGET_CPU=arm64 ;;
  Linux/) export AC_PLATFORM=linux AC_TARGET_OS=linux AC_TARGET_CPU=x64 ;;
  Linux/windows) export AC_PLATFORM=windows AC_TARGET_OS=win AC_TARGET_CPU=x64 ;;
  *) echo "env.sh: the engine builds on macOS and Linux, and Windows from Linux, not $(uname -s)/${AC_TARGET_PLATFORM:-}" >&2; return 64 2>/dev/null || exit 64 ;;
esac
export HELIUM_MACOS_TAG=0.19.4.1
export HELIUM_MACOS_DIR="$CB/helium-macos"
export HELIUM_LINUX_TAG=0.19.4.1
export HELIUM_LINUX_DIR="$CB/helium-linux"
export HELIUM_WINDOWS_TAG=0.19.4.1
export HELIUM_WINDOWS_DIR="$CB/helium-windows"
case $AC_PLATFORM in
  macos) export HELIUM_PLATFORM_TAG=$HELIUM_MACOS_TAG HELIUM_PLATFORM_DIR=$HELIUM_MACOS_DIR ;;
  linux) export HELIUM_PLATFORM_TAG=$HELIUM_LINUX_TAG HELIUM_PLATFORM_DIR=$HELIUM_LINUX_DIR ;;
  windows) export HELIUM_PLATFORM_TAG=$HELIUM_WINDOWS_TAG HELIUM_PLATFORM_DIR=$HELIUM_WINDOWS_DIR ;;
esac
if [[ $AC_PLATFORM == windows ]]; then
  export GN_OUT_CONFIGS="Release_GN_win_$AC_TARGET_CPU${AC_ENGINE_PROFILE:+_$AC_ENGINE_PROFILE}"
else
  export GN_OUT_CONFIGS="Release_GN_$AC_TARGET_CPU${AC_ENGINE_PROFILE:+_$AC_ENGINE_PROFILE}"
fi
# Low priority for everything heavy. CPU-bound steps (compile/link) run in the
# background QoS band (-b): on this M5 Pro that confines them to the 10
# lower-tier cores and throttles their disk I/O. Background QoS also throttles
# network traffic to a crawl, so network-bound steps (sync) use the utility
# clamp with throttled disk I/O instead.
if [[ $AC_PLATFORM == macos ]]; then
  lowprio() { taskpolicy -b nice -n 19 "$@"; }
  lowprio_net() { taskpolicy -c utility -d throttle nice -n 19 "$@"; }
else
  lowprio() { ionice -c 3 nice -n 19 "$@"; }
  lowprio_net() { ionice -c 2 -n 7 nice -n 19 "$@"; }
fi
export DEPOT_TOOLS_METRICS=0
