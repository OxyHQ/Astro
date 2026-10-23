import type { FaviconImage } from "@astro-browser-real/astrocore";
import { provideNativeModule } from "../../../demo/src/shims/expo-modules-core";
import { engineCall, forwardEngineTopics, startEngineEvents } from "../host/engine";

export * from "../../../demo/src/shims/astrocore";
export { WebView } from "./WebView";

provideNativeModule("AstroCEF", { engineCall, forwardEngineTopics });
startEngineEvents();

export async function faviconsFor(_profile: string, _pages: string[], _icons: string[] = []) {
  return { pages: new Map<string, { uri: string; icon: string }>(), icons: new Map<string, string>() };
}

export async function fetchFavicon(_url: string, _profile: string, _page?: string): Promise<FaviconImage | null> {
  return null;
}
