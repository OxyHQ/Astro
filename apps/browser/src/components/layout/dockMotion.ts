import type { MotionSpec, SpringSpec } from "@oxy.so/bloom/motion";
import { create } from "zustand";

export const DOCK_SPRING: SpringSpec = { response: 0.215, dampingRatio: 0.79 };

export const ARC_PEEK_SPRING: SpringSpec = { response: 0.185, dampingRatio: 0.77 };
export const ARC_PEEK_OUT_MS = 150;
export const ARC_HIDE_MS = 100;
export const PEEK_SLIDE_MS = 180;

export const EASE_OUT_CUBIC = [0.215, 0.61, 0.355, 1] as const;
export const EASE_IN_OUT_CUBIC = [0.645, 0.045, 0.355, 1] as const;

const INSTANT: MotionSpec = { duration: 0 };
const PEEK_SLIDE: MotionSpec = { duration: PEEK_SLIDE_MS, easing: EASE_OUT_CUBIC };

export function sidebarMotion(o: { arc: boolean; instant: boolean }) {
  const dock = o.instant ? { show: INSTANT, hide: INSTANT } : { show: DOCK_SPRING, hide: o.arc ? { duration: ARC_HIDE_MS, easing: EASE_OUT_CUBIC } : DOCK_SPRING };
  return o.arc
    ? { ...dock, peekIn: ARC_PEEK_SPRING, peekOut: { duration: ARC_PEEK_OUT_MS, easing: EASE_IN_OUT_CUBIC } }
    : { ...dock, peekIn: PEEK_SLIDE, peekOut: PEEK_SLIDE };
}

export const TOP_STRIP_MOTION = { show: INSTANT, hide: INSTANT, peekIn: PEEK_SLIDE, peekOut: PEEK_SLIDE };

export const LIGHTS_CENTER: readonly [number, number] = [25, 27];
export const ARC_LIGHTS_CENTER: readonly [number, number] = [25, 24];
export const TOP_STRIP_LIGHTS_CENTER: readonly [number, number] = [20.75, 20.75];

export const PEEK_ORIGIN: readonly [number, number] = [5, 5];
export const PEEK_BOTTOM = 5;
export const PEEK_RADIUS = 12;

export function lightsCenter(offset: number, down = 0, base: readonly [number, number] = LIGHTS_CENTER): [number, number] | null {
  const dx = Math.round(offset * 2) / 2;
  return dx === 0 && down === 0 && base === LIGHTS_CENTER ? null : [base[0] - dx, base[1] + down];
}

export const cardLeft = (dock: number, width: number, inset: number) => inset + (width - inset) * dock;

type DockMotion = { moving: Record<string, true> };
export const useDockMotion = create<DockMotion>()(() => ({ moving: {} }));

export const dockMoving = (windowId: string) => !!useDockMotion.getState().moving[windowId];

export function setDockMoving(windowId: string, moving: boolean) {
  const current = useDockMotion.getState().moving;
  if (!!current[windowId] === moving) return;
  const { [windowId]: _, ...rest } = current;
  useDockMotion.setState({
    moving: moving ? { ...current, [windowId]: true } : rest,
  });
}

const peeking = new Map<string, number>();
export const setPeekShown = (windowId: string, shown: boolean, rightEdge = 0) => void (shown ? peeking.set(windowId, rightEdge) : peeking.delete(windowId));
export const peekShown = (windowId: string) => peeking.has(windowId);
export const overPeek = (windowId: string, x: number) => x < (peeking.get(windowId) ?? -Infinity);
export const devPeeks: Record<string, { show(): void; hide(): void }> = {};

export const HEADER_TOOLS = { toggleX: 70.75 + 27, pitch: 35, edge: 7, lightsRight: 70.75 + 7 } as const;

export const HEADER_MIN_GAP = 2;

export type HeaderButton = "back" | "forward" | "reload";

export function navButtonsFitting(width: number, button = 30, toggle = true): { buttons: HeaderButton[]; step: number } {
  const { toggleX, pitch, edge } = HEADER_TOOLS;
  const span = width - edge - button / 2 - (toggle ? toggleX : toggleX - pitch);
  const count = Math.max(0, Math.min(3, Math.floor(span / (button + HEADER_MIN_GAP))));
  const buttons: HeaderButton[] = count === 3 ? ["back", "forward", "reload"] : count === 2 ? ["back", "forward"] : count === 1 ? ["back"] : [];
  return { buttons, step: count ? Math.min(pitch, span / count) : pitch };
}
