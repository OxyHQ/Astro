// Where inside a page the user is.
//
// A host is a whole page (`astro://settings`); a section within it is a
// FRAGMENT (`astro://settings/#/privacy`). The fragment, not a path segment,
// because a WebUI data source serves one document per host and a real sub-path
// would have to be routed in C++ before this bundle ever runs -- a page that
// cannot deep-link until someone edits a `WebUIDataSource` is a page that will
// not deep-link.
//
// The fragment is a PATH, kept in the shape upstream Chromium uses for its own
// settings routes (`/privacy`, `/clearBrowserData`, `/content/cookies`), so a
// section can claim upstream's literal spelling as an alias and a bookmark or
// a link out of the browser's own UI lands somewhere real instead of on the
// default section. Resolving a path to a section is the page's job; this
// module only owns reading, writing and observing the value.

import {useSyncExternalStore} from 'react';

/** The current fragment, normalised to a leading slash. `'/'` when absent. */
function read(): string {
  const raw = location.hash.slice(1);
  if (raw === '') {
    return '/';
  }
  return raw.startsWith('/') ? raw : `/${raw}`;
}

let snapshot = read();
const listeners = new Set<() => void>();
let started = false;

function onHashChange(): void {
  const next = read();
  if (next === snapshot) {
    // Stable reference while unchanged, or every subscriber re-renders on a
    // fragment write that did not move anything.
    return;
  }
  snapshot = next;
  for (const listener of listeners) {
    listener();
  }
}

/**
 * One `hashchange` listener for the document, not one per subscriber.
 *
 * The per-subscriber form looks equivalent and is not: each listener would
 * compare against the same module snapshot, so the first to run would update
 * it and every later one would see its own read as unchanged and notify
 * nobody. Exactly one component would re-render.
 */
function subscribe(listener: () => void): () => void {
  if (!started) {
    started = true;
    window.addEventListener('hashchange', onHashChange);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): string {
  return snapshot;
}

/** The live fragment path. */
export function useHashPath(): string {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/**
 * Go to a fragment path.
 *
 * A history entry, not a replacement: the browser's Back button is how a user
 * leaves a section they opened, and upstream settings behaves the same way.
 */
export function setHashPath(path: string): void {
  location.hash = path;
}
