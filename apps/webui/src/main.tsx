import "../../demo/src/styles.css";
import "./styles.css";
import { createRoot } from "react-dom/client";
import { unstable_batchedUpdates } from "react-native";
import { WindowRoot } from "../../browser/src/App";
import { startTranslate } from "../../browser/src/components/site/translate";
import { afterFirstWindow } from "../../browser/src/lib/afterFirstWindow";
import { startCliControl } from "../../browser/src/lib/cliControl";
import { startNativeSync } from "../../browser/src/lib/native";
import { flushPersistence, startPersistence } from "../../browser/src/lib/persist";
import { startTabPages } from "../../browser/src/lib/tabPages";
import { startUserScripts } from "../../browser/src/lib/userScripts";
import { setStoreBatching, useBrowser } from "../../browser/src/store/browser";
import { emitCommand, loadDocuments } from "./shims/shell";
import { OverlayHost } from "../../demo/src/shims/web/overlays";
import "../../demo/src/shims/web/motion/shortcuts";
import { installEngineFetch } from "./host/fetch";
import { startEngineKeys } from "./host/keys";
import { tabHub } from "./host/tabs";
import { startUpdater } from "./host/updater";
import { startWindows, usePageWindowId } from "./host/windows";
import { AppMenuButton } from "./AppMenu";
import { UtilityWindows } from "./UtilityWindows";
import { WindowControls } from "./WindowControls";

installEngineFetch();
startTranslate();
void startEngineKeys();
setStoreBatching(unstable_batchedUpdates);

Object.assign(globalThis, { astro: { store: useBrowser, emitCommand } });

const startPage = () =>
  startWindows(
    {
      lead: (hydrate) => {
        void startPersistence({ hydrate });
        afterFirstWindow(startUserScripts);
        afterFirstWindow(startUpdater);
      },
      begin: () => {
        startTabPages();
        startNativeSync();
        startCliControl();
      },
      end: () => flushPersistence({ final: true }),
    },
    () => void tabHub().then((hub) => hub.page.close()),
  );

void loadDocuments().then(startPage);

function PageWindow() {
  const windowId = usePageWindowId();
  if (!windowId) return null;
  return (
    <>
      <div className="astro-window">
        <WindowRoot windowId={windowId} />
        <WindowControls />
        <AppMenuButton />
      </div>
      <UtilityWindows />
      <OverlayHost />
    </>
  );
}

createRoot(document.getElementById("root")!, { onUncaughtError: (error) => console.error("[astro] crashed", error) }).render(<PageWindow />);
