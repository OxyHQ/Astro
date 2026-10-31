import { useSyncExternalStore } from "react";
import { type BrowserState, useBrowser } from "../../../browser/src/store/browser";
import { emitWindowEvent } from "../../../demo/src/shims/shell";
import { loadCr } from "./engine";
import { closeOwnWindow, confirmWindowClose } from "./quit";
import { notePageWindow, releaseClosedTabs } from "./tabTransfer";

type Data = Record<string, unknown>;
type Change = { value: unknown } | { set: Data; del: string[] };
type Patch = Record<string, Change>;
type Message =
  | { type: "hello"; page: string }
  | { type: "welcome"; page: string; windowId: string; state: Data }
  | { type: "opening"; windowId: string }
  | { type: "patch"; patch: Patch }
  | { type: "close"; windowId: string }
  | { type: "focus"; windowId: string }
  | { type: "rollCall" }
  | { type: "here"; page: string; windowId: string };

export type WindowRoles = {
  lead(hydrate: boolean): void;
  begin(): void;
  end(): void;
};

declare const chrome: { send(method: string, args?: unknown[]): void };

const LEADER_LOCK = "astro-window-leader";
const pageLock = (id: string) => `astro-window-page:${id}`;
const CHANNEL = "astro-windows";
const CLOSE_DELAY_MS = 400;
const ROLL_CALL_MS = 500;

const page = crypto.randomUUID();
const channel = new BroadcastChannel(CHANNEL);
const owners = new Map<string, string>();
const waitingForWindow: string[] = [];
const assignedWindows = new Map<string, string>();
const pageListeners = new Set<() => void>();
let windowId: string | null = null;
let leader = false;
let ready = false;
let remote = false;
let unloading = false;
let welcomed: ((message: Extract<Message, { type: "welcome" }>) => void) | null = null;
let closePage: () => void = () => window.close();

const post = (message: Message) => {
  try {
    channel.postMessage(message);
  } catch (error) {
    console.warn("[astro] couldn't share a window update", error);
  }
};

const isPlain = (value: unknown): value is Data =>
  !!value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype;

function snapshot(): Data {
  return Object.fromEntries(Object.entries(useBrowser.getState()).filter(([, value]) => typeof value !== "function"));
}

function diff(next: Data, prev: Data): Patch {
  const patch: Patch = {};
  for (const [key, value] of Object.entries(next)) {
    const before = prev[key];
    if (value === before || typeof value === "function") continue;
    if (isPlain(value) && isPlain(before)) {
      const set: Data = {};
      for (const [id, entry] of Object.entries(value)) if (entry !== before[id]) set[id] = entry;
      patch[key] = { set, del: Object.keys(before).filter((id) => !(id in value)) };
    } else {
      patch[key] = { value };
    }
  }
  return patch;
}

function applyRemote(update: Data) {
  remote = true;
  try {
    useBrowser.setState(update as Partial<BrowserState>);
  } finally {
    remote = false;
  }
}

function applyPatch(patch: Patch) {
  const current = useBrowser.getState() as unknown as Data;
  const update: Data = {};
  for (const [key, change] of Object.entries(patch)) {
    if ("value" in change) {
      update[key] = change.value;
      continue;
    }
    const merged: Data = { ...(isPlain(current[key]) ? current[key] : {}), ...change.set };
    for (const id of change.del) delete merged[id];
    update[key] = merged;
  }
  applyRemote(update);
}

type Frame = [number, number, number, number];

const FRAME_POLL_MS = 1000;
const flipped = ([x, y, width, height]: Frame): Frame => [x, -y - height, width, height];
const currentFrame = (): Frame => flipped([window.screenX, window.screenY, window.outerWidth, window.outerHeight]);
const sameFrame = (a: Frame | null | undefined, b: Frame) => !!a && a.every((v, i) => Math.abs(v - b[i]!) < 2);

function restoreFrame(id: string) {
  const s = useBrowser.getState();
  const w = s.windows[id];
  const [width, height] = s.settings.littleAstroSize;
  const frame: Frame | null = w?.frame
    ? flipped(w.frame)
    : w?.kind === "small"
      ? [Math.max(0, (screen.availWidth - width) / 2), Math.max(0, (screen.availHeight - height) / 2), width, height]
      : null;
  if (frame) chrome.send("astroWindowBounds", frame);
}

function trackFrame() {
  const note = () => {
    if (!windowId) return;
    const s = useBrowser.getState();
    const frame = currentFrame();
    if (s.windows[windowId] && !sameFrame(s.windows[windowId]!.frame, frame)) s.setWindowFrame(windowId, frame);
  };
  window.addEventListener("resize", note);
  setInterval(note, FRAME_POLL_MS);
}

function setPageWindow(id: string) {
  restoreFrame(id);
  windowId = id;
  notePageWindow(id);
  document.documentElement.dataset.windowId = id;
  for (const listener of pageListeners) listener();
}

export const pageWindowId = () => windowId;

export const pageWindowReady = (): Promise<string> =>
  new Promise((resolve) => {
    if (windowId) return resolve(windowId);
    const listener = () => {
      if (!windowId) return;
      pageListeners.delete(listener);
      resolve(windowId);
    };
    pageListeners.add(listener);
  });
export const isLeaderPage = () => leader;

export const usePageWindowId = () =>
  useSyncExternalStore(
    (listener) => {
      pageListeners.add(listener);
      return () => pageListeners.delete(listener);
    },
    () => windowId,
  );

export function requestWindow(id: string) {
  if (!leader) return;
  queueMicrotask(() => {
    if (owners.has(id) || waitingForWindow.includes(id)) return;
    waitingForWindow.push(id);
    chrome.send("astroNewWindow");
    post({ type: "opening", windowId: id });
  });
}

export function releaseWindow(id: string) {
  if (!leader) return;
  const waiting = waitingForWindow.indexOf(id);
  if (waiting >= 0) waitingForWindow.splice(waiting, 1);
  if (id === windowId) return void closeOwnWindow(id, closePage);
  if (owners.has(id)) post({ type: "close", windowId: id });
}

export function focusPageWindow(id: string) {
  if (id === windowId) window.focus();
  else post({ type: "focus", windowId: id });
}

function noteWelcome(newPage: string, id: string) {
  assignedWindows.set(newPage, id);
  const waiting = waitingForWindow.indexOf(id);
  if (waiting >= 0) waitingForWindow.splice(waiting, 1);
}

function welcome(newPage: string) {
  const s = useBrowser.getState();
  const known = assignedWindows.get(newPage);
  const id = known && s.windows[known] ? known : (waitingForWindow.shift() ?? s.createWindow());
  noteWelcome(newPage, id);
  closeWhenGone(id, newPage);
  post({ type: "welcome", page: newPage, windowId: id, state: snapshot() });
}

function closeWhenGone(id: string, ownerPage: string) {
  owners.set(id, ownerPage);
  void navigator.locks.request(pageLock(ownerPage), () =>
    setTimeout(() => {
      if (unloading || owners.get(id) !== ownerPage) return;
      owners.delete(id);
      useBrowser.getState().closeWindow(id);
    }, CLOSE_DELAY_MS),
  );
}

const pendingHellos: string[] = [];

channel.onmessage = ({ data }: MessageEvent<Message>) => {
  switch (data.type) {
    case "hello":
      if (!leader) return;
      if (ready) welcome(data.page);
      else pendingHellos.push(data.page);
      return;
    case "welcome":
      noteWelcome(data.page, data.windowId);
      if (data.page === page) welcomed?.(data);
      return;
    case "opening":
      if (!waitingForWindow.includes(data.windowId)) waitingForWindow.push(data.windowId);
      return;
    case "patch":
      if (windowId) applyPatch(data.patch);
      return;
    case "close":
      if (data.windowId === windowId) closePage();
      return;
    case "focus":
      if (data.windowId === windowId) window.focus();
      return;
    case "rollCall":
      if (windowId && !leader) post({ type: "here", page, windowId });
      else if (welcomed) post({ type: "hello", page });
      return;
    case "here":
      if (leader) closeWhenGone(data.windowId, data.page);
      return;
  }
};

function shareChanges() {
  releaseClosedTabs(isLeaderPage);
  useBrowser.subscribe((s, prev) => {
    if (remote || !windowId) return;
    const patch = diff(s as unknown as Data, prev as unknown as Data);
    if (Object.keys(patch).length) post({ type: "patch", patch });
  });
}

function trackFocus() {
  trackFrame();
  const focus = () => {
    const s = useBrowser.getState();
    if (windowId && s.ui.focusedWindowId !== windowId && s.windows[windowId]) s.setFocusedWindow(windowId);
  };
  window.addEventListener("focus", focus);
  window.addEventListener("pointerdown", focus, true);
  window.addEventListener("keydown", focus, true);
}

function leadAfterPromotion(roles: WindowRoles) {
  leader = true;
  owners.set(windowId!, page);
  const { windows } = useBrowser.getState();
  waitingForWindow.splice(0, waitingForWindow.length, ...waitingForWindow.filter((id) => windows[id] && !owners.has(id)));
  roles.lead(false);
  post({ type: "rollCall" });
  setTimeout(() => {
    const s = useBrowser.getState();
    for (const id of s.windowOrder) if (!owners.has(id) && !waitingForWindow.includes(id)) s.closeWindow(id);
  }, ROLL_CALL_MS);
  ready = true;
}

function acquireLeadership(wait: boolean): Promise<boolean> {
  return new Promise((resolve) => {
    void navigator.locks.request(LEADER_LOCK, { ifAvailable: !wait }, (lock) => {
      resolve(!!lock);
      return lock ? new Promise<never>(() => {}) : undefined;
    });
  });
}

async function listenForCloseRequests() {
  const cr = await loadCr();
  const add = cr.addWebUiListener as unknown as (event: string, listener: (kind: string) => void) => void;
  add("astro-window-event", (kind) => {
    if (kind !== "closeRequest") return;
    const id = windowId;
    if (!id) return closePage();
    void confirmWindowClose(id).then((confirmed) => confirmed && emitWindowEvent({ type: "closeRequest", id }));
  });
}

export async function startWindows(roles: WindowRoles, close: () => void) {
  closePage = close;
  void listenForCloseRequests();
  window.addEventListener("pagehide", () => {
    unloading = true;
    if (leader) roles.end();
  });

  void navigator.locks.request(pageLock(page), () => new Promise<never>(() => {}));
  if (await acquireLeadership(false)) return leadFromStart(roles);

  const leadership = acquireLeadership(true);
  const greeting = await Promise.race([
    new Promise<Extract<Message, { type: "welcome" }>>((resolve) => {
      welcomed = resolve;
      post({ type: "hello", page });
    }),
    leadership.then(() => null),
  ]);
  welcomed = null;
  if (!greeting) return leadFromStart(roles);
  applyRemote(greeting.state);
  setPageWindow(greeting.windowId);
  shareChanges();
  trackFocus();
  roles.begin();
  void leadership.then(() => leadAfterPromotion(roles));
}

function leadFromStart(roles: WindowRoles) {
  leader = true;
  roles.lead(true);
  const s = useBrowser.getState();
  const own = s.ui.focusedWindowId ?? s.windowOrder[0] ?? s.createWindow();
  owners.set(own, page);
  setPageWindow(own);
  shareChanges();
  trackFocus();
  roles.begin();
  ready = true;
  for (const hello of pendingHellos.splice(0)) welcome(hello);
}
