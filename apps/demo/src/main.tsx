import "./styles.css";
import { createRoot } from "react-dom/client";
import { unstable_batchedUpdates } from "react-native";
import { emitCommand } from "@astro-browser/shell";
import { WindowRoot } from "../../browser/src/App";
import { startNativeSync } from "../../browser/src/lib/native";
import { startTabPages } from "../../browser/src/lib/tabPages";
import { setStoreBatching, useBrowser } from "../../browser/src/store/browser";
import { Controls } from "./Controls";
import { startEmbed } from "./embed";
import { isFrameable } from "./frameable";
import { pageTitle } from "./pages";
import { installLocalSuggestions } from "./localSuggest";
import { demoSession } from "./seed";
import { warmFrame } from "./shims/web/framePool";
import { OverlayHost } from "./shims/web/overlays";
import "./shims/web/motion/shortcuts";
import { TrafficLights } from "./shims/web/windowChrome";

installLocalSuggestions();
setStoreBatching(unstable_batchedUpdates);
useBrowser.getState().hydrate(demoSession());
startTabPages();
startNativeSync();

const params = new URLSearchParams(location.search);
const embed = params.has("embed");
const bare = embed || params.has("bare");

Object.assign(globalThis, { astroDemo: { store: useBrowser, emitCommand } });

function warmOtherProfiles() {
  const s = useBrowser.getState();
  for (const window of Object.values(s.windows))
    for (const [profileId, tabId] of Object.entries(window.activeTabIds)) {
      const url = s.tabs[tabId]?.url;
      if (profileId !== window.profileId && url && isFrameable(url)) warmFrame(url, pageTitle(url));
    }
}

const idle = (run: () => void) => ("requestIdleCallback" in window ? requestIdleCallback(run, { timeout: 1500 }) : setTimeout(run, 300));
idle(warmOtherProfiles);

function DemoWindow() {
  return (
    <div className={embed ? "astro-desktop embed" : bare ? "astro-desktop" : "astro-desktop with-controls"}>
      <div className="astro-window">
        <WindowRoot />
        <TrafficLights />
      </div>
      {bare ? null : <Controls />}
      <OverlayHost />
    </div>
  );
}

createRoot(document.getElementById("root")!, { onUncaughtError: (error) => console.error("[astro demo] crashed", error) }).render(<DemoWindow />);

if (embed) startEmbed();
