// What a section contributes to the dev browser. DEV ONLY -- see ./state.ts.
//
// The dev fixtures are SPLIT BY SECTION rather than kept in one table, and the
// reason is ownership rather than tidiness: settings is filled in by several
// people at once, and a single fixture file is a file every one of them edits.
// A section owns `sections/<name>.fixtures.ts` and nothing else has to move for
// its controls to become drivable without a Chromium build.
//
// This module holds only the SHAPE. The merge that reads every section's
// contribution lives in ./sections.ts, which imports them; keeping the two
// apart is what stops a fixture module that imports this type from sitting in
// an import cycle with the module that collects it.

import type {Pref} from '../settings-private.ts';

/** A handler call that replies, as `sendWithPromise` makes it. */
export type HandlerReply = (...args: unknown[]) => unknown;

/** A handler call that does not reply, as `send` makes it. */
export type HandlerAction = (...args: unknown[]) => void;

/**
 * One section's contribution to the dev browser.
 *
 * `prefs` are served through `chrome.settingsPrivate`; every Chromium pref
 * listed must be one of the entries in `prefs_util.cc`, or the control built
 * against it works in dev and is invisible to the real API.
 *
 * `replies` and `actions` stand in for the C++ `WebUIMessageHandler`s. They are
 * keyed by the message name the handler registers, and the split is the same
 * one the transport makes: `sendWithPromise` expects an answer, `send` does
 * not, and the dev bridge cannot tell which a message is from the call alone.
 */
export interface SectionFixtures {
  readonly prefs?: readonly Pref[];
  readonly replies?: Readonly<Record<string, HandlerReply>>;
  readonly actions?: Readonly<Record<string, HandlerAction>>;
}

/**
 * Merge one keyed map per section, refusing a key two sections both claim.
 *
 * Not a silent last-wins: two sections declaring the same pref or the same
 * handler message is a real disagreement about who owns it, and the losing
 * section's control renders from a value it did not write. In dev that reads as
 * a control that ignores its own fixture, with nothing to say why.
 */
export function mergeUnique<T>(
  what: string,
  contributions: readonly (readonly [string, Readonly<Record<string, T>>])[],
): Record<string, T> {
  const merged: Record<string, T> = {};
  const owners = new Map<string, string>();
  for (const [section, entries] of contributions) {
    for (const [key, value] of Object.entries(entries)) {
      const owner = owners.get(key);
      if (owner !== undefined) {
        throw new Error(
          `dev fixtures: ${what} "${key}" is declared by both the ${owner} and ` +
            `${section} sections. One of them owns it; delete the other.`,
        );
      }
      owners.set(key, section);
      merged[key] = value;
    }
  }
  return merged;
}
