// The browser, as far as a dev server is concerned.
//
// DEV ONLY. Every module in this directory is reached exclusively from a
// dynamic import inside an `import.meta.env.DEV` branch, which Vite eliminates
// in a build -- so none of these fixtures, and no fake policy state, is
// emitted into a bundle the browser ships. See ../env.ts.
//
// ONE state, two views. `settings-private.ts` presents it as the prefs API and
// `theme.ts` as the theme interface, over the same map, because in the real
// browser they are two windows onto one PrefService: the settings page writes
// the scheme, the browser re-themes, and every open page hears about it. Two
// independent mocks would let the appearance control move while the page it is
// on stayed the colour it started, and the dev loop would be testing a
// disconnection that does not exist in production.

import {COLOR_SCHEME_PREF, COLOR_SCHEME_SYSTEM, THEME_PRESET_PREF} from '../pref-ids.ts';
import type {Pref} from '../settings-private.ts';

/**
 * The fixtures.
 *
 * Real pref paths, and real allowlist membership: every Chromium pref here is
 * one of the 448 entries in prefs_util.cc, so a control built against it keeps
 * working when the mock is replaced by the browser. The two theme prefs are
 * NOT allowlisted -- they are here because the theme mock reads the same map,
 * not because settingsPrivate would ever serve them.
 *
 * The set is chosen to make every rendering path drivable without C++: one
 * plain toggle, one a policy has ENFORCED (the control must lock and say who
 * locked it), and one a policy merely RECOMMENDS (the control must stay usable
 * and still show the recommendation).
 */
const FIXTURES: readonly Pref[] = [
  {key: 'enable_do_not_track', type: 'BOOLEAN', value: false},
  {key: 'profile.password_manager_leak_detection', type: 'BOOLEAN', value: true},
  {
    key: 'https_only_mode_enabled',
    type: 'BOOLEAN',
    value: true,
    controlledBy: 'USER_POLICY',
    controlledByName: 'Astro dev policy',
    enforcement: 'ENFORCED',
  },
  {
    key: 'search.suggest_enabled',
    type: 'BOOLEAN',
    value: false,
    controlledBy: 'USER_POLICY',
    controlledByName: 'Astro dev policy',
    enforcement: 'RECOMMENDED',
    recommendedValue: true,
  },
  {key: COLOR_SCHEME_PREF, type: 'NUMBER', value: COLOR_SCHEME_SYSTEM},
  {key: THEME_PRESET_PREF, type: 'STRING', value: 'oxy'},
];

const prefs = new Map<string, Pref>(FIXTURES.map(pref => [pref.key, pref]));
const listeners = new Set<(changed: readonly Pref[]) => void>();

export function allPrefs(): readonly Pref[] {
  return [...prefs.values()];
}

export function readPref(key: string): Pref | undefined {
  return prefs.get(key);
}

/**
 * Write a pref, as the browser would.
 *
 * Refuses an ENFORCED pref and a value of the wrong type, because both are
 * refusals the real API makes silently -- a control that only ever gets its
 * way in dev is a control whose disabled state nobody has looked at.
 */
export function writePref(key: string, value: unknown): boolean {
  const pref = prefs.get(key);
  if (!pref || pref.enforcement === 'ENFORCED') {
    return false;
  }
  const expected =
    pref.type === 'BOOLEAN' ? 'boolean' : pref.type === 'NUMBER' ? 'number' : 'string';
  if (typeof value !== expected) {
    return false;
  }
  const next: Pref = {...pref, value};
  prefs.set(key, next);
  for (const listener of listeners) {
    listener([next]);
  }
  return true;
}

export function onPrefsChanged(listener: (changed: readonly Pref[]) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
