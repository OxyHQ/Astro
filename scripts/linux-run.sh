#!/usr/bin/env bash
# Starts the Linux engine (out/Release_GN_x64_dev unless AC_ENGINE_PROFILE says otherwise) with apps/webui's build.
# Usage: scripts/linux-run.sh [chrome arguments…]   (pnpm linux builds apps/webui first)
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
export AC_ENGINE_PROFILE="${AC_ENGINE_PROFILE-dev}"
source "$root/engine/patches/build/env.sh"
chrome="$CB/chromium_git/chromium/src/out/$GN_OUT_CONFIGS/chrome"
[[ -x "$chrome" ]] || { echo "linux-run.sh: no engine at $chrome: build it (docs/engine-build.md › On Linux)" >&2; exit 1; }
[[ -f "$root/apps/webui/dist/index.html" ]] || { echo "linux-run.sh: build the interface first: pnpm -C apps/webui build" >&2; exit 1; }
PATH="$root/scripts/agent:$PATH" "$root/packages/astrocore/scripts/ubo.sh" >/dev/null
exec "$chrome" --astro-ui-dir="$root/apps/webui/dist" --astro-ublock-dir="$root/packages/astrocore/vendor/ubo/ext" "$@"
