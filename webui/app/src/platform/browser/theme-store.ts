// The theme, live, on every astro:// page.
//
// One store, one contract, and deliberately NOT the pref API. Reading the
// theme has to work on the new tab page and inside a side panel, not only on
// settings -- and chrome.settingsPrivate is granted per host, so a theme built
// on it would light up exactly one page. Its own pref is also absent from that
// API's allowlist (see pref-ids.ts), so even on settings the read would return
// nothing. The transport is a narrow typed Mojo interface bound by every Astro
// page controller: `GetTheme()`, `SetThemeMode()`, `SetColorPreset()` and an
// `OnThemeChanged` observer.
//
// The observer is what makes the theming LIVE: the browser echoes a change
// back, this store publishes a new snapshot, and the BloomThemeProvider at the
// root of every open page re-renders with new props. Nothing reloads, and
// nothing is persisted page-side -- the browser's prefs are the only copy, so
// the native toolbar and the WebUI pages cannot drift apart. There is no
// localStorage anywhere in this path, by design.

import {APP_COLOR_NAMES, type AppColorName} from '@oxyhq/bloom/color-presets';
import {useSyncExternalStore} from 'react';

import {MissingBrowserApiError} from './env.ts';

/**
 * Bloom's ThemeMode without `adaptive`.
 *
 * The browser's own scheme pref is a three-way (system/light/dark) and it is
 * what drives the native UI; a fourth mode the browser cannot represent would
 * be a page-only state, which is the drift this store exists to prevent.
 */
export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * The theme as it comes off the wire.
 *
 * `preset` is a bare string here and an `AppColorName` in {@link ThemeState}:
 * the browser stores whatever name was written into the profile, and only this
 * store gets to decide whether this build of Bloom still has that colour.
 */
export interface RawTheme {
  readonly mode: ThemeMode;
  readonly preset: string;
}

export interface ThemeState {
  readonly mode: ThemeMode;
  readonly preset: AppColorName;
}

/** What the browser side of the theme provides. */
export interface ThemeSource {
  getTheme(): Promise<RawTheme>;
  setMode(mode: ThemeMode): Promise<void>;
  setPreset(preset: AppColorName): Promise<void>;
  /** Returns the unsubscribe. */
  onThemeChanged(listener: (theme: RawTheme) => void): () => void;
}

/** What a page renders with until the browser has answered. */
const DEFAULT_THEME: ThemeState = {mode: 'system', preset: 'oxy'};

/**
 * A preset name the browser reported that this Bloom does not have.
 *
 * Normalised rather than thrown on: the value crosses a version boundary --
 * a profile can carry a preset written by a build with a newer Bloom, or one
 * whose preset was renamed -- and the right response to an unknown colour is
 * the default colour, not a browser page that refuses to render.
 */
function asPreset(value: string): AppColorName {
  return (APP_COLOR_NAMES as readonly string[]).includes(value)
    ? (value as AppColorName)
    : DEFAULT_THEME.preset;
}

let snapshot: ThemeState = DEFAULT_THEME;
const listeners = new Set<() => void>();
let started = false;
let resolved: Promise<ThemeSource> | undefined;

function publish(next: RawTheme): void {
  const preset = asPreset(next.preset);
  if (next.mode === snapshot.mode && preset === snapshot.preset) {
    // The snapshot reference has to be stable while the value is unchanged, or
    // useSyncExternalStore re-renders every subscriber on every echo.
    return;
  }
  snapshot = {mode: next.mode, preset};
  for (const listener of listeners) {
    listener();
  }
}

function themeSource(): Promise<ThemeSource> {
  resolved ??= (async () => {
    // The real binding lands with the //astro module's astro_theme.mojom
    // target; see ./mojo/index.ts for how its generated bindings reach this
    // bundle. Until then a browser-served page has no theme transport and says
    // so, rather than rendering in a colour nobody chose.
    if (import.meta.env.DEV) {
      const {createThemeMock} = await import('./mock/theme.ts');
      return createThemeMock();
    }
    throw new MissingBrowserApiError(
      'astro_theme.mojom',
      'The interface is bound by the page\'s C++ controller; this page was ' +
        'served by one that does not bind it.',
    );
  })();
  return resolved;
}

function start(): void {
  if (started) {
    return;
  }
  started = true;
  void themeSource().then(source => {
    source.onThemeChanged(publish);
    void source.getTheme().then(publish);
  });
}

export function subscribe(listener: () => void): () => void {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): ThemeState {
  return snapshot;
}

/** The live theme. Drives BloomThemeProvider's props at the root of every page. */
export function useThemeState(): ThemeState {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/**
 * Change the scheme.
 *
 * Nothing is applied locally: the browser writes the pref, re-themes its own
 * UI and echoes back through the observer, and that echo is what moves this
 * store. A local guess would show a scheme a policy had refused.
 */
export function setMode(mode: ThemeMode): void {
  void themeSource().then(source => source.setMode(mode));
}

/** Change the colour preset. Same round trip as {@link setMode}. */
export function setPreset(preset: AppColorName): void {
  void themeSource().then(source => source.setPreset(preset));
}
