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
export HELIUM_MACOS_TAG=0.19.4.1
export HELIUM_DIR="$CB/helium"
export HELIUM_MACOS_DIR="$CB/helium-macos"
export GN_OUT_CONFIGS=Release_GN_arm64
# Low priority for everything heavy. CPU-bound steps (compile/link) run in the
# background QoS band (-b): on this M5 Pro that confines them to the 10
# lower-tier cores and throttles their disk I/O. Background QoS also throttles
# network traffic to a crawl, so network-bound steps (sync) use the utility
# clamp with throttled disk I/O instead.
lowprio() { taskpolicy -b nice -n 19 "$@"; }
lowprio_net() { taskpolicy -c utility -d throttle nice -n 19 "$@"; }
export DEPOT_TOOLS_METRICS=0
