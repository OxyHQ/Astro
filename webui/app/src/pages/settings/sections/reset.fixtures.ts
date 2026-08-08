// Reset settings -- the dev browser this section renders from. DEV ONLY.
//
// Reached only from `platform/browser/mock/sections.ts`, which is imported only
// from inside an `import.meta.env.DEV` branch, so nothing here is emitted into a
// bundle the browser ships. See `platform/browser/env.ts`.
//
// Every Chromium pref declared here must be one of the entries in
// `chrome/browser/extensions/api/settings_private/prefs_util.cc`: a pref outside
// that allowlist is invisible to `chrome.settingsPrivate` however correctly it is
// spelled, so a control built against one works in dev and does nothing in the
// browser. Handler messages must be ones the C++ handler registered by
// `settings_ui.cc` actually answers, for the same reason.

import type {SectionFixtures} from '@astro/platform';

export const resetFixtures: SectionFixtures = {};
