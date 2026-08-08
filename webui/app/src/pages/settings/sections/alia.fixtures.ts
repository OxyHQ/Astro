// Alia -- the dev browser this section renders from. DEV ONLY.
//
// Reached only from `platform/browser/mock/sections.ts`, which is imported only
// from inside an `import.meta.env.DEV` branch, so nothing here is emitted into a
// bundle the browser ships. See `platform/browser/env.ts`.
//
// EMPTY, and deliberately so. The only Alia preference in the browser is
// `astro.ntp_show_alia` (patch 020), which is not in
// `chrome/browser/extensions/api/settings_private/prefs_util.cc` and so is
// invisible to `chrome.settingsPrivate`; declaring it here would make a control
// work in dev and do nothing in a real build. The side panel reads no
// preferences at all and registers no WebUI message handler, and the overlay
// defines no Mojo interface, so there is nothing else to stand in for.
//
// The section's one live control is a navigation to `astro://alia`, which needs
// no fixture: the route table already knows the address. On the dev server
// there is a single origin and no `alia` page in the bundle, so following it
// lands on the app's unknown-host screen -- that is the dev server being one
// origin, not the link being wrong.

import type {SectionFixtures} from '@astro/platform';

export const aliaFixtures: SectionFixtures = {};
