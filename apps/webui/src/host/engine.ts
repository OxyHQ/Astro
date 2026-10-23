import { emitNativeEvent } from "../../../demo/src/shims/expo-modules-core";

type Cr = {
  sendWithPromise<T>(method: string, ...args: unknown[]): Promise<T>;
  addWebUiListener(event: string, listener: (...args: string[]) => void): unknown;
};

declare const chrome: { send(method: string, args?: unknown[]): void };

let cr: Promise<Cr> | null = null;
const CR = "chrome://resources/js/cr.js";
const loadCr = () => (cr ??= import(/* @vite-ignore */ CR) as Promise<Cr>);

const DEFAULT_ENGINE_PROFILE = "";

export async function engineCall(name: string, profile: string, args: string | null): Promise<string> {
  if (profile !== DEFAULT_ENGINE_PROFILE) return JSON.stringify({ error: "profile not loaded" });
  return (await loadCr()).sendWithPromise<string>("astroEngineCall", name, args);
}

export function forwardEngineTopics(topics: string[]) {
  chrome.send("astroEngineTopics", [topics]);
}

export function startEngineEvents() {
  void loadCr().then((loaded) =>
    loaded.addWebUiListener("astro-engine-event", (topic, json) => {
      const payload = JSON.parse(json) as Record<string, unknown>;
      emitNativeEvent("AstroCEF", "onEngineEvent", { topic, payload: JSON.stringify({ ...payload, profile: DEFAULT_ENGINE_PROFILE }) });
    }),
  );
}
