import type { DisplayMediaRequest, DisplayMediaSource } from "@astro-browser-real/astrocore";

const MAX_PENDING = 16;
const pending = new Map<string, DisplayMediaSource[]>();

const sourcesOf = (payload: Record<string, unknown>) => (Array.isArray(payload.sources) ? (payload.sources as DisplayMediaSource[]) : []);

export function noteDisplayMediaRequest(payload: Record<string, unknown>): DisplayMediaRequest {
  const request = { id: String(payload.id ?? ""), origin: String(payload.origin ?? ""), audio: payload.audio === true, sources: sourcesOf(payload) };
  pending.delete(request.id);
  pending.set(request.id, request.sources);
  for (const id of pending.keys()) if (pending.size > MAX_PENDING) pending.delete(id);
  return request;
}

export function noteDisplayMediaSources(payload: Record<string, unknown>) {
  const id = String(payload.id ?? "");
  if (pending.has(id)) pending.set(id, sourcesOf(payload));
}

export const forgetDisplayMedia = (id: string) => void pending.delete(id);

export const displayMediaServices = {
  displayMediaSources: async () => [...pending.values()].at(-1) ?? [],
  setDisplayMediaPicker: async () => {},
};
