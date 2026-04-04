// ── Settings state management (localStorage-backed) ──

const STORAGE_KEY = "astro-settings";

interface SettingsStore {
  [key: string]: string | number | boolean;
}

let cache: SettingsStore | null = null;

function loadStore(): SettingsStore {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as SettingsStore) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function saveStore(): void {
  if (!cache) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
}

export function getSettingValue<T extends string | number | boolean>(
  key: string,
  defaultValue: T,
): T {
  const store = loadStore();
  const val = store[key];
  if (val === undefined) return defaultValue;
  return val as T;
}

export function setSettingValue(
  key: string,
  value: string | number | boolean,
): void {
  const store = loadStore();
  store[key] = value;
  saveStore();
}

export function getAllSettings(): SettingsStore {
  return { ...loadStore() };
}
