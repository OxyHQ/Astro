// Accessibility -- the dev browser this section renders from. DEV ONLY.
//
// Reached only from `platform/browser/mock/sections.ts`, which is imported only
// from inside an `import.meta.env.DEV` branch, so nothing here is emitted into a
// bundle the browser ships. See `platform/browser/env.ts`.
//
// Every pref is an entry in the accessibility block of
// `chrome/browser/extensions/api/settings_private/prefs_util.cc` (lines
// 555-597, plus `settings.a11y.focus_highlight` at 1217), checked by name. The
// caption values are the wire formats upstream's own page writes -- a percentage
// string with the sign, a bare RGB triple, an integer 0-100, a raw CSS shadow --
// so a control that stored the wrong shape shows up here rather than in a build.
//
// No handler fixtures. AccessibilityMainHandler's `getScreenReaderState` only
// gates a row this section does not draw, and every CaptionsHandler message is
// about live caption's downloadable speech model, which Astro cannot fetch.

import type {SectionFixtures} from '@astro/platform';

export const accessibilityFixtures: SectionFixtures = {
  prefs: [
    {key: 'settings.a11y.focus_highlight', type: 'BOOLEAN', value: true},
    {key: 'settings.a11y.caretbrowsing.enabled', type: 'BOOLEAN', value: false},
    {key: 'settings.a11y.overscroll_history_navigation', type: 'BOOLEAN', value: true},
    // ToastAlertLevel::kAll.
    {key: 'settings.toast.alert_level', type: 'NUMBER', value: 0},

    // Captions. Every value is one the corresponding menu offers, so each row
    // renders with a selection rather than falling back to its placeholder --
    // except the two that sit at the stored default, which IS the empty string
    // and is worth exercising: it is the one value that is a real choice and
    // looks like an absent one.
    {key: 'accessibility.captions.text_size', type: 'STRING', value: '150%'},
    {key: 'accessibility.captions.text_font', type: 'STRING', value: ''},
    {key: 'accessibility.captions.text_color', type: 'STRING', value: '255,255,255'},
    {key: 'accessibility.captions.text_opacity', type: 'NUMBER', value: 100},
    {
      key: 'accessibility.captions.text_shadow',
      type: 'STRING',
      value: '0px 0px 2px rgba(0, 0, 0, 0.5), 2px 2px 2px black',
    },
    {key: 'accessibility.captions.background_color', type: 'STRING', value: '0,0,0'},
    {key: 'accessibility.captions.background_opacity', type: 'NUMBER', value: 50},
  ],
};
