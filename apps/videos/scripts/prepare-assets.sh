#!/bin/bash
set -euo pipefail
V=$(cd "$(dirname "$0")/.." && pwd); R=$(cd "$V/../.." && pwd)
F=$V/node_modules/@fontsource-variable
[ -d "$F/archivo" ] && [ -d "$F/newsreader" ] && [ -d "$F/martian-mono" ] || (cd "$V" && pnpm install --frozen-lockfile)
mkdir -p "$V/public/fonts" "$V/public/brand"
cp "$F/archivo/files/archivo-latin-wdth-normal.woff2" "$F/martian-mono/files/martian-mono-latin-wdth-normal.woff2" \
  "$F/newsreader/files/newsreader-latin-opsz-normal.woff2" "$F/newsreader/files/newsreader-latin-opsz-italic.woff2" "$V/public/fonts/"
L=$R/output/brand/astro/final
[ -f "$L/mark-trim.png" ] && [ -f "$L/icon-1024.png" ] || (cd "$R" && python3 docs/brand/astro/build.py > /dev/null)
python3 - "$L/icon-1024.png" "$L/mark-trim.png" "$V/public/brand" <<'PY'
import sys
import numpy as np
from PIL import Image
icon, mark, out = sys.argv[1:4]
Image.open(icon).convert("RGBA").resize((512, 512), Image.LANCZOS).save(f"{out}/app-icon.png")
im = Image.open(mark).convert("RGBA")
im.save(f"{out}/mark.png")
px = np.array(im)
r, g, b, a = (px[..., i].astype(int) for i in range(4))
sun = (r > 170) & (g > 120) & (b < 130) & (r > g) & (a > 100)
ys, xs = np.nonzero(sun)
cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
radius = max(xs.max() - xs.min(), ys.max() - ys.min()) / 2
yy, xx = np.mgrid[: px.shape[0], : px.shape[1]]
disc = np.hypot(xx - cx, yy - cy) <= radius + 12
for name, keep in (("sun", disc), ("hills", ~disc)):
    layer = px.copy()
    layer[..., 3] = np.where(keep, layer[..., 3], 0)
    Image.fromarray(layer).save(f"{out}/{name}.png")
print(f"sun centre {cx / im.width:.4f} {cy / im.height:.4f} radius {radius / im.width:.4f} (fractions of the mark)")
PY
swift "$V/scripts/capture/cursor.swift" "$V/public/brand" > /dev/null
echo "fonts and brand → $V/public"
