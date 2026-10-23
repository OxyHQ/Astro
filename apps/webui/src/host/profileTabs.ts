import { loadCr } from "./engine";
import type { EngineTab, TabState } from "./tabs";

declare const chrome: {
  send(method: string, args?: unknown[]): void;
  browser: { attachIframeGuest(guestId: unknown, contentWindow: Window): void };
};

type Wire = { url?: string; title?: string; loading?: boolean; canGoBack?: boolean; canGoForward?: boolean; favicon?: string; opener?: number };

export const PROFILE_TAB_PREFIX = "p:";

const toState = (wire: Wire): TabState => ({
  url: wire.url ?? "",
  title: wire.title ?? "",
  favicon: wire.favicon || null,
  isLoading: !!wire.loading,
  canGoBack: !!wire.canGoBack,
  canGoForward: !!wire.canGoForward,
});

const tabs = new Map<number, ProfileTab>();
let onOpened: ((tab: { id: string; url: string; opener: number }) => void) | null = null;

export function onProfileTabOpened(handler: (tab: { id: string; url: string; opener: number }) => void) {
  onOpened = handler;
}

let listening: Promise<void> | null = null;
const listen = () =>
  (listening ??= loadCr().then((cr) => {
    (cr.addWebUiListener as unknown as (event: string, listener: (kind: string, id: number, wire: Wire) => void) => void)(
      "astro-profile-tab",
      (kind, id, wire) => {
        if (kind === "opened") return onOpened?.({ id: `${PROFILE_TAB_PREFIX}${id}`, url: wire.url ?? "", opener: wire.opener ?? 0 });
        const tab = tabs.get(id);
        if (kind === "changed") tab?.update(toState(wire));
        if (kind === "closed") {
          tabs.delete(id);
          tab?.onClosed?.();
        }
      },
    );
  }));

class ProfileTab implements EngineTab {
  private listeners = new Set<(state: TabState) => void>();
  private frame: HTMLIFrameElement | null = null;
  private guestId: Promise<string | null>;
  onClosed: (() => void) | null = null;
  onActivatedByEngine: (() => void) | null = null;
  state: TabState = toState({});

  constructor(readonly tabId: number) {
    this.guestId = loadCr().then((cr) => cr.sendWithPromise<string | null>("astroProfileTabGuest", tabId));
    this.command("report");
  }

  private command(name: string, arg = "") {
    chrome.send("astroProfileTabCommand", [this.tabId, name, arg]);
  }

  update(state: TabState) {
    this.state = state;
    for (const listener of this.listeners) listener(state);
  }

  listen(listener: (state: TabState) => void) {
    this.listeners.add(listener);
    listener(this.state);
    return () => void this.listeners.delete(listener);
  }

  async attach(frame: HTMLIFrameElement) {
    this.frame = frame;
    const guestId = await this.guestId;
    if (!guestId || this.frame !== frame) return;
    while (!frame.contentWindow) await new Promise((resolve) => setTimeout(resolve, 16));
    chrome.browser.attachIframeGuest(guestId, frame.contentWindow);
  }

  detach(frame: HTMLIFrameElement) {
    if (this.frame === frame) this.frame = null;
  }

  navigate(url: string) {
    this.command("navigate", url);
  }
  back() {
    this.command("back");
  }
  forward() {
    this.command("forward");
  }
  reload() {
    this.command("reload");
  }
  stop() {
    this.command("stop");
  }
  activate() {
    this.command("activate");
  }
  close() {
    this.listeners.clear();
    tabs.delete(this.tabId);
    this.command("close");
  }
}

export async function openProfileTab(profile: string, adoptId: string | undefined, url: string | undefined): Promise<EngineTab | null> {
  await listen();
  let tabId = adoptId?.startsWith(PROFILE_TAB_PREFIX) ? Number(adoptId.slice(PROFILE_TAB_PREFIX.length)) : null;
  if (tabId === null) {
    const cr = await loadCr();
    tabId = await cr.sendWithPromise<number | null>("astroProfileTabOpen", profile, url || "about:blank");
  }
  if (tabId === null || !Number.isFinite(tabId)) return null;
  const tab = new ProfileTab(tabId);
  tabs.set(tabId, tab);
  return tab;
}

export { listen as startProfileTabs };
