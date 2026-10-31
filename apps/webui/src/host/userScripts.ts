import type { UserScriptsFolder } from "@astro-browser-real/shell";
import { call, DEFAULT_ENGINE_PROFILE, onHostEngineEvent } from "./engine";

const TOPIC = "userScripts";

const listeners = new Set<() => void>();
let subscribed = false;

async function scriptsCall(method: string, args: Record<string, unknown> = {}) {
  const reply = await call("ac_user_scripts", DEFAULT_ENGINE_PROFILE, { method, ...args });
  if (typeof reply.error === "string") throw new Error(reply.error);
  return reply;
}

export const userScriptsAvailable = () => true;

export const watchUserScripts = (on: boolean) => void scriptsCall("watch", { on }).catch((error: unknown) => console.warn("[scripts] couldn't watch the Scripts folder", error));

export const readUserScripts = async (): Promise<UserScriptsFolder> => (await scriptsCall("read")) as unknown as UserScriptsFolder;

export const readUserScriptsStatus = async (): Promise<string | null> => {
  const { status } = await scriptsCall("readStatus");
  return typeof status === "string" ? status : null;
};

export const writeUserScriptsStatus = async (json: string): Promise<void> => void (await scriptsCall("writeStatus", { json }));

export function onUserScriptsChange(listener: () => void) {
  listeners.add(listener);
  if (!subscribed) {
    subscribed = true;
    onHostEngineEvent(TOPIC, () => {
      for (const notify of listeners) notify();
    });
  }
  return { remove: () => void listeners.delete(listener) };
}
