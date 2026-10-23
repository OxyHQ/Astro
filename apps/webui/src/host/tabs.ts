import { callTab, watchTab } from "./tabBridge";

type TabData = {
  id: string;
  title: string;
  url: string;
  favicon?: { dataUrl?: string } | null;
  networkState: number;
  isActive: boolean;
};
type Container = { data?: { tab?: TabData | null } | null; children?: Container[] | null };
type Remote<T> = T & { $: { bindNewPipeAndPassReceiver(): unknown; close(): void } };
type GuestHandler = Remote<{
  navigate(src: string): void;
  canGoBack(): Promise<{ canGoBack: boolean }>;
  canGoForward(): Promise<{ canGoForward: boolean }>;
  goBack(): void;
  goForward(): void;
  reload(): void;
  stopLoading(): void;
}>;
type TabStripService = {
  getTabs(): Promise<{ tabStrip: Container; stream: { handle: unknown } }>;
  createTabAt(position: null, url: string | null): Promise<TabData>;
  closeNodes(ids: string[]): Promise<unknown>;
  activateTab(id: string): Promise<unknown>;
};
type Listener = { addListener(listener: () => void): unknown };
type PageCallbackRouter = { setFocusToLocationBar: Listener };
type PageHandler = {
  getGuestIdForTabId(tabId: string, receiver: unknown): Promise<{ guestId: unknown }>;
  minimize(): void;
  maximize(): void;
  restore(): void;
  close(): void;
};
type Observer = {
  onTabsCreated(event: { tabs: { tab: TabData }[] }): void;
  onNodesClosed(event: { nodeIds: string[] }): void;
  onDataChanged(event: { tab?: { data: TabData } | null }): void;
  onCollectionCreated(): void;
  onNodeMoved(): void;
};

declare const chrome: { browser: { attachIframeGuest(guestId: unknown, contentWindow: Window): void } };

const importFromPage = <T>(path: string): Promise<T> => import(/* @vite-ignore */ path);

const NETWORK_WAITING = 1;
const NETWORK_LOADING = 2;
const FIRST_URL_WAIT_MS = 500;
const STARTUP_URL_WAIT_MS = 3000;
const CLOSED_TAB_SETTLE_MS = 300;

export type TabState = {
  url: string;
  title: string;
  favicon: string | null;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  themeColor: string | null;
};

export type ForeignTab = { id: string; url: string };

export interface EngineTab {
  readonly ref: string;
  state: TabState;
  onClosed: (() => void) | null;
  onActivatedByEngine: (() => void) | null;
  listen(listener: (state: TabState) => void): () => void;
  attach(frame: HTMLIFrameElement): Promise<void>;
  detach(frame: HTMLIFrameElement): void;
  navigate(url: string): void;
  back(): void;
  forward(): void;
  reload(): void;
  stop(): void;
  activate(): void;
  close(): void;
}

export class ChromiumTab implements EngineTab {
  private guestId: Promise<unknown>;
  private frame: HTMLIFrameElement | null = null;
  private listeners = new Set<(state: TabState) => void>();
  private active = false;
  onClosed: (() => void) | null = null;
  onActivatedByEngine: (() => void) | null = null;
  state: TabState;
  private stopWatching = () => {};

  get ref() {
    return this.id;
  }

  constructor(
    private hub: TabHub,
    readonly id: string,
    readonly guest: GuestHandler,
    data: TabData,
  ) {
    this.state = toState(data, false, false, null);
    void watchTab(id, (kind, payload) => {
      if (kind === "theme") this.setTheme((payload.color as string | null) ?? null);
    }).then(({ snapshot, stop }) => {
      this.stopWatching = stop;
      if (snapshot) this.setTheme(snapshot.themeColor);
    });
    this.guestId = hub.page.getGuestIdForTabId(id, guest.$.bindNewPipeAndPassReceiver()).then((r) => r.guestId);
  }

  listen(listener: (state: TabState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => void this.listeners.delete(listener);
  }

  async update(data: TabData) {
    const activated = data.isActive && !this.active;
    this.active = data.isActive;
    if (activated && this.hub.requestedActive !== this.id) this.onActivatedByEngine?.();
    const [{ canGoBack }, { canGoForward }] = await Promise.all([this.guest.canGoBack(), this.guest.canGoForward()]);
    this.state = toState(data, canGoBack, canGoForward, this.state.themeColor);
    for (const listener of this.listeners) listener(this.state);
  }

  setTheme(themeColor: string | null) {
    if (themeColor === this.state.themeColor) return;
    this.state = { ...this.state, themeColor };
    for (const listener of this.listeners) listener(this.state);
  }

  async attach(frame: HTMLIFrameElement) {
    this.frame = frame;
    const guestId = await this.guestId;
    if (this.frame !== frame) return;
    while (!frame.contentWindow) await new Promise((resolve) => setTimeout(resolve, 16));
    chrome.browser.attachIframeGuest(guestId, frame.contentWindow);
  }

  detach(frame: HTMLIFrameElement) {
    if (this.frame === frame) this.frame = null;
  }

  navigate(url: string) {
    if (isBlank(this.state.url)) void callTab(this.id, "navigate", { url, replace: true });
    else this.guest.navigate(url);
  }

  back() {
    this.guest.goBack();
  }

  forward() {
    this.guest.goForward();
  }

  reload() {
    this.guest.reload();
  }

  stop() {
    this.guest.stopLoading();
  }

  activate() {
    this.hub.requestedActive = this.id;
    void this.hub.service.activateTab(this.id);
  }

  close() {
    this.listeners.clear();
    this.stopWatching();
    this.hub.close(this);
  }
}

function toState(data: TabData, canGoBack: boolean, canGoForward: boolean, themeColor: string | null): TabState {
  return {
    url: data.url,
    title: data.title,
    favicon: data.favicon?.dataUrl || null,
    isLoading: data.networkState === NETWORK_WAITING || data.networkState === NETWORK_LOADING,
    canGoBack,
    canGoForward,
    themeColor,
  };
}

const isBlank = (url: string) => !url || url === "about:blank" || /^chrome:\/\/(newtab|new-tab-page)\b/.test(url);

const flatten = (container: Container): TabData[] => [
  ...(container.data?.tab ? [container.data.tab] : []),
  ...(container.children ?? []).flatMap(flatten),
];

export class TabHub {
  private tabs = new Map<string, ChromiumTab>();
  private spare: TabData[] = [];
  private known = new Map<string, TabData>();
  private creating = new Set<Promise<unknown>>();
  requestedActive: string | null = null;
  private foreignHandler: ((tab: ForeignTab) => void) | null = null;
  private waitingForHandler: TabData[] = [];
  onFocusLocationBar: (() => void) | null = null;

  constructor(
    readonly service: TabStripService,
    readonly page: PageHandler,
    private newGuestHandler: () => GuestHandler,
  ) {}

  static async start(): Promise<TabHub> {
    const [browser, tabsApi, observation] = await Promise.all([
      importFromPage<{
        browserProxyFactory: { getInstance(): { handler: PageHandler; callbackRouter: PageCallbackRouter } };
        GuestHandlerRemote: new () => GuestHandler;
      }>("/browser.mojom-webui.js"),
      importFromPage<{ TabStripService: { getRemote(): TabStripService } }>("/tab_strip_api/tab_strip_api.mojom-webui.js"),
      importFromPage<{ TabStripObservation: new (observer: Observer) => { bind(handle: unknown): void } }>("/tab_strip_api/tab_strip_observation.js"),
    ]);
    const proxy = browser.browserProxyFactory.getInstance();
    const hub = new TabHub(tabsApi.TabStripService.getRemote(), proxy.handler, () => new browser.GuestHandlerRemote());
    proxy.callbackRouter.setFocusToLocationBar.addListener(() => hub.onFocusLocationBar?.());
    const snapshot = await hub.service.getTabs();
    for (const tab of flatten(snapshot.tabStrip)) {
      hub.known.set(tab.id, tab);
      void hub.settleStartup(tab);
    }
    new observation.TabStripObservation(hub.observer()).bind(snapshot.stream.handle);
    return hub;
  }

  private observer(): Observer {
    return {
      onTabsCreated: ({ tabs }) => {
        for (const { tab } of tabs) {
          this.known.set(tab.id, tab);
          void this.settleCreated(tab);
        }
      },
      onNodesClosed: ({ nodeIds }) => {
        for (const id of nodeIds) {
          this.known.delete(id);
          this.spare = this.spare.filter((tab) => tab.id !== id);
          const tab = this.tabs.get(id);
          this.tabs.delete(id);
          if (tab) setTimeout(() => tab.onClosed?.(), CLOSED_TAB_SETTLE_MS);
        }
      },
      onDataChanged: (event) => {
        const data = event.tab?.data;
        if (!data) return;
        this.known.set(data.id, data);
        void this.tabs.get(data.id)?.update(data);
      },
      onCollectionCreated: () => {},
      onNodeMoved: () => {},
    };
  }

  get onForeignTab() {
    return this.foreignHandler;
  }

  set onForeignTab(handler: ((tab: ForeignTab) => void) | null) {
    this.foreignHandler = handler;
    const waiting = this.waitingForHandler;
    this.waitingForHandler = [];
    for (const tab of waiting) void this.settleCreated(tab);
  }

  private async settleCreated(tab: TabData) {
    await Promise.allSettled([...this.creating]);
    if (this.tabs.has(tab.id) || !this.known.has(tab.id)) return;
    if (!this.onForeignTab) {
      this.waitingForHandler.push(tab);
      return;
    }
    const url = await this.firstUrl(tab.id);
    const settled = this.known.get(tab.id);
    if (settled && !this.tabs.has(tab.id)) this.onForeignTab?.({ id: tab.id, url });
  }

  private async settleStartup(tab: TabData) {
    const url = await this.firstUrl(tab.id, STARTUP_URL_WAIT_MS);
    if (this.tabs.has(tab.id) || !this.known.has(tab.id)) return;
    if (isBlank(url)) this.spare.push(this.known.get(tab.id) ?? tab);
    else void this.settleCreated(tab);
  }

  private async firstUrl(id: string, wait = FIRST_URL_WAIT_MS): Promise<string> {
    const deadline = Date.now() + wait;
    while (Date.now() < deadline) {
      const url = this.known.get(id)?.url ?? "";
      if (url && url !== "about:blank") return url;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    return this.known.get(id)?.url ?? "";
  }

  async open({ adoptId, url }: { adoptId?: string; url?: string }): Promise<ChromiumTab> {
    const adopted = adoptId ? this.known.get(adoptId) : undefined;
    if (adopted && !this.tabs.has(adopted.id)) return this.claim(adopted, null);
    const spare = this.spare.shift();
    if (spare) return this.claim(spare, url ?? null);
    const creating = this.service.createTabAt(null, url || "about:blank");
    this.creating.add(creating);
    try {
      const created = await creating;
      this.known.set(created.id, this.known.get(created.id) ?? created);
      return this.claim(created, null);
    } finally {
      this.creating.delete(creating);
    }
  }

  private claim(data: TabData, url: string | null): ChromiumTab {
    this.spare = this.spare.filter((tab) => tab.id !== data.id);
    const tab = new ChromiumTab(this, data.id, this.newGuestHandler(), data);
    this.tabs.set(data.id, tab);
    if (url && url !== data.url) tab.navigate(url);
    void tab.update(this.known.get(data.id) ?? data);
    return tab;
  }

  close(tab: ChromiumTab) {
    if (this.tabs.get(tab.id) !== tab) return;
    this.tabs.delete(tab.id);
    const data = this.known.get(tab.id);
    if (this.tabs.size === 0 && this.spare.length === 0 && data) {
      tab.navigate("about:blank");
      this.spare.push(data);
    } else {
      void this.service.closeNodes([tab.id]);
    }
    tab.guest.$.close();
  }
}

let started: Promise<TabHub> | null = null;
export const tabHub = (): Promise<TabHub> => (started ??= TabHub.start());
