// chrome.languageSettingsPrivate -- the browser's own language and spell-check
// state.
//
// Lane 1 of the transport contract, like settings-private.ts and
// autofill-private.ts: a purpose-typed Chromium API granted per host, not the
// untyped pref bridge this project removed. Its grant is a URL pattern in
// `chrome/common/extensions/api/_api_features.json` (`chrome://settings/*`,
// `contexts: ["webui"]`), reaching Astro's page through the scheme rewrite in
// layer 8 of the WebUI scheme composition.
//
// WHICH languages are enabled is NOT here. That is the `intl.accept_languages`
// pref, and reading it through settingsPrivate rather than through this API is
// what lets the languages screen refuse to edit a list a policy has fixed --
// this API carries no policy metadata of its own. The same split applies to
// spell check: `spellcheck.dictionaries` holds the enabled dictionaries and
// `browser.enable_spellchecking` the master switch, both allowlisted prefs,
// while the WORDS in the custom dictionary live only here.
//
// Deliberately absent, each for a reason rather than for brevity:
//
//   * The whole translate family (`setEnableTranslationForLanguage`,
//     `setLanguageAlwaysTranslateState`, `setTranslateTargetLanguage`, the two
//     always/never getters). Astro disables translation unless a script URL is
//     passed on the command line -- `patches/ungoogled/core/ungoogled-chromium/
//     toggle-translation-via-switch.patch` -- so these write state nothing in
//     this build reads.
//   * Input methods (`getInputMethodLists`, `addInputMethod`,
//     `removeInputMethod`). ChromeOS only.
//   * `retryDownloadDictionary`, which is only meaningful beside the download
//     progress UI that would call it.

import {MissingBrowserApiError} from './env.ts';

/** One language the browser knows about. Not necessarily one the user enabled. */
export interface LanguageInfo {
  /** The BCP 47 code, and the key `intl.accept_languages` stores. */
  readonly code: string;
  readonly displayName: string;
  readonly nativeDisplayName: string;
  /** Absent or false means no dictionary exists for it. */
  readonly supportsSpellcheck?: boolean;
  /** The browser refuses to enable it; the row must not offer to. */
  readonly isProhibitedLanguage?: boolean;
}

/** Whether a spell-check dictionary is on disk yet. */
export interface DictionaryStatus {
  readonly languageCode: string;
  readonly isReady: boolean;
  readonly isDownloading?: boolean;
  readonly downloadFailed?: boolean;
}

/** Where a language moves in the accept-language order. */
export type LanguageMove = 'TOP' | 'UP' | 'DOWN';

export interface LanguageSettingsPrivateApi {
  /** Every language the browser knows, in its own order. */
  getLanguages(): Promise<readonly LanguageInfo[]>;
  enableLanguage(code: string): void;
  disableLanguage(code: string): void;
  moveLanguage(code: string, move: LanguageMove): void;
  getDictionaryStatuses(): Promise<readonly DictionaryStatus[]>;
  getCustomWords(): Promise<readonly string[]>;
  addCustomWord(word: string): void;
  removeCustomWord(word: string): void;
  /** Returns the unsubscribe. Reports what changed, not the whole list. */
  onCustomWordsChanged(
    listener: (added: readonly string[], removed: readonly string[]) => void,
  ): () => void;
  /** Returns the unsubscribe. */
  onDictionariesChanged(listener: (statuses: readonly DictionaryStatus[]) => void): () => void;
}

/** The callback-shaped API as the browser actually installs it. */
interface ChromeLanguageSettingsPrivate {
  getLanguageList(callback: (languages: LanguageInfo[]) => void): void;
  enableLanguage(code: string): void;
  disableLanguage(code: string): void;
  moveLanguage(code: string, moveType: LanguageMove): void;
  getSpellcheckDictionaryStatuses(callback: (statuses: DictionaryStatus[]) => void): void;
  getSpellcheckWords(callback: (words: string[]) => void): void;
  addSpellcheckWord(word: string): void;
  removeSpellcheckWord(word: string): void;
  onCustomDictionaryChanged: {
    addListener(callback: (added: string[], removed: string[]) => void): void;
    removeListener(callback: (added: string[], removed: string[]) => void): void;
  };
  onSpellcheckDictionariesChanged: {
    addListener(callback: (statuses: DictionaryStatus[]) => void): void;
    removeListener(callback: (statuses: DictionaryStatus[]) => void): void;
  };
}

function wrap(api: ChromeLanguageSettingsPrivate): LanguageSettingsPrivateApi {
  return {
    getLanguages: () => new Promise(resolve => api.getLanguageList(resolve)),
    enableLanguage: code => api.enableLanguage(code),
    disableLanguage: code => api.disableLanguage(code),
    moveLanguage: (code, move) => api.moveLanguage(code, move),
    getDictionaryStatuses: () =>
      new Promise(resolve => api.getSpellcheckDictionaryStatuses(resolve)),
    getCustomWords: () => new Promise(resolve => api.getSpellcheckWords(resolve)),
    addCustomWord: word => api.addSpellcheckWord(word),
    removeCustomWord: word => api.removeSpellcheckWord(word),
    onCustomWordsChanged: listener => {
      api.onCustomDictionaryChanged.addListener(listener);
      return () => api.onCustomDictionaryChanged.removeListener(listener);
    },
    onDictionariesChanged: listener => {
      api.onSpellcheckDictionariesChanged.addListener(listener);
      return () => api.onSpellcheckDictionariesChanged.removeListener(listener);
    },
  };
}

let resolved: Promise<LanguageSettingsPrivateApi> | undefined;

/** The language API for this page, resolved once. */
export function languageSettingsPrivate(): Promise<LanguageSettingsPrivateApi> {
  resolved ??= (async () => {
    const real = (
      globalThis as {chrome?: {languageSettingsPrivate?: ChromeLanguageSettingsPrivate}}
    ).chrome?.languageSettingsPrivate;
    if (real) {
      return wrap(real);
    }
    if (import.meta.env.DEV) {
      const {createLanguageSettingsPrivateMock} = await import(
        './mock/language-settings-private.ts'
      );
      return createLanguageSettingsPrivateMock();
    }
    throw new MissingBrowserApiError(
      'chrome.languageSettingsPrivate',
      'The API is granted by a matches pattern in _api_features.json; this ' +
        'page is served from a host that pattern does not cover.',
    );
  })();
  return resolved;
}
