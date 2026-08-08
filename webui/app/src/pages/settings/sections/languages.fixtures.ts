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
// Astro targets the handler does not exist. Everything else this section would
// want is `chrome.languageSettingsPrivate`, which is a different API from
// `chrome.settingsPrivate` and has no fixture shape here.

import type {SectionFixtures} from '@astro/platform';

export const languagesFixtures: SectionFixtures = {
  prefs: [
    // Comma-joined with no spaces, which is the form the pref really holds --
    // a fixture with spaces would hide the reformatting the row does.
    {key: 'intl.accept_languages', type: 'STRING', value: 'en-GB,en,es-ES,es'},

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
};
