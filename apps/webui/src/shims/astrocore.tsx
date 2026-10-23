import { provideNativeModule } from "../../../demo/src/shims/expo-modules-core";
import { engineCall, forwardEngineTopics, startEngineEvents } from "../host/engine";
import { fetchFaviconImage } from "../host/favicons";

export * from "../../../demo/src/shims/astrocore";
export { faviconsFor, fetchFavicon } from "@astro-browser-real/astrocore";
export { WebView } from "./WebView";

provideNativeModule("AstroCEF", { engineCall, forwardEngineTopics, fetchFavicon: fetchFaviconImage });
startEngineEvents();
