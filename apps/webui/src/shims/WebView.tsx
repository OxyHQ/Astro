import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from "react";
import { View } from "react-native";
import type { NavigationState, WebViewHandle, WebViewProps } from "@astro-browser-real/astrocore";
import { type ChromiumTab, type TabState, tabHub } from "../host/tabs";
import { emitCommand } from "./shell";

let nextBrowserId = 1;
let opener: { current: WebViewProps } | null = null;

const ENGINE_NEW_TAB = /^(chrome:\/\/(newtab|new-tab-page)\/?|about:blank)?$/;
const command = (name: "newTab" | "focusCommandBar") => emitCommand({ command: name, arg: null, windowId: null });

void tabHub().then((hub) => {
  hub.onForeignTab = ({ id, url }) => {
    if (ENGINE_NEW_TAB.test(url)) {
      void hub.service.closeNodes([id]);
      command("newTab");
      return;
    }
    opener?.current.onOpenWindow?.({ url, disposition: "foreground", adoptId: id, userGesture: true });
  };
  hub.onFocusLocationBar = () => command("focusCommandBar");
});

function navigationState(state: TabState): NavigationState {
  return {
    url: state.url,
    title: state.title,
    canGoBack: state.canGoBack,
    canGoForward: state.canGoForward,
    isLoading: state.isLoading,
    themeColor: null,
    themeColorSource: null,
  };
}

export const WebView = forwardRef<WebViewHandle, WebViewProps>(function WebView(props, ref) {
  const latest = useRef(props);
  latest.current = props;
  const tab = useRef<ChromiumTab | null>(null);
  const opened = useRef<Promise<ChromiumTab> | null>(null);
  const frame = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    let closed = false;
    let lastFavicon: string | null = null;
    let lastLoading: boolean | null = null;
    const browserId = nextBrowserId++;
    opened.current = tabHub().then((hub) => hub.open({ adoptId: latest.current.adoptId, url: latest.current.url }));
    let stopListening = () => {};
    void opened.current.then((opening) => {
      if (closed) return opening.close();
      tab.current = opening;
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
    const withTab = (run: (current: ChromiumTab) => void) => async () => {
      const current = tab.current ?? (await opened.current);
      if (current) run(current);
    };
    const handle: Partial<WebViewHandle> = {
      nativeTag: () => null,
      loadUrl: async (url) => withTab((current) => current.navigate(url))(),
      goBack: withTab((current) => current.guest.goBack()),
      goForward: withTab((current) => current.guest.goForward()),
      reload: withTab((current) => current.guest.reload()),
      forceReload: withTab((current) => current.guest.reload()),
      stopLoading: withTab((current) => current.guest.stopLoading()),
      focus: async () => frame.current?.focus(),
      navigationEntries: async () => {
        const state = tab.current?.state;
        return state ? [{ url: state.url, title: state.title, current: true }] : [];
      },
      evaluate: async () => null,
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
