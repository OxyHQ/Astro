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
  contentType?: string;
  document?: string;
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
  contentType: document.contentType || '',
}));
`;

export type GoogleDocument = { kind: "Google Sheets" | "Google Docs" | "Google Slides"; exportPath: string };

export function googleDocument(url: string): GoogleDocument | null {
  try {
    const u = new URL(url);
    if (u.hostname !== "docs.google.com") return null;
    const match = /^\/(spreadsheets|document|presentation)\/d\/([\w-]{10,})/.exec(u.pathname);
    if (!match) return null;
    const [, kind, id] = match;
    if (kind === "spreadsheets") {
      const gid = /(?:^|[#&?])gid=(\d+)/.exec(`${u.hash}&${u.search}`)?.[1];
      return { kind: "Google Sheets", exportPath: `/spreadsheets/d/${id}/export?format=csv${gid ? `&gid=${gid}` : ""}` };
    }
    if (kind === "document") return { kind: "Google Docs", exportPath: `/document/d/${id}/export?format=txt` };
    return { kind: "Google Slides", exportPath: `/presentation/d/${id}/export?format=txt` };
  } catch {
    return null;
  }
}

const exportReader = (path: string) => `
fetch(${JSON.stringify(path)}, { credentials: 'include' })
  .then((r) => (r.ok ? r.text() : Promise.reject(r.status)))
  .then((text) => post('result', JSON.stringify({ text: text.slice(0, ${PAGE_TEXT_LIMIT}), truncated: text.length > ${PAGE_TEXT_LIMIT} })))
  .catch(() => post('result', 'null'));
`;

export const PDF_LIMIT_BYTES = 15 * 1024 * 1024;

const PDF_READER = `
fetch(location.href, { credentials: 'include' })
  .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
  .then((buffer) => {
    if (buffer.byteLength > ${PDF_LIMIT_BYTES}) return post('result', JSON.stringify({ error: 'too large', size: buffer.byteLength }));
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    const name = decodeURIComponent(location.pathname.split('/').pop() || '') || 'document.pdf';
    post('result', JSON.stringify({ data: btoa(binary), size: bytes.length, name: /\\.pdf$/i.test(name) ? name : name + '.pdf' }));
  })
  .catch(() => post('result', 'null'));
`;

export type PdfBytes = { data: string; size: number; name: string };

export const isPdf = (page: Pick<PageRead, "contentType" | "url">) =>
  page.contentType === "application/pdf" || (!page.contentType && /\.pdf($|[?#])/i.test(page.url));

export async function readPdf(tabId: string): Promise<PdfBytes | null> {
  const web = webviews.get(tabId);
  if (!web) return null;
  const read = await withTimeout(web.evaluate<PdfBytes | { error: string }>(PDF_READER).catch(() => null), 19_000, null);
  return read && "data" in read ? read : null;
}

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
  const google = googleDocument(page.url || tab.url);
  if (google) {
    const exported = await withTimeout(web.evaluate<{ text: string; truncated: boolean }>(exportReader(google.exportPath)).catch(() => null), 8000, null);
    if (exported?.text) {
      page.text = exported.text;
      page.truncated = exported.truncated;
      page.document = google.kind === "Google Sheets" ? `${google.kind}, the sheet as CSV` : google.kind;
    }
  }
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
