// Ad blocking -- the dev browser this section renders from. DEV ONLY.
//
// Reached only from `platform/browser/mock/sections.ts`, which is imported only
// from inside an `import.meta.env.DEV` branch, so nothing here is emitted into a
// bundle the browser ships. See `platform/browser/env.ts`.
//
// EMPTY, and that is the finding rather than an omission to be filled in later.
// A fixture is a stand-in for something the browser really serves, and the
// browser serves this section nothing:
//
//   * the four `oxy.adblock.*` preferences exist (patch 046) but are not in
//     `chrome/browser/extensions/api/settings_private/prefs_util.cc`, so
//     `chrome.settingsPrivate` will never report them however they are spelled
//     here. Declaring one would make a control work in dev and fail silently in
//     the browser, which is the exact failure the allowlist rule exists to stop;
//   * `AstroAdBlockUIHandler`'s three messages are installed by the controller
//     for `astro://adblock`, not by the one this page is served from, so a
//     reply fixture for `getAdBlockState` would be answering a message that is
//     a CHECK failure in a real build;
//   * there is no Mojo interface for the ad blocker anywhere in the overlay.
//
// The section therefore renders facts about the build -- the filter-list
// catalogue and the updater's own constants -- which are compiled in and need
// no transport at all.

import type {SectionFixtures} from '@astro/platform';

export const adblockFixtures: SectionFixtures = {};
