import { webviews } from "../../lib/webviews";
import { useBrowser } from "../../store/browser";
import { activeTabId } from "../../store/model";
import { oxySignInAvailable, useOxySession, wantOxy } from "../../oxy/session";
import type { ChatEntry } from "../chatEntry";
import {
  addChatContext,
  chatItemId,
  setPersonalizationOff,
  updateWindowChat,
  windowChat,
  type ChatAsk,
  type ChatContextItem,
  type ChatPlacement,
} from "./state";

let nextAsk = 0;
let composerFocused: string | null = null;

export const setComposerFocused = (windowId: string | null) => {
  composerFocused = windowId;
};

export const chatSupported = oxySignInAvailable;
export const useChatSupported = () => useOxySession((s) => s.available);

export function openChatPanel(windowId: string, options: { focus?: boolean } = {}) {
  wantOxy();
  updateWindowChat(windowId, (chat) => ({
    open: true,
    placement: chat.open ? chat.placement : useBrowser.getState().settings.chatPlacement,
    focusRequest: options.focus === false ? chat.focusRequest : Date.now(),
  }));
}

export function closeChat(windowId: string) {
  updateWindowChat(windowId, { open: false, history: false });
  if (composerFocused === windowId) focusPage(windowId);
}

export function toggleChat(windowId: string) {
  if (chatTabActive(windowId)) return updateWindowChat(windowId, { focusRequest: Date.now() });
  if (windowChat(windowId).open) closeChat(windowId);
  else openChatPanel(windowId);
}

export function focusChat(windowId: string) {
  if (chatTabActive(windowId)) return composerFocused === windowId ? undefined : updateWindowChat(windowId, { focusRequest: Date.now() });
  if (windowChat(windowId).open && composerFocused === windowId) return focusPage(windowId);
  openChatPanel(windowId);
}

function focusPage(windowId: string) {
  const tabId = activeTabId(useBrowser.getState(), windowId);
  if (tabId) void webviews.get(tabId)?.focus();
}

export function setChatPlacement(windowId: string, placement: ChatPlacement) {
  useBrowser.getState().updateSettings({ chatPlacement: placement });
  updateWindowChat(windowId, { placement, open: true, focusRequest: Date.now() });
}

export function newChat(windowId: string) {
  updateWindowChat(windowId, {
    conversationId: null,
    context: [],
    draft: "",
    currentTab: true,
    personal: true,
    history: false,
    ask: null,
    focusRequest: Date.now(),
  });
}

export function showChatConversation(windowId: string, conversationId: string | null) {
  const chat = windowChat(windowId);
  if (conversationId && !chat.conversationId && !chat.personal) setPersonalizationOff(conversationId, true);
  updateWindowChat(windowId, { conversationId, personal: true, history: false, focusRequest: Date.now() });
}

export const toggleChatHistory = (windowId: string) => updateWindowChat(windowId, (chat) => ({ history: !chat.history }));

export function askInChat(windowId: string, text: string, options: Partial<Omit<ChatAsk, "id" | "text">> = {}) {
  wantOxy();
  const ask: ChatAsk = { id: ++nextAsk, text, send: options.send ?? true, fresh: options.fresh ?? false, context: options.context ?? [] };
  if (options.transcript) ask.transcript = options.transcript;
  if (options.summary) ask.summary = options.summary;
  updateWindowChat(windowId, (chat) => ({
    open: true,
    placement: chat.open ? chat.placement : useBrowser.getState().settings.chatPlacement,
    history: false,
    ask,
    focusRequest: Date.now(),
  }));
}

export function attachToChat(windowId: string, items: ChatContextItem[], options: { open?: boolean } = {}) {
  addChatContext(windowId, items);
  if (options.open !== false) openChatPanel(windowId);
}

export function askAboutSelection(tabId: string, text: string) {
  const tab = useBrowser.getState().tabs[tabId];
  if (!tab) return;
  attachToChat(tab.windowId, [{ id: chatItemId("selection"), kind: "selection", tabId, title: tab.customTitle || tab.title, url: tab.url, text }]);
}

export function openChatFromEntry(entry: ChatEntry) {
  const tab = entry.page ? useBrowser.getState().tabs[entry.page.tabId] : undefined;
  const context: ChatContextItem[] = entry.page
    ? [{ id: chatItemId("tab"), kind: "tab", tabId: entry.page.tabId, title: entry.page.title, url: entry.page.url, favicon: tab?.favicon ?? null }]
    : [];
  if (entry.skill) context.push({ id: chatItemId("skill"), kind: "skill", ...entry.skill });
  askInChat(entry.windowId, entry.prompt, {
    send: entry.prompt.trim().length > 0 || !!entry.skill,
    fresh: entry.source !== "promptAction" && entry.source !== "suggestion",
    context,
    ...(entry.page?.transcript ? { transcript: entry.page.transcript } : {}),
    ...(entry.page?.summary ? { summary: entry.page.summary } : {}),
  });
}

export const CHAT_TAB_URL = "astro://chat";

export const isChatTabUrl = (url: string | null | undefined) => !!url && url.toLowerCase().startsWith(CHAT_TAB_URL);

export function chatTabActive(windowId: string) {
  const s = useBrowser.getState();
  const id = activeTabId(s, windowId);
  return !!id && isChatTabUrl(s.tabs[id]?.url);
}

export function openChatTab(windowId: string) {
  const s = useBrowser.getState();
  const existing = s.windows[windowId]?.tabIds.find((id) => isChatTabUrl(s.tabs[id]?.url));
  closeChat(windowId);
  if (existing) return s.activate(existing);
  s.newTab(windowId, { url: CHAT_TAB_URL });
}
