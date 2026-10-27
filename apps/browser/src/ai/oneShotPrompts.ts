export type NamedTab = { title: string; url: string };

const MAX_GROUP_TABS = 12;
const MAX_TITLE = 120;
const EMOJI = /\p{Extended_Pictographic}/u;
const EMOJI_ANYWHERE = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}]/gu;
const FORBIDDEN_IN_FILE = /[\\/:*?"<>|\u0000-\u001f]/g;

const clip = (text: string, n: number) => (text.length > n ? `${text.slice(0, n - 1)}…` : text);

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function pathOf(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname}`;
  } catch {
    return url;
  }
}

function firstJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const value = JSON.parse(text.slice(start, end + 1)) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const unquote = (text: string) => text.trim().replace(/^["'“”‘’`*_]+|["'“”‘’`*_]+$/g, "").trim();

export const GROUP_NAME_INSTRUCTIONS = [
  "You name a group of browser tabs.",
  'Reply with JSON only: {"name": "…", "emoji": "…"}.',
  "name: 1 to 3 words, at most 24 characters, Title Case, no emoji, saying what the tabs have in common (their topic or the task they serve), in the language of the tab titles. Prefer the site's name when every tab is on one site and has no clearer common topic.",
  "emoji: exactly one emoji that fits the name.",
].join("\n");

export function groupNameInput(tabs: readonly NamedTab[]): string {
  return tabs
    .slice(0, MAX_GROUP_TABS)
    .map((t) => `- ${clip(t.title.trim() || hostOf(t.url), MAX_TITLE)} (${hostOf(t.url)})`)
    .join("\n");
}

export type GroupNameAnswer = { name: string; emoji: string | null };

export function parseGroupName(text: string | null): GroupNameAnswer | null {
  if (!text) return null;
  const json = firstJsonObject(text);
  const rawName = typeof json?.name === "string" ? json.name : null;
  if (!rawName) return null;
  const name = unquote(rawName.replace(EMOJI_ANYWHERE, "")).replace(/\s+/g, " ");
  if (!name || name.length > 32 || name.split(" ").length > 4) return null;
  const rawEmoji = typeof json?.emoji === "string" ? json.emoji.trim() : "";
  const graphemes = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(rawEmoji)].map((g) => g.segment);
  const emoji = graphemes.length === 1 && EMOJI.test(graphemes[0]!) ? graphemes[0]! : null;
  return { name, emoji };
}

export const PINNED_TITLE_INSTRUCTIONS = [
  "You shorten the title of a pinned browser tab to what a person would call it.",
  "Reply with the short title only: 1 to 3 words, at most 20 characters, no quotes, no emoji, no unread counts, no email addresses.",
  "Leave out the site's name unless the site itself is what the tab is for. Keep the language of the title.",
  'Examples: "(3) Inbox - ana@example.com - Gmail" → Inbox; "Pull requests · oxy/astro · GitHub" → Astro PRs; "Home / X" → X; "Google Calendar - Week of October 26, 2026" → Calendar.',
].join("\n");

export const pinnedTitleInput = (tab: NamedTab) => `Title: ${clip(tab.title.trim(), 200)}\nURL: ${clip(pathOf(tab.url), 200)}`;

export function parsePinnedTitle(text: string | null, original: string): string | null {
  if (!text) return null;
  const line = text.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  const title = unquote(line.replace(/^(title|short title)\s*:\s*/i, "").replace(EMOJI_ANYWHERE, "")).replace(/[.。]+$/, "").replace(/\s+/g, " ");
  if (!title || title.length > 32 || title.split(" ").length > 5) return null;
  return title.toLowerCase() === original.trim().toLowerCase() ? null : title;
}

const COMPOUND_EXTENSIONS = /\.(tar\.(gz|bz2|xz|zst)|user\.js)$/i;

export function splitExtension(filename: string): { base: string; extension: string } {
  const compound = COMPOUND_EXTENSIONS.exec(filename);
  if (compound) return { base: filename.slice(0, compound.index), extension: compound[0] };
  const dot = filename.lastIndexOf(".");
  if (dot <= 0 || dot === filename.length - 1 || filename.length - dot > 12 || /\s/.test(filename.slice(dot))) return { base: filename, extension: "" };
  return { base: filename.slice(0, dot), extension: filename.slice(dot) };
}

export const DOWNLOAD_NAME_INSTRUCTIONS = [
  "You give a downloaded file a clear, human name.",
  "Reply with the new file name only, WITHOUT the extension: 2 to 6 words separated by spaces, at most 60 characters, in the language the file's name or source uses.",
  "Say what the file is (an invoice, a paper, an installer, a photo of…) using its name and where it came from. Keep version numbers, dates and identifiers that matter. Never use / \\ : * ? \" < > |.",
  "If the current name is already clear, reply with it unchanged.",
].join("\n");

export type DownloadFacts = { filename: string; url: string; mimeType: string };

export const downloadNameInput = (d: DownloadFacts) =>
  [`File: ${clip(d.filename, 200)}`, `Type: ${d.mimeType || "unknown"}`, `Downloaded from: ${clip(pathOf(d.url), 300)}`].join("\n");

const comparable = (name: string) => name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

export function parseDownloadName(text: string | null, original: string): string | null {
  if (!text) return null;
  const { base: originalBase, extension } = splitExtension(original);
  const line = text.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  let base = unquote(line.replace(/^(file ?name|name)\s*:\s*/i, ""));
  if (extension && base.toLowerCase().endsWith(extension.toLowerCase())) base = base.slice(0, -extension.length);
  base = base
    .replace(EMOJI_ANYWHERE, "")
    .replace(FORBIDDEN_IN_FILE, " ")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .slice(0, 80)
    .trim();
  if (!base || comparable(base) === comparable(originalBase)) return null;
  return `${base}${extension}`;
}

export const VIDEO_SUMMARY_INSTRUCTIONS = [
  "Summarize a YouTube video from its transcript for someone deciding whether to watch it.",
  "Reply in the transcript's language, in Markdown: one sentence saying what the video is, then 3 to 6 bullet points with its key points, each starting with the timestamp where it is made, as [m:ss].",
  "No preamble, no closing remarks.",
].join("\n");

export const MAX_TRANSCRIPT_CHARS = 24_000;

export type TranscriptLine = { startMs: number; text: string };

export function timestamp(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export function transcriptText(lines: readonly TranscriptLine[], maxChars = MAX_TRANSCRIPT_CHARS): string {
  const out: string[] = [];
  let used = 0;
  let lastMark = -Infinity;
  for (const line of lines) {
    const text = line.text.replace(/\s+/g, " ").trim();
    if (!text) continue;
    const mark = line.startMs - lastMark >= 30_000 ? `[${timestamp(line.startMs)}] ` : "";
    if (mark) lastMark = line.startMs;
    const piece = `${mark}${text}`;
    if (used + piece.length + 1 > maxChars) break;
    out.push(piece);
    used += piece.length + 1;
  }
  return out.join(" ");
}

export const videoSummaryInput = (title: string, transcript: string) => `Title: ${clip(title, 200)}\nTranscript:\n${transcript}`;

export type PromptAction = { id: string; title: string; prompt: string; icon: string; keywords: string[]; when: "page" | "code" | "video" | "text" };

export const PROMPT_ACTIONS: PromptAction[] = [
  { id: "summarize", title: "Summarize This Page", prompt: "Summarize this page.", icon: "text.alignleft", keywords: ["summary", "tldr", "tl;dr", "resume", "resumen"], when: "page" },
  { id: "summarizeVideo", title: "Summarize This Video", prompt: "Summarize this video.", icon: "play.circle.fill", keywords: ["summary", "youtube", "transcript", "video"], when: "video" },
  { id: "eli5", title: "Explain Like I'm 5", prompt: "Explain this page like I'm 5.", icon: "lightbulb", keywords: ["eli5", "explain", "simple", "simplify"], when: "page" },
  { id: "quiz", title: "Quiz Me", prompt: "Quiz me on this page: ask me one question at a time.", icon: "questionmark.circle", keywords: ["quiz", "test me", "study", "flashcards"], when: "page" },
  { id: "proofread", title: "Proofread", prompt: "Proofread the text on this page and list the corrections.", icon: "text.badge.checkmark", keywords: ["proofread", "grammar", "spelling", "typos"], when: "text" },
  { id: "reviewCode", title: "Review Code", prompt: "Review the code on this page: bugs first, then improvements.", icon: "chevron.left.forwardslash.chevron.right", keywords: ["code review", "review code", "bugs"], when: "code" },
  { id: "citations", title: "Find Citations", prompt: "Find citations for the main claims on this page, with links.", icon: "book", keywords: ["citations", "sources", "references", "cite"], when: "page" },
];

const CODE_HOSTS = /(^|\.)(github\.com|gitlab\.com|bitbucket\.org|codeberg\.org|sourcegraph\.com|gist\.github\.com|stackoverflow\.com|codepen\.io|jsfiddle\.net|replit\.com)$/;
const TEXT_HOSTS = /(^|\.)(docs\.google\.com|notion\.so|notion\.site|medium\.com|substack\.com|dropbox\.com|quip\.com|coda\.io|overleaf\.com|office\.com|live\.com)$/;

export function youtubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www|m|music)\./, "");
    if (host === "youtu.be") return /^[\w-]{11}$/.test(u.pathname.slice(1)) ? u.pathname.slice(1) : null;
    if (host !== "youtube.com") return null;
    if (u.pathname === "/watch") return /^[\w-]{11}$/.test(u.searchParams.get("v") ?? "") ? u.searchParams.get("v") : null;
    const short = /^\/(shorts|live|embed)\/([\w-]{11})/.exec(u.pathname);
    return short ? short[2]! : null;
  } catch {
    return null;
  }
}

export function promptActionsFor(url: string): PromptAction[] {
  if (!/^https?:/i.test(url)) return [];
  const host = hostOf(url);
  const video = !!youtubeVideoId(url);
  return PROMPT_ACTIONS.filter((a) => {
    if (a.when === "video") return video;
    if (a.when === "code") return CODE_HOSTS.test(host);
    if (a.when === "text") return TEXT_HOSTS.test(host) || !CODE_HOSTS.test(host);
    return true;
  });
}
