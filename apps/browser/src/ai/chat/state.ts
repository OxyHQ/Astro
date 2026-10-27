import { create } from "zustand";
import type { AstroCommand } from "../skills/skills";

export type ChatPlacement = "sidebar" | "floating";

export type ChatTabRef = { tabId: string; title: string; url: string; favicon: string | null };

export type ChatContextItem =
  | ({ id: string; kind: "tab" } & ChatTabRef)
  | { id: string; kind: "group"; groupId: string; title: string; tabs: ChatTabRef[] }
  | { id: string; kind: "selection"; tabId: string; title: string; url: string; text: string }
  | { id: string; kind: "file"; name: string; mime: string; uri: string; size: number }
  | { id: string; kind: "screenshot"; tabId: string; title: string; url: string; uri: string }
  | { id: string; kind: "link"; url: string }
  | { id: string; kind: "skill"; name: string; title: string; command?: AstroCommand };

export type ChatAsk = {
  id: number;
  text: string;
  send: boolean;
  fresh: boolean;
  context: ChatContextItem[];
  transcript?: string;
  summary?: string;
  conversationId?: string;
  extra?: string[];
};

export type ChatFrame = { x: number; y: number; width: number; height: number };

export type WindowChat = {
  open: boolean;
  placement: ChatPlacement;
  conversationId: string | null;
  draft: string;
  context: ChatContextItem[];
  currentTab: boolean;
  personal: boolean;
  history: boolean;
  focusRequest: number;
  ask: ChatAsk | null;
};

type ChatState = {
  windows: Record<string, WindowChat>;
  personalizationOff: Record<string, true>;
};

const EMPTY: WindowChat = {
  open: false,
  placement: "sidebar",
  conversationId: null,
  draft: "",
  context: [],
  currentTab: true,
  personal: true,
  history: false,
  focusRequest: 0,
  ask: null,
};

export const useChat = create<ChatState>()(() => ({ windows: {}, personalizationOff: {} }));

export const windowChat = (windowId: string): WindowChat => useChat.getState().windows[windowId] ?? EMPTY;

export const useWindowChat = <T>(windowId: string, pick: (chat: WindowChat) => T): T => useChat((s) => pick(s.windows[windowId] ?? EMPTY));

export function updateWindowChat(windowId: string, change: Partial<WindowChat> | ((chat: WindowChat) => Partial<WindowChat>)) {
  useChat.setState((s) => {
    const current = s.windows[windowId] ?? EMPTY;
    const next = typeof change === "function" ? change(current) : change;
    return { windows: { ...s.windows, [windowId]: { ...current, ...next } } };
  });
}

export function forgetWindowChat(windowId: string) {
  useChat.setState((s) => {
    if (!s.windows[windowId]) return s;
    const { [windowId]: _gone, ...rest } = s.windows;
    return { windows: rest };
  });
}

let nextId = 0;
export const chatItemId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(++nextId).toString(36)}`;

export function addChatContext(windowId: string, items: ChatContextItem[]) {
  updateWindowChat(windowId, (chat) => {
    const keyOf = (item: ChatContextItem) =>
      item.kind === "tab" ? `tab:${item.tabId}` : item.kind === "group" ? `group:${item.groupId}` : item.kind === "link" ? `link:${item.url}` : item.kind === "skill" ? `skill:${item.name}` : item.id;
    const seen = new Set(chat.context.map(keyOf));
    return { context: [...chat.context, ...items.filter((item) => !seen.has(keyOf(item)) && seen.add(keyOf(item)))] };
  });
}

export const removeChatContext = (windowId: string, id: string) =>
  updateWindowChat(windowId, (chat) => ({ context: chat.context.filter((item) => item.id !== id) }));

export const personalizationOff = (conversationId: string | null) => !!conversationId && !!useChat.getState().personalizationOff[conversationId];

export function setPersonalizationOff(conversationId: string, off: boolean) {
  useChat.setState((s) => {
    const { [conversationId]: _was, ...rest } = s.personalizationOff;
    return { personalizationOff: off ? { ...rest, [conversationId]: true } : rest };
  });
}
