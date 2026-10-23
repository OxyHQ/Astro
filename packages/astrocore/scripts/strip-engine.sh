#!/usr/bin/env bash
set -euo pipefail

app="${1:?usage: strip-engine.sh <Astro.app> <symbols dir>}"
symbols="${2:?usage: strip-engine.sh <Astro.app> <symbols dir>}"
fwv="$(cd "$app/Contents/Frameworks/Chromium Framework.framework/Versions/Current" && pwd -P)" \
  || { echo "error: no Chromium Framework.framework in $app" >&2; exit 1; }
mkdir -p "$symbols"
symbols="$(cd "$symbols" && pwd -P)"

uuid() { dwarfdump --uuid "$1" | awk '{ print $2 }'; }
total_before=0 total_after=0
binaries=("$fwv/Chromium Framework" "$fwv"/Libraries/*.dylib "$fwv/Helpers/chrome_crashpad_handler" "$fwv/Helpers/app_mode_loader")
for bin in "${binaries[@]}"; do
  [ -f "$bin" ] || continue
  rel="${bin#"$fwv"/}"
  mkdir -p "$symbols/$(dirname "$rel")"
  cp -c "$bin" "$symbols/$rel"
  before_uuid="$(uuid "$bin")" before_exports="$(dyld_info -exports "$bin" | tail -n +2 | sort)"
  before="$(stat -f %z "$bin")"
  strip -x "$bin" 2>/dev/null
  after="$(stat -f %z "$bin")"
  [ "$(uuid "$bin")" = "$before_uuid" ] || { echo "error: strip changed the UUID of $rel" >&2; exit 1; }
  [ "$(dyld_info -exports "$bin" | tail -n +2 | sort)" = "$before_exports" ] \
    || { echo "error: strip changed what $rel exports" >&2; exit 1; }
  total_before=$((total_before + before)) total_after=$((total_after + after))
done
echo "    stripped ${#binaries[@]} files: $((total_before / 1048576)) MB -> $((total_after / 1048576)) MB (unstripped copies in $symbols)"
