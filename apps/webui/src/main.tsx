import "../../demo/src/styles.css";
import "./styles.css";
import { useEffect, useLayoutEffect, useRef } from "react";
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
import { startAppActivity } from "./host/appActive";
import { startDragPreview } from "./host/dragPreview";
import { installEngineFetch } from "./host/fetch";
import { startEngineKeys } from "./host/keys";
import { startFeedbackCommands } from "./host/feedback";
import { OxyHost } from "./host/oxy";
import { leadLifecycle, startLifecycle } from "./host/lifecycle";
import { offerOnboarding, startOnboardingCommand } from "./host/onboarding";
import { startPerformanceRecordingCommand } from "./host/performanceRecording";
import { startTabDragShare } from "./host/tabDragShare";
import { tabHub } from "./host/tabs";
import { endTelemetry, leadTelemetry, reportUncaught, startPageTelemetry, windowShown } from "./host/telemetry";
import { startUpdater } from "./host/updater";
import { startWindows, usePageWindowId } from "./host/windows";
import { AppMenuButton } from "./AppMenu";
import { UtilityWindows } from "./UtilityWindows";
import { WindowControls } from "./WindowControls";

installEngineFetch();
startTranslate();
void startEngineKeys();
void startAppActivity();
startDragPreview();
startTabDragShare();
setStoreBatching(unstable_batchedUpdates);

Object.assign(globalThis, { astro: { store: useBrowser, emitCommand } });

const startPage = () =>
  startWindows(
    {
      lead: (hydrate) => {
        if (hydrate) offerOnboarding();
        leadTelemetry(hydrate);
        leadLifecycle(hydrate);
        void startPersistence({ hydrate });
        afterFirstWindow(startUserScripts);
        afterFirstWindow(startUpdater);
      },
      begin: () => {
        startPageTelemetry();
        startTabPages();
        startNativeSync();
        startLifecycle();
        startCliControl();
        startOnboardingCommand();
        startPerformanceRecordingCommand();
        startFeedbackCommands();
      },
      end: () => {
        endTelemetry();
        flushPersistence({ final: true });
      },
    },
    () => void tabHub().then((hub) => hub.closePage()),
  );

void loadDocuments().then(startPage);

function LaunchMarks() {
  const committed = useRef(0);
  useLayoutEffect(() => void (committed.current = Date.now()), []);
  useEffect(() => windowShown({ committed: committed.current, shown: Date.now() }), []);
  return null;
}

function PageWindow() {
  const windowId = usePageWindowId();
  if (!windowId) return null;
  return (
    <>
      <div className="astro-window">
        <WindowRoot windowId={windowId} />
        <LaunchMarks />
        <WindowControls />
        <AppMenuButton />
      </div>
      <UtilityWindows />
      <OverlayHost />
      <OxyHost />
    </>
  );
}

createRoot(document.getElementById("root")!, {
  onUncaughtError: (error) => {
    reportUncaught(error);
    console.error("[astro] crashed", error);
  },
}).render(<PageWindow />);
