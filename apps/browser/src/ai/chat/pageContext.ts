import { webviews } from "../../lib/webviews";
import { useBrowser } from "../../store/browser";
import { transcriptText, type TranscriptLine } from "../oneShotPrompts";
import { transcriptScript, type TranscriptResult } from "../youtubeTranscript";

export type PageMedia = { kind: "video" | "audio"; currentTime: number; duration: number; paused: boolean; title: string };

export type PageRead = {
  title: string;
  url: string;
  description: string;
  language: string;
  text: string;
  truncated: boolean;
  selection: string;
  media: PageMedia[];
  transcript?: string;
};

export const PAGE_TEXT_LIMIT = 48_000;
const READ_TIMEOUT_MS = 4000;
const TRANSCRIPT_TIMEOUT_MS = 6000;

const PAGE_READER = `
const limit = ${PAGE_TEXT_LIMIT};
const clean = (s) => String(s || '').replace(/[ \\t\\u00a0]+/g, ' ').replace(/\\n\\s*\\n\\s*\\n+/g, '\\n\\n').trim();
const textOf = (el) => (el && typeof el.innerText === 'string' ? el.innerText : (el && el.textContent) || '');
const shadowText = (root) => {
  const out = [];
  for (const el of root.querySelectorAll('*')) {
    if (!el.shadowRoot) continue;
    for (const child of el.shadowRoot.children) out.push(textOf(child));
    out.push(shadowText(el.shadowRoot));
  }
  return out.filter(Boolean).join('\\n');
};
const frameText = () => {
  const out = [];
  for (const frame of document.querySelectorAll('iframe')) {
    try {
      const doc = frame.contentDocument;
      if (doc && doc.body) out.push(textOf(doc.body));
    } catch (e) {}
  }
  return out.filter(Boolean).join('\\n');
};
const main = document.querySelector('article, main, [role=main]');
let text = clean(textOf(main));
if (text.length < 600) text = clean(textOf(document.body));
const extra = clean([shadowText(document), frameText()].filter(Boolean).join('\\n'));
if (extra && !text.includes(extra.slice(0, 200))) text = clean(text + '\\n\\n' + extra);
const meta = (q) => { const m = document.querySelector(q); return (m && m.getAttribute('content')) || ''; };
const media = Array.from(document.querySelectorAll('video, audio'))
  .filter((m) => m.duration > 0 && isFinite(m.duration))
  .slice(0, 4)
  .map((m) => ({ kind: m.tagName.toLowerCase(), currentTime: m.currentTime, duration: m.duration, paused: m.paused, title: m.getAttribute('title') || m.getAttribute('aria-label') || '' }));
post('result', JSON.stringify({
  title: document.title,
  url: location.href,
  description: meta('meta[name="description"]') || meta('meta[property="og:description"]'),
  language: document.documentElement.lang || '',
  text: text.slice(0, limit),
  truncated: text.length > limit,
  selection: clean(String(getSelection() || '')).slice(0, 8000),
  media,
}));
`;

const withTimeout = <T>(work: Promise<T>, ms: number, fallback: T) =>
  Promise.race([work, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);

export function youTubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www|m)\./, "");
    if (host === "youtube.com" && u.pathname === "/watch") return u.searchParams.get("v");
    if (host === "youtube.com" && u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2] || null;
    if (host === "youtu.be") return u.pathname.slice(1) || null;
  } catch {}
  return null;
}

async function readTranscript(tabId: string, videoId: string): Promise<string | undefined> {
  const web = webviews.get(tabId);
  if (!web) return undefined;
  const result = await withTimeout(
    web.evaluate<TranscriptResult>(transcriptScript(videoId)).catch(() => null),
    TRANSCRIPT_TIMEOUT_MS,
    null,
  );
  if (!result || "error" in result) return undefined;
  return transcriptText(result.lines as TranscriptLine[]);
}

export async function readPage(tabId: string, options: { transcript?: boolean } = {}): Promise<PageRead | null> {
  const tab = useBrowser.getState().tabs[tabId];
  const web = webviews.get(tabId);
  if (!tab) return null;
  const fallback: PageRead = {
    title: tab.customTitle || tab.title,
    url: tab.url,
    description: "",
    language: "",
    text: "",
    truncated: false,
    selection: "",
    media: [],
  };
  if (!web || !/^https?:|^file:/i.test(tab.url)) return fallback;
  const read = await withTimeout(
    web.evaluate<PageRead>(PAGE_READER).catch(() => null),
    READ_TIMEOUT_MS,
    null,
  );
  const page = read ?? fallback;
  const videoId = options.transcript === false ? null : youTubeVideoId(page.url || tab.url);
  if (videoId) {
    const transcript = await readTranscript(tabId, videoId);
    if (transcript) page.transcript = transcript;
  }
  return page;
}

export function clock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}
