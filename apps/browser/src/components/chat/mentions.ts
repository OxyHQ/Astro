import type { BrowserState } from "../../store/browser";
import { activeTabId, viewTabIds } from "../../store/model";
import { live, profileFolders } from "../../live/store";

export type MentionCandidate =
  | { kind: "tab"; key: string; tabId: string; title: string; url: string; favicon: string | null }
  | { kind: "group"; key: string; groupId: string; title: string; count: number }
  | { kind: "liveFolder"; key: string; folderId: string; title: string; count: number; folderKind: "pullRequests" | "documents" };

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
  const active = activeTabId(s, windowId);
  const profileId = (active ? s.tabs[active]?.profileId : undefined) ?? s.windows[windowId]?.profileId ?? "";
  const store = live();
  const folders: MentionCandidate[] = profileFolders(store, profileId)
    .map((id) => store.folders[id]!)
    .filter((f) => matches(query, f.name))
    .map((f) => ({ kind: "liveFolder", key: `live:${f.id}`, folderId: f.id, title: f.name, count: store.items[f.id]?.length ?? 0, folderKind: f.kind }));
  return [...groups, ...folders, ...tabs].slice(0, MAX);
}
