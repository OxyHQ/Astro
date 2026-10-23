import { provideNativeModule } from "../../../demo/src/shims/expo-modules-core";
import { engineCall, forwardEngineTopics, startEngineEvents } from "../host/engine";
import { fetchFaviconImage } from "../host/favicons";
import { cefServices, extensionServices, startDownloads } from "../host/services";
import { appServices, systemServices } from "../host/system";
import { startTabEvents } from "../host/tabBridge";

export * from "../../../demo/src/shims/astrocore";
export { faviconsFor, fetchFavicon } from "@astro-browser-real/astrocore";
export { WebView } from "./WebView";

provideNativeModule("AstroCEF", { ...cefServices, engineCall, forwardEngineTopics, fetchFavicon: fetchFaviconImage });
provideNativeModule("AstroExtensions", extensionServices);
provideNativeModule("AstroImport", { listBrowsers: async () => "[]" });
provideNativeModule("AstroSystem", systemServices);
provideNativeModule("AstroApp", appServices);
startEngineEvents();
startTabEvents();
startDownloads();
