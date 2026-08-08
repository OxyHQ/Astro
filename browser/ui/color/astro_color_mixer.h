// Copyright 2026 Oxy. Astro product module.

#ifndef ASTRO_BROWSER_UI_COLOR_ASTRO_COLOR_MIXER_H_
#define ASTRO_BROWSER_UI_COLOR_ASTRO_COLOR_MIXER_H_

namespace ui {
struct ColorProviderKey;
class ColorProvider;
}  // namespace ui

namespace astro {

// Astro's palette, applied to Chromium's native UI.
//
// The ColorProvider paints the browser itself -- frame, tabs, omnibox, menus,
// dialogs -- from roughly 1,588 colour ids. It is a separate world from the
// CSS the WebUI pages use, and Chromium keeps no link between the two.
//
// The values here come from //astro/browser/resources/palette, which asks
// Bloom for its palette once and emits BOTH this header and the stylesheet the
// pages read. Deriving it twice is how a browser frame ends up almost the same
// purple as a settings card, which nobody notices until the two are adjacent.
void AddAstroColorMixers(ui::ColorProvider* provider,
                         const ui::ColorProviderKey& key);

}  // namespace astro

#endif  // ASTRO_BROWSER_UI_COLOR_ASTRO_COLOR_MIXER_H_
