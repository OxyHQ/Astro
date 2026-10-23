import { loadCr } from "./engine";

export type TabEventListener = (kind: string, payload: Record<string, unknown>) => void;
export type TabSnapshot = { media: Record<string, unknown>; zoom: Record<string, unknown>; security: Record<string, unknown>; themeColor: string | null };

const listeners = new Map<string, Set<TabEventListener>>();
let listening: Promise<void> | null = null;

const listen = () =>
  (listening ??= loadCr().then((cr) =>
    (cr.addWebUiListener as unknown as (event: string, listener: (ref: string, kind: string, payload: Record<string, unknown>) => void) => void)(
      "astro-tab-event",
      (ref, kind, payload) => {
        for (const listener of listeners.get(ref) ?? []) listener(kind, payload);
      },
    ),
  ));

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
