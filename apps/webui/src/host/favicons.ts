import type { FaviconImage } from "@astro-browser-real/astrocore";

const dataUri = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

async function asPng(blob: Blob): Promise<{ uri: string; width: number; height: number }> {
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  const png = await canvas.convertToBlob({ type: "image/png" });
  return { uri: await dataUri(png), width: bitmap.width, height: bitmap.height };
}

export async function fetchFaviconImage(url: string, _profile: string): Promise<FaviconImage | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await asPng(await response.blob());
  } catch {
    return null;
  }
}
