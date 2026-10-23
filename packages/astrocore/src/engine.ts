import type { EventSubscription } from "expo-modules-core";
import { Cef } from "./native";

export async function engineCall<T>(name: string, profile: string, args?: object): Promise<T> {
  const result = JSON.parse(await Cef.engineCall(name, profile, args ? JSON.stringify(args) : null)) as T | { error: string };
  if (result && typeof result === "object" && "error" in result) throw new Error(`${name}: ${result.error}`);
  return result as T;
}

export type EnginePayload = { profile: string } & Record<string, unknown>;
type EngineListener = (payload: EnginePayload) => void;

const engineListeners = new Map<string, Set<EngineListener>>();
let engineSubscription: EventSubscription | null = null;

function deliverEngineEvent({ topic, payload }: { topic: string; payload: string }) {
  const listeners = engineListeners.get(topic);
  if (!listeners?.size) return;
  const parsed = JSON.parse(payload) as EnginePayload;
  for (const listener of listeners) listener(parsed);
}

const forwardEngineTopics = () => void Cef.forwardEngineTopics?.([...engineListeners.keys()]);

function stopListening(topic: string, listeners: Set<EngineListener>, listener: EngineListener) {
  if (!listeners.delete(listener) || listeners.size || engineListeners.get(topic) !== listeners) return;
  engineListeners.delete(topic);
  forwardEngineTopics();
  if (engineListeners.size) return;
  engineSubscription?.remove();
  engineSubscription = null;
}

export function onEngineEvent(topic: string, listener: EngineListener): EventSubscription {
  let listeners = engineListeners.get(topic);
  if (!listeners) {
    listeners = new Set();
    engineListeners.set(topic, listeners);
    forwardEngineTopics();
  }
  listeners.add(listener);
  engineSubscription ??= Cef.addListener("onEngineEvent", deliverEngineEvent);
  const subscribed = listeners;
  return { remove: () => stopListening(topic, subscribed, listener) };
}
