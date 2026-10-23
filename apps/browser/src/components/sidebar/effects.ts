import { onAppEvent, onWindowEvent } from "@astro-browser/shell";
import { everySlowly } from "../../lib/slowTimers";
import { webviews } from "../../lib/webviews";
import { startLive } from "../../live";
import { useBrowser } from "../../store/browser";
import { changedIds } from "../../store/changes";
import { dismissHover } from "./hover";
import { sidebarUi } from "./state";
import { cancelSwitcher, commitSwitcher, moveSwitcher } from "./switcher";

const AUTO_CLEAN_EVERY_MS = 30 * 60 * 1000;
let started = false;

export function startSidebarEffects() {
  if (started) return;
  started = true;
  startLive();

  useBrowser.subscribe((s, prev) => {
    const switcher = sidebarUi().switcher;
    if (switcher && s.windows !== prev.windows && !s.windows[switcher.windowId]) cancelSwitcher();
    for (const id of changedIds(s.tabs, prev.tabs)) {
      const muted = s.tabs[id]?.muted;
      if (muted !== undefined && prev.tabs[id] && prev.tabs[id]!.muted !== muted) void webviews.get(id)?.setMuted(muted);
    }
  });

  onAppEvent((e) => {
    if (e.type === "resignActive" || e.type === "screenLocked") {
      dismissHover();
      useBrowser.getState().closeAbandonedNewTabs();
    }
    if (e.type === "switcherReleased" || e.type === "resignActive") commitSwitcher();
    if (e.type === "switcherMouseUp" || (e.type === "switcherKey" && e.key === "escape")) cancelSwitcher();
    if (e.type === "switcherKey" && e.key !== "escape") moveSwitcher(e.key === "next" ? 1 : -1);
  });

  onWindowEvent((e) => {
    const hover = sidebarUi().hover;
    if (e.type === "focus" && hover && hover.windowId !== e.id) dismissHover();
  });

  everySlowly({
    every: AUTO_CLEAN_EVERY_MS,
    run: () => {
      const s = useBrowser.getState();
      const hours = s.settings.cleanUpInactiveTabsAfterHours;
      if (hours === null) return;
      for (const id of s.windowOrder) s.cleanUpTabs(id, { inactiveForMs: hours * 3_600_000 });
    },
  });
}
