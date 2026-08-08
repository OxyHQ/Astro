// The pref store the UI subscribes to.
//
// chrome.settingsPrivate is an external mutable source with its own change
// notification, so it is read through useSyncExternalStore rather than copied
// into component state: `getSnapshot` returns a reference that only changes
// when the browser says a pref changed, and every subscriber re-renders from
// the same snapshot. Holding prefs in a useState and refreshing them from an
// effect would let two controls disagree about the same pref.

import {getAll, onChanged, set, type Pref} from './prefs.ts';

type Snapshot = ReadonlyMap<string, Pref>;

let snapshot: Snapshot = new Map();
const listeners = new Set<() => void>();
let started = false;

function publish(prefs: Pref[]): void {
  // A NEW map each time, because useSyncExternalStore compares snapshots by
  // reference; mutating the existing one would leave every subscriber
  // convinced nothing had changed.
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
  // The listener is registered BEFORE the first read, so a pref changed while
  // the initial getAllPrefs is in flight is not lost.
  onChanged(publish);
  void getAll().then(publish);
}

export function subscribe(listener: () => void): () => void {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): Snapshot {
  return snapshot;
}

/**
 * Write a pref.
 *
 * No optimistic local update: the browser echoes the change back through
 * onPrefsChanged, and that echo is the single source the UI renders from. A
 * local guess would show the new value even when a policy refused the write.
 */
export function setPref(key: string, value: unknown): void {
  void set(key, value);
}
