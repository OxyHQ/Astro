import { loadCr } from "./engine";
import { watchTab } from "./tabBridge";
import type { EngineTab, TabState } from "./tabs";

declare const chrome: {
  send(method: string, args?: unknown[]): void;
  browser: { attachIframeGuest(guestId: unknown, contentWindow: Window): void };
};

type Opened = { ref: string; guestId: string };

const EMPTY: TabState = { url: "", title: "", favicon: null, isLoading: true, canGoBack: false, canGoForward: false, themeColor: null };

class ExtensionViewTab implements EngineTab {
  private listeners = new Set<(state: TabState) => void>();
  private frame: HTMLIFrameElement | null = null;
  private stopWatching = () => {};
  onClosed: (() => void) | null = null;
  onActivatedByEngine: (() => void) | null = null;
  state: TabState = EMPTY;

  constructor(
    readonly ref: string,
    private guestId: string,
  ) {
    void watchTab(ref, (kind, payload) => {
      if (kind === "navigation") this.update({ ...this.state, ...(payload as Partial<TabState>) });
    }).then(({ snapshot, stop }) => {
      this.stopWatching = stop;
      const navigation = (snapshot as { navigation?: Partial<TabState> } | null)?.navigation;
      if (navigation) this.update({ ...this.state, ...navigation });
    });
  }

  private update(state: TabState) {
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
    while (!frame.contentWindow) await new Promise((resolve) => setTimeout(resolve, 16));
    if (this.frame === frame) chrome.browser.attachIframeGuest(this.guestId, frame.contentWindow);
  }

  detach(frame: HTMLIFrameElement) {
    if (this.frame === frame) this.frame = null;
  }

  navigate() {}
  back() {}
  forward() {}
  reload() {}
  stop() {}
  activate() {}

  close() {
    this.listeners.clear();
    this.stopWatching();
    chrome.send("astroExtensionViewClose", [this.ref]);
  }
}

export async function openExtensionView(url: string, kind: string, tabRef: string): Promise<EngineTab | null> {
  const opened = await (await loadCr()).sendWithPromise<Opened | null>("astroExtensionViewOpen", url, kind, tabRef);
  return opened ? new ExtensionViewTab(opened.ref, opened.guestId) : null;
}
