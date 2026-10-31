import type { DragPreviewShape } from "@astro-browser-real/shell";
import { useTabDrag } from "../../../browser/src/components/layout/tabDrag";
import { useBrowser } from "../../../browser/src/store/browser";
import { provideNativeModule } from "../../../demo/src/shims/expo-modules-core";
import { loadCr } from "./engine";
import { pageWindowId } from "./windows";

declare const chrome: { send(method: string, args?: unknown[]): void };

type Rect = [number, number, number, number];
type Shown = "pill" | "card" | "window";
type Picture = { image: CanvasImageSource; frame: Rect };

const CARD: [number, number] = [209, 110];
const CARD_SCALE = 2;
const WINDOW_SCALE = 0.5;
const PILL_MS = 30;
const MORPH_MS = 60;
const GROW_MS = 200;
const FADE_MS = 100;
const REVEAL_MS = 600;
const PILL_RADIUS = 10;
const CARD_RADIUS = 4;
const PILL_RIM = 0.15;
const CARD_RIM = 0.3;
const PLACEHOLDER_TOP = 42;
const PLACEHOLDER_ICON = 64;
const PLACEHOLDER_FONT = 34;
const PLACEHOLDER_GAP = 12;
const PLACEHOLDER_INSET = 80;

const send = (update: Record<string, unknown>) => chrome.send("astroDragPreview", [update]);

let generation = 0;
let source: string | null = null;
let windowShot: HTMLImageElement | null = null;
let windowSize: [number, number] = [0, 0];
let pillSize: [number, number] = [173, 32];
let grab: [number, number] = [86, 16];
let chip: Rect = [0, 0, 0, 0];
let page: Picture | null = null;
let images: Partial<Record<Shown, { url: string; scale: number }>> = {};
let shape: DragPreviewShape = "hidden";
let wanted: DragPreviewShape = "hidden";
let lastPoint: [number, number] = [0, 0];
let shownAt = 0;
let panel: { frame: Rect; opacity: number } | null = null;
let shown: Shown | null = null;
let sentImage: string | null = null;
let animation: number | null = null;
let desired: Rect | null = null;

const flipped = ([x, y, width, height]: Rect): Rect => [x, -y - height, width, height];

let contentOrigin: [number, number] | null = null;
const noteOrigin = (e: PointerEvent) => void (contentOrigin = [e.screenX - e.clientX, e.screenY - e.clientY]);
const toScreen = ([x, y]: [number, number]): [number, number] => {
  const [left, top] = contentOrigin ?? [window.screenX, window.screenY];
  return [left + x, top + y];
};

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

function canvas(width: number, height: number) {
  const made = document.createElement("canvas");
  made.width = Math.max(1, Math.round(width));
  made.height = Math.max(1, Math.round(height));
  const ctx = made.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  return { made, ctx };
}

const shotScale = () => (windowShot && windowSize[0] ? windowShot.naturalWidth / windowSize[0] : 1);

function composePill() {
  if (!windowShot) return;
  const scale = shotScale();
  const { made, ctx } = canvas(chip[2] * scale, chip[3] * scale);
  ctx.drawImage(windowShot, chip[0] * scale, chip[1] * scale, chip[2] * scale, chip[3] * scale, 0, 0, made.width, made.height);
  images.pill = { url: made.toDataURL("image/png"), scale };
}

function composeCard() {
  if (!windowShot) return;
  const [width, height] = windowSize;
  if (!width || !height) return;
  const { made, ctx } = canvas(CARD[0] * CARD_SCALE, CARD[1] * CARD_SCALE);
  const fit = Math.max(CARD[0] / width, CARD[1] / height) * CARD_SCALE;
  ctx.drawImage(windowShot, 0, 0, width * fit, height * fit);
  if (page) {
    const [x, y, w, h] = page.frame;
    ctx.drawImage(page.image, x * fit, y * fit, w * fit, h * fit);
  }
  images.card = { url: made.toDataURL("image/png"), scale: CARD_SCALE };
}

function composeWindow() {
  if (!windowShot) return;
  const [width, height] = windowSize;
  if (!width || !height) return;
  const { made, ctx } = canvas(width * WINDOW_SCALE, height * WINDOW_SCALE);
  ctx.drawImage(windowShot, 0, 0, made.width, made.height);
  if (page) {
    const [x, y, w, h] = page.frame;
    ctx.drawImage(page.image, x * WINDOW_SCALE, y * WINDOW_SCALE, w * WINDOW_SCALE, h * WINDOW_SCALE);
  }
  images.window = { url: made.toDataURL("image/png"), scale: WINDOW_SCALE };
}

function setFrame(frame: Rect, opacity: number) {
  panel = { frame, opacity };
  const visible = !!shown && !!images[shown];
  send({ frame, opacity: visible ? opacity : 0 });
}

function show(kind: Shown) {
  shown = kind;
  const image = images[kind];
  const pill = kind === "pill";
  const style = { radius: pill ? PILL_RADIUS : CARD_RADIUS, rim: pill ? PILL_RIM : CARD_RIM };
  if (!image) return void (panel && send({ ...style, opacity: 0 }));
  if (image.url === sentImage) return;
  sentImage = image.url;
  send({
    image: image.url,
    scale: image.scale,
    placement: kind === "pill" ? "fit" : kind === "window" ? "top" : "fill",
    ...(kind === "window" ? {} : style),
    ...(panel ? { frame: panel.frame, opacity: panel.opacity } : {}),
  });
}

function stopAnimation() {
  if (animation !== null) cancelAnimationFrame(animation);
  animation = null;
}

function animate(to: Rect, alpha: number, ms: number, done?: () => void) {
  stopAnimation();
  desired = to;
  const from = panel?.frame ?? to;
  const fromAlpha = panel?.opacity ?? alpha;
  const start = performance.now();
  const step = () => {
    const t = Math.min(1, (performance.now() - start) / Math.max(ms, 1));
    const e = 1 - (1 - t) ** 3;
    const target = desired ?? to;
    const mix = (a: number, b: number) => a + (b - a) * e;
    setFrame([mix(from[0], target[0]), mix(from[1], target[1]), mix(from[2], target[2]), mix(from[3], target[3])], mix(fromAlpha, alpha));
    if (t < 1) {
      animation = requestAnimationFrame(step);
      return;
    }
    animation = null;
    done?.();
  };
  animation = requestAnimationFrame(step);
}

function place(next: "pill" | "card", point: [number, number], animated: boolean) {
  const pill = next === "pill";
  const size: [number, number] = pill ? pillSize : CARD;
  const offset: [number, number] = pill ? grab : [size[0] / 2, size[1] / 2];
  const frame: Rect = [Math.round(point[0] - offset[0]), Math.round(point[1] - offset[1]), size[0], size[1]];
  show(next);
  if (animated && panel && (panel.frame[2] !== frame[2] || panel.frame[3] !== frame[3])) animate(frame, 1, MORPH_MS);
  else if (animation === null) setFrame(frame, 1);
  else desired = frame;
}

function hidePanel() {
  stopAnimation();
  panel = null;
  shown = null;
  sentImage = null;
  send({ hide: true });
}

function release() {
  generation++;
  shape = "hidden";
  wanted = "hidden";
  source = null;
  windowShot = null;
  page = null;
  images = {};
}

async function begin(windowId: string, chipRect: Rect, grabPoint: [number, number]) {
  cancel();
  if (windowId !== pageWindowId()) return;
  const drag = generation;
  source = windowId;
  chip = chipRect;
  pillSize = [chipRect[2], chipRect[3]];
  grab = [grabPoint[0] - chipRect[0], grabPoint[1] - chipRect[1]];
  windowSize = [window.innerWidth, window.innerHeight];
  const shot = await (await loadCr()).sendWithPromise<string | null>("astroCapturePage");
  const image = shot ? await loadImage(shot) : null;
  if (drag !== generation || !image) return;
  windowShot = image;
  composePill();
  composeCard();
  if (shown && shown !== "window") show(shown);
  if (panel && shown) setFrame(panel.frame, panel.opacity);
}

function update(next: DragPreviewShape, local: [number, number]) {
  if (!source) return;
  const point = toScreen(local);
  wanted = next;
  lastPoint = point;
  if (next === "hidden") {
    stopAnimation();
    if (shape === "hidden") return;
    shape = "hidden";
    hidePanel();
    return;
  }
  if (shape === "hidden") {
    shownAt = performance.now();
    shape = "pill";
    stopAnimation();
    place("pill", point, false);
    if (next !== "card") return;
    const drag = generation;
    setTimeout(() => {
      if (drag !== generation || shape !== "pill" || wanted !== "card") return;
      shape = "card";
      place("card", lastPoint, true);
    }, PILL_MS);
  } else if (shape !== next && !(next === "card" && performance.now() - shownAt < PILL_MS)) {
    shape = next;
    place(next, point, true);
  } else {
    place(shape as "pill" | "card", point, false);
  }
}

async function setPage(base64: string, frame: Rect) {
  if (!source) return;
  const drag = generation;
  const image = await loadImage(`data:image/jpeg;base64,${base64}`);
  if (drag !== generation || !image) return;
  page = { image, frame };
  composeCard();
  if (shape === "card") show("card");
}

async function setPlaceholder(title: string, favicon: string | null) {
  if (!source || page) return;
  const drag = generation;
  const [width, height] = windowSize;
  const frame: Rect = [0, PLACEHOLDER_TOP, width, Math.max(1, height - PLACEHOLDER_TOP)];
  const icon = favicon ? await loadImage(favicon) : null;
  if (drag !== generation || page) return;
  const dark = useBrowser.getState().ui.appDark;
  const { made, ctx } = canvas(frame[2], frame[3]);
  ctx.fillStyle = dark ? "rgb(31, 31, 31)" : "rgb(247, 247, 247)";
  ctx.fillRect(0, 0, made.width, made.height);
  const midX = made.width / 2;
  const midY = made.height / 2;
  if (icon) ctx.drawImage(icon, midX - PLACEHOLDER_ICON / 2, midY - PLACEHOLDER_GAP - PLACEHOLDER_ICON, PLACEHOLDER_ICON, PLACEHOLDER_ICON);
  ctx.fillStyle = dark ? "rgba(255, 255, 255, 0.7)" : "rgba(0, 0, 0, 0.6)";
  ctx.font = `500 ${PLACEHOLDER_FONT}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(title, midX, midY + PLACEHOLDER_GAP, made.width - PLACEHOLDER_INSET);
  page = { image: made, frame };
  composeCard();
  if (shape === "card") show("card");
}

function revealed(windowId: string, done: () => void) {
  const start = performance.now();
  const check = () => {
    if (useBrowser.getState().ui.focusedWindowId === windowId || performance.now() - start > REVEAL_MS) return done();
    setTimeout(check, 16);
  };
  check();
}

function end(windowId: string | null, fallback: Rect | null) {
  const showing = shape !== "hidden" && !!panel;
  if (windowId) composeWindow();
  const whole = images.window;
  release();
  if (!showing) return hidePanel();
  const drag = generation;
  const fade = () => {
    if (drag !== generation || !panel) return;
    animate(panel.frame, 0, FADE_MS, () => drag === generation && hidePanel());
  };
  if (!windowId || !fallback || fallback[2] <= 0) return fade();
  if (whole) {
    images = { window: whole };
    show("window");
  }
  const target = useBrowser.getState().windows[windowId]?.frame ?? fallback;
  animate(flipped(target), 1, GROW_MS, () => revealed(windowId, fade));
}

function cancel() {
  stopAnimation();
  if (panel) hidePanel();
  release();
}

export function startDragPreview() {
  window.addEventListener("pointerdown", noteOrigin, true);
  window.addEventListener("pointermove", noteOrigin, true);
  useTabDrag.subscribe((drag) => document.documentElement.classList.toggle("astro-tab-drag", drag.tabIds.length > 0));
  provideNativeModule("AstroShell", {
    dragPreviewBegin: async (windowId: string, chipRect: Rect, grabPoint: [number, number]) => void begin(windowId, chipRect, grabPoint),
    dragPreviewPage: async (base64: string, frame: Rect) => void setPage(base64, frame),
    dragPreviewUpdate: async (next: DragPreviewShape, point: [number, number]) => update(next, point),
    dragPreviewPlaceholder: async (title: string, favicon: string | null) => void setPlaceholder(title, favicon),
    dragPreviewEnd: async (windowId: string | null, frame: Rect | null) => end(windowId, frame),
    dragPreviewCancel: async () => cancel(),
  });
}
