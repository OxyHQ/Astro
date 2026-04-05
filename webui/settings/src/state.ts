// ── Settings state management ──
//
// When running inside Astro (astro://settings), settings are read from
// and written to the real Chromium PrefService via chrome.send().
// When running standalone (Vite dev server), falls back to localStorage.

const STORAGE_KEY = "astro-settings";

// Detect whether we're running inside a WebUI context.
// chrome.send exists only when the page is served by the browser's
// WebUI infrastructure, not in regular web pages or the dev server.
const IS_WEBUI =
  typeof chrome !== "undefined" &&
  typeof chrome.send === "function";

// ── Type declarations for the WebUI bridge ──

declare global {
  interface Window {
    // The browser calls these to deliver resolved values back from
    // ResolveJavascriptCallback / CallJavascriptFunction.
    cr?: {
      webUIResponse?: (
        callbackId: string,
        success: boolean,
        value: unknown,
      ) => void;
    };
  }
}

// ── Promise-based chrome.send wrappers ──

// Pending promise resolvers keyed by callback ID.
const pendingCallbacks = new Map<string, (value: unknown) => void>();
let callbackCounter = 0;

// Install the global resolver that Chromium's ResolveJavascriptCallback
// will invoke.  This follows the standard cr.webUIResponse protocol.
if (IS_WEBUI) {
  if (!window.cr) {
    window.cr = {};
  }
  window.cr.webUIResponse = (
    callbackId: string,
    _success: boolean,
    value: unknown,
  ) => {
    const resolve = pendingCallbacks.get(callbackId);
    if (resolve) {
      pendingCallbacks.delete(callbackId);
      resolve(value);
    }
  };
}

function sendWithCallback(method: string, ...args: unknown[]): Promise<unknown> {
  const callbackId = `astro_settings_${++callbackCounter}`;
  return new Promise((resolve) => {
    pendingCallbacks.set(callbackId, resolve);
    chrome.send(method, [callbackId, ...args]);
  });
}

// ── Browser pref read/write ──

function setPrefInBrowser(key: string, value: string | number | boolean): void {
  if (IS_WEBUI) {
    chrome.send("setPref", [key, value]);
  }
}

function getPrefFromBrowser(key: string): Promise<unknown> {
  if (!IS_WEBUI) {
    return Promise.resolve(undefined);
  }
  return sendWithCallback("getPref", key);
}

function getAllPrefsFromBrowser(): Promise<Record<string, unknown>> {
  if (!IS_WEBUI) {
    return Promise.resolve({});
  }
  return sendWithCallback("getAllPrefs") as Promise<Record<string, unknown>>;
}

// ── localStorage fallback (dev mode) ──

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

// ── Public API ──

/**
 * Read a setting value synchronously.
 *
 * In dev mode this reads from localStorage.  In WebUI mode the initial
 * values are hydrated from PrefService via initFromBrowser(), and
 * subsequent reads come from the in-memory cache.
 */
export function getSettingValue<T extends string | number | boolean>(
  key: string,
  defaultValue: T,
): T {
  const store = loadStore();
  const val = store[key];
  if (val === undefined) return defaultValue;
  return val as T;
}

/**
 * Write a setting value.
 *
 * Always updates the local cache/localStorage.  When running inside
 * Astro, also pushes the value to PrefService via chrome.send().
 */
export function setSettingValue(
  key: string,
  value: string | number | boolean,
): void {
  const store = loadStore();
  store[key] = value;
  saveStore();

  // Push to the real browser prefs when available.
  setPrefInBrowser(key, value);
}

/**
 * Return a shallow copy of all settings.
 */
export function getAllSettings(): SettingsStore {
  return { ...loadStore() };
}

/**
 * Hydrate the local cache from PrefService.
 *
 * Called once at startup when running inside astro://settings.
 * This ensures the UI reflects the actual browser state rather than
 * stale localStorage values from a previous session.
 *
 * Returns true if hydration happened, false if we're in dev mode.
 */
export async function initFromBrowser(): Promise<boolean> {
  if (!IS_WEBUI) {
    return false;
  }

  const prefs = await getAllPrefsFromBrowser();
  const store = loadStore();

  for (const [key, value] of Object.entries(prefs)) {
    if (value !== null && value !== undefined) {
      store[key] = value as string | number | boolean;
    }
  }

  saveStore();
  return true;
}

/**
 * Whether we're running inside the browser's WebUI.
 */
export const isWebUI = IS_WEBUI;
