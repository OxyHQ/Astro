// The pref layer.
//
// Every setting comes from chrome.settingsPrivate, the same API Chromium's own
// settings page uses. Nothing is hand-mapped: getAllPrefs() returns the whole
// surface with each pref's type, value and policy enforcement, so a control can
// be rendered from the pref itself rather than from a table someone maintains.
//
// The page this replaces mapped 41 prefs by hand through a bespoke Mojo
// interface. That is why it was always missing something: the table was the
// product's memory of what exists, and it could only ever be a subset of what
// the browser actually has. Measured on this build, getAllPrefs() returns 157.

export const enum PrefType {
  BOOLEAN = 'BOOLEAN',
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  URL = 'URL',
  LIST = 'LIST',
  DICTIONARY = 'DICTIONARY',
}

export interface Pref {
  key: string;
  type: PrefType;
  value: unknown;
  /** Present only when a policy or extension controls the pref. */
  enforcement?: string;
  controlledBy?: string;
}

interface SettingsPrivate {
  getAllPrefs(callback: (prefs: Pref[]) => void): void;
  setPref(key: string, value: unknown, pageId: string,
          callback: (success: boolean) => void): void;
  onPrefsChanged: { addListener(callback: (prefs: Pref[]) => void): void };
}

function api(): SettingsPrivate {
  const chromeApi = (globalThis as { chrome?: { settingsPrivate?: SettingsPrivate } }).chrome;
  const settingsPrivate = chromeApi?.settingsPrivate;
  if (!settingsPrivate) {
    // Not a soft failure. settingsPrivate is granted to this page by a URL
    // pattern in the extension API feature files; if it is absent the grant did
    // not match, and every control on the page would silently render a default
    // instead of the user's actual setting.
    throw new Error(
        'chrome.settingsPrivate is unavailable: this origin was not granted ' +
        'the API. Check the matches patterns in _api_features.json.');
  }
  return settingsPrivate;
}

export function getAll(): Promise<Pref[]> {
  return new Promise(resolve => api().getAllPrefs(resolve));
}

export function set(key: string, value: unknown): Promise<boolean> {
  return new Promise(resolve => api().setPref(key, value, '', resolve));
}

export function onChanged(callback: (prefs: Pref[]) => void): void {
  api().onPrefsChanged.addListener(callback);
}
