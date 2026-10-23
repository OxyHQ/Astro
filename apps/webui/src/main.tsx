import "../../demo/src/styles.css";
import "./styles.css";
import { createRoot } from "react-dom/client";
import { unstable_batchedUpdates } from "react-native";
import { WindowRoot } from "../../browser/src/App";
import { startNativeSync } from "../../browser/src/lib/native";
import { startPersistence } from "../../browser/src/lib/persist";
import { startTabPages } from "../../browser/src/lib/tabPages";
import { setStoreBatching } from "../../browser/src/store/browser";
import { MenuHost } from "../../demo/src/shims/web/menus";
import "../../demo/src/shims/web/motion/shortcuts";
import { installEngineFetch } from "./host/fetch";
import { WindowControls } from "./WindowControls";

installEngineFetch();
setStoreBatching(unstable_batchedUpdates);
startPersistence();
startTabPages();
startNativeSync();

createRoot(document.getElementById("root")!, { onUncaughtError: (error) => console.error("[astro] crashed", error) }).render(
  <>
    <div className="astro-window">
      <WindowRoot />
      <WindowControls />
    </div>
    <MenuHost />
  </>,
);
