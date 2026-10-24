import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { View } from "react-native";
import type { BlockedPopup, ContentBlockedState, CrashInfo, DownloadNavigation, ExternalAppRequest, FindResult, LoadError, MediaAccess, MediaState, NavigationState, PasswordPrompt, SecurityInfo, WebViewHandle, WebViewProps, ZoomState } from "@astro-browser-real/astrocore";
import type { BrowserCommand } from "@astro-browser-real/shell";
import { openProfileTab, onProfileTabOpened, PROFILE_TAB_PREFIX } from "../host/profileTabs";
import { type EngineTab, type TabState, tabHub } from "../host/tabs";
import { emitNativeEvent } from "../../../demo/src/shims/expo-modules-core";
import { forgetDisplayMedia, noteDisplayMediaRequest, noteDisplayMediaSources } from "../host/displayMedia";
import { openExtensionView } from "../host/extensionViews";
import { PageChannel } from "../host/pageChannel";
import { fetchFaviconImage } from "../host/favicons";
import { cefServices } from "../host/services";
import { callTab, type TabEventListener, watchTab } from "../host/tabBridge";
import { offerHandOff, noteLiveTab, noteTabGone, takeTransferredTab, transferredUrlGuard } from "../host/tabTransfer";
import { pageWindowId } from "../host/windows";
import { openFromPage } from "../../../browser/src/components/layout/openFromPage";
import { useBrowser } from "../../../browser/src/store/browser";
import { DockedDevTools, type DevToolsDock, devToolsDock, pageFrameStyle } from "./DockedDevTools";
import { emitCommand } from "./shell";

let nextBrowserId = 1;
const browsers = new Map<number, { ref: string; profile: string }>();

export const refForBrowser = (browserId: number) => browsers.get(browserId)?.ref ?? null;
export const latestTabRef = () => [...browsers.values()].reverse().find((entry) => !entry.ref.startsWith("x:"))?.ref ?? null;

const tabRefForProfile = (profile: string) => {
  for (const entry of [...browsers.values()].reverse()) if (entry.profile === profile && !entry.ref.startsWith("x:")) return entry.ref;
  return "";
};
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

async function takeTransferred(key: string, arrived: ReturnType<typeof transferredUrlGuard>): Promise<EngineTab | null> {
  const hub = await tabHub();
  const taken = await hub.take(takeTransferredTab(key));
  if (!taken) return null;
  const tab = taken.ref.startsWith(PROFILE_TAB_PREFIX) ? await openProfileTab("", taken.ref, undefined) : hub.adopt(taken);
  if (tab) arrived.arrive(taken.url);
  return tab;
}

async function openEngineTab(props: WebViewProps, arrived: ReturnType<typeof transferredUrlGuard>): Promise<EngineTab | null> {
  if (props.extensionHost) return openExtensionView(props.url ?? "", props.extensionHost, tabRefForProfile(props.profile ?? ""));
  const transferred = props.transferKey ? await takeTransferred(props.transferKey, arrived) : null;
  if (transferred) {
    if (arrived.differs(props.url)) transferred.navigate(props.url!);
    return transferred;
  }
  if (isProfileTab(props.profile, props.adoptId)) return openProfileTab(props.profile ?? "", props.adoptId, props.url);
  return tabHub().then((hub) => hub.open({ adoptId: props.adoptId, url: props.url }));
}

function handOffTarget(key: string) {
  const s = useBrowser.getState();
  const own = pageWindowId();
  return { toWindow: s.tabs[key]?.windowId ?? null, keepWindow: !!own && !!s.windows[own] };
}

const ESCAPE_KEPT_BY_PAGE =
  'post("result", JSON.stringify(!!document.fullscreenElement || !!(document.activeElement && (document.activeElement.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)))));';

async function escapeIfUnused(ref: string, p: WebViewProps) {
  const kept = await callTab<string>(ref, "evaluate", { code: ESCAPE_KEPT_BY_PAGE }).catch(() => null);
  if (kept === "false") p.onCommand?.({ command: "escape", text: "" });
}

function tabEvents(props: { current: WebViewProps }, browserId: number, onDevTools: (dock: DevToolsDock | null) => void, ref: string, channel: PageChannel, zoom: (state: ZoomState) => void): TabEventListener {
  return (kind, payload) => {
    const p = props.current;
    if (kind === "pageScript")
      return channel.handle(String(payload.kind ?? ""), String(payload.json ?? "null"), Number(payload.frame), payload.main === true);
    if (kind === "unhandledEscape") return void escapeIfUnused(ref, p);
    if (kind === "devTools") return onDevTools(devToolsDock(payload));
    if (kind === "permission") return emitNativeEvent("AstroCEF", "onPermission", { ...payload, browserId });
    if (kind === "installPrompt") return emitNativeEvent("AstroExtensions", "onInstallPrompt", { ...payload, browserId });
    if (kind === "actionPopup") return emitNativeEvent("AstroChromeUI", "onActionPopup", { ...payload, browserId });
    if (kind === "actionShortcut") return emitNativeEvent("AstroChromeUI", "onActionShortcut", { ...payload, browserId });
    if (kind === "sidePanel") return emitNativeEvent("AstroChromeUI", "onSidePanel", { ...payload, browserId });
    if (kind === "deviceChooser") return emitNativeEvent("AstroChromeUI", "onDeviceChooser", { ...payload, browserId });
    if (kind === "castDialog") return emitNativeEvent("AstroChromeUI", "onCastDialog", { ...payload, browserId });
    if (kind === "windowClose") return p.onWindowClose?.();
    if (kind === "pageFocus") return p.onPageFocus?.();
    if (kind === "contentBlocked") return p.onContentBlocked?.(payload as ContentBlockedState);
    if (kind === "unresponsive") return p.onUnresponsive?.();
    if (kind === "responsive") return p.onResponsive?.();
    if (kind === "downloadNavigation") return p.onDownloadNavigation?.(payload as DownloadNavigation);
    if (kind === "preferredSize") return p.onPreferredSize?.(payload as { width: number; height: number });
    if (kind === "find") p.onFindResult?.(payload as FindResult);
    else if (kind === "media") p.onMedia?.(payload as MediaState);
    else if (kind === "mediaAccess") p.onMediaAccess?.(payload as MediaAccess);
    else if (kind === "zoom") zoom(payload as ZoomState);
    else if (kind === "security") p.onSecurity?.(payload as SecurityInfo);
    else if (kind === "crashed") {
      channel.crashed();
      p.onCrashed?.(payload as CrashInfo);
    }
    else if (kind === "loadError") p.onLoadError?.(payload as LoadError);
    else if (kind === "fullscreen") p.onFullscreen?.(!!payload.fullscreen);
    else if (kind === "passwordPrompt") p.onPasswordPrompt?.(payload as PasswordPrompt);
    else if (kind === "externalApp") p.onExternalApp?.(payload as ExternalAppRequest);
    else if (kind === "displayMediaRequest") p.onDisplayMediaRequest?.(noteDisplayMediaRequest(payload));
    else if (kind === "displayMediaSources") noteDisplayMediaSources(payload);
    else if (kind === "popupBlocked") p.onPopupBlocked?.(payload as BlockedPopup);
    else if (kind === "discarded") p.onDiscarded?.(String(payload.url ?? ""));
    else if (kind === "status") p.onStatus?.(String(payload.text ?? ""));
  };
}

const PICTURE_IN_PICTURE =
  "(async () => {" +
  "  const videos = [...document.querySelectorAll('video')].filter(v => v.readyState > 0 && !v.disablePictureInPicture);" +
  "  videos.sort((a, b) => (b.paused ? 0 : 1) - (a.paused ? 0 : 1) || b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight);" +
  "  if (!videos.length) return post('result', 'false');" +
  "  if (document.pictureInPictureElement === videos[0]) return post('result', 'true');" +
  "  try { await videos[0].requestPictureInPicture(); post('result', 'true'); } catch (e) { post('result', 'false'); }" +
  "})()";
const EXIT_PICTURE_IN_PICTURE =
  "document.pictureInPictureElement && document.exitPictureInPicture();" +
  "window.documentPictureInPicture && documentPictureInPicture.window && documentPictureInPicture.window.close()";

const originOf = (url: string) => {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
};

function navigationState(state: TabState, channel: PageChannel | null): NavigationState {
  const pageTheme = channel?.theme?.color ?? null;
  return {
    url: state.url,
    title: state.title,
    canGoBack: state.canGoBack,
    canGoForward: state.canGoForward,
    isLoading: state.isLoading,
    themeColor: pageTheme ?? state.themeColor,
    themeColorSource: pageTheme ? (channel?.theme?.source as NavigationState["themeColorSource"]) ?? null : state.themeColor ? "meta" : null,
  };
}

export const WebView = forwardRef<WebViewHandle, WebViewProps>(function WebView(props, ref) {
  const latest = useRef(props);
  latest.current = props;
  const tab = useRef<EngineTab | null>(null);
  const opened = useRef<Promise<EngineTab | null> | null>(null);
  const frame = useRef<HTMLIFrameElement | null>(null);
  const arrived = useRef(transferredUrlGuard());
  const [devTools, setDevTools] = useState<DevToolsDock | null>(null);
  const channel = useRef<PageChannel | null>(null);

  useEffect(() => {
    let closed = false;
    let lastFavicon: string | null = null;
    let lastLoading: boolean | null = null;
    const browserId = nextBrowserId++;
    const key = latest.current.extensionHost ? "" : (latest.current.transferKey ?? "");
    opened.current = openEngineTab(latest.current, arrived.current);
    let stopListening = () => {};
    let stopWatching = () => {};
    let handedOff = false;
    let withdrawHandOff = () => {};
    void opened.current.then((opening) => {
      if (!opening) return;
      if (closed) return opening.close();
      tab.current = opening;
      if (key) {
        noteLiveTab(key, opening.ref);
        withdrawHandOff = offerHandOff(key, () => {
          if (handedOff || tab.current !== opening || !opening.handOff) return;
          handedOff = true;
          const { toWindow, keepWindow } = handOffTarget(key);
          opening.handOff(key, toWindow, keepWindow);
        });
      }
      browsers.set(browserId, { ref: opening.ref, profile: latest.current.profile ?? "" });
      let lastZoom: ZoomState | null = null;
      const emitZoom = (state: ZoomState) => {
        lastZoom = state;
        latest.current.onZoom?.({ ...state, pinchScale: page.pinchScale });
      };
      const page = new PageChannel(
        () => tab.current?.ref ?? null,
        latest,
        browserId,
        () => tab.current?.state.url ?? "",
        () => latest.current.visible !== false,
        (what) => {
          if (what === "zoom" && lastZoom) emitZoom(lastZoom);
          if (what === "theme" && tab.current) latest.current.onNavigationChange?.(navigationState(tab.current.state, page));
        },
      );
      channel.current = page;
      void watchTab(opening.ref, tabEvents(latest, browserId, setDevTools, opening.ref, page, emitZoom)).then(({ snapshot, stop }) => {
        if (closed) return stop();
        stopWatching = stop;
        if (!snapshot) return;
        latest.current.onMedia?.(snapshot.media as MediaState);
        if (snapshot.mediaAccess) latest.current.onMediaAccess?.(snapshot.mediaAccess as MediaAccess);
        emitZoom(snapshot.zoom as ZoomState);
        latest.current.onSecurity?.(snapshot.security as SecurityInfo);
        if (snapshot.preferredSize) latest.current.onPreferredSize?.(snapshot.preferredSize);
        setDevTools(devToolsDock((snapshot as { devTools?: unknown }).devTools));
      });
      opening.onClosed = () => latest.current.onWindowClose?.();
      opening.onActivatedByEngine = () => latest.current.onActivateRequest?.({ reason: "engine" });
      stopListening = opening.listen((state) => {
        latest.current.onNavigationChange?.(navigationState(state, page));
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
      browsers.delete(browserId);
      withdrawHandOff();
      stopListening();
      stopWatching();
      if (!handedOff) {
        if (key && tab.current) noteTabGone(key);
        tab.current?.close();
      }
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
      loadUrl: async (url) =>
        withTab((current) => {
          if (!arrived.current.skips(url)) current.navigate(url);
        })(),
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
      evaluate: async <T,>(code: string) => {
        const json = await call<string>("evaluate", { code });
        if (typeof json !== "string") return null;
        try {
          return JSON.parse(json) as T;
        } catch {
          return null;
        }
      },
      navigationEntries: async () => (await call<Awaited<ReturnType<WebViewHandle["navigationEntries"]>>>("navigationEntries")) ?? [],
      executeExtensionAction: async (id) => (await call<"none" | "popup" | "sidePanel">("executeExtensionAction", { id })) ?? "none",
      openBlockedPopup: async (id, always) => run("openBlockedPopup", { id, always: !!always }),
      resolvePasswordPrompt: async (answer, edits) => run("resolvePasswordPrompt", { answer, ...edits }),
      getSecurityInfo: async () => await call<SecurityInfo>("securityInfo"),
      resolveDisplayMedia: async (id, sourceId) => {
        forgetDisplayMedia(id);
        run("resolveDisplayMedia", { id, sourceId });
      },
      mediaCaptureSourceId: async () => await call<string>("mediaCaptureSourceId"),
      clearSiteData: async () => {
        const origin = originOf(tab.current?.state.url ?? "");
        if (!origin) return { cookies: false, storage: false };
        return (await cefServices.clearSiteData(latest.current.profile ?? "", origin)) as Awaited<ReturnType<WebViewHandle["clearSiteData"]>>;
      },
      discard: async () => (await call<Awaited<ReturnType<WebViewHandle["discard"]>>>("discard")) ?? "unsupported",
      setFrozen: async (frozen) => run("setFrozen", { frozen }),
      mediaCommand: async (action, seconds) => channel.current?.mediaCommand(action, seconds),
      downloadFavicon: async (url) => fetchFaviconImage(url, latest.current.profile ?? ""),
      downloadImage: async (url, maxPixels) => fetchFaviconImage(url, latest.current.profile ?? "", maxPixels),
      requestPictureInPicture: async () => (await call<string>("evaluate", { code: PICTURE_IN_PICTURE, userGesture: true })) === "true",
      exitPictureInPicture: async () => run("executeJavaScript", { code: EXIT_PICTURE_IN_PICTURE }),
      notificationAction: async (id, action) => channel.current?.notificationAction(id, action),
      resolveUnresponsive: async (terminate) => run("resolveUnresponsive", { terminate }),
      capturePicture: async (scale) => {
        const picture = await call<{ data: string }>("capturePicture", { scale });
        const bounds = frame.current?.getBoundingClientRect();
        if (!picture?.data || !bounds?.width || !bounds.height) return null;
        return { data: picture.data, frame: [bounds.left, bounds.top, bounds.width, bounds.height] };
      },
    };
    return new Proxy(handle, { get: (target, key) => (key in target ? target[key as keyof WebViewHandle] : () => done) }) as WebViewHandle;
  }, []);

  return (
    <View style={[props.style, { overflow: "hidden" }, !visible && { opacity: 0, pointerEvents: "none" }]}>
      {devTools && <DockedDevTools key={`${devTools.guestId}:${devTools.session}`} dock={devTools} visible={visible} />}
      <iframe
        ref={frame}
        title=""
        tabIndex={visible ? 0 : -1}
        style={pageFrameStyle(devTools)}
      />
    </View>
  );
});
