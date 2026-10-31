import { useBrowser, type BrowserState } from "../../store/browser";
import { activeTabId } from "../../store/model";
import { openChatPanel, showChatConversation } from "./actions";
import { windowChat } from "./state";

export const WORKSPACE_ICON = "symbol:sparkles";
const UNTITLED = "Chat";

const titles = new Map<string, string>();

export function workspaceGroupId(s: Pick<BrowserState, "groups">, windowId: string, conversationId: string): string | null {
  return Object.values(s.groups).find((g) => g.windowId === windowId && g.chatId === conversationId)?.id ?? null;
}

export function chatOfTab(s: Pick<BrowserState, "groups">, tabId: string | null | undefined): string | null {
  if (!tabId) return null;
  return Object.values(s.groups).find((g) => g.chatId && g.tabIds.includes(tabId))?.chatId ?? null;
}

export function placeInWorkspace(windowId: string, conversationId: string | null, tabIds: string[]): string | null {
  const ids = tabIds.filter(Boolean);
  if (!conversationId || !ids.length) return null;
  const s = useBrowser.getState();
  const existing = workspaceGroupId(s, windowId, conversationId);
  if (existing) {
    s.addTabsToGroup(existing, ids);
    return existing;
  }
  const id = s.createGroup(ids, { name: titles.get(conversationId) ?? UNTITLED, icon: WORKSPACE_ICON });
  if (!id) return null;
  useBrowser.getState().updateGroup(id, { chatId: conversationId });
  return id;
}

export function noteChatTitle(conversationId: string, title: string) {
  const name = title.trim();
  if (!name || titles.get(conversationId) === name) return;
  titles.set(conversationId, name);
  const s = useBrowser.getState();
  for (const g of Object.values(s.groups)) if (g.chatId === conversationId && g.name !== name) s.updateGroup(g.id, { name });
}

export type WorkspaceMove = { show: string | null; open: boolean };

export function workspaceMove(previous: string | null, next: string | null, shown: string | null, panelOpen: boolean): WorkspaceMove {
  if (!next || next === previous) return { show: null, open: false };
  return { show: next === shown ? null : next, open: !panelOpen };
}

export function startWorkspaceFollow(windowId: string): () => void {
  let last = chatOfTab(useBrowser.getState(), activeTabId(useBrowser.getState(), windowId));
  return useBrowser.subscribe((s, prev) => {
    if (s.windows === prev.windows && s.groups === prev.groups) return;
    const chat = chatOfTab(s, activeTabId(s, windowId));
    const previous = last;
    last = chat;
    const current = windowChat(windowId);
    const move = workspaceMove(previous, chat, current.conversationId, current.open);
    if (move.show) showChatConversation(windowId, move.show);
    if (move.open) openChatPanel(windowId, { focus: false });
  });
}
