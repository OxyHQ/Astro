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
//
// The VALUES come from the sections, one file each (./sections.ts). This module
// owns only what the browser does with them: refuse a write a policy forbids,
// refuse a value of the wrong type, and notify.

import type {Pref} from '../settings-private.ts';
import {fixturePrefs} from './sections.ts';

const prefs = new Map<string, Pref>(fixturePrefs().map(pref => [pref.key, pref]));
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
