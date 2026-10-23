import { emitNativeEvent } from "../../../demo/src/shims/expo-modules-core";

type Cr = {
  sendWithPromise<T>(method: string, ...args: unknown[]): Promise<T>;
  addWebUiListener(event: string, listener: (...args: string[]) => void): unknown;
};

declare const chrome: { send(method: string, args?: unknown[]): void };

let cr: Promise<Cr> | null = null;
const CR = "chrome://resources/js/cr.js";
export const loadCr = () => (cr ??= import(/* @vite-ignore */ CR) as Promise<Cr>);

export const DEFAULT_ENGINE_PROFILE = "";

export type EngineResult = Record<string, unknown> & { error?: string };

export async function engineCall(name: string, profile: string, args: string | null): Promise<string> {
  if (profile.includes("@")) return JSON.stringify({ error: "no engine data for a private profile" });
  return (await loadCr()).sendWithPromise<string>("astroEngineCall", name, args, profile);
}

export async function call(name: string, profile: string, args?: object): Promise<EngineResult> {
  const json = await engineCall(name, profile, args ? JSON.stringify(args) : null);
  try {
    const parsed = JSON.parse(json) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as EngineResult) : { error: "bad reply from the engine" };
  } catch {
    return { error: "bad reply from the engine" };
  }
}

export const pickFiles = async (kind: "files" | "folder" | "save", suggestedName?: string): Promise<string[]> =>
  (await (await loadCr()).sendWithPromise<string[]>("astroPickFiles", kind, ...(suggestedName ? [suggestedName] : []))) ?? [];

export async function boolPref(name: string, profile: string, value?: boolean): Promise<boolean> {
  if (profile !== DEFAULT_ENGINE_PROFILE) return true;
  const result = await (await loadCr()).sendWithPromise<boolean | null>("astroPref", name, value ?? null);
  return result ?? true;
}

let uiTopics: string[] = [];
const hostListeners = new Map<string, Set<(payload: Record<string, unknown>) => void>>();

const sendTopics = () => chrome.send("astroEngineTopics", [[...new Set([...uiTopics, ...hostListeners.keys()])]]);

export function forwardEngineTopics(topics: string[]) {
  uiTopics = topics;
  sendTopics();
}

export function onHostEngineEvent(topic: string, listener: (payload: Record<string, unknown>) => void) {
  const listeners = hostListeners.get(topic) ?? new Set();
  listeners.add(listener);
  hostListeners.set(topic, listeners);
  sendTopics();
}

export function startEngineEvents() {
  void loadCr().then((loaded) =>
    loaded.addWebUiListener("astro-engine-event", (topic, json) => {
      const payload = JSON.parse(json) as Record<string, unknown>;
      for (const listener of hostListeners.get(topic) ?? []) listener(payload);
      if (uiTopics.includes(topic)) emitNativeEvent("AstroCEF", "onEngineEvent", { topic, payload: JSON.stringify(payload) });
    }),
  );
}
