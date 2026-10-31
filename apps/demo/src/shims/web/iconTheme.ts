import type { IconTheme } from "@astro-browser-real/shell";

const SAMPLE = 32;
const EMOJI_POINTS = 16;
const OPAQUE = 0.975;
const BLUR_SPREAD = 0.055;
const LIGHT = 0.88;
const LIGHT_FILL = "#000000FF";
const LIGHT_STROKE = "#FFFFFF4D";

type Rgb = [number, number, number];

async function sourceImage(uri: string | null, emoji: string | null): Promise<CanvasImageSource & { width: number; height: number } | null> {
  if (emoji) {
    const canvas = new OffscreenCanvas(SAMPLE, SAMPLE);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.scale(SAMPLE / EMOJI_POINTS, SAMPLE / EMOJI_POINTS);
    ctx.font = `${EMOJI_POINTS}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(emoji, EMOJI_POINTS / 2, EMOJI_POINTS / 2);
    return canvas;
  }
  if (!uri) return null;
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image.naturalWidth && image.naturalHeight ? image : null);
    image.onerror = () => resolve(null);
    image.src = uri;
  });
}

function opaquePixels(image: CanvasImageSource & { width: number; height: number }): Rgb[] {
  let width = image.width;
  let height = image.height;
  const longest = Math.max(width, height);
  if (longest > 0 && SAMPLE / longest < 1) {
    width *= SAMPLE / longest;
    height *= SAMPLE / longest;
  }
  const w = Math.trunc(width);
  const h = Math.trunc(height);
  if (w <= 0 || h <= 0) return [];
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const colors: Rgb[] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3]! / 255 >= OPAQUE) colors.push([data[i]! / 255, data[i + 1]! / 255, data[i + 2]! / 255]);
  }
  return colors;
}

const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = ([r, g, b]: Rgb) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
const hexByte = (c: number) => Math.round(Math.min(Math.max(c, 0), 1) * 255).toString(16).toUpperCase().padStart(2, "0");
const hex = ([r, g, b]: Rgb) => `#${hexByte(r)}${hexByte(g)}${hexByte(b)}FF`;

export function themeOf(colors: Rgb[]): IconTheme | null {
  if (!colors.length) return null;
  const mean = colors.reduce<Rgb>((sum, c) => [sum[0] + c[0], sum[1] + c[1], sum[2] + c[2]], [0, 0, 0]).map((v) => v / colors.length) as Rgb;
  const spread = colors.reduce((sum, c) => sum + Math.hypot(c[0] - mean[0], c[1] - mean[1], c[2] - mean[2]), 0) / colors.length;
  if (spread >= BLUR_SPREAD) return { kind: "blur" };
  if (luminance(mean) > LIGHT) return { kind: "template", fill: LIGHT_FILL, stroke: LIGHT_STROKE };
  return { kind: "template", fill: hex(mean) };
}

export async function iconTheme(uri: string | null, emoji: string | null): Promise<IconTheme | null> {
  if (!uri && !emoji) return null;
  const image = await sourceImage(uri || null, emoji || null);
  return image ? themeOf(opaquePixels(image)) : null;
}
