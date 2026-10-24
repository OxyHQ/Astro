#!/usr/bin/env bash
# Stages the Windows and Linux interface (apps/webui/dist in $AC_REPO, built with `pnpm -C apps/webui build`) into
# chrome/browser/resources/astro_ui of the Chromium tree (untracked there): dist/ holds the files and files.json lists
# them for //chrome/browser/astro:ui_resources, which packs them into resources.pak (chromium-astro-ui.patch).
# Step 5 runs it, so a build always ships the interface as it is; files that didn't change keep their times, and
# files.json is rewritten only when the list changes. macOS has no such interface: there it does nothing.
set -euo pipefail
case "${1:-}" in
  -h | --help) awk 'NR == 1 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "$0"; exit 0 ;;
  --apply) ;;
  *) echo "ui-resource.sh: pass --apply to stage the interface (--help for usage)" >&2; exit 64 ;;
esac
[[ -n "${CHROMIUM_SRC:-}" ]] || { echo "ui-resource.sh: set CHROMIUM_SRC to the tree to write" >&2; exit 64; }
source "$(dirname "$0")/env.sh"
[[ $AC_PLATFORM == macos ]] && exit 0
ui_tree="$(cd "$CHROMIUM_SRC" 2>/dev/null && pwd -P)" || { echo "ui-resource.sh: no tree at $CHROMIUM_SRC" >&2; exit 64; }
ui_out="$ui_tree/chrome/browser/resources/astro_ui"
if ! python3 "$(dirname "$0")/pathguard.py" classify "$CHROMIUM_SRC" "$ui_out/files.json" >/dev/null; then
  AC_CHROMIUM_BUILD="$(cd "$ui_tree/../../.." && pwd -P)" source "$(dirname "$0")/step-guard.sh" --apply
fi
ui_dist="$AC_REPO/apps/webui/dist"
[[ -f "$ui_dist/index.html" ]] || { echo "ui-resource.sh: no interface at $ui_dist: build it first (pnpm -C apps/webui build)" >&2; exit 1; }
mkdir -p "$ui_out/dist"
rsync -r --delete --checksum "$ui_dist/" "$ui_out/dist/"
ui_list=$(mktemp "$ui_out/.files.json.XXXXXX")
python3 - "$ui_out/dist" "$ui_list" <<'PY'
import json, os, sys
root, out = sys.argv[1], sys.argv[2]
files = sorted(os.path.relpath(os.path.join(parent, name), root).replace(os.sep, "/")
               for parent, _, names in os.walk(root) for name in names)
json.dump(files, open(out, "w"), indent=1)
open(out, "a").write("\n")
PY
if cmp -s "$ui_list" "$ui_out/files.json"; then rm -f "$ui_list"; else mv -f "$ui_list" "$ui_out/files.json"; fi
echo "ui-resource.sh: $(python3 -c 'import json, sys; print(len(json.load(open(sys.argv[1]))))' "$ui_out/files.json") files from $ui_dist"
