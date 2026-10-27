import type { BrowserState } from "../../store/browser";
import { viewTabIds } from "../../store/model";

export type MentionCandidate =
  | { kind: "tab"; key: string; tabId: string; title: string; url: string; favicon: string | null }
  | { kind: "group"; key: string; groupId: string; title: string; count: number };

const MAX = 8;

const matches = (query: string, ...fields: string[]) => {
  const q = query.toLowerCase();
  return !q || fields.some((f) => f.toLowerCase().includes(q));
};

export function mentionCandidates(s: BrowserState, windowId: string, query: string): MentionCandidate[] {
  const tabIds = viewTabIds(s, windowId).filter((id) => !!s.tabs[id]?.url);
  const tabs: MentionCandidate[] = tabIds
    .map((id) => s.tabs[id]!)
    .filter((tab) => matches(query, tab.customTitle || tab.title, tab.url))
    .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
    .map((tab) => ({ kind: "tab", key: `tab:${tab.id}`, tabId: tab.id, title: tab.customTitle || tab.title || tab.url, url: tab.url, favicon: tab.favicon }));
  const groups: MentionCandidate[] = Object.values(s.groups)
    .filter((g) => g.windowId === windowId && g.tabIds.some((id) => tabIds.includes(id)) && matches(query, g.name))
    .map((g) => ({
      kind: "group",
      key: `group:${g.id}`,
      groupId: g.id,
      title: g.name || "Tab Group",
      count: g.tabIds.filter((id) => tabIds.includes(id)).length,
    }));
  return [...groups, ...tabs].slice(0, MAX);
}
