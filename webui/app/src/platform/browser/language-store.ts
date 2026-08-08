// The language and spell-check store the UI subscribes to.
//
// Same shape and the same reasons as pref-store.ts. Three snapshots rather than
// one, because the browser notifies about them separately: the supported
// language list does not change at runtime, the dictionary statuses change as
// downloads finish, and the custom words change as the user types. Folding them
// into one value would re-render the language list every time a word was added.
//
// Each starts UNDEFINED rather than empty, so "not answered yet" and "you have
// none" stay distinguishable -- an empty custom dictionary is a real and common
// state, and it must not be shown to someone whose words are still loading.
//
// The custom-word list is the one that is MAINTAINED rather than replaced:
// `onCustomDictionaryChanged` reports what was added and removed, not the new
// list, so the store applies the delta. Re-fetching on every notification would
// work and would also make each keystroke a round trip.

import {useSyncExternalStore} from 'react';

import {
  languageSettingsPrivate,
  type DictionaryStatus,
  type LanguageInfo,
  type LanguageMove,
} from './language-settings-private.ts';

let languages: readonly LanguageInfo[] | undefined;
let dictionaries: readonly DictionaryStatus[] | undefined;
let customWords: readonly string[] | undefined;

const listeners = new Set<() => void>();
let started = false;

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

function start(): void {
  if (started) {
    return;
  }
  started = true;
  void languageSettingsPrivate().then(api => {
    api.onDictionariesChanged(next => {
      dictionaries = next;
      notify();
    });
    api.onCustomWordsChanged((added, removed) => {
      const next = new Set(customWords ?? []);
      for (const word of removed) {
        next.delete(word);
      }
      for (const word of added) {
        next.add(word);
      }
      // Sorted, because the browser's dictionary has no order of its own and a
      // list that reshuffled as words were added would be unreadable.
      customWords = [...next].sort((a, b) => a.localeCompare(b));
      notify();
    });
    void api.getLanguages().then(next => {
      languages = next;
      notify();
    });
    void api.getDictionaryStatuses().then(next => {
      dictionaries = next;
      notify();
    });
    void api.getCustomWords().then(next => {
      customWords = [...next].sort((a, b) => a.localeCompare(b));
      notify();
    });
  });
}

function subscribe(listener: () => void): () => void {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Every language the browser knows. Undefined until it has answered. */
export function useLanguages(): readonly LanguageInfo[] | undefined {
  return useSyncExternalStore(subscribe, () => languages);
}

/** Which spell-check dictionaries are on disk. Undefined until answered. */
export function useDictionaryStatuses(): readonly DictionaryStatus[] | undefined {
  return useSyncExternalStore(subscribe, () => dictionaries);
}

/** The words the user added to the dictionary, sorted. Undefined until answered. */
export function useCustomWords(): readonly string[] | undefined {
  return useSyncExternalStore(subscribe, () => customWords);
}

export function enableLanguage(code: string): void {
  void languageSettingsPrivate().then(api => api.enableLanguage(code));
}

export function disableLanguage(code: string): void {
  void languageSettingsPrivate().then(api => api.disableLanguage(code));
}

export function moveLanguage(code: string, move: LanguageMove): void {
  void languageSettingsPrivate().then(api => api.moveLanguage(code, move));
}

export function addCustomWord(word: string): void {
  void languageSettingsPrivate().then(api => api.addCustomWord(word));
}

export function removeCustomWord(word: string): void {
  void languageSettingsPrivate().then(api => api.removeCustomWord(word));
}
