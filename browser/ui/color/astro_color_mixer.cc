// Copyright 2026 Oxy. Astro product module.

#include "astro/browser/ui/color/astro_color_mixer.h"

#include "astro/browser/resources/palette/astro_palette.h"
#include "chrome/browser/ui/color/chrome_color_id.h"
#include "ui/color/color_id.h"
#include "ui/color/color_mixer.h"
#include "ui/color/color_provider.h"
#include "ui/color/color_provider_key.h"
#include "ui/color/color_recipe.h"

namespace astro {

void AddAstroColorMixers(ui::ColorProvider* provider,
                         const ui::ColorProviderKey& key) {
  const bool dark = key.color_mode == ui::ColorProviderKey::ColorMode::kDark;

  const SkColor primary = dark ? kAstroPrimaryDark : kAstroPrimaryLight;
  const SkColor on_primary =
      dark ? kAstroPrimaryForegroundDark : kAstroPrimaryForegroundLight;
  const SkColor surface = dark ? kAstroCardDark : kAstroCardLight;
  const SkColor on_surface =
      dark ? kAstroCardForegroundDark : kAstroCardForegroundLight;
  const SkColor border = dark ? kAstroBorderDark : kAstroBorderLight;

  ui::ColorMixer& mixer = provider->AddMixer();

  // The surfaces a person actually looks at, and only those.
  //
  // A mixer that reassigns every id it can name is how a theme becomes
  // unreadable in one colour mode without anything reporting it: nothing in
  // the build has an opinion about contrast, so each id here is one somebody
  // has looked at in both modes.
  mixer[ui::kColorAccent] = {primary};
  mixer[ui::kColorButtonBackgroundProminent] = {primary};
  mixer[ui::kColorButtonForegroundProminent] = {on_primary};
  mixer[ui::kColorCheckboxForegroundChecked] = {primary};
  mixer[ui::kColorFocusableBorderFocused] = {primary};
  mixer[ui::kColorLinkForegroundDefault] = {primary};
  mixer[ui::kColorTextfieldSelectionBackground] = {primary};
  mixer[ui::kColorToggleButtonTrackOn] = {primary};

  mixer[ui::kColorMenuBackground] = {surface};
  mixer[ui::kColorMenuItemForeground] = {on_surface};
  mixer[ui::kColorMenuSeparator] = {border};

  mixer[kColorToolbar] = {surface};
  mixer[kColorToolbarText] = {on_surface};
  mixer[kColorToolbarSeparator] = {border};
  mixer[kColorLocationBarBorder] = {border};
}

}  // namespace astro
