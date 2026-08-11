// The ad blocker page's state, live, from the browser.
//
// Same shape as the new tab page's store and for the same reasons: one
// `useSyncExternalStore` over a typed Mojo transport, nothing kept page-side,
// and every change rendered from the browser's ECHO rather than from an
// optimistic local guess.
//
// What that buys here is specific. Three of the four values move without this
// page doing anything: the blocked count climbs on every request the throttle
// cancels in any tab, the site exceptions change when the toolbar shield is
// used in another window, and the master switch is a profile preference a
// second settings window can write. The page this replaces asked once, on load,
// and had no way to hear any of it -- so a number it showed was only ever true
// for the instant it arrived.

import {MissingBrowserApiError} from '@astro/platform';
import {useSyncExternalStore} from 'react';

/** One list in the browser's compiled-in catalogue. */
export interface FilterList {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /**
   * Whether the browser fetches and applies this one.
   *
   * The catalogue's `default_enabled`, which is also exactly the set the
   * updater downloads. There is no per-list preference anywhere in the browser,
   * so this is a fact about the build and not a state a control could change.
   */
  readonly fetched: boolean;
}

export interface AdBlockState {
  /**
   * Whether the browser has answered yet.
   *
   * Distinguishes "no exceptions" from "not asked yet" -- the difference
   * between an empty list a person can trust and a frame of the page they
   * should not be shown.
   */
  readonly ready: boolean;
  readonly enabled: boolean;
  readonly blockedCount: number;
  readonly filterLists: readonly FilterList[];
  /** Hosts with blocking switched off. Sorted by the browser. */
  readonly disabledSites: readonly string[];
  readonly customRules: string;
}

/** Everything the browser side of the ad blocker page provides. */
export interface AdBlockSource {
  getState(): Promise<Omit<AdBlockState, 'ready'>>;
  /** Returns the unsubscribe. */
  onChanged(listener: (patch: Partial<AdBlockState>) => void): () => void;

  setEnabled(enabled: boolean): void;
  /** Resolves false when nothing was stored -- see astro_adblock.mojom. */
  removeSiteException(host: string): Promise<boolean>;
  setCustomRules(rules: string): Promise<boolean>;
}

const EMPTY: AdBlockState = {
  ready: false,
  // Not `true`. The default IS true, but rendering the switch on before the
  // browser has answered means a profile with blocking off shows it on for a
  // frame -- which is the one direction of that mistake that matters.
  enabled: false,
  blockedCount: 0,
  filterLists: [],
  disabledSites: [],
  customRules: '',
};

let snapshot: AdBlockState = EMPTY;
const listeners = new Set<() => void>();
let started = false;
let resolved: Promise<AdBlockSource> | undefined;

function publish(patch: Partial<AdBlockState>): void {
  snapshot = {...snapshot, ...patch};
  for (const listener of listeners) {
    listener();
  }
}

function adBlockSource(): Promise<AdBlockSource> {
  resolved ??= (async () => {
    // `Mojo` is the global a renderer installs for a page whose controller
    // enabled Mojo bindings. Feature-detected rather than inferred from the URL
    // or the build mode: those say where the page came from, this says whether
    // there is a pipe to bind.
    if ('Mojo' in globalThis) {
      const {createAdBlockSource} = await import('./adblock-mojo.ts');
      return createAdBlockSource();
    }
    if (import.meta.env.DEV) {
      const {createAdBlockMock} = await import('./mock.ts');
      return createAdBlockMock();
    }
    throw new MissingBrowserApiError(
      'astro_adblock.mojom',
      'Mojo bindings are not enabled on this page, so no interface its C++ ' +
        'controller binds can be reached from it.',
    );
  })();
  return resolved;
}

function start(): void {
  if (started) {
    return;
  }
  started = true;
  void adBlockSource().then(source => {
    source.onChanged(publish);
    void source.getState().then(state => {
      publish({...state, ready: true});
    });
  });
}

export function subscribe(listener: () => void): () => void {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): AdBlockState {
  return snapshot;
}

/** The live ad blocker state. */
export function useAdBlock(): AdBlockState {
  return useSyncExternalStore(subscribe, getSnapshot);
}

// The writes. None of them touches `snapshot`: each goes to the browser and
// comes back through the observer, so what the page shows is what the browser
// stored -- including when it stored nothing.

export function setEnabled(enabled: boolean): void {
  void adBlockSource().then(source => source.setEnabled(enabled));
}

export function removeSiteException(host: string): Promise<boolean> {
  return adBlockSource().then(source => source.removeSiteException(host));
}

export function setCustomRules(rules: string): Promise<boolean> {
  return adBlockSource().then(source => source.setCustomRules(rules));
}
