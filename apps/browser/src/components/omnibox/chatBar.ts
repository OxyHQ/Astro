import type { Suggestion } from "@astro-browser/core";
import type { ChatContextItem, ChatTabRef } from "../../ai/chat/state";
import type { BrowserState } from "../../store/browser";
import type { MentionCandidate } from "../chat/mentions";

export type BarMention = { query: string; start: number };

export type BarDestination = "search" | "chat";

const MENTION_AT_END = /(^|\s)@([^\s@]{0,40})$/;

export function barMention(text: string): BarMention | null {
  const m = MENTION_AT_END.exec(text);
  if (!m) return null;
  return { query: m[2] ?? "", start: m.index + (m[1] ?? "").length };
}

export const withoutMention = (text: string, mention: BarMention) => text.slice(0, mention.start);

export function attachmentKey(item: ChatContextItem): string {
  if (item.kind === "tab") return `tab:${item.tabId}`;
  if (item.kind === "group") return `group:${item.groupId}`;
  return item.id;
}

export function addAttachment(list: ChatContextItem[], item: ChatContextItem): ChatContextItem[] {
  const key = attachmentKey(item);
  return list.some((i) => attachmentKey(i) === key) ? list : [...list, item];
}

export function toggleAttachment(list: ChatContextItem[], item: ChatContextItem): ChatContextItem[] {
  const key = attachmentKey(item);
  return list.some((i) => attachmentKey(i) === key) ? list.filter((i) => attachmentKey(i) !== key) : [...list, item];
}

export function groupTabRefs(s: Pick<BrowserState, "groups" | "tabs">, groupId: string): ChatTabRef[] {
  const group = s.groups[groupId];
  if (!group) return [];
  return group.tabIds.flatMap((id) => {
    const tab = s.tabs[id];
    return tab?.url ? [{ tabId: id, title: tab.customTitle || tab.title, url: tab.url, favicon: tab.favicon }] : [];
  });
}

export function mentionItem(candidate: MentionCandidate, groupTabs: (groupId: string) => ChatTabRef[], id: string): ChatContextItem {
  if (candidate.kind === "tab")
    return { id, kind: "tab", tabId: candidate.tabId, title: candidate.title, url: candidate.url, favicon: candidate.favicon };
  return { id, kind: "group", groupId: candidate.groupId, title: candidate.title, tabs: groupTabs(candidate.groupId) };
}

export const routedDestination = (first: Suggestion | undefined): BarDestination => (first?.kind === "chat" ? "chat" : "search");

export function barDestination({
  override,
  attached,
  first,
}: {
  override: BarDestination | null;
  attached: readonly ChatContextItem[];
  first: Suggestion | undefined;
}): BarDestination {
  if (attached.length) return "chat";
  return override ?? routedDestination(first);
}

export const destinationDecides = (override: BarDestination | null, attached: readonly ChatContextItem[]) => attached.length > 0 || override !== null;

export const canAskWith = (text: string, attached: readonly ChatContextItem[]) => !!text.trim() || attached.some((item) => item.kind === "file");

export function attachmentLabel(item: ChatContextItem): string {
  switch (item.kind) {
    case "tab":
      return item.title || item.url;
    case "group":
      return `${item.title} (${item.tabs.length})`;
    case "file":
      return item.name;
    default:
      return "";
  }
}
