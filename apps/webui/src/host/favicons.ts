import type { FaviconImage } from "@astro-browser-real/astrocore";

const dataUri = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const decodeDataUrl = (url: string) =>
  new Promise<ImageBitmap | null>((resolve) => {
    const image = new Image();
    image.onload = () => void createImageBitmap(image).then(resolve, () => resolve(null));
    image.onerror = () => resolve(null);
    image.src = url;
  });

async function decode(url: string): Promise<ImageBitmap | null> {
  if (url.startsWith("data:")) return decodeDataUrl(url);
  const response = await fetch(url);
  return response.ok ? createImageBitmap(await response.blob()) : null;
}

async function asPng(bitmap: ImageBitmap, maxPixels?: number): Promise<FaviconImage> {
  const area = bitmap.width * bitmap.height;
  const scale = maxPixels && area > maxPixels ? Math.sqrt(maxPixels / area) : 1;
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  const png = await canvas.convertToBlob({ type: "image/png" });
  return { uri: await dataUri(png), width, height };
}

export async function fetchFaviconImage(url: string, _profile: string, maxPixels?: number): Promise<FaviconImage | null> {
  try {
    const bitmap = await decode(url);
    return bitmap ? await asPng(bitmap, maxPixels) : null;
  } catch {
    return null;
  }
}
