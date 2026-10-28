import { artifactsOfTools, KIND_LABEL, type Artifact, type ArtifactKind } from "../artifacts/artifacts";

export type LibraryConversation = { id: string; title: string; lastMessage?: string | null; createdAt: string; updatedAt: string };

type ToolLike = { toolCallId: string; toolName: string; state?: string; args?: unknown; result?: unknown };

export type ScannedMessage = { id?: string; role: string; content?: unknown; toolInvocations?: readonly ToolLike[]; createdAt?: string };

export type ScannedConversation = { id: string; title?: string; updatedAt: string; createdAt?: string; messages?: readonly ScannedMessage[] };

export type IndexedFile = { id: string; title: string; kind: ArtifactKind; detail: string; at: number };

export type IndexedChat = { id: string; updatedAt: string; text: string; urls: string[]; files: IndexedFile[] };

export const INDEX_TEXT_LIMIT = 8000;
export const INDEX_URL_LIMIT = 60;

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"'`)\]}|]+/gi;

export function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .flatMap((part) => {
      const p = part as { type?: unknown; text?: unknown; file?: { filename?: unknown } };
      if (p?.type === "text" && typeof p.text === "string") return [p.text];
      if (p?.type === "file" && typeof p.file?.filename === "string") return [p.file.filename];
      return [];
    })
    .join("\n");
}

const trimUrl = (url: string) => url.replace(/[.,;:!?]+$/, "");

export function urlsIn(text: string): string[] {
  return [...text.matchAll(URL_PATTERN)].map((m) => trimUrl(m[0]));
}

function stringsIn(value: unknown, out: string[], depth = 0) {
  if (depth > 6 || out.length > 400) return;
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const v of value) stringsIn(v, out, depth + 1);
  else if (value && typeof value === "object") for (const v of Object.values(value)) stringsIn(v, out, depth + 1);
}

export function toolUrls(tools: readonly ToolLike[]): string[] {
  const found: string[] = [];
  for (const tool of tools) {
    const strings: string[] = [];
    stringsIn(tool.result, strings);
    stringsIn(tool.args, strings);
    for (const s of strings) if (/^https?:\/\//i.test(s.trim())) found.push(trimUrl(s.trim()));
  }
  return found;
}

function detailOf(artifact: Artifact): string {
  const b = artifact.body;
  const n = (count: number, one: string) => `${count} ${one}${count === 1 ? "" : "s"}`;
  switch (b.kind) {
    case "report":
      return `${KIND_LABEL.report} · ${n(b.markdown.split(/\s+/).filter(Boolean).length, "word")}`;
    case "deck":
      return `${KIND_LABEL.deck} · ${n(b.slides.length, "slide")}`;
    case "dashboard":
      return `${KIND_LABEL.dashboard} · ${n(b.widgets.length, "widget")}`;
    case "table":
      return `${KIND_LABEL.table} · ${n(b.rows.length, "row")}`;
    case "code":
      return `${KIND_LABEL.code}${b.language ? ` · ${b.language}` : ""}`;
  }
}

function bodyText(artifact: Artifact): string {
  const b = artifact.body;
  switch (b.kind) {
    case "report":
      return b.markdown;
    case "deck":
      return b.slides.map((s) => [s.title, s.subtitle, s.body, ...(s.bullets ?? [])].filter(Boolean).join(" ")).join(" ");
    case "dashboard":
      return b.widgets.map((w) => ("title" in w && w.title) || ("label" in w && w.label) || "").join(" ");
    case "table":
      return b.headers.join(" ");
    case "code":
      return b.code.slice(0, 400);
  }
}

const timeOf = (iso: string | undefined, fallback: number) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : fallback;
};

export function indexConversation(conversation: ScannedConversation): IndexedChat {
  const updated = timeOf(conversation.updatedAt, 0);
  const parts: string[] = [];
  const urls: string[] = [];
  const latest = new Map<string, IndexedFile>();
  for (const message of conversation.messages ?? []) {
    if (message.role !== "user" && message.role !== "assistant") continue;
    const text = messageText(message.content);
    if (text) {
      parts.push(text);
      urls.push(...urlsIn(text));
    }
    const tools = message.toolInvocations ?? [];
    urls.push(...toolUrls(tools));
    if (message.role !== "assistant") continue;
    const at = timeOf(message.createdAt, updated);
    for (const artifact of artifactsOfTools(tools)) {
      parts.push(`${artifact.title} ${bodyText(artifact)}`);
      latest.set(`${artifact.body.kind}:${artifact.title.trim().toLowerCase()}`, { id: artifact.id, title: artifact.title, kind: artifact.body.kind, detail: detailOf(artifact), at });
    }
  }
  const joined = parts.join("\n").replace(/\s+/g, " ").trim();
  return {
    id: conversation.id,
    updatedAt: conversation.updatedAt,
    text: joined.length > INDEX_TEXT_LIMIT ? joined.slice(0, INDEX_TEXT_LIMIT) : joined,
    urls: [...new Set(urls)].slice(0, INDEX_URL_LIMIT),
    files: [...latest.values()].sort((a, b) => b.at - a.at),
  };
}

export const needsScan = (conversation: LibraryConversation, index: Record<string, IndexedChat>) => index[conversation.id]?.updatedAt !== conversation.updatedAt;

export type DateRange = "any" | "today" | "yesterday" | "week" | "month";

export const DATE_RANGES: { id: DateRange; title: string }[] = [
  { id: "any", title: "Any Time" },
  { id: "today", title: "Today" },
  { id: "yesterday", title: "Yesterday" },
  { id: "week", title: "Past 7 Days" },
  { id: "month", title: "Past 30 Days" },
];

export type Span = { from: number; to: number };

const DAY = 86_400_000;

export const startOfDay = (at: number) => {
  const d = new Date(at);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

const addDays = (at: number, days: number) => {
  const d = new Date(at);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).getTime();
};

export function rangeSpan(range: DateRange, now: number): Span | null {
  const today = startOfDay(now);
  switch (range) {
    case "any":
      return null;
    case "today":
      return { from: today, to: addDays(today, 1) };
    case "yesterday":
      return { from: addDays(today, -1), to: today };
    case "week":
      return { from: addDays(today, -6), to: addDays(today, 1) };
    case "month":
      return { from: addDays(today, -29), to: addDays(today, 1) };
  }
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const monthIndex = (word: string) => (word.length >= 3 ? MONTHS.findIndex((m) => m.startsWith(word)) : -1);

function monthSpan(month: number, now: number): Span {
  const d = new Date(now);
  const year = month > d.getMonth() ? d.getFullYear() - 1 : d.getFullYear();
  return { from: new Date(year, month, 1).getTime(), to: new Date(year, month + 1, 1).getTime() };
}

export function dateInQuery(query: string, now: number): { text: string; span: Span | null } {
  const words = query.trim().split(/\s+/).filter(Boolean);
  const lower = words.map((w) => w.toLowerCase().replace(/[,.]$/, ""));
  const today = startOfDay(now);
  const weekStart = addDays(today, -((new Date(today).getDay() + 6) % 7));
  const monthStart = new Date(new Date(today).getFullYear(), new Date(today).getMonth(), 1).getTime();
  const take = (start: number, count: number, span: Span) => ({ text: [...words.slice(0, start), ...words.slice(start + count)].join(" "), span });
  for (let i = 0; i < lower.length; i++) {
    const w = lower[i]!;
    const next = lower[i + 1];
    if (w === "today") return take(i, 1, { from: today, to: addDays(today, 1) });
    if (w === "yesterday") return take(i, 1, { from: addDays(today, -1), to: today });
    if ((w === "this" || w === "last" || w === "past") && (next === "week" || next === "month")) {
      if (w === "this") return take(i, 2, next === "week" ? { from: weekStart, to: addDays(today, 1) } : { from: monthStart, to: addDays(today, 1) });
      if (w === "past") return take(i, 2, { from: addDays(today, next === "week" ? -6 : -29), to: addDays(today, 1) });
      if (next === "week") return take(i, 2, { from: addDays(weekStart, -7), to: weekStart });
      const d = new Date(monthStart);
      return take(i, 2, { from: new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime(), to: monthStart });
    }
    const weekday = WEEKDAYS.indexOf(w);
    if (weekday >= 0) {
      const back = (new Date(today).getDay() - weekday + 7) % 7;
      const day = addDays(today, -back);
      return take(i, 1, { from: day, to: addDays(day, 1) });
    }
    const month = monthIndex(w);
    const dayOfMonth = next && /^\d{1,2}$/.test(next) ? Number(next) : 0;
    const ambiguous = w === "may" || w === "mar" || w === "march";
    if (month >= 0 && (!ambiguous || dayOfMonth > 0)) {
      const span = monthSpan(month, now);
      if (dayOfMonth >= 1 && dayOfMonth <= 31) {
        const from = new Date(new Date(span.from).getFullYear(), month, dayOfMonth).getTime();
        return take(i, 2, { from, to: addDays(from, 1) });
      }
      return take(i, 1, span);
    }
  }
  return { text: query.trim(), span: null };
}

export const inSpan = (at: number, span: Span | null) => !span || (at >= span.from && at < span.to);

export const intersect = (a: Span | null, b: Span | null): Span | null => (!a ? b : !b ? a : { from: Math.max(a.from, b.from), to: Math.min(a.to, b.to) });

export const searchWords = (text: string) => text.toLowerCase().split(/\s+/).filter(Boolean);

export type ChatMatch = "title" | "message" | "url" | "file";

export type ChatHit = { id: string; title: string; at: number; match: ChatMatch | null; snippet: string; url?: string };

const SNIPPET = 120;

function snippetAround(text: string, word: string): string {
  const at = text.toLowerCase().indexOf(word);
  if (at < 0) return "";
  const from = Math.max(0, at - 40);
  const cut = text.slice(from, from + SNIPPET).trim();
  return `${from > 0 ? "…" : ""}${cut}${from + SNIPPET < text.length ? "…" : ""}`;
}

export function searchChats(conversations: readonly LibraryConversation[], index: Record<string, IndexedChat>, query: string, span: Span | null): ChatHit[] {
  const words = searchWords(query);
  const hits: ChatHit[] = [];
  for (const c of conversations) {
    const at = timeOf(c.updatedAt, 0);
    if (!inSpan(at, span)) continue;
    const title = c.title || "New Chat";
    if (!words.length) {
      hits.push({ id: c.id, title, at, match: null, snippet: c.lastMessage ?? "" });
      continue;
    }
    const entry = index[c.id];
    const titleText = title.toLowerCase();
    const body = `${entry?.text ?? ""} ${c.lastMessage ?? ""}`.toLowerCase();
    const urls = entry?.urls ?? [];
    const urlText = urls.join(" ").toLowerCase();
    const files = (entry?.files ?? []).map((f) => f.title).join(" ").toLowerCase();
    if (!words.every((w) => titleText.includes(w) || body.includes(w) || urlText.includes(w) || files.includes(w))) continue;
    if (words.every((w) => titleText.includes(w))) {
      hits.push({ id: c.id, title, at, match: "title", snippet: c.lastMessage ?? "" });
      continue;
    }
    const url = urls.find((u) => words.some((w) => u.toLowerCase().includes(w)));
    const textWord = words.find((w) => !titleText.includes(w) && body.includes(w));
    if (textWord) {
      hits.push({ id: c.id, title, at, match: "message", snippet: snippetAround(entry?.text || c.lastMessage || "", textWord) || (c.lastMessage ?? "") });
      continue;
    }
    if (url) {
      hits.push({ id: c.id, title, at, match: "url", snippet: url, url });
      continue;
    }
    hits.push({ id: c.id, title, at, match: "file", snippet: c.lastMessage ?? "" });
  }
  return hits.sort((a, b) => b.at - a.at);
}

export type FileHit = IndexedFile & { conversationId: string; chatTitle: string };

export function searchFiles(conversations: readonly LibraryConversation[], index: Record<string, IndexedChat>, query: string, span: Span | null): FileHit[] {
  const words = searchWords(query);
  const hits: FileHit[] = [];
  for (const c of conversations) {
    const entry = index[c.id];
    if (!entry) continue;
    const chatTitle = c.title || "New Chat";
    for (const file of entry.files) {
      if (!inSpan(file.at, span)) continue;
      const text = `${file.title} ${file.detail} ${chatTitle}`.toLowerCase();
      if (words.length && !words.every((w) => text.includes(w))) continue;
      hits.push({ ...file, conversationId: c.id, chatTitle });
    }
  }
  return hits.sort((a, b) => b.at - a.at);
}

export function dayGroup(at: number, now: number): string {
  const days = Math.round((startOfDay(now) - startOfDay(at)) / DAY);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "Previous 7 Days";
  if (days < 30) return "Previous 30 Days";
  return new Date(at).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function groupByDay<T extends { at: number }>(items: readonly T[], now: number): { label: string; items: T[] }[] {
  const groups: { label: string; items: T[] }[] = [];
  for (const item of items) {
    const label = dayGroup(item.at, now);
    const last = groups.at(-1);
    if (last?.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

export function shortDate(at: number, now: number): string {
  const d = new Date(at);
  const days = Math.round((startOfDay(now) - startOfDay(at)) / DAY);
  if (days <= 0) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString("en-US", { weekday: "long" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(d.getFullYear() !== new Date(now).getFullYear() ? { year: "numeric" } : {}) });
}
