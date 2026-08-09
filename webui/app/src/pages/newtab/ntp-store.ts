// The new tab page's state, live, from the browser.
//
// Same shape as the theme store and for the same reasons: one
// `useSyncExternalStore` over a typed Mojo transport, nothing persisted
// page-side, and every change rendered from the browser's ECHO rather than
// from an optimistic local guess. What that buys here is concrete — the ad
// blocker's count climbs while this tab sits in the background, another window
// can hide a widget, and an enterprise policy can refuse a search-engine
// change. All three arrive the same way.
//
// THE LOCALSTORAGE IS GONE, deliberately and completely. The page this
// replaces kept its notes, its links, its widget order, its chosen search
// engine and a cached weather reading in localStorage, which meant the browser
// could not see any of it: it could not validate a URL before the page
// rendered it as a link, could not show the same note in two windows (each
// WebUI host is its own origin), and could not carry any of it into a new
// profile. #22 requires that obsolete frontend storage not remain as a second
// source of truth, and nothing in this directory writes to it.

import {MissingBrowserApiError} from '@astro/platform';
import {useSyncExternalStore} from 'react';

/**
 * The widgets the grid lays out.
 *
 * Mirrors `astro.ntp.mojom.WidgetId`. Spelled as strings here and mapped to
 * the enum in the transport, so the page's own code — and the widget order
 * stored in the profile — read as names rather than as ordinals nobody can
 * check.
 */
export const WIDGET_IDS = [
  'weather',
  'clock',
  'quickLinks',
  'notes',
  'discover',
  'alia',
  'sites',
] as const;

export type WidgetId = (typeof WIDGET_IDS)[number];

export interface Widget {
  readonly id: WidgetId;
  readonly visible: boolean;
}

export interface QuickLink {
  readonly title: string;
  readonly url: string;
}

export interface Tile {
  readonly title: string;
  readonly url: string;
}

export interface SearchEngine {
  /**
   * A TemplateURLID, as a decimal string.
   *
   * The wire type is `int64`, which the Mojo TypeScript generator maps to
   * `bigint`. Carried as a string through the store because a bigint cannot be
   * a React key, cannot be compared with `===` against one parsed elsewhere
   * without care, and serialises to nothing useful — the transport is the only
   * place that needs the numeric form.
   */
  readonly id: string;
  readonly name: string;
  readonly keyword: string;
  readonly isDefault: boolean;
  /**
   * Whether the browser would accept being asked to use this one.
   *
   * False only for a policy-pinned or extension-controlled provider — the
   * engine that is already the default reports true. See the field's comment
   * in astro_ntp.mojom for why the raw Chromium predicate is not what is sent.
   */
  readonly selectable: boolean;
}

export interface NtpState {
  /**
   * Whether the browser has answered yet.
   *
   * Distinguishes "no links" from "not asked yet", which is the difference
   * between an empty state a user should act on and a frame of the page they
   * should not see at all.
   */
  readonly ready: boolean;
  readonly widgets: readonly Widget[];
  readonly quickLinks: readonly QuickLink[];
  readonly notes: string;
  readonly blockedCount: number;
  readonly searchEngines: readonly SearchEngine[];
  /**
   * Most-visited tiles.
   *
   * Never part of the initial answer: they come from an asynchronous history
   * query, and an empty array before it lands is "not yet", not "none".
   * Off-the-record profiles get none at all, by construction in the browser.
   */
  readonly tiles: readonly Tile[];
}

/** Everything the browser side of the new tab page provides. */
export interface NtpSource {
  getState(): Promise<Omit<NtpState, 'ready' | 'tiles'>>;
  /** Returns the unsubscribe. */
  onChanged(listener: (patch: Partial<NtpState>) => void): () => void;

  setWidgetVisible(id: WidgetId, visible: boolean): void;
  setWidgetOrder(order: readonly WidgetId[]): void;
  /** Resolves false when the browser stored nothing — see astro_ntp.mojom. */
  addQuickLink(title: string, url: string): Promise<boolean>;
  updateQuickLink(index: number, title: string, url: string): Promise<boolean>;
  removeQuickLink(index: number): void;
  setNotes(notes: string): void;
  setDefaultSearchEngine(id: string): Promise<boolean>;
  search(query: string): void;
  openCustomizeChrome(): void;
  openAliaSidePanel(): void;
}

/**
 * What the page renders before the browser has answered.
 *
 * The widget list is empty rather than a guess at the default arrangement: a
 * guessed order would lay the grid out once and then re-lay it a frame later,
 * and the reflow is more noticeable than the blank.
 */
const EMPTY: NtpState = {
  ready: false,
  widgets: [],
  quickLinks: [],
  notes: '',
  blockedCount: 0,
  searchEngines: [],
  tiles: [],
};

let snapshot: NtpState = EMPTY;
const listeners = new Set<() => void>();
let started = false;
let resolved: Promise<NtpSource> | undefined;

function publish(patch: Partial<NtpState>): void {
  snapshot = {...snapshot, ...patch};
  for (const listener of listeners) {
    listener();
  }
}

function ntpSource(): Promise<NtpSource> {
  resolved ??= (async () => {
    // `Mojo` is the global a renderer installs for a page whose controller
    // enabled Mojo bindings. Feature-detected rather than inferred from the
    // URL or the build mode: those say where the page came from, this says
    // whether there is a pipe to bind.
    if ('Mojo' in globalThis) {
      const {createNtpSource} = await import('./ntp-mojo.ts');
      return createNtpSource();
    }
    if (import.meta.env.DEV) {
      const {createNtpMock} = await import('./mock.ts');
      return createNtpMock();
    }
    throw new MissingBrowserApiError(
      'astro_ntp.mojom',
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
  void ntpSource().then(source => {
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

export function getSnapshot(): NtpState {
  return snapshot;
}

/** The live new tab page state. */
export function useNtp(): NtpState {
  return useSyncExternalStore(subscribe, getSnapshot);
}

// The writes.
//
// None of them touches `snapshot`. Every one goes to the browser and comes
// back through the observer, so what the page shows is what the browser
// stored — including when it stored nothing.

export function setWidgetVisible(id: WidgetId, visible: boolean): void {
  void ntpSource().then(source => source.setWidgetVisible(id, visible));
}

export function setWidgetOrder(order: readonly WidgetId[]): void {
  void ntpSource().then(source => source.setWidgetOrder(order));
}

export function addQuickLink(title: string, url: string): Promise<boolean> {
  return ntpSource().then(source => source.addQuickLink(title, url));
}

export function updateQuickLink(
  index: number,
  title: string,
  url: string,
): Promise<boolean> {
  return ntpSource().then(source => source.updateQuickLink(index, title, url));
}

export function removeQuickLink(index: number): void {
  void ntpSource().then(source => source.removeQuickLink(index));
}

export function setNotes(notes: string): void {
  void ntpSource().then(source => source.setNotes(notes));
}

export function setDefaultSearchEngine(id: string): Promise<boolean> {
  return ntpSource().then(source => source.setDefaultSearchEngine(id));
}

export function search(query: string): void {
  void ntpSource().then(source => source.search(query));
}

export function openCustomizeChrome(): void {
  void ntpSource().then(source => source.openCustomizeChrome());
}

export function openAliaSidePanel(): void {
  void ntpSource().then(source => source.openAliaSidePanel());
}

/**
 * Move a widget one place in the arrangement.
 *
 * Here rather than in the panel that renders the buttons, because the same
 * normalisation the browser applies has to be applied to the array being sent:
 * a move computed from a filtered or reordered view of the widgets would send
 * an order that silently drops the ones it could not see.
 */
export function moveWidget(
  widgets: readonly Widget[],
  id: WidgetId,
  delta: -1 | 1,
): void {
  const order = widgets.map(widget => widget.id);
  const from = order.indexOf(id);
  const to = from + delta;
  if (from === -1 || to < 0 || to >= order.length) {
    return;
  }
  const next = [...order];
  next.splice(from, 1);
  next.splice(to, 0, id);
  setWidgetOrder(next);
}
