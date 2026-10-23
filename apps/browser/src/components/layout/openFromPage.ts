import type { OpenWindowRequest } from "@astro-browser/astrocore";
import { openWindow } from "../../lib/actions";
import { useBrowser } from "../../store/browser";
import { engineProfile } from "../../store/model";
import { isSmall, originalProfile, privateWindowProfile } from "../../store/small";
import { openLinkInSplit, openSplitPane } from "./splitActions";

export function openFromPage({ url, adoptId, disposition, profile }: OpenWindowRequest, from: { windowId: string; profileId: string; tabId?: string }) {
  const s = useBrowser.getState();
  const w = s.windows[from.windowId];
  if (!w) return;
  if (disposition === "current") {
    if (from.tabId) s.navigate(from.tabId, url, { userInitiated: false });
    return;
  }
  if (isSmall(s, w.id) && disposition !== "window" && disposition !== "incognito") {
    return void s.newTab(w.id, { url, adoptId, openerId: from.tabId, profileId: from.profileId, background: true });
  }
  if (disposition === "split") {
    if (from.tabId) return openLinkInSplit(from.tabId, url, adoptId);
    openSplitPane(w.id, { url, adoptId });
    return;
  }
  if (disposition === "incognito") {
    const profileId = privateWindowProfile(s, w, profile);
    if (adoptId?.startsWith("tab:")) return void openWindow({ incognito: true, url, adoptId, profileId });
    return void openWindow({ incognito: true, url, profileId });
  }
  if (disposition === "window") {
    return void openWindow(w.incognito ? { incognito: true, url, profileId: originalProfile(s, w) } : { profileId: from.profileId, url, adoptId });
  }
  const background = disposition === "background" || from.profileId !== w.profileId;
  s.newTab(w.id, { url, adoptId, openerId: from.tabId, profileId: from.profileId, background });
}

export function pageProfileId(windowId: string, pageProfile: string): string {
  const s = useBrowser.getState();
  const w = s.windows[windowId];
  if (w && engineProfile(w.profileId) === pageProfile) return w.profileId;
  return s.profileOrder.find((p) => engineProfile(p) === pageProfile) ?? w?.profileId ?? s.settings.defaultProfileId;
}
