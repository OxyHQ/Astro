// The wrapper that lets the search field point at one control.
//
// Navigating to the right screen is only half of finding a setting. Astro's
// settings screens run to thirty rows, so a hit that opens `/security` and
// stops has handed the user a page and a second search to do by eye. This is
// the other half: the row the hit named is scrolled to and marked.
//
// One request at a time, held in a module store rather than in the page's
// state, because the two ends of it are far apart in both tree and time. The
// search field asks for a control; the screen that draws it is `lazy()` and
// arrives some frames later, mounted under a different subtree. The anchor
// itself is what notices it has been asked for -- so a screen still loading
// when the request is made still reveals its control when it arrives, and no
// component in between has to know the request exists.
//
// A request nobody claims expires. Otherwise a control that is declared but
// not anchored would leave the request standing, and the next visit to any
// screen that DOES anchor that id would light up for no reason the user could
// connect to anything they did.

import {useEffect, useSyncExternalStore, type ReactNode} from 'react';
import {View} from 'react-native';

import type {MessageId} from '@astro/platform';

/** How long the row stays marked once the anchor has claimed the request. */
const HIGHLIGHT_MS = 2500;

/** How long an unclaimed request survives. Longer: the screen may still be loading. */
const REQUEST_MS = 6000;

let requested: MessageId | undefined;
let expiry: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function publish(next: MessageId | undefined): void {
  if (next === requested) {
    // Stable snapshot while unchanged, or every anchor on the screen re-renders
    // on a request that moved nothing.
    return;
  }
  requested = next;
  for (const listener of listeners) {
    listener();
  }
}

function expireIn(ms: number): void {
  clearTimeout(expiry);
  expiry = setTimeout(() => publish(undefined), ms);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): MessageId | undefined {
  return requested;
}

/**
 * The DOM id of a control's anchor.
 *
 * Reduced to letters, digits and dashes rather than passed through: the value
 * is a dotted message id, react-native-web writes `id` to the DOM verbatim,
 * and an id that survives that trip unchanged is one fewer thing to be wrong
 * about when this is read back from a browser.
 */
function anchorId(id: MessageId): string {
  return `astro-control-${id.replace(/[^A-Za-z0-9]+/g, '-')}`;
}

/** Ask for a control to be shown. Consumed by whichever anchor carries that id. */
export function revealControl(id: MessageId): void {
  publish(id);
  expireIn(REQUEST_MS);
}

export interface ControlAnchorProps {
  /**
   * The control's message id -- the same value the section declares in its
   * `*.strings.ts`, which is what makes a search hit and a rendered row the
   * same thing rather than two strings that happen to match.
   */
  id: MessageId;
  /**
   * Ids this anchor also answers for.
   *
   * A section declares the OPTION names inside a choice as well as the choice
   * itself -- "Dark" and "System" alongside "Theme", "Open the New Tab page"
   * alongside the startup mode -- because those are the words a user searches
   * for. The options have no row of their own to mark, so the control they
   * belong to is revealed instead.
   */
  also?: readonly MessageId[];
  children: ReactNode;
}

export function ControlAnchor({id, also, children}: ControlAnchorProps) {
  const request = useSyncExternalStore(subscribe, getSnapshot);
  const revealed = request !== undefined && (request === id || (also?.includes(request) ?? false));

  useEffect(() => {
    if (!revealed) {
      return;
    }
    // After the commit that wrote the id, so the element is findable. Found by
    // id rather than through a ref: under react-native-css a ref on a
    // className'd component does not resolve to the DOM node on web, and this
    // View carries a className the moment it is revealed.
    document.getElementById(anchorId(id))?.scrollIntoView({block: 'center'});
    // Claimed. The mark is brief from here rather than from the request, so a
    // screen that took a second to load still shows it for the full time.
    expireIn(HIGHLIGHT_MS);
  }, [revealed, id]);

  return (
    // The id exists only while this control is the one being pointed at. Every
    // row on every screen carrying one would be forty dead attributes per page
    // and, where a screen legitimately draws the same label twice (one row per
    // installed dictionary), forty duplicate ids.
    <View
      id={revealed ? anchorId(id) : undefined}
      className={revealed ? 'rounded-2xl bg-primary-subtle' : undefined}
    >
      {children}
    </View>
  );
}
