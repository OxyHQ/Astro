import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { attachScreenshot, endAreaCapture, jpegUri, useAreaCapture, type AreaCaptureRequest } from "../../../browser/src/components/chat/capture";
import { webviews } from "../../../browser/src/lib/webviews";
import { usePageWindowId } from "./windows";

type Shot = { uri: string; frame: [number, number, number, number] };
type Rect = { x: number; y: number; width: number; height: number };

const MIN_SIDE = 4;
const DIM = "rgba(0, 0, 0, 0.4)";

export function AreaCapture() {
  const windowId = usePageWindowId();
  const request = useAreaCapture((s) => s.request);
  if (!request || request.windowId !== windowId) return null;
  return createPortal(<Overlay key={`${request.tabId}`} request={request} />, document.body);
}

const rectOf = (start: { x: number; y: number }, end: { x: number; y: number }): Rect => ({
  x: Math.min(start.x, end.x),
  y: Math.min(start.y, end.y),
  width: Math.abs(end.x - start.x),
  height: Math.abs(end.y - start.y),
});

async function crop(shot: Shot, rect: Rect): Promise<string | null> {
  const image = new Image();
  image.src = shot.uri;
  await image.decode().catch(() => null);
  if (!image.naturalWidth) return null;
  const ratio = image.naturalWidth / shot.frame[2];
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(rect.width * ratio));
  canvas.height = Math.max(1, Math.round(rect.height * ratio));
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(image, rect.x * ratio, rect.y * ratio, rect.width * ratio, rect.height * ratio, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.92);
}

function Overlay({ request }: { request: AreaCaptureRequest }) {
  const [shot, setShot] = useState<Shot | null>(null);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [end, setEnd] = useState<{ x: number; y: number } | null>(null);
  const surface = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      const picture = await webviews.get(request.tabId)?.capturePicture(1).catch(() => null);
      if (!live) return;
      if (!picture?.data) return endAreaCapture();
      setShot({ uri: jpegUri(picture.data), frame: picture.frame });
    })();
    return () => {
      live = false;
    };
  }, [request]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      endAreaCapture();
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, []);

  useEffect(() => surface.current?.focus(), [shot]);

  if (!shot) return null;
  const [left, top, width, height] = shot.frame;
  const point = (event: ReactPointerEvent) => ({
    x: Math.min(width, Math.max(0, event.clientX - left)),
    y: Math.min(height, Math.max(0, event.clientY - top)),
  });
  const selection = start && end ? rectOf(start, end) : null;

  const finish = async (rect: Rect | null) => {
    endAreaCapture();
    if (!rect || rect.width < MIN_SIDE || rect.height < MIN_SIDE) return;
    const uri = await crop(shot, rect);
    if (uri) attachScreenshot(request.windowId, request.tabId, uri);
  };

  return (
    <div
      ref={surface}
      tabIndex={-1}
      role="dialog"
      aria-label="Capture an area of the page"
      data-astro-area-capture=""
      onPointerDown={(event) => {
        if (event.button !== 0) return void endAreaCapture();
        event.currentTarget.setPointerCapture(event.pointerId);
        const at = point(event);
        setStart(at);
        setEnd(at);
      }}
      onPointerMove={(event) => start && setEnd(point(event))}
      onPointerUp={(event) => start && void finish(rectOf(start, point(event)))}
      onContextMenu={(event) => {
        event.preventDefault();
        endAreaCapture();
      }}
      style={{ position: "fixed", left, top, width, height, zIndex: 2147483000, cursor: "crosshair", overflow: "hidden", outline: "none", userSelect: "none" }}
    >
      {selection ? (
        <div
          style={{
            position: "absolute",
            left: selection.x,
            top: selection.y,
            width: selection.width,
            height: selection.height,
            boxShadow: `0 0 0 100000px ${DIM}`,
            outline: "1px solid rgba(255, 255, 255, 0.9)",
          }}
        />
      ) : (
        <div style={{ position: "absolute", inset: 0, background: DIM }} />
      )}
      {!selection && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 16,
            transform: "translateX(-50%)",
            padding: "6px 12px",
            borderRadius: 999,
            background: "rgba(30, 28, 29, 0.92)",
            color: "#FFFFFF",
            font: "500 12px/16px system-ui, sans-serif",
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          Drag to capture an area · Esc to cancel
        </div>
      )}
    </div>
  );
}
