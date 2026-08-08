// Languages -- the dev browser this section renders from. DEV ONLY.
//
// Reached only from `platform/browser/mock/sections.ts`, which is imported only
// from inside an `import.meta.env.DEV` branch, so nothing here is emitted into a
// bundle the browser ships. See `platform/browser/env.ts`.
//
// All three prefs are in the "Languages page" block of
// `chrome/browser/extensions/api/settings_private/prefs_util.cc` (lines
// 424-450), which carries no `#if` guard, so they are served on Linux.
//
// No handler fixtures, and none is possible: `settings_ui.cc` installs
// LanguagesHandler only under `IS_CHROMEOS` and `IS_WIN`, so on the platform
// Astro targets the handler does not exist.
//
// The `languages` block below is `chrome.languageSettingsPrivate`'s dataset,
// and this section is its sole declarant -- a second section declaring it is
// refused at startup naming both. Note what it does NOT contain: which
// languages are enabled. That is `intl.accept_languages`, above, because it is
// what the real API writes; the two must stay consistent, since a code in the
// pref with no entry here renders as a language with no name (deliberately
// exercised by the `zz` entry).

import type {SectionFixtures} from '@astro/platform';

export const languagesFixtures: SectionFixtures = {
  prefs: [
    // Comma-joined with no spaces, which is the form the pref really holds --
    // a fixture with spaces would hide the reformatting the row does.
    // `zz` is not in the known list below, on purpose: a profile can carry a
    // language this build does not know, and the row must show the bare code
    // rather than inventing a name or dropping the entry.
    {key: 'intl.accept_languages', type: 'STRING', value: 'en-GB,en,es-ES,zz'},

    // RECOMMENDED rather than plain, so the "your organisation recommends this
    // on" path is drivable without a managed profile. The switch must stay
    // usable and still carry the sentence.
    {
      key: 'browser.enable_spellchecking',
      type: 'BOOLEAN',
      value: false,
      controlledBy: 'USER_POLICY',
      controlledByName: 'Astro dev policy',
      enforcement: 'RECOMMENDED',
      recommendedValue: true,
    },

    // A LIST, which the dev browser can serve but not write -- the mock refuses
    // a write of any type other than boolean, number or string, exactly as this
    // section's read-only row expects.
    {key: 'spellcheck.dictionaries', type: 'LIST', value: ['en-GB', 'es']},
  ],

  languages: {
    // Every language the browser KNOWS -- the real API returns some six
    // hundred. Enough here to drive the picker, its filter and the cap message
    // without pretending to be the real list.
    languages: [
      {code: 'en-GB', displayName: 'English (United Kingdom)', nativeDisplayName: 'English (United Kingdom)', supportsSpellcheck: true},
      {code: 'en', displayName: 'English', nativeDisplayName: 'English', supportsSpellcheck: true},
      {code: 'es-ES', displayName: 'Spanish (Spain)', nativeDisplayName: 'espa\u00f1ol (Espa\u00f1a)', supportsSpellcheck: true},
      {code: 'es', displayName: 'Spanish', nativeDisplayName: 'espa\u00f1ol', supportsSpellcheck: true},
      {code: 'ca', displayName: 'Catalan', nativeDisplayName: 'catal\u00e0', supportsSpellcheck: true},
      {code: 'fr', displayName: 'French', nativeDisplayName: 'fran\u00e7ais', supportsSpellcheck: true},
      {code: 'de', displayName: 'German', nativeDisplayName: 'Deutsch', supportsSpellcheck: true},
      {code: 'pt-BR', displayName: 'Portuguese (Brazil)', nativeDisplayName: 'portugu\u00eas (Brasil)', supportsSpellcheck: true},
      {code: 'ja', displayName: 'Japanese', nativeDisplayName: '\u65e5\u672c\u8a9e'},
      // Prohibited, so the picker's refusal to offer it is drivable. Without
      // one, a screen that ignored the flag would look identical to one that
      // honours it.
      {code: 'qps-ploc', displayName: 'Pseudolocale', nativeDisplayName: 'Pseudolocale', isProhibitedLanguage: true},
    ],
    dictionaries: [
      {languageCode: 'en-GB', isReady: true},
      // Mid-download, which is a state the screen renders differently and
      // nothing in a dev server would otherwise reach.
      {languageCode: 'es', isReady: false, isDownloading: true},
    ],
    customWords: ['Astro', 'de-Googled', 'Oxy', 'ungoogled'],
  },
};
