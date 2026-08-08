// The saved-info store the UI subscribes to.
//
// Same shape and the same reasons as pref-store.ts: chrome.autofillPrivate is
// an external mutable source with its own change notification, so it is read
// through useSyncExternalStore rather than copied into component state. A list
// held in a useState and refreshed from an effect lets two screens disagree
// about the same record, and a memoising compiler is entitled to freeze the
// first value it computed from an out-of-band read.
//
// The snapshot starts UNDEFINED rather than as three empty arrays, and that
// distinction is the whole point: "the browser has not answered yet" and "you
// have no saved addresses" look identical once both are `[]`, and a screen that
// cannot tell them apart shows an empty state to someone whose data is still
// loading.

import {useSyncExternalStore} from 'react';

import {autofillPrivate, type PersonalData} from './autofill-private.ts';

let snapshot: PersonalData | undefined;
const listeners = new Set<() => void>();
let started = false;

function publish(next: PersonalData): void {
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
  void autofillPrivate().then(api => {
    // The observer is registered BEFORE the first read, so a change that lands
    // while the three list calls are in flight is not lost.
    api.onPersonalDataChanged(publish);
    void api.getPersonalData().then(publish);
  });
}

function subscribe(listener: () => void): () => void {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): PersonalData | undefined {
  return snapshot;
}

/** The saved addresses, cards and IBANs. Undefined until the browser answers. */
export function usePersonalData(): PersonalData | undefined {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/**
 * Forget a saved address.
 *
 * No optimistic removal: the browser echoes the new lists through
 * onPersonalDataChanged and that echo is the only thing that moves the store.
 * A local guess would show the row gone even where the delete was refused.
 */
export function removeAddress(guid: string): void {
  void autofillPrivate().then(api => api.removeAddress(guid));
}

/** Forget a saved card or IBAN. Same round trip as {@link removeAddress}. */
export function removePaymentsEntity(guid: string): void {
  void autofillPrivate().then(api => api.removePaymentsEntity(guid));
}
