import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from "react";
import { View } from "react-native";
import type { CrashInfo, FindResult, LoadError, MediaState, NavigationState, SecurityInfo, WebViewHandle, WebViewProps, ZoomState } from "@astro-browser-real/astrocore";
import type { BrowserCommand } from "@astro-browser-real/shell";
import { openProfileTab, onProfileTabOpened, PROFILE_TAB_PREFIX } from "../host/profileTabs";
import { type EngineTab, type TabState, tabHub } from "../host/tabs";
import { cefServices } from "../host/services";
import { callTab, type TabEventListener, watchTab } from "../host/tabBridge";
import { pageWindowId } from "../host/windows";
import { openFromPage } from "../../../browser/src/components/layout/openFromPage";
import { useBrowser } from "../../../browser/src/store/browser";
import { emitCommand } from "./shell";

let nextBrowserId = 1;
let opener: { current: WebViewProps } | null = null;

const ENGINE_PAGES: [RegExp, BrowserCommand][] = [
  [/^chrome:\/\/(newtab|new-tab-page)\b/, "newTab"],
  [/^chrome:\/\/settings\b/, "openSettings"],
  [/^chrome:\/\/history\b/, "showHistory"],
  [/^chrome:\/\/downloads\b/, "downloads"],
];
const command = (name: BrowserCommand) => emitCommand({ command: name, arg: null, windowId: pageWindowId() });

function adoptForeign(id: string, url: string, closeIt: () => void) {
  const page = ENGINE_PAGES.find(([pattern]) => pattern.test(url));
  if (page) {
    closeIt();
    command(page[1]);
    return;
  }
  const request = { url, disposition: "foreground" as const, adoptId: id, userGesture: true };
  if (opener?.current.onOpenWindow) return opener.current.onOpenWindow(request);
  const windowId = pageWindowId();
  const w = windowId ? useBrowser.getState().windows[windowId] : undefined;
  if (w) openFromPage(request, { windowId: w.id, profileId: w.profileId });
}

void tabHub().then((hub) => {
  hub.onForeignTab = ({ id, url }) => adoptForeign(id, url, () => void hub.service.closeNodes([id]));
  hub.onFocusLocationBar = () => command("focusCommandBar");
});

onProfileTabOpened(({ id, url }) =>
  adoptForeign(id, url, () => void openProfileTab("", id, undefined).then((tab) => tab?.close())),
);

const isProfileTab = (profile: string | undefined, adoptId: string | undefined) => adoptId?.startsWith(PROFILE_TAB_PREFIX) || !!profile;

function openEngineTab(props: WebViewProps): Promise<EngineTab | null> {
  if (isProfileTab(props.profile, props.adoptId)) return openProfileTab(props.profile ?? "", props.adoptId, props.url);
  return tabHub().then((hub) => hub.open({ adoptId: props.adoptId, url: props.url }));
}

function tabEvents(props: { current: WebViewProps }): TabEventListener {
  return (kind, payload) => {
    const p = props.current;
    if (kind === "find") p.onFindResult?.(payload as FindResult);
    else if (kind === "media") p.onMedia?.(payload as MediaState);
    else if (kind === "zoom") p.onZoom?.(payload as ZoomState);
    else if (kind === "security") p.onSecurity?.(payload as SecurityInfo);
    else if (kind === "crashed") p.onCrashed?.(payload as CrashInfo);
    else if (kind === "loadError") p.onLoadError?.(payload as LoadError);
    else if (kind === "fullscreen") p.onFullscreen?.(!!payload.fullscreen);
  };
}

const originOf = (url: string) => {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
};

function navigationState(state: TabState): NavigationState {
  return {
    url: state.url,
    title: state.title,
    canGoBack: state.canGoBack,
    canGoForward: state.canGoForward,
    isLoading: state.isLoading,
    themeColor: state.themeColor,
    themeColorSource: state.themeColor ? "meta" : null,
  };
}

export const WebView = forwardRef<WebViewHandle, WebViewProps>(function WebView(props, ref) {
  const latest = useRef(props);
  latest.current = props;
  const tab = useRef<EngineTab | null>(null);
  const opened = useRef<Promise<EngineTab | null> | null>(null);
  const frame = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    let closed = false;
    let lastFavicon: string | null = null;
    let lastLoading: boolean | null = null;
    const browserId = nextBrowserId++;
    opened.current = openEngineTab(latest.current);
    let stopListening = () => {};
    let stopWatching = () => {};
    void opened.current.then((opening) => {
      if (!opening) return;
      if (closed) return opening.close();
      tab.current = opening;
      void watchTab(opening.ref, tabEvents(latest)).then(({ snapshot, stop }) => {
        if (closed) return stop();
        stopWatching = stop;
        if (!snapshot) return;
        latest.current.onMedia?.(snapshot.media as MediaState);
        latest.current.onZoom?.(snapshot.zoom as ZoomState);
        latest.current.onSecurity?.(snapshot.security as SecurityInfo);
      });
      opening.onClosed = () => latest.current.onWindowClose?.();
      opening.onActivatedByEngine = () => latest.current.onActivateRequest?.({ reason: "engine" });
      stopListening = opening.listen((state) => {
        latest.current.onNavigationChange?.(navigationState(state));
        if (state.isLoading !== lastLoading) {
          lastLoading = state.isLoading;
          latest.current.onProgress?.(state.isLoading ? 0.3 : 1);
        }
        if (state.favicon && state.favicon !== lastFavicon) {
          lastFavicon = state.favicon;
          latest.current.onFavicon?.(state.favicon, [state.favicon]);
        }
      });
      latest.current.onReady?.(browserId, browserId);
      if (frame.current) void opening.attach(frame.current);
      if (latest.current.visible !== false) opening.activate();
    });
    return () => {
      closed = true;
      stopListening();
      stopWatching();
      tab.current?.close();
      tab.current = null;
    };
  }, []);

  const visible = props.visible !== false;
  useEffect(() => {
    if (!visible) return;
    opener = latest;
    tab.current?.activate();
    return () => {
      if (opener === latest) opener = null;
    };
  }, [visible]);

  useLayoutEffect(() => {
    const current = frame.current;
    if (current) void tab.current?.attach(current);
    return () => {
      if (current) tab.current?.detach(current);
    };
  }, []);

  useImperativeHandle(ref, () => {
    const done = Promise.resolve();
    const withTab = (run: (current: EngineTab) => void) => async () => {
      const current = tab.current ?? (await opened.current);
      if (current) run(current);
    };
    const call = async <T,>(method: string, args: Record<string, unknown> = {}) => {
      const current = tab.current ?? (await opened.current);
      return current ? callTab<T>(current.ref, method, args) : null;
    };
    const run = (method: string, args?: Record<string, unknown>) => void call(method, args);
    const handle: Partial<WebViewHandle> = {
      nativeTag: () => null,
      loadUrl: async (url) => withTab((current) => current.navigate(url))(),
      goBack: withTab((current) => current.back()),
      goForward: withTab((current) => current.forward()),
      goToOffset: async (offset) => run("goToOffset", { offset }),
      reload: withTab((current) => current.reload()),
      forceReload: async () => run("forceReload"),
      stopLoading: withTab((current) => current.stop()),
      focus: async () => frame.current?.focus(),
      setMuted: async (muted) => run("setMuted", { muted }),
      zoomStep: async (direction) => run("zoomStep", { direction }),
      find: async (text, forward, findNext) => run("find", { text, forward, findNext }),
      stopFinding: async (clearSelection) => run("stopFinding", { clearSelection }),
      print: async () => run("print"),
      runPageCommand: async (name) => run(name === "systemPrint" ? "systemPrint" : name),
      showDevTools: async (panel) => run("showDevTools", panel ? { panel } : {}),
      executeJavaScript: async (code) => run("executeJavaScript", { code }),
      evaluate: async <T,>(code: string) => (await call<T>("evaluate", { code })) ?? null,
      navigationEntries: async () => (await call<Awaited<ReturnType<WebViewHandle["navigationEntries"]>>>("navigationEntries")) ?? [],
      getSecurityInfo: async () => await call<SecurityInfo>("securityInfo"),
      clearSiteData: async () => {
        const origin = originOf(tab.current?.state.url ?? "");
        if (!origin) return { cookies: false, storage: false };
        return (await cefServices.clearSiteData(latest.current.profile ?? "", origin)) as Awaited<ReturnType<WebViewHandle["clearSiteData"]>>;
      },
      discard: async () => "unsupported",
      capturePicture: async () => null,
    };
    return new Proxy(handle, { get: (target, key) => (key in target ? target[key as keyof WebViewHandle] : () => done) }) as WebViewHandle;
  }, []);

  return (
    <View style={[props.style, { overflow: "hidden" }, !visible && { opacity: 0, pointerEvents: "none" }]}>
      <iframe
        ref={frame}
        title=""
        tabIndex={visible ? 0 : -1}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none", background: "transparent" }}
      />
    </View>
  );
});
