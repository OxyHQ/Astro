// chrome.settingsPrivate, over the dev fixtures. DEV ONLY -- see ./state.ts.

import type {Pref, SettingsPrivateApi} from '../settings-private.ts';
import {allPrefs, onPrefsChanged, readPref, writePref} from './state.ts';

export function createSettingsPrivateMock(): SettingsPrivateApi {
  return {
    getAllPrefs: () => Promise.resolve(allPrefs()),
    getPref: (key: string): Promise<Pref> => {
      const pref = readPref(key);
      return pref
        ? Promise.resolve(pref)
        : Promise.reject(new Error(`no pref named "${key}" in the dev fixtures`));
    },
    setPref: (key, value) => Promise.resolve(writePref(key, value)),
    onPrefsChanged,
  };
}
