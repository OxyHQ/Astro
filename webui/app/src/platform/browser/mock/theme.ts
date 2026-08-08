// astro_theme.mojom, over the dev fixtures. DEV ONLY -- see ./state.ts.
//
// This mock stands in for the C++ side, so it also does the C++ side's job of
// translating between the interface and the prefs behind it: the browser's
// scheme pref is a ThemeService::BrowserColorScheme integer, and the interface
// speaks a mode. Doing that translation here rather than in theme-store.ts is
// what keeps the store honest -- when the real binding replaces this file, the
// store does not learn that a pref was ever involved.

import {
  COLOR_SCHEME_DARK,
  COLOR_SCHEME_LIGHT,
  COLOR_SCHEME_PREF,
  COLOR_SCHEME_SYSTEM,
  THEME_PRESET_PREF,
} from '../pref-ids.ts';
import type {RawTheme, ThemeMode, ThemeSource} from '../theme-store.ts';
import {onPrefsChanged, readPref, writePref} from './state.ts';

function toMode(value: unknown): ThemeMode {
  switch (value) {
    case COLOR_SCHEME_LIGHT:
      return 'light';
    case COLOR_SCHEME_DARK:
      return 'dark';
    default:
      return 'system';
  }
}

function toColorScheme(mode: ThemeMode): number {
  switch (mode) {
    case 'light':
      return COLOR_SCHEME_LIGHT;
    case 'dark':
      return COLOR_SCHEME_DARK;
    case 'system':
      return COLOR_SCHEME_SYSTEM;
  }
}

function currentTheme(): RawTheme {
  return {
    mode: toMode(readPref(COLOR_SCHEME_PREF)?.value),
    preset: String(readPref(THEME_PRESET_PREF)?.value ?? ''),
  };
}

export function createThemeMock(): ThemeSource {
  return {
    getTheme: () => Promise.resolve(currentTheme()),
    setMode: mode => {
      writePref(COLOR_SCHEME_PREF, toColorScheme(mode));
      return Promise.resolve();
    },
    setPreset: preset => {
      writePref(THEME_PRESET_PREF, preset);
      return Promise.resolve();
    },
    // Every pref write notifies; the store drops an echo that did not change
    // the theme, exactly as it will for the real observer.
    onThemeChanged: listener => onPrefsChanged(() => listener(currentTheme())),
  };
}
