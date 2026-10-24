import { emitNativeEvent } from "../../../demo/src/shims/expo-modules-core";
import { loadCr } from "./engine";
import { notificationResponse } from "./system";
import { isLeaderPage } from "./windows";

export type TabEventListener = (kind: string, payload: Record<string, unknown>) => void;
export type TabSnapshot = {
  media: Record<string, unknown>;
  zoom: Record<string, unknown>;
  security: Record<string, unknown>;
  themeColor: string | null;
  navigation?: Record<string, unknown>;
  preferredSize?: { width: number; height: number };
  mediaAccess?: Record<string, unknown>;
  autofillPrompt?: Record<string, unknown>;
  discarded?: boolean;
};

const listeners = new Map<string, Set<TabEventListener>>();
let listening: Promise<void> | null = null;

const HOST_EVENTS: Record<string, [module: string, event: string]> = {
  permissionDismissed: ["AstroCEF", "onPermissionDismissed"],
};

const listen = () =>
  (listening ??= loadCr().then((cr) => {
    const add = cr.addWebUiListener as unknown as (event: string, listener: (...args: never[]) => void) => void;
    add("astro-tab-event", (ref: string, kind: string, payload: Record<string, unknown>) => {
      for (const listener of listeners.get(ref) ?? []) listener(kind, payload);
    });
    add("astro-host-event", (kind: string, payload: Record<string, unknown>) => {
      if (kind === "installPrompt") return void (isLeaderPage() && emitNativeEvent("AstroExtensions", "onInstallPrompt", payload));
      if (kind === "openURLs") return void (isLeaderPage() && emitNativeEvent("AstroShell", "onOpenURLs", payload));
      if (kind === "notificationResponse") return emitNativeEvent("AstroApp", "onNotificationResponse", notificationResponse(payload));
      const target = HOST_EVENTS[kind];
      if (target) emitNativeEvent(target[0], target[1], payload);
    });
  }));

export const startTabEvents = () => void listen();

export async function watchTab(ref: string, listener: TabEventListener): Promise<{ snapshot: TabSnapshot | null; stop: () => void }> {
  await listen();
  const set = listeners.get(ref) ?? new Set();
  set.add(listener);
  listeners.set(ref, set);
  const stop = () => {
    set.delete(listener);
    if (!set.size) listeners.delete(ref);
  };
  const snapshot = await (await loadCr()).sendWithPromise<TabSnapshot | null>("astroTabWatch", ref);
  return { snapshot, stop };
}

export const callTab = async <T = unknown>(ref: string, method: string, args: Record<string, unknown> = {}): Promise<T | null> =>
  (await loadCr()).sendWithPromise<T | null>("astroTabCall", ref, method, args);
