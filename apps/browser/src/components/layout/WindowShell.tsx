import { onWindowEvent, setTrafficLightsCenter, watchLeftEdge, WindowDragRegion } from "@astro-browser/shell";
import { BloomScope } from "@oxy.so/bloom/appearance";
import { AppShell, useAppShell, type AppShellDock, type AppShellDockPeekChrome } from "@oxy.so/bloom/app-shell";
import { BloomThemeProvider } from "@oxy.so/bloom/theme";
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { runOnJS, useAnimatedReaction } from "react-native-reanimated";
import { useShallow } from "zustand/react/shallow";
import { switchOn } from "../../lib/killSwitches";
import { hex, layout, useTheme, type Theme } from "../../lib/theme";
import { useBrowser } from "../../store/browser";
import { useWindowId } from "../../store/hooks";
import { Sidebar } from "../Sidebar";
import { dismissHoverIn } from "../sidebar/hover";
import { useSidebarUi } from "../sidebar/state";
import { ProfileSwipe } from "./ProfileSwipe";
import {
  ARC_LIGHTS_CENTER,
  devPeeks,
  LIGHTS_CENTER,
  lightsCenter,
  PEEK_ORIGIN,
  PEEK_RADIUS,
  setDockMoving,
  setPeekShown,
  sidebarMotion,
} from "./dockMotion";
import { useTabDrag } from "./tabDrag";
import { TOP_CARD_INSET, TOP_PEEK_TOP, TopStripEdge, TopStripRegion } from "./TopTabStrip";
import { WindowButtonsHost } from "./windowButtons";

const STRIP_WIDTH = 8;
const HOLD_SLACK = 24;
const NO_INSET = { top: 0, end: 0, bottom: 0, start: 0 };
const NATIVE_LIGHTS = Platform.OS !== "web";

export function peekChrome(theme: Theme): AppShellDockPeekChrome {
  return {
    surface: hex(theme.windowTint[0]),
    border: hex(theme.panelBorder),
    borderWidth: 0.5,
    shadow: `0px 6px 20px rgba(0, 0, 0, ${theme.panelShadowOpacity})`,
  };
}

export function WindowShell({ fullscreen, topTabs, width, children }: { fullscreen: boolean; topTabs: boolean; width: number; children: ReactNode }) {
  const theme = useTheme();
  const windowId = useWindowId();
  const dark = useBrowser((s) => s.ui.appDark);
  const [open, savedWidth, addressBar] = useBrowser(
    useShallow((s) => [s.windows[windowId]?.sidebarOpen ?? true, s.settings.sidebarWidth ?? layout.sidebarWidth, s.settings.addressBar === "sidebar"] as const),
  );
  const sidebarWidth = useSidebarUi((u) => u.dragWidth[windowId]) ?? savedWidth;
  const arc = addressBar && !topTabs && switchOn("sidebarSlide");
  const hidden = !open || fullscreen;
  const wasFullscreen = useRef(fullscreen);
  const leavingFullscreen = wasFullscreen.current && !fullscreen;
  useEffect(() => void (wasFullscreen.current = fullscreen), [fullscreen]);
  const chrome = useMemo(() => peekChrome(theme), [theme]);
  const setOpen = (next: boolean) => {
    const s = useBrowser.getState();
    if ((s.windows[windowId]?.sidebarOpen ?? true) !== next) s.toggleSidebar(windowId);
  };

  const dock: AppShellDock = {
    hidden,
    onHiddenChange: (next) => !fullscreen && setOpen(!next),
    peek: { trigger: "manual", inset: PEEK_ORIGIN[0], radius: PEEK_RADIUS, fade: !arc, chrome },
    onPeekChange: (shown) => {
      setPeekShown(windowId, shown, PEEK_ORIGIN[0] + sidebarWidth);
      dismissHoverIn(windowId);
    },
    motion: sidebarMotion({ arc, instant: fullscreen || leavingFullscreen || topTabs || !switchOn("sidebarSlide") }),
  };
  const topDock: AppShellDock = {
    hidden,
    onHiddenChange: (next) => !fullscreen && setOpen(!next),
    peek: { trigger: "manual", inset: { top: TOP_PEEK_TOP, start: TOP_CARD_INSET, end: TOP_CARD_INSET }, radius: 12, fade: true, chrome },
    motion: sidebarMotion({ arc: false, instant: true }),
  };

  const sidebar = useMemo(
    () => (
      <>
        <ProfileSwipe>
          <Sidebar width={sidebarWidth} />
        </ProfileSwipe>
        <WindowButtonsHost />
      </>
    ),
    [sidebarWidth],
  );

  return (
    <BloomThemeProvider mode={dark ? "dark" : "light"} colorPreset="blue">
      <BloomScope panelRadius={fullscreen ? 0 : layout.cardRadius}>
        <AppShell
          style={{ flex: 1 }}
          background="transparent"
          header={null}
          variant="feed"
          scroll="fixed"
          safeArea={false}
          navFrom={0}
          framedFrom={0}
          contentMaxWidth="none"
          navigationAlign="content"
          navigationGap={0}
          frameInset={
            fullscreen
              ? NO_INSET
              : topTabs && open
                ? { top: 0, end: TOP_CARD_INSET, bottom: TOP_CARD_INSET, start: TOP_CARD_INSET }
                : { top: layout.cardTop, end: layout.cardInset, bottom: layout.cardInset, start: layout.cardInset }
          }
          sidebar={
            topTabs
              ? undefined
              : { surface: "plain", variant: "panel", collapsed: false, collapseDisabled: true, width: sidebarWidth, render: () => sidebar, dock }
          }
          topBar={topTabs ? <TopStripRegion width={width} fullscreen={fullscreen} /> : undefined}
          topBarVisibility="always"
          topBarDock={topTabs ? topDock : undefined}
          overlay={
            topTabs ? (
              hidden && !fullscreen && <TopStripEdge />
            ) : (
              <SidebarDockControls width={sidebarWidth} fullscreen={fullscreen} lights={addressBar ? ARC_LIGHTS_CENTER : LIGHTS_CENTER} />
            )
          }
          panelLayout={{
            mode: "split",
            flow: "bounded",
            panels: [
              {
                id: "card",
                appearance: "plain",
                content: (
                  <View style={{ flex: 1, minHeight: 0, flexDirection: "row" }}>
                    {!fullscreen && <WindowDragRegion style={StyleSheet.absoluteFill} />}
                    {children}
                  </View>
                ),
              },
            ],
          }}
        />
      </BloomScope>
    </BloomThemeProvider>
  );
}

function SidebarDockControls({ width, fullscreen, lights }: { width: number; fullscreen: boolean; lights: readonly [number, number] }) {
  const windowId = useWindowId();
  const { navigationDock: dock } = useAppShell();
  const latest = useRef(dock);
  latest.current = dock;
  const edgeOver = useRef(false);
  const peeking = dock.peeking && !fullscreen;
  const watching = dock.hidden && !fullscreen && !dock.moving;
  const draggingTab = useTabDrag((d) => d.windowId === windowId && d.tabIds.length > 0);
  const holdWidth = PEEK_ORIGIN[0] + width + HOLD_SLACK;
  const nativeHold = peeking ? holdWidth : draggingTab ? STRIP_WIDTH : 0;

  useEffect(() => setDockMoving(windowId, dock.moving), [windowId, dock.moving]);
  useEffect(() => () => setDockMoving(windowId, false), [windowId]);
  useLayoutEffect(() => () => dismissHoverIn(windowId), [windowId, dock.hidden, peeking]);
  useEffect(() => {
    if (!watching) return;
    const sub = onWindowEvent((e) => {
      if (e.type !== "leftEdge" || e.id !== windowId) return;
      edgeOver.current = e.over;
      latest.current.peek(e.over);
    });
    watchLeftEdge(windowId, true, nativeHold);
    return () => {
      sub.remove();
      watchLeftEdge(windowId, false);
      edgeOver.current = false;
    };
  }, [windowId, watching, nativeHold]);
  useEffect(() => {
    devPeeks[windowId] = { show: () => latest.current.peek(true), hide: () => latest.current.peek(false) };
    return () => void delete devPeeks[windowId];
  }, [windowId]);
  useEffect(() => () => setPeekShown(windowId, false), [windowId]);
  useTrafficLights(windowId, { width, peeking, fullscreen, lights });

  if (!watching) return null;
  return (
    <View
      onMouseEnter={() => dock.peek(true)}
      onMouseLeave={(e: { nativeEvent: { clientX: number; clientY: number } }) => {
        const { clientX: x, clientY: y } = e.nativeEvent;
        if (!(latest.current.peeking && x >= 0 && x < holdWidth && y >= 0)) dock.peek(false);
      }}
      style={{ position: "absolute", left: 0, top: 0, bottom: layout.cardInset, width: STRIP_WIDTH, zIndex: 1 }}
    />
  );
}

function useTrafficLights(windowId: string, o: { width: number; peeking: boolean; fullscreen: boolean; lights: readonly [number, number] }) {
  const { navigationDock: dock } = useAppShell();
  const sent = useRef<string | undefined>(undefined);
  const latest = useRef(o);
  latest.current = o;
  const send = (docked: number, slide: number) => {
    const v = latest.current;
    const offset = !NATIVE_LIGHTS || v.fullscreen ? 0 : v.peeking ? (v.width + 12) * (1 - slide) - PEEK_ORIGIN[0] : v.width * (1 - docked);
    const center = lightsCenter(offset, NATIVE_LIGHTS && v.peeking && !v.fullscreen ? PEEK_ORIGIN[1] : 0, v.lights);
    const key = center ? center.join(",") : "";
    if (key === sent.current) return;
    sent.current = key;
    void setTrafficLightsCenter(windowId, center);
  };
  const progress = dock.progress;
  const peekProgress = dock.peekProgress;
  useAnimatedReaction(
    () => (NATIVE_LIGHTS && progress && peekProgress ? [progress.value, peekProgress.value] : null),
    (now, before) => {
      if (now && (!before || now[0] !== before[0] || now[1] !== before[1])) runOnJS(send)(now[0]!, now[1]!);
    },
    [progress, peekProgress],
  );
  useEffect(() => send(progress?.value ?? (dock.hidden ? 0 : 1), peekProgress?.value ?? 0), [o.width, o.peeking, o.fullscreen, o.lights, dock.hidden]);
  useEffect(
    () => () => {
      sent.current = undefined;
      void setTrafficLightsCenter(windowId, null);
    },
    [windowId],
  );
}
