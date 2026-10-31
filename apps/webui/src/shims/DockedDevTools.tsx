import { type CSSProperties, useLayoutEffect, useRef } from "react";

declare const chrome: { browser: { attachIframeGuest(guestId: unknown, contentWindow: Window): void } };

export type DevToolsDock = {
  guestId: string;
  session: number;
  dockSide: "bottom" | "right" | "left" | "none";
  hideInspected: boolean;
  bounds: { x: number; y: number; width: number; height: number };
};

const MIN_DEVTOOLS_WIDTH = 250;
const MIN_DEVTOOLS_HEIGHT = 72;

const FRAME: CSSProperties = { position: "absolute", border: "none", background: "transparent" };
const FILL: CSSProperties = { ...FRAME, left: 0, top: 0, width: "100%", height: "100%" };

export function devToolsDock(payload: unknown): DevToolsDock | null {
  const dock = payload as (Partial<DevToolsDock> & { open?: boolean }) | null | undefined;
  if (!dock?.open || typeof dock.guestId !== "string" || !dock.bounds) return null;
  return {
    guestId: dock.guestId,
    session: Number(dock.session ?? 0),
    dockSide: dock.dockSide ?? "none",
    hideInspected: !!dock.hideInspected,
    bounds: dock.bounds,
  };
}

export function pageFrameStyle(dock: DevToolsDock | null): CSSProperties {
  if (!dock) return FILL;
  const { x, y, width, height } = dock.bounds;
  if ((width <= 0 || height <= 0) && !dock.hideInspected) return FILL;
  const maxWidth = dock.dockSide === "right" ? `max(0px, calc(100% - ${MIN_DEVTOOLS_WIDTH}px))` : "100%";
  const maxHeight = dock.dockSide === "bottom" ? `max(0px, calc(100% - ${MIN_DEVTOOLS_HEIGHT}px))` : "100%";
  return {
    ...FRAME,
    left: `min(${Math.max(0, x)}px, 100%)`,
    top: `min(${Math.max(0, y)}px, 100%)`,
    width: `min(${Math.max(0, width)}px, ${maxWidth})`,
    height: `min(${Math.max(0, height)}px, ${maxHeight})`,
  };
}

export function DockedDevTools({ dock, visible }: { dock: DevToolsDock; visible: boolean }) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const guestId = dock.guestId;

  useLayoutEffect(() => {
    const current = frame.current;
    if (!current) return;
    let cancelled = false;
    void (async () => {
      while (!current.contentWindow) {
        await new Promise((resolve) => setTimeout(resolve, 16));
        if (cancelled) return;
      }
      if (!cancelled) chrome.browser.attachIframeGuest(guestId, current.contentWindow);
    })();
    return () => {
      cancelled = true;
    };
  }, [guestId]);

  return <iframe ref={frame} title="" tabIndex={visible ? 0 : -1} style={FILL} />;
}
