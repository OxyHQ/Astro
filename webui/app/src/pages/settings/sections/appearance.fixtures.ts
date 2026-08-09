// Appearance -- the dev browser this section renders from. DEV ONLY.
//
// Reached only from `platform/browser/mock/sections.ts`, which is imported only
// from inside an `import.meta.env.DEV` branch, so nothing here is emitted into a
// bundle the browser ships. See `platform/browser/env.ts`.
//
// The two THEME prefs below are the ONE exception to the rule the other
// sections follow, and it is worth stating rather than discovering: neither is
// in `chrome.settingsPrivate`'s allowlist (`prefs_util.cc`), so neither would
// ever be served by that API. They are here because the dev theme mock reads
// the same map -- the real theme transport is typed Mojo, for exactly that
// reason (see `platform/browser/theme-store.ts`). Every OTHER pref in this file
// is one of the allowlist's entries and was checked against it by name.

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

    {key: 'browser.show_home_button', type: 'BOOLEAN', value: true},
    {key: 'homepage_is_newtabpage', type: 'BOOLEAN', value: false},
    // A URL-typed pref, which the row reports rather than edits. The value is
    // deliberately a real-looking address: an empty string would make the row
    // look like the pref was missing rather than unset.
    {key: 'homepage', type: 'URL', value: 'https://oxy.so/'},

    {key: 'bookmark_bar.show_on_all_tabs', type: 'BOOLEAN', value: true},
    {key: 'bookmark_bar.show_tab_groups', type: 'BOOLEAN', value: true},
    // RECOMMENDED rather than plain, so the "your organisation recommends this
    // on" path is drivable without a managed profile. Every section is asked to
    // carry at least one managed pref; this is Appearance's.
    {
      key: 'auto_pin_new_tab_groups',
      type: 'BOOLEAN',
      value: false,
      controlledBy: 'USER_POLICY',
      controlledByName: 'Astro dev policy',
      enforcement: 'RECOMMENDED',
      recommendedValue: true,
    },

    {key: 'side_panel.is_right_aligned', type: 'BOOLEAN', value: true},
    {key: 'browser.hovercard.memory_usage_enabled', type: 'BOOLEAN', value: false},
    {key: 'browser.split_view_drag_and_drop_enabled', type: 'BOOLEAN', value: true},

    // 16 is Chromium's own default, and one of the five values the appearance
    // page offers -- a value outside that set would render the select with no
    // selection, which is a state worth reaching deliberately rather than by
    // accident.
    {key: 'webkit.webprefs.default_font_size', type: 'NUMBER', value: 16},
    {key: 'webkit.webprefs.minimum_font_size', type: 'NUMBER', value: 0},
    {key: 'webkit.webprefs.fonts.standard.Zyyy', type: 'STRING', value: 'Times New Roman'},
    {key: 'webkit.webprefs.fonts.serif.Zyyy', type: 'STRING', value: 'Times New Roman'},
    {key: 'webkit.webprefs.fonts.sansserif.Zyyy', type: 'STRING', value: 'Arial'},
    {key: 'webkit.webprefs.fonts.fixed.Zyyy', type: 'STRING', value: 'Monospace'},
    {key: 'webkit.webprefs.fonts.math.Zyyy', type: 'STRING', value: 'Latin Modern Math'},
  ],

  actions: {
    // AppearanceHandler::ResetPinnedToolbarActions takes no arguments and sends
    // no reply, so it is an action rather than a reply. The dev browser has no
    // toolbar to reset; answering at all is what proves the call reached a
    // handler instead of falling through to the mock's unknown-message failure.
    resetPinnedToolbarActions: () => undefined,
    // Likewise fire-and-forget. There is no side panel in the dev browser, so
    // what this fixture is for is the same thing: the call resolving rather
    // than hitting the mock's unknown-message failure.
    openCustomizeChrome: () => undefined,
  },
};
