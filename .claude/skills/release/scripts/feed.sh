#!/usr/bin/env bash
set -euo pipefail

version="${1:?usage: feed.sh <version> [--before-publish] [app]}"
shift
before=0
if [ "${1:-}" = "--before-publish" ]; then before=1; shift; fi
root="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
app="${1:-$root/dist/$version/export/Astro.app}"

feed="$(/usr/libexec/PlistBuddy -c 'Print :SUFeedURL' "$app/Contents/Info.plist")"
case "$feed" in
  https://*) ;;
  *) echo "FAIL  feed URL is https  ($feed)"; exit 1 ;;
esac
xml="$(curl -fsSL --max-time 20 --retry 2 "$feed" 2>&1)" || { echo "FAIL  feed answers  ($feed: $xml)"; exit 1; }
listed="$(grep -o 'shortVersionString>[^<]*' <<< "$xml" | head -1 | sed 's/.*>//' || true)"
if ! grep -q 'xmlns:sparkle' <<< "$xml"; then
  echo "FAIL  feed is a Sparkle appcast  ($feed)"
  exit 1
fi
if [ $before = 1 ]; then
  echo "PASS  feed answers with an appcast  ($feed, latest ${listed:-none})"
elif [ "$listed" = "$version" ]; then
  echo "PASS  feed lists $version  ($feed)"
else
  echo "FAIL  feed lists $version  ($feed lists ${listed:-nothing})"
  exit 1
fi
