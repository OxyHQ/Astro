import { provideNativeModule } from "../../../demo/src/shims/expo-modules-core";
import { engineCall, forwardEngineTopics, startEngineEvents } from "../host/engine";
import { fetchFaviconImage } from "../host/favicons";
import { cefServices, extensionServices, startDownloads } from "../host/services";
import { chromeUIServices } from "../host/chromeUI";
import { contentBlockerServices, startContentBlocker } from "../host/contentBlocker";
import { importServices, startImportEvents } from "../host/import";
import { appServices, systemServices } from "../host/system";
import { startTabEvents } from "../host/tabBridge";

export * from "../../../demo/src/shims/astrocore";
export { faviconsFor, fetchFavicon } from "@astro-browser-real/astrocore";
export { WebView } from "./WebView";

provideNativeModule("AstroCEF", { ...cefServices, ...contentBlockerServices, engineCall, forwardEngineTopics, fetchFavicon: fetchFaviconImage });
provideNativeModule("AstroExtensions", extensionServices);
provideNativeModule("AstroImport", importServices);
provideNativeModule("AstroSystem", systemServices);
provideNativeModule("AstroApp", appServices);
provideNativeModule("AstroChromeUI", chromeUIServices);
startEngineEvents();
startImportEvents();
startTabEvents();
startContentBlocker();
startDownloads();
