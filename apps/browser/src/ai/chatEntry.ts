import { create } from "zustand";

export type ChatEntrySource = "commandBar" | "promptAction" | "videoSummary";

export type ChatPageContext = {
  tabId: string;
  url: string;
  title: string;
  transcript?: string;
  summary?: string;
};

export type ChatEntry = {
  windowId: string;
  prompt: string;
  source: ChatEntrySource;
  page?: ChatPageContext;
};

export type ChatOpener = (entry: ChatEntry) => void;

type ChatEntryState = { opener: ChatOpener | null };

export const useChatEntry = create<ChatEntryState>()(() => ({ opener: null }));

export function registerChatOpener(opener: ChatOpener): () => void {
  useChatEntry.setState({ opener });
  return () => {
    if (useChatEntry.getState().opener === opener) useChatEntry.setState({ opener: null });
  };
}

export const chatAvailable = () => !!useChatEntry.getState().opener;
export const useChatAvailable = () => useChatEntry((s) => !!s.opener);

export function openChat(entry: ChatEntry): boolean {
  const opener = useChatEntry.getState().opener;
  if (!opener) return false;
  opener(entry);
  return true;
}
