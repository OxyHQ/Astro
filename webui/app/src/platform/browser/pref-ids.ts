// Pref paths this app names, mirrored from the browser's own constants.
//
// A pref path is a string on both sides of the boundary, so nothing catches a
// rename: the C++ side keeps writing `astro.theme.preset` while the page reads
// `astro.theme.color_preset` and every control silently shows its default.
// These constants exist so the mirror is one file to diff rather than a
// scattering of literals, and so the build-safety case that pins them can grep
// two files instead of the whole tree.
//
// The counterparts:
//
//   COLOR_SCHEME  chrome/common/pref_names.h, `kBrowserColorScheme`. Upstream's
//                 own pref -- it already drives NativeTheme and is
//                 policy-manageable, so Astro adds no pref of its own for the
//                 light/dark decision. Its values are
//                 ThemeService::BrowserColorScheme (chrome/browser/themes/
//                 theme_service.h): 0 system, 1 light, 2 dark. Stored as an
//                 integer in profile prefs, so the numbers are permanent.
//
//   THEME_PRESET  Astro's own, registered in patch 020-register-oxy-prefs and
//                 declared in the //astro module's astro_pref_names.h. It
//                 carries a Bloom colour-preset name.
//
// NOTE for whoever wires the C++ side: neither pref is in settingsPrivate's
// allowlist. `browser.theme.color_scheme2` is absent from the 448 entries in
// chrome/browser/extensions/api/settings_private/prefs_util.cc, so it is
// invisible to chrome.settingsPrivate however correct the path is. The theme
// transport is typed Mojo for exactly that reason (see theme-store.ts).

/** Light/dark/system, as ThemeService::BrowserColorScheme. */
export const COLOR_SCHEME_PREF = 'browser.theme.color_scheme2';

/** The active Bloom colour preset, by name. */
export const THEME_PRESET_PREF = 'astro.theme.preset';

/** `ThemeService::BrowserColorScheme`, by value. */
export const COLOR_SCHEME_SYSTEM = 0;
export const COLOR_SCHEME_LIGHT = 1;
export const COLOR_SCHEME_DARK = 2;
