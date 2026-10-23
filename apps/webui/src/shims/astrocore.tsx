import type { FaviconImage } from "@astro-browser-real/astrocore";

export * from "../../../demo/src/shims/astrocore";
export { WebView } from "./WebView";

export async function faviconsFor(_profile: string, _pages: string[], _icons: string[] = []) {
  return { pages: new Map<string, { uri: string; icon: string }>(), icons: new Map<string, string>() };
}

export async function fetchFavicon(_url: string, _profile: string, _page?: string): Promise<FaviconImage | null> {
  return null;
}
