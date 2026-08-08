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

import type {SavedAddress, SavedCard, SavedIban} from '../autofill-private.ts';
import type {DictionaryStatus, LanguageInfo} from '../language-settings-private.ts';
import type {Pref} from '../settings-private.ts';

/** A handler call that replies, as `sendWithPromise` makes it. */
export type HandlerReply = (...args: unknown[]) => unknown;

/** A handler call that does not reply, as `send` makes it. */
export type HandlerAction = (...args: unknown[]) => void;

/** What `chrome.autofillPrivate` serves. Declared by ONE section. */
export interface AutofillFixtures {
  readonly addresses?: readonly SavedAddress[];
  readonly cards?: readonly SavedCard[];
  readonly ibans?: readonly SavedIban[];
}

/**
 * What `chrome.languageSettingsPrivate` serves. Declared by ONE section.
 *
 * `languages` is every language the browser KNOWS, not the ones the user
 * enabled -- which is the real API's shape, and the reason the enabled list is
 * the `intl.accept_languages` pref instead. Keep the two consistent: a code in
 * that pref with no entry here renders as a language with no name.
 */
export interface LanguageFixtures {
  readonly languages?: readonly LanguageInfo[];
  readonly dictionaries?: readonly DictionaryStatus[];
  readonly customWords?: readonly string[];
}

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
  /** Saved addresses and payment methods. Only the autofill section declares this. */
  readonly autofill?: AutofillFixtures;
  /** Languages and spell check. Only the languages section declares this. */
  readonly languages?: LanguageFixtures;
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

/**
 * The one section's contribution to an API only one section owns.
 *
 * The saved-info and language APIs are not keyed collections several sections
 * add to -- they are one dataset with one owner. Two declarants is not a merge
 * problem, it is a disagreement about whose screen the data belongs to, and
 * silently taking the first would leave the other section rendering a list it
 * did not write.
 */
export function soleContribution<T>(
  what: string,
  contributions: readonly (readonly [string, T | undefined])[],
): T | undefined {
  let found: T | undefined;
  let owner: string | undefined;
  for (const [section, value] of contributions) {
    if (value === undefined) {
      continue;
    }
    if (owner !== undefined) {
      throw new Error(
        `dev fixtures: ${what} is declared by both the ${owner} and ${section} ` +
          'sections. One of them owns it; delete the other.',
      );
    }
    owner = section;
    found = value;
  }
  return found;
}
