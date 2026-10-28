import { create } from "zustand";
import { alia, aliaReady } from "./api";

export type ResponseLength = "short" | "medium" | "long";

export type MemoryEntry = { _id: string; title: string; summary: string; type: "profile" | "topic" | "person"; createdAt?: string; updatedAt?: string };

export type MemoryContext = { occupation: string; location: string; timezone: string; bio: string };

export type MemoryPreferences = { language: string; tone: string; responseLength: ResponseLength | ""; interests: string[] };

export type MemorySettings = { autoSaveEnabled: boolean; recallEnabled: boolean };

export type MemoryProfile = { memories: MemoryEntry[]; context: MemoryContext; preferences: MemoryPreferences; settings: MemorySettings };

export const UNSET = "default";

export const fromOption = (value: string) => (value === UNSET ? "" : value);

export const toOption = (value: string) => value || UNSET;

export const TONES = [
  { value: UNSET, title: "Default" },
  { value: "friendly", title: "Friendly" },
  { value: "professional", title: "Professional" },
  { value: "concise", title: "Concise" },
  { value: "casual", title: "Casual" },
];

export const RESPONSE_LENGTHS = [
  { value: UNSET, title: "Default" },
  { value: "short", title: "Short" },
  { value: "medium", title: "Medium" },
  { value: "long", title: "Long" },
];

export const LANGUAGES = [
  { value: UNSET, title: "The language I write in" },
  { value: "en-US", title: "English" },
  { value: "es-ES", title: "Español" },
  { value: "fr-FR", title: "Français" },
  { value: "de-DE", title: "Deutsch" },
  { value: "it-IT", title: "Italiano" },
  { value: "pt-BR", title: "Português" },
  { value: "zh-CN", title: "中文" },
  { value: "ja-JP", title: "日本語" },
  { value: "ko-KR", title: "한국어" },
  { value: "ru-RU", title: "Русский" },
  { value: "ar-SA", title: "العربية" },
  { value: "hi-IN", title: "हिन्दी" },
];

type Raw = Record<string, unknown>;

const str = (v: unknown) => (typeof v === "string" ? v : "");
const obj = (v: unknown): Raw => (v && typeof v === "object" ? (v as Raw) : {});

export function memoryProfileOf(raw: unknown): MemoryProfile {
  const r = obj(raw);
  const context = obj(r.context);
  const preferences = obj(r.preferences);
  const settings = obj(r.settings);
  const length = str(preferences.responseLength);
  return {
    memories: (Array.isArray(r.memories) ? r.memories : []).flatMap((m): MemoryEntry[] => {
      const e = obj(m);
      const id = str(e._id) || str(e.id);
      const type = str(e.type);
      return id && str(e.title)
        ? [{ _id: id, title: str(e.title), summary: str(e.summary), type: type === "topic" || type === "person" ? type : "profile", createdAt: str(e.createdAt), updatedAt: str(e.updatedAt) }]
        : [];
    }),
    context: { occupation: str(context.occupation), location: str(context.location), timezone: str(context.timezone), bio: str(context.bio) },
    preferences: {
      language: str(preferences.language),
      tone: str(preferences.tone),
      responseLength: length === "short" || length === "medium" || length === "long" ? length : "",
      interests: Array.isArray(preferences.interests) ? preferences.interests.filter((i): i is string => typeof i === "string") : [],
    },
    settings: { autoSaveEnabled: settings.autoSaveEnabled !== false, recallEnabled: settings.recallEnabled !== false },
  };
}

export const interestsOf = (text: string) => [...new Set(text.split(",").map((i) => i.trim()).filter(Boolean))].slice(0, 30);

const orNull = (v: string) => (v.trim() ? v.trim() : null);

export function contextBody(c: MemoryContext) {
  return { occupation: orNull(c.occupation), location: orNull(c.location), timezone: orNull(c.timezone), bio: orNull(c.bio) };
}

export function preferencesBody(p: MemoryPreferences) {
  return { language: orNull(p.language), tone: orNull(p.tone), responseLength: p.responseLength || null, interests: p.interests };
}

type MemoryState = { profile: MemoryProfile | null; loading: boolean; error: string | null; owner: string | null };

export const useMemoryProfile = create<MemoryState>()(() => ({ profile: null, loading: false, error: null, owner: null }));

export async function refreshMemory(): Promise<void> {
  if (!aliaReady()) return;
  useMemoryProfile.setState({ loading: true });
  try {
    const r = await alia().get<unknown>("/memory");
    useMemoryProfile.setState({ profile: memoryProfileOf(r.data), loading: false, error: null });
  } catch {
    useMemoryProfile.setState({ loading: false, error: "Your personalization couldn't be loaded." });
  }
}

const current = () => useMemoryProfile.getState().profile;

async function write(change: (p: MemoryProfile) => MemoryProfile, send: (p: MemoryProfile) => Promise<unknown>) {
  const before = current();
  if (!before) return;
  const next = change(before);
  useMemoryProfile.setState({ profile: next, error: null });
  try {
    await send(next);
  } catch {
    useMemoryProfile.setState({ profile: before, error: "That change couldn't be saved." });
  }
}

export const saveContext = (patch: Partial<MemoryContext>) =>
  write(
    (p) => ({ ...p, context: { ...p.context, ...patch } }),
    (p) => alia().put("/memory/context", contextBody(p.context)),
  );

export const savePreferences = (patch: Partial<MemoryPreferences>) =>
  write(
    (p) => ({ ...p, preferences: { ...p.preferences, ...patch } }),
    (p) => alia().put("/memory/preferences", preferencesBody(p.preferences)),
  );

export const saveMemorySettings = (patch: Partial<MemorySettings>) =>
  write(
    (p) => ({ ...p, settings: { ...p.settings, ...patch } }),
    () => alia().put("/memory/settings", patch),
  );

export const forgetMemory = (id: string) =>
  write(
    (p) => ({ ...p, memories: p.memories.filter((m) => m._id !== id) }),
    () => alia().delete(`/memory/${encodeURIComponent(id)}`),
  );

export function forgetMemoryProfile() {
  useMemoryProfile.setState({ profile: null, loading: false, error: null, owner: null });
}
