import { Surface, Symbol, VisualEffect } from "@astro-browser/shell";
import { resolvePanelDropTarget, type AppShellPanelDrop, type PanelDropTarget } from "@oxy.so/bloom/app-shell";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { hex, useTheme } from "../../lib/theme";
import { withAlpha } from "../sidebar/tokens";
import { useBrowser } from "../../store/browser";
import { MAX_SPLIT_PANES } from "../../store/splits";
import { useHover } from "../primitives";
import { hideToast, useToasts } from "./splitActions";
import { useWindowId } from "../../store/hooks";
import { overPeek } from "./dockMotion";
import { PREVIEW } from "./splitDrop";
import { setDropTarget, setOnPage, setTargetResolver, useTabDrag } from "./tabDrag";

type PaneRect = { x: number; y: number; width: number; height: number };

const paneRects = new Map<string, Map<string, PaneRect>>();

export function notePaneRect(windowId: string, paneId: string, rect: PaneRect | null) {
  let rects = paneRects.get(windowId);
  if (!rects) paneRects.set(windowId, (rects = new Map()));
  if (rect) rects.set(paneId, rect);
  else rects.delete(paneId);
}

const tabOf = (paneId: string) => paneId.slice(0, paneId.indexOf("|"));
const inside = (r: PaneRect, x: number, y: number) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;

export function usePaneDrop(visible: readonly string[]): AppShellPanelDrop | undefined {
  const windowId = useWindowId();
  const dragging = useTabDrag((s) => (s.windowId === windowId ? s.tabId : null));
  const x = useTabDrag((s) => s.x);
  const y = useTabDrag((s) => s.y);
  const lifted = useTabDrag((s) => s.lifted);
  const outside = useTabDrag((s) => s.outside);
  const full = visible.length >= MAX_SPLIT_PANES;
  const fallback = useBrowser((s) => {
    if (!dragging || visible.length !== 1 || tabOf(visible[0]!) !== dragging) return null;
    const tab = s.tabs[dragging];
    const others = (s.windows[windowId]?.tabIds ?? []).map((id) => s.tabs[id]!).filter((t) => t && t.id !== dragging && t.profileId === tab?.profileId);
    return others.sort((a, b) => b.lastActiveAt - a.lastActiveAt)[0]?.id ?? null;
  });
  const candidates = useMemo(() => (fallback ? visible : visible.filter((id) => tabOf(id) !== dragging)), [visible, dragging, fallback]);
  const overPage = !!dragging && x >= 0 && !overPeek(windowId, x) && visible.some((id) => {
    const r = paneRects.get(windowId)?.get(id);
    return !!r && inside(r, x, y);
  });
  const active = !!dragging && !full && !outside && candidates.length > 0 && (lifted ?? overPage);
  const asTarget = (target: PanelDropTarget | null) => {
    if (!target) return null;
    const tabId = fallback && tabOf(target.panelId) === dragging ? fallback : tabOf(target.panelId);
    return { tabId, side: target.edge === "start" ? ("left" as const) : ("right" as const) };
  };
  const latest = useRef({ candidates, visible, ready: false, asTarget });
  latest.current = { candidates, visible, ready: active && lifted !== false, asTarget };
  useEffect(() => {
    if (!dragging) return;
    setTargetResolver((px, py, current, out) => {
      const { candidates, visible, ready, asTarget } = latest.current;
      const rects = paneRects.get(windowId);
      if (!ready || out || !rects || overPeek(windowId, px)) return null;
      if (!visible.some((id) => rects.get(id) && inside(rects.get(id)!, px, py))) return null;
      const panels: Record<string, PaneRect> = {};
      for (const id of candidates) if (rects.get(id)) panels[id] = rects.get(id)!;
      const over: Record<string, PaneRect> = {};
      for (const id of visible) if (rects.get(id)) over[id] = rects.get(id)!;
      const keep = current ? candidates.find((id) => tabOf(id) === current.tabId || current.tabId === fallback) : undefined;
      return asTarget(
        resolvePanelDropTarget({
          panels,
          over,
          point: { x: px, y: py },
          current: keep && current ? { panelId: keep, edge: current.side === "left" ? "start" : "end" } : null,
          edges: ["start", "end"],
          preview: PREVIEW,
          rtl: false,
        }),
      );
    });
    return () => setTargetResolver(null);
  }, [dragging]);
  useEffect(() => setOnPage(active && overPage), [active && overPage]);
  useEffect(
    () => () => {
      setDropTarget(null);
      setOnPage(false);
    },
    [],
  );
  return useMemo(
    () => ({
      active,
      point: dragging ? { x, y } : null,
      panels: candidates,
      edges: ["start", "end"] as const,
      preview: PREVIEW,
      appearance: "glass" as const,
      onTargetChange: (target: PanelDropTarget | null) => setDropTarget(latest.current.asTarget(target)),
    }),
    [active, dragging, x, y, candidates],
  );
}

export const SplitToast = memo(function SplitToast({ windowId }: { windowId: string }) {
  const theme = useTheme();
  const toast = useToasts((s) => s.toasts[windowId] ?? null);
  const appear = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(toast);
  useEffect(() => {
    if (toast) return setShown(toast);
    if (!shown?.sticky) return;
    Animated.timing(appear, { toValue: 0, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(({ finished }) => {
      if (finished) setShown(null);
    });
  }, [toast]);
  useEffect(() => {
    if (!toast) return;
    setShown(toast);
    appear.setValue(0);
    Animated.spring(appear, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 6 }).start();
    if (toast.sticky) return;
    const timer = setTimeout(() => {
      Animated.timing(appear, { toValue: 0, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(({ finished }) => {
        if (!finished) return;
        setShown(null);
        hideToast(windowId, toast.id);
      });
    }, toast.action ? 4000 : 2600);
    return () => clearTimeout(timer);
  }, [toast?.id]);
  if (!shown) return null;
  return (
    <View pointerEvents={shown.action ? "box-none" : "none"} style={{ position: "absolute", left: 0, right: 0, bottom: 22, alignItems: "center" }}>
      <Animated.View style={{ opacity: appear, transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }, { scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }}>
        <Surface
          fill={hex(theme.dark ? "rgba(44,42,43,0.9)" : "rgba(255,255,255,0.92)")}
          cornerRadius={14}
          borderColor={hex(theme.dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.1)")}
          borderWidth={0.5}
          shadowColor="#000000"
          shadowOpacity={theme.dark ? 0.4 : 0.14}
          shadowRadius={16}
          shadowOffset={[0, 6]}
          style={{ paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 10, maxWidth: 420 }}
        >
          <VisualEffect material="hudWindow" cornerRadius={14} style={StyleSheet.absoluteFill} />
          <Symbol name={shown.icon ?? "rectangle.split.3x1"} size={15} color={theme.icon} style={{ width: 20, height: 20 }} />
          <View style={{ flexShrink: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: theme.textPrimary }}>{shown.title}</Text>
            {shown.message ? <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 1 }}>{shown.message}</Text> : null}
          </View>
          {shown.action ? (
            <ToastAction
              title={shown.action.title}
              onPress={() => {
                shown.action!.run();
                setShown(null);
                hideToast(windowId, shown.id);
              }}
            />
          ) : null}
        </Surface>
      </Animated.View>
    </View>
  );
});

function ToastAction({ title, onPress }: { title: string; onPress(): void }) {
  const theme = useTheme();
  const { hovered, hoverProps } = useHover();
  return (
    <Pressable {...hoverProps} onPress={onPress}>
      {({ pressed }) => (
        <View style={{ height: 24, paddingHorizontal: 10, borderRadius: 7, justifyContent: "center", backgroundColor: pressed ? theme.toolbarPressed : hovered ? theme.toolbarHover : theme.urlPill }}>
          <Text style={{ fontSize: 12, fontWeight: "500", color: theme.textPrimary }}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}
