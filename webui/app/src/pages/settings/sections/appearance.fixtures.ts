// Appearance -- the dev browser this section renders from. DEV ONLY.
//
// Reached only from `platform/browser/mock/sections.ts`, which is imported only
// from inside an `import.meta.env.DEV` branch, so nothing here is emitted into a
// bundle the browser ships. See `platform/browser/env.ts`.
//
// The two prefs below are the ONE exception to the rule the other sections
// follow, and it is worth stating rather than discovering: neither is in
// `chrome.settingsPrivate`'s allowlist (`prefs_util.cc`), so neither would ever
// be served by that API. They are here because the dev theme mock reads the same
// map -- the real theme transport is typed Mojo, for exactly that reason (see
// `platform/browser/theme-store.ts`). Every other pref in every other section
// must be an allowlisted one, or the control built against it works in dev and
// does nothing in the browser.

import {
  COLOR_SCHEME_PREF,
  COLOR_SCHEME_SYSTEM,
  THEME_PRESET_PREF,
  type SectionFixtures,
} from '@astro/platform';

export const appearanceFixtures: SectionFixtures = {
  prefs: [
    {key: COLOR_SCHEME_PREF, type: 'NUMBER', value: COLOR_SCHEME_SYSTEM},
    {key: THEME_PRESET_PREF, type: 'STRING', value: 'oxy'},
  ],
};
