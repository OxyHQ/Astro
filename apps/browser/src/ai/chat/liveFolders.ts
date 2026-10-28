import { live } from "../../live/store";
import { SOURCES } from "../../live/sources";
import type { LiveFolder, LiveItem } from "../../live/types";
import { attachToChat } from "./actions";
import { chatItemId, type ChatContextItem } from "./state";

const MAX_ITEMS = 60;
const SECTION: Record<string, string> = { authored: "yours", review: "review requested from you", team: "review requested from your team" };

const day = (ms: number) => (ms ? new Date(ms).toISOString().slice(0, 10) : "");

function pullRequestLine(item: LiveItem): string {
  const pr = item.pr!;
  const facts = [
    `${pr.repo}#${pr.number}`,
    `by ${pr.author}`,
    pr.draft ? "draft" : "",
    pr.review === "approved" ? "approved" : pr.review === "changesRequested" ? "changes requested" : pr.review === "required" ? "review required" : "",
    pr.mergeable === "conflicting" ? "has conflicts" : "",
    pr.checks.length ? `checks: ${pr.checks.some((c) => c.state === "failure") ? "failing" : pr.checks.every((c) => c.state === "success" || c.state === "neutral") ? "passing" : "running"}` : "",
    pr.unresolvedThreads ? `${pr.unresolvedThreads} unresolved threads` : "",
    `+${pr.additions} −${pr.deletions} in ${pr.changedFiles} files`,
    item.section ? SECTION[item.section] ?? "" : "",
    item.updatedAt ? `updated ${day(item.updatedAt)}` : "",
  ].filter(Boolean);
  return `- ${item.title} — ${item.url} (${facts.join(", ")})`;
}

function documentLine(item: LiveItem): string {
  const facts = [
    SOURCES[item.source]?.name ?? item.source,
    item.doc?.kind ?? "",
    item.doc?.place ? `in ${item.doc.place}` : "",
    item.doc?.editedBy ? `last edited by ${item.doc.editedBy}` : "",
    item.updatedAt ? `updated ${day(item.updatedAt)}` : "",
  ].filter(Boolean);
  return `- ${item.title} — ${item.url} (${facts.join(", ")})`;
}

export function liveFolderSection(folder: Pick<LiveFolder, "name" | "kind">, items: LiveItem[]): string[] {
  const kind = folder.kind === "pullRequests" ? "pull requests" : "documents";
  const shown = items.slice(0, MAX_ITEMS);
  const lines = shown.map((item) => (item.pr ? pullRequestLine(item) : documentLine(item)));
  return [
    `## The person's live folder “${folder.name}” (${items.length} ${kind})`,
    "A folder in the browser's sidebar that keeps itself up to date. Each line is one item: its title, its URL and what the folder knows about it.",
    lines.length ? lines.join("\n") + (items.length > shown.length ? `\n… and ${items.length - shown.length} more` : "") : "It is empty right now.",
  ];
}

export function liveFolderContext(folderId: string): string[] {
  const s = live();
  const folder = s.folders[folderId];
  return folder ? liveFolderSection(folder, s.items[folderId] ?? []) : [];
}

export function liveFolderItem(folderId: string): ChatContextItem | null {
  const folder = live().folders[folderId];
  return folder ? { id: chatItemId("live"), kind: "liveFolder", folderId, title: folder.name, folderKind: folder.kind } : null;
}

export function chatAboutLiveFolder(windowId: string, folderId: string): boolean {
  const item = liveFolderItem(folderId);
  if (!item) return false;
  attachToChat(windowId, [item]);
  return true;
}
