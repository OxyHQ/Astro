// Privacy and security -- the dev browser this section renders from. DEV ONLY.
//
// Reached only from `platform/browser/mock/sections.ts`, which is imported only
// from inside an `import.meta.env.DEV` branch, so nothing here is emitted into a
// bundle the browser ships. See `platform/browser/env.ts`.
//
// Every pref here is one of the 448 entries in
// `chrome/browser/extensions/api/settings_private/prefs_util.cc`, so a control
// built against it keeps working when the mock is replaced by the browser. A
// pref outside that allowlist is invisible to `chrome.settingsPrivate` however
// correctly it is spelled.
//
// The set is chosen to make every rendering path drivable without C++: one
// plain toggle, one a policy has ENFORCED (the control must lock and say who
// locked it), and one a policy merely RECOMMENDS (the control must stay usable
// and still show the recommendation). Keep that spread as this section grows --
// a fixture set where nothing is managed is a fixture set that never exercises
// the managed state.

import type {SectionFixtures} from '@astro/platform';

export const privacyFixtures: SectionFixtures = {
  prefs: [
    {key: 'enable_do_not_track', type: 'BOOLEAN', value: false},
    {key: 'profile.password_manager_leak_detection', type: 'BOOLEAN', value: true},
    {
      key: 'https_only_mode_enabled',
      type: 'BOOLEAN',
      value: true,
      controlledBy: 'USER_POLICY',
      controlledByName: 'Astro dev policy',
      enforcement: 'ENFORCED',
    },
    {
      key: 'search.suggest_enabled',
      type: 'BOOLEAN',
      value: false,
      controlledBy: 'USER_POLICY',
      controlledByName: 'Astro dev policy',
      enforcement: 'RECOMMENDED',
      recommendedValue: true,
    },
  ],
};
