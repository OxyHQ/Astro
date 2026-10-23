import { useSyncExternalStore } from "react";
import { type BrowserState, useBrowser } from "../../../browser/src/store/browser";

type Data = Record<string, unknown>;
type Change = { value: unknown } | { set: Data; del: string[] };
type Patch = Record<string, Change>;
type Message =
  | { type: "hello"; page: string }
  | { type: "welcome"; page: string; windowId: string; state: Data }
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

function setPageWindow(id: string) {
  windowId = id;
  document.documentElement.dataset.windowId = id;
  for (const listener of pageListeners) listener();
}

export const pageWindowId = () => windowId;
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
  });
}

export function releaseWindow(id: string) {
  if (!leader) return;
  const waiting = waitingForWindow.indexOf(id);
  if (waiting >= 0) waitingForWindow.splice(waiting, 1);
  if (id === windowId) return closePage();
  if (owners.has(id)) post({ type: "close", windowId: id });
}

export function focusPageWindow(id: string) {
  if (id === windowId) window.focus();
  else post({ type: "focus", windowId: id });
}

function welcome(newPage: string) {
  const s = useBrowser.getState();
  const id = waitingForWindow.shift() ?? s.createWindow();
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
      if (data.page === page) welcomed?.(data);
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
      return;
    case "here":
      if (leader) closeWhenGone(data.windowId, data.page);
      return;
  }
};

function shareChanges() {
  useBrowser.subscribe((s, prev) => {
    if (remote || !windowId) return;
    const patch = diff(s as unknown as Data, prev as unknown as Data);
    if (Object.keys(patch).length) post({ type: "patch", patch });
  });
}

function trackFocus() {
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
  roles.lead(false);
  post({ type: "rollCall" });
  setTimeout(() => {
    const s = useBrowser.getState();
    for (const id of s.windowOrder) if (!owners.has(id)) s.closeWindow(id);
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

export async function startWindows(roles: WindowRoles, close: () => void) {
  closePage = close;
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
