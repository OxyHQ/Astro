// chrome.languageSettingsPrivate, over the dev fixtures. DEV ONLY -- see
// ./state.ts.
//
// This mock stands in for the C++ side, so it also does the C++ side's job:
// enabling, disabling and reordering a language WRITES `intl.accept_languages`
// through the same pref state settings-private.ts serves. That is what the real
// API does, and doing it here is what keeps the languages screen honest -- the
// screen reads the enabled list from the pref, so if this mock kept its own
// private copy the dev loop would be testing a connection that does not exist.
//
// It also means the policy path is real without any extra machinery: mark
// `intl.accept_languages` ENFORCED in the fixtures and every write below is
// refused by `writePref`, exactly as a managed browser refuses it.

import type {
  DictionaryStatus,
  LanguageInfo,
  LanguageSettingsPrivateApi,
} from '../language-settings-private.ts';
import {fixtureLanguages} from './sections.ts';
import {readPref, writePref} from './state.ts';

/** The pref that holds which languages are enabled, and in what order. */
const ACCEPT_LANGUAGES = 'intl.accept_languages';

const fixtures = fixtureLanguages();

const known: readonly LanguageInfo[] = fixtures.languages ?? [];
let dictionaries: readonly DictionaryStatus[] = fixtures.dictionaries ?? [];
let customWords: readonly string[] = fixtures.customWords ?? [];

const wordListeners = new Set<(added: readonly string[], removed: readonly string[]) => void>();

// Registered and never fired, on purpose. A dictionary status changes when a
// download finishes, and nothing in a dev server downloads one -- so the store
// renders whatever the fixtures declare and this stays an empty set rather than
// a fake transition nobody could tell from a real one.
const dictionaryListeners = new Set<(statuses: readonly DictionaryStatus[]) => void>();

function acceptLanguages(): string[] {
  const value = readPref(ACCEPT_LANGUAGES)?.value;
  return typeof value === 'string' && value !== '' ? value.split(',') : [];
}

function writeAcceptLanguages(codes: readonly string[]): void {
  writePref(ACCEPT_LANGUAGES, codes.join(','));
}

export function createLanguageSettingsPrivateMock(): LanguageSettingsPrivateApi {
  return {
    getLanguages: () => Promise.resolve(known),

    enableLanguage: code => {
      const codes = acceptLanguages();
      if (!codes.includes(code)) {
        writeAcceptLanguages([...codes, code]);
      }
    },

    disableLanguage: code => {
      const codes = acceptLanguages();
      // The browser refuses to leave the list empty -- a profile with no
      // accepted language has no UI language to fall back to.
      if (codes.length > 1) {
        writeAcceptLanguages(codes.filter(entry => entry !== code));
      }
    },

    moveLanguage: (code, move) => {
      const codes = acceptLanguages();
      const from = codes.indexOf(code);
      if (from === -1) {
        return;
      }
      const to = move === 'TOP' ? 0 : move === 'UP' ? from - 1 : from + 1;
      if (to < 0 || to >= codes.length) {
        return;
      }
      const next = [...codes];
      next.splice(from, 1);
      next.splice(to, 0, code);
      writeAcceptLanguages(next);
    },

    getDictionaryStatuses: () => Promise.resolve(dictionaries),

    getCustomWords: () => Promise.resolve(customWords),

    addCustomWord: word => {
      if (customWords.includes(word)) {
        return;
      }
      customWords = [...customWords, word];
      for (const listener of wordListeners) {
        listener([word], []);
      }
    },

    removeCustomWord: word => {
      if (!customWords.includes(word)) {
        return;
      }
      customWords = customWords.filter(entry => entry !== word);
      for (const listener of wordListeners) {
        listener([], [word]);
      }
    },

    onCustomWordsChanged: listener => {
      wordListeners.add(listener);
      return () => {
        wordListeners.delete(listener);
      };
    },

    onDictionariesChanged: listener => {
      dictionaryListeners.add(listener);
      return () => {
        dictionaryListeners.delete(listener);
      };
    },
  };
}
