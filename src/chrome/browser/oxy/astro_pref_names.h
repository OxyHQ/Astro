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

}  // namespace astro::prefs

#endif  // CHROME_BROWSER_OXY_ASTRO_PREF_NAMES_H_
