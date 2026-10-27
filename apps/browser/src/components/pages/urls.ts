import { focus } from "../../lib/actions";
import { useBrowser } from "../../store/browser";
import { activeTabId, resolveWindowId, viewTabIds } from "../../store/model";
import type { Tab } from "../../store/types";

type InternalPageId = "history" | "bookmarks" | "downloads" | "chat" | "skills" | "artifact";

export const INTERNAL_PAGES: Record<InternalPageId, { title: string }> = {
  history: { title: "History" },
  bookmarks: { title: "Bookmarks" },
  downloads: { title: "Downloads" },
  chat: { title: "Chat" },
  skills: { title: "Skills" },
  artifact: { title: "Artifact" },
};

const SCHEME = "astro://";

const internalUrl = (page: InternalPageId, query?: string) => `${SCHEME}${page}${query ? `?q=${encodeURIComponent(query)}` : ""}`;

export function internalPageOf(url: string | null | undefined): InternalPageId | null {
  if (!url?.toLowerCase().startsWith(SCHEME)) return null;
  const page = url.slice(SCHEME.length).split(/[/?#]/)[0]!.toLowerCase();
  return page in INTERNAL_PAGES ? (page as InternalPageId) : null;
}

export function internalQuery(url: string): string {
  const q = /[?&]q=([^&#]*)/.exec(url)?.[1];
  try {
    return q ? decodeURIComponent(q) : "";
  } catch {
    return q ?? "";
  }
}

export const tabDestination = (t: Pick<Tab, "url" | "navigation">) => t.navigation?.url ?? t.url;

export const isInternalTab = (t: Pick<Tab, "url" | "navigation">) => internalPageOf(tabDestination(t)) !== null;

export function openInternalPage(page: InternalPageId, windowId?: string | null, options: { query?: string; background?: boolean } = {}) {
  const s = useBrowser.getState();
  const id = resolveWindowId(s, windowId);
  if (!id) return;
  if (!options.background && (!windowId || windowId !== id)) focus(id);
  const url = internalUrl(page, options.query);
  const existing = viewTabIds(s, id).find((t) => internalPageOf(tabDestination(s.tabs[t]!)) === page);
  if (existing) {
    if (options.query) s.navigate(existing, url);
    if (!options.background) s.activate(existing);
    return;
  }
  const active = activeTabId(s, id);
  if (active && !s.tabs[active]!.url && !options.background) return s.navigate(active, url);
  s.newTab(id, { url, background: options.background });
}

export function openSkillsPage(windowId: string | null, route: "yours" | "gallery" | "new" = "yours", prompt = "") {
  const s = useBrowser.getState();
  const id = resolveWindowId(s, windowId);
  if (!id) return;
  const url = `${SCHEME}skills${route === "yours" ? "" : `/${route}`}${prompt ? `?q=${encodeURIComponent(prompt)}` : ""}`;
  const existing = viewTabIds(s, id).find((t) => internalPageOf(tabDestination(s.tabs[t]!)) === "skills");
  if (existing) {
    s.navigate(existing, url);
    return s.activate(existing);
  }
  s.newTab(id, { url });
}
