// The pref store the UI subscribes to.
//
// chrome.settingsPrivate is an external mutable source with its own change
// notification, so it is read through useSyncExternalStore rather than copied
// into component state: getSnapshot returns a reference that changes only when
// the browser says a pref changed, and every subscriber re-renders from the
// same snapshot. Prefs held in a useState and refreshed from an effect let two
// controls disagree about the same pref, and a memoising compiler is entitled
// to freeze the first value it computed from an out-of-band read.

import {useSyncExternalStore} from 'react';

import {settingsPrivate, type Pref} from './settings-private.ts';

type Snapshot = ReadonlyMap<string, Pref>;

let snapshot: Snapshot = new Map();
const listeners = new Set<() => void>();
let started = false;

function publish(prefs: readonly Pref[]): void {
  // A NEW map each time: useSyncExternalStore compares snapshots by reference,
  // and mutating the existing one would leave every subscriber convinced
  // nothing had changed.
  const next = new Map(snapshot);
  for (const pref of prefs) {
    next.set(pref.key, pref);
  }
  snapshot = next;
  for (const listener of listeners) {
    listener();
  }
}

function start(): void {
  if (started) {
    return;
  }
  started = true;
  void settingsPrivate().then(api => {
    // The change listener is registered BEFORE the first read, so a pref that
    // changes while getAllPrefs is in flight is not lost.
    api.onPrefsChanged(publish);
    void api.getAllPrefs().then(publish);
  });
}

export function subscribe(listener: () => void): () => void {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): Snapshot {
  return snapshot;
}

/**
 * One pref, live.
 *
 * Undefined until the browser has reported it -- which is also the honest
 * answer for a pref this profile does not have. A control renders itself
 * unavailable rather than inventing a default.
 */
export function usePref(key: string): Pref | undefined {
  return useSyncExternalStore(subscribe, () => snapshot.get(key));
}

/**
 * Write a pref.
 *
 * No optimistic local update: the browser echoes the change back through
 * onPrefsChanged and that echo is the single source the UI renders from. A
 * local guess would show the new value even where a policy refused the write.
 */
export function setPref(key: string, value: unknown): void {
  void settingsPrivate().then(api => api.setPref(key, value));
}
