import { useBrowser, type BrowserState } from "../store/browser";
import { changedIds } from "../store/changes";
import { isIncognitoProfile } from "../store/model";
import type { Tab } from "../store/types";
import { oneShot, oneShotReady } from "./inference";
import { parsePinnedTitle, PINNED_TITLE_INSTRUCTIONS, pinnedTitleInput } from "./oneShotPrompts";

const WAIT_FOR_TITLE_MS = 30_000;
const MAX_OUTPUT_TOKENS = 24;

const hasTitle = (t: Tab) => !!t.title && t.title !== t.url && !/^https?:\/\//.test(t.title);
const eligible = (s: BrowserState, t: Tab | undefined): t is Tab =>
  !!t && t.pinned && !t.customTitle && /^https?:/i.test(t.url) && !isIncognitoProfile(t.profileId) && s.settings.aiPinnedTitles !== false;

export function restoreOriginalTitle(tabId: string) {
  const t = useBrowser.getState().tabs[tabId];
  if (t?.aiTitle && t.customTitle === t.aiTitle) useBrowser.getState().updateTab(tabId, { customTitle: null, aiTitle: undefined });
}

export const hasAiTitle = (t: Pick<Tab, "aiTitle" | "customTitle"> | undefined) => !!t?.aiTitle && t.customTitle === t.aiTitle;

export function startPinnedTitles(): () => void {
  const waiting = new Map<string, number>();
  const asking = new Set<string>();

  const ask = async (id: string) => {
    const s = useBrowser.getState();
    const t = s.tabs[id];
    if (!eligible(s, t) || !hasTitle(t) || asking.has(id)) return;
    asking.add(id);
    const original = t.title;
    const title = parsePinnedTitle(
      await oneShot("pinnedTitle", { instructions: PINNED_TITLE_INSTRUCTIONS, input: pinnedTitleInput({ title: original, url: t.url }), maxOutputTokens: MAX_OUTPUT_TOKENS }),
      original,
    );
    asking.delete(id);
    const now = useBrowser.getState();
    if (!title || !eligible(now, now.tabs[id])) return;
    now.updateTab(id, { customTitle: title, aiTitle: title });
  };

  const stop = useBrowser.subscribe((s, prev) => {
    if (s.tabs === prev.tabs) return;
    const now = Date.now();
    for (const [id, since] of waiting) {
      const t = s.tabs[id];
      if (!eligible(s, t) || now - since > WAIT_FOR_TITLE_MS) waiting.delete(id);
      else if (hasTitle(t)) {
        waiting.delete(id);
        void ask(id);
      }
    }
    if (!oneShotReady()) return;
    for (const id of changedIds(s.tabs, prev.tabs)) {
      const t = s.tabs[id];
      const before = prev.tabs[id];
      if (!t || !t.pinned || !before || before.pinned || !eligible(s, t)) continue;
      if (hasTitle(t)) void ask(t.id);
      else waiting.set(t.id, now);
    }
  });
  return () => {
    stop();
    waiting.clear();
  };
}
