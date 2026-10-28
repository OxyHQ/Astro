import { create } from "zustand";
import type { ChatContextItem } from "./chat/state";
import type { AstroCommand } from "./skills/skills";

export type ChatEntrySource = "commandBar" | "promptAction" | "videoSummary" | "skill" | "calendar" | "suggestion" | "artifact";

export type ChatEntrySkill = { name: string; title: string; command?: AstroCommand; occurrence?: string };

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
  skill?: ChatEntrySkill;
  conversationId?: string;
  context?: string[];
  items?: ChatContextItem[];
};

export type ChatOpener = (entry: ChatEntry) => void;

type ChatEntryState = { opener: ChatOpener | null };

export const useChatEntry = create<ChatEntryState>()(() => ({ opener: null }));

const openers: { opener: ChatOpener }[] = [];

export function registerChatOpener(opener: ChatOpener): () => void {
  const entry = { opener };
  openers.push(entry);
  useChatEntry.setState({ opener });
  return () => {
    const index = openers.indexOf(entry);
    if (index < 0) return;
    openers.splice(index, 1);
    useChatEntry.setState({ opener: openers.at(-1)?.opener ?? null });
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
