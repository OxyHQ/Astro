#!/usr/bin/env bash
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
site="$here/../../apps/site"

SITE_URL=https://astro.oxy.so pnpm -C "$site" exec astro build
rsync -a --delete "$site/dist/" "$here/dist/"
cd "$here"
npx @hexclave/cli@latest deploy --cloud-project-id 49be2e2e-87c4-433e-b42f-f255854bff56
