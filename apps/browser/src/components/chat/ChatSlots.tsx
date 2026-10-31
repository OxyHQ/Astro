import { PortalHost } from "@astro-browser/shell";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, PanResponder, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { create } from "zustand";
import { isChatTabUrl } from "../../ai/chat/actions";
import { useWindowChat } from "../../ai/chat/state";
import { activeTabId } from "../../store/model";
import { layout } from "../../lib/theme";
import { springPhysics } from "@oxy.so/bloom/motion";
import { DOCK_SPRING } from "../layout/dockMotion";
import { useBrowser } from "../../store/browser";
import { useWindowId } from "../../store/hooks";

export const CHAT_MIN_WIDTH = 320;
export const CHAT_MAX_WIDTH = 640;
export const CHAT_DEFAULT_WIDTH = 400;
const FLOATING_DEFAULT = { width: 420, height: 560 };
const FLOATING_MARGIN = 16;
const SIDEBAR_SPRING = { ...springPhysics(DOCK_SPRING), restDisplacementThreshold: 0.001, restSpeedThreshold: 0.001 };

type Slots = { slots: Record<string, number> };

export const useChatSlots = create<Slots>()(() => ({ slots: {} }));

export const windowSlotKey = (windowId: string) => `window:${windowId}`;
export const tabSlotKey = (tabId: string) => `tab:${tabId}`;

function ChatSlot({ slotKey, style }: { slotKey: string; style: StyleProp<ViewStyle> }) {
  useEffect(() => {
    useChatSlots.setState((s) => ({ slots: { ...s.slots, [slotKey]: (s.slots[slotKey] ?? 0) + 1 } }));
    return () =>
      useChatSlots.setState((s) => {
        const { [slotKey]: held = 0, ...rest } = s.slots;
        return { slots: held > 1 ? { ...rest, [slotKey]: held - 1 } : rest };
      });
  }, [slotKey]);
  return <PortalHost name={slotKey} style={style} />;
}

const useChatTabActive = (windowId: string) =>
  useBrowser((s) => {
    const id = activeTabId(s, windowId);
    return !!id && isChatTabUrl(s.tabs[id]?.url);
  });

function rubberBand(width: number): number {
  const band = (over: number) => 36 * (1 - Math.exp(-over / 90));
  if (width > CHAT_MAX_WIDTH) return CHAT_MAX_WIDTH + band(width - CHAT_MAX_WIDTH);
  if (width < CHAT_MIN_WIDTH) return CHAT_MIN_WIDTH - band(CHAT_MIN_WIDTH - width);
  return width;
}
const clampWidth = (w: number) => Math.min(CHAT_MAX_WIDTH, Math.max(CHAT_MIN_WIDTH, w));

export function ChatSidebar() {
  const windowId = useWindowId();
  const inTab = useChatTabActive(windowId);
  const open = useWindowChat(windowId, (c) => c.open && c.placement === "sidebar") && !inTab;
  const savedWidth = useBrowser((s) => s.settings.chatWidth ?? CHAT_DEFAULT_WIDTH);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const appear = useRef(new Animated.Value(open ? 1 : 0)).current;
  const [shown, setShown] = useState(open);

  useEffect(() => {
    if (open) setShown(true);
    Animated.spring(appear, { toValue: open ? 1 : 0, ...SIDEBAR_SPRING, useNativeDriver: false }).start(({ finished }) => {
      if (finished && !open) setShown(false);
    });
  }, [open]);

  const width = dragWidth ?? savedWidth;
  const start = useRef(width);
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          start.current = useBrowser.getState().settings.chatWidth ?? CHAT_DEFAULT_WIDTH;
          setDragWidth(start.current);
        },
        onPanResponderMove: (_, g) => setDragWidth(rubberBand(start.current - g.dx)),
        onPanResponderRelease: (_, g) => {
          const raw = rubberBand(start.current - g.dx);
          const target = clampWidth(raw);
          const finish = () => {
            useBrowser.getState().updateSettings({ chatWidth: target });
            setDragWidth(null);
          };
          if (raw === target) return finish();
          const value = new Animated.Value(raw);
          value.addListener(({ value: v }) => setDragWidth(v));
          Animated.timing(value, { toValue: target, duration: 260, easing: Easing.out(Easing.back(1.2)), useNativeDriver: false }).start(() => {
            value.removeAllListeners();
            finish();
          });
        },
        onPanResponderTerminate: () => setDragWidth(null),
        onPanResponderTerminationRequest: () => false,
      }),
    [],
  );

  if (!shown) return null;
  const room = width + layout.cardInset - 1;
  return (
    <Animated.View style={{ width: appear.interpolate({ inputRange: [0, 1], outputRange: [0, room] }), overflow: "hidden" }}>
      <Animated.View style={{ position: "absolute", top: 0, bottom: 0, left: room - width, width }}>
        <ChatSlot slotKey={windowSlotKey(windowId)} style={{ flex: 1 }} />
        <View
          {...responder.panHandlers}
          onDoubleClick={() => useBrowser.getState().updateSettings({ chatWidth: CHAT_DEFAULT_WIDTH })}
          style={{ position: "absolute", top: 0, bottom: 0, left: -3, width: 7, cursor: "col-resize" }}
        />
      </Animated.View>
    </Animated.View>
  );
}

type Frame = { x: number; y: number; width: number; height: number };

export const useFloatingDrag = create<{ drag: { dx: number; dy: number } | null }>()(() => ({ drag: null }));

function placeFloating(saved: [number, number, number, number] | null, area: { width: number; height: number }): Frame {
  const width = Math.min(saved?.[2] ?? FLOATING_DEFAULT.width, Math.max(CHAT_MIN_WIDTH, area.width - 2 * FLOATING_MARGIN));
  const height = Math.min(saved?.[3] ?? FLOATING_DEFAULT.height, Math.max(240, area.height - 2 * FLOATING_MARGIN));
  const x = saved ? saved[0] : area.width - width - FLOATING_MARGIN * 2;
  const y = saved ? saved[1] : area.height - height - FLOATING_MARGIN * 2;
  return {
    width,
    height,
    x: Math.min(Math.max(FLOATING_MARGIN, x), Math.max(FLOATING_MARGIN, area.width - width - FLOATING_MARGIN)),
    y: Math.min(Math.max(FLOATING_MARGIN, y), Math.max(FLOATING_MARGIN, area.height - height - FLOATING_MARGIN)),
  };
}

export function moveFloatingChat(dx: number, dy: number, done: boolean) {
  useFloatingDrag.setState({ drag: done ? null : { dx, dy } });
}

export function ChatFloating({ area }: { area: { width: number; height: number } }) {
  const windowId = useWindowId();
  const inTab = useChatTabActive(windowId);
  const open = useWindowChat(windowId, (c) => c.open && c.placement === "floating") && !inTab;
  const saved = useBrowser((s) => s.settings.chatFloatingFrame);
  const drag = useFloatingDrag((s) => s.drag);
  const appear = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(open);
  const base = placeFloating(saved, area);
  const frame = drag ? placeFloating([base.x + drag.dx, base.y + drag.dy, base.width, base.height], area) : base;
  const committed = useRef(frame);
  committed.current = frame;

  useEffect(() => {
    if (open) setShown(true);
    Animated.timing(appear, { toValue: open ? 1 : 0, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(({ finished }) => {
      if (finished && !open) setShown(false);
    });
  }, [open]);

  useEffect(() => {
    if (drag !== null) return;
    const f = committed.current;
    const current = useBrowser.getState().settings.chatFloatingFrame;
    if (current && current[0] === f.x && current[1] === f.y) return;
    if (current || f.x !== base.x || f.y !== base.y) useBrowser.getState().updateSettings({ chatFloatingFrame: [f.x, f.y, f.width, f.height] });
  }, [drag === null]);

  if (!shown || area.width === 0) return null;
  return (
    <Animated.View
      pointerEvents={open ? "auto" : "none"}
      style={{
        position: "absolute",
        left: frame.x,
        top: frame.y,
        width: frame.width,
        height: frame.height,
        opacity: appear,
        transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }],
      }}
    >
      <ChatSlot slotKey={windowSlotKey(windowId)} style={{ flex: 1 }} />
    </Animated.View>
  );
}

export function ChatTabSlot({ tabId }: { tabId: string }) {
  return <ChatSlot slotKey={tabSlotKey(tabId)} style={StyleSheet.absoluteFill} />;
}
