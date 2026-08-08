// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_UI_ASTRO_COLOR_MIXER_H_
#define CHROME_BROWSER_OXY_UI_ASTRO_COLOR_MIXER_H_

#include "chrome/browser/oxy/ui/astro_color_tokens.h"
#include "ui/color/color_provider_key.h"

namespace ui {
class ColorProvider;
}

namespace astro {

// Paints Chromium's native UI — toolbar, omnibox, tab strip, frame, menus —
// from the Bloom colour preset the profile selected, so the browser around a
// page and the page itself are the same theme rather than two that happen to
// look alike.
//
// Called LAST from AddChromeColorMixers (patch 061), because the last mixer
// added wins. Which Chromium ColorId a Bloom token paints is decided here, by
// hand: astro_color_tokens.h carries the values and knows nothing about
// Chromium, and this file carries the mapping and computes no colour.
void AddAstroColorMixers(ui::ColorProvider* provider,
                         const ui::ColorProviderKey& key);

// The preset the mixer paints from.
//
// PROCESS-GLOBAL in v1, which is a real limitation and not an oversight: a
// ColorProvider is looked up by ui::ColorProviderKey, and that key carries no
// profile, so a per-profile preset needs a key extension. With more than one
// profile open the last write wins for every window. Tracked on issue #24.
//
// AstroThemeService is the only writer. Setting it does NOT repaint anything
// on its own — the caller must invalidate the ColorProvider caches, which is
// what NativeTheme::NotifyOnNativeThemeUpdated() does.
void SetActiveColorPreset(ColorPreset preset);
ColorPreset GetActiveColorPresetForTesting();

}  // namespace astro

#endif  // CHROME_BROWSER_OXY_UI_ASTRO_COLOR_MIXER_H_
