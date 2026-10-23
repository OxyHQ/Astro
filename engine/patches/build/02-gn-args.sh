#!/usr/bin/env bash
# Step 2: writes out/$GN_OUT_CONFIGS/args.gn from gn_defines.sh (the complete list) and runs
# `gn gen`. Run it after step 4 (the branding file our series adds must exist), and again
# whenever gn_defines.sh changes.
set -euo pipefail
source "$(dirname "$0")/step-guard.sh" "$@"
source "$(dirname "$0")/env.sh"
source "$(dirname "$0")/gn_defines.sh"
src="$CB/chromium_git/chromium/src"
out_dir="$src/out/$GN_OUT_CONFIGS"
mkdir -p "$out_dir"
python3 "$(dirname "$0")/pathguard.py" build-root "$CB" >/dev/null || [[ $? -eq 10 ]] || { echo "02-gn-args.sh: $CB doesn't stay in one place" >&2; exit 64; }
for path in "$out_dir" "$out_dir/args.gn"; do
  if [[ -L "$path" ]] || { [[ -f "$path" ]] && [[ "$(if [[ $AC_PLATFORM == macos ]]; then stat -f %l "$path"; else stat -c %h "$path"; fi)" -gt 1 ]]; }; then
    echo "02-gn-args.sh: $path is a link: refusing to write through it" >&2
    exit 64
  fi
done
args_tmp=$(mktemp "$out_dir/.args.gn.XXXXXX")
printf '%s\n' "${_gn_args[@]}" | sort >"$args_tmp"
chmod 644 "$args_tmp"
mv -f "$args_tmp" "$out_dir/args.gn"
cd "$src"
gn gen "out/$GN_OUT_CONFIGS"
