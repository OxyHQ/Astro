// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_ASTRO_PREF_NAMES_H_
#define CHROME_BROWSER_OXY_ASTRO_PREF_NAMES_H_

namespace astro::prefs {

// The active Bloom colour preset, by name — one of astro::kColorPresetNames in
// ui/astro_color_tokens.h. It paints the native browser UI through
// ui/astro_color_mixer.cc and every astro:// page through astro_theme.mojom,
// so the two cannot drift: there is one stored value and both read it.
//
// A profile can carry a name this build of Bloom does not have (written by a
// newer build, or renamed upstream). ColorPresetFromName returns nullopt for
// it and the reader falls back to kDefaultThemePreset rather than refusing to
// paint.
//
// SPELLED IN THREE PLACES, and nothing but tools/tests/cases/
// theme-pref-ids-match-across-the-boundary.sh makes them agree:
//   * here, for the overlay's C++;
//   * patches/astro/020-register-oxy-prefs.patch, which registers it — a
//     patch edits an upstream file that this header does not reach, so the
//     literal there cannot be replaced by this constant;
//   * webui/app/src/platform/browser/pref-ids.ts, THEME_PRESET_PREF, for the
//     page that renders the control.
// A pref path is a string on every side of that boundary, so a rename that
// misses one of the three reads a pref nobody writes and silently shows a
// default.
inline constexpr char kThemePreset[] = "astro.theme.preset";

// What kThemePreset is registered with, and what a name this build does not
// recognise falls back to.
inline constexpr char kDefaultThemePreset[] = "oxy";

// NOTE — there is deliberately no Astro pref for light/dark. That decision is
// upstream's `browser.theme.color_scheme2` (`::prefs::kBrowserColorScheme`,
// chrome/common/pref_names.h), which already drives NativeTheme and is
// policy-manageable. A second pref would be a second source of truth for the
// same fact.

// -- New tab page ----------------------------------------------------------
//
// Everything the new tab page remembers. It reaches all of it through
// astro_ntp.mojom, which names a decision rather than a pref path, so unlike
// the theme preset above these are spelled in TWO places rather than three —
// here, and the registration in patches/astro/020-register-oxy-prefs.patch.
// The page has no third spelling to drift from because it never sees one.
// tools/tests/cases/ntp-pref-ids-match-the-registration.sh is what keeps the
// two that remain in agreement; a pref path is still a string on both sides of
// a patch boundary, and PrefService returns the type's empty value rather than
// failing for a path nobody registered.

// Per-widget visibility. One boolean each rather than one dictionary: a
// dictionary pref has no per-key default, so a profile written by a build with
// six widgets would report the seventh as absent rather than as shown.
inline constexpr char kNtpShowWeather[] = "astro.ntp_show_weather";
inline constexpr char kNtpShowClock[] = "astro.ntp_show_clock";
inline constexpr char kNtpShowQuickLinks[] = "astro.ntp_show_quick_links";
inline constexpr char kNtpShowNotes[] = "astro.ntp_show_notes";
inline constexpr char kNtpShowSites[] = "astro.ntp_show_sites";
inline constexpr char kNtpShowDiscover[] = "astro.ntp_show_discover";
inline constexpr char kNtpShowAlia[] = "astro.ntp_show_alia";

// The order of the grid, as a list of the widget ids in astro_ntp.mojom
// spelled the way WidgetIdToStorageKey spells them. Normalised on every read:
// an unknown name is dropped and a missing one is appended, so a profile from
// a build with a different widget set still opens.
inline constexpr char kNtpWidgetOrder[] = "astro.ntp_widget_order";

// The user's own links, as a list of {title, url} dictionaries. Was
// localStorage on the page, which meant the browser could not see them, could
// not validate the URLs it was about to render, and lost them whenever the
// page's origin was cleared.
inline constexpr char kNtpQuickLinks[] = "astro.ntp_quick_links";

// The scratch note. Also localStorage before; also invisible to the browser.
inline constexpr char kNtpNotes[] = "astro.ntp_notes";

}  // namespace astro::prefs

#endif  // CHROME_BROWSER_OXY_ASTRO_PREF_NAMES_H_
