// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_ASTRO_THEME_SERVICE_H_
#define CHROME_BROWSER_OXY_ASTRO_THEME_SERVICE_H_

#include <string>

#include "base/memory/raw_ptr.h"
#include "base/observer_list.h"
#include "base/observer_list_types.h"
#include "chrome/browser/oxy/astro_pref_names.h"
#include "chrome/browser/oxy/ui/astro_color_tokens.h"
#include "chrome/browser/themes/theme_service.h"
#include "components/keyed_service/core/keyed_service.h"
#include "components/prefs/pref_change_registrar.h"

class Profile;

namespace astro {

// The pref's registered default, as a preset rather than a string. `.value()`
// is not a shortcut: in a constant expression it makes a default naming a
// preset this build of Bloom does not ship a compile error here, at the one
// place that resolves it.
inline constexpr ColorPreset kDefaultColorPreset =
    ColorPresetFromName(prefs::kDefaultThemePreset).value();

// Whether this build offers `preset` for somebody to choose.
//
// Bloom gates three of its eighteen presets and only DECLARES the gate —
// enforcing it is the consuming app's job, because only the app knows who is
// signed in and what they pay for. Astro knows neither, so its answer is
// fixed: it offers what nobody gates, plus its OWN default preset. `oxy` is
// gated to Oxy's brand and this browser is Oxy's, which is exactly what that
// gate is for; `faircoin` is another organisation's brand and `mono` is sold
// with a subscription, so neither is Astro's to hand out.
//
// This is the same rule webui/app's appearance section states as
// `['oxy', ...FREE_COLOR_NAMES]`, and
// tools/tests/cases/offered-presets-match-across-the-boundary.sh is what keeps
// the two from drifting.
//
// It reads the GENERATED gate table rather than listing names, deliberately: a
// hand-written palette rots the first time Bloom adds a preset, silently, and
// in the direction that offers it. The gates used to be C++ comments only,
// which is how the colour picker came to offer all eighteen.
constexpr bool IsColorPresetOffered(ColorPreset preset) {
  return ColorPresetGateFor(preset) == ColorPresetGate::kNone ||
         preset == kDefaultColorPreset;
}

// The one authority for "what theme is this profile using", for the native
// browser UI and for every astro:// page at once.
//
// Two facts make up a theme and they are stored in two different places, on
// purpose:
//
//   mode    upstream's `browser.theme.color_scheme2`, owned by ThemeService.
//           It already drives NativeTheme and is policy-manageable, so Astro
//           reads and writes it rather than keeping a second copy.
//   preset  astro::prefs::kThemePreset, a Bloom colour-preset name. Astro's
//           own, because Chromium has no concept of it.
//
// The service watches both, pushes the preset into the native colour mixer,
// invalidates the ColorProvider caches so open windows repaint without a
// restart, and tells its observers so the WebUI pages re-render. A page never
// applies a theme it chose locally: it asks for a change, the pref moves, and
// the echo is what moves the page — which is why the toolbar and the settings
// page cannot show different colours.
class AstroThemeService : public KeyedService {
 public:
  class Observer : public base::CheckedObserver {
   public:
    // Either fact changed. Deliberately carries no payload: the service is the
    // only source, so an observer re-reads it and cannot cache a value that
    // disagrees with the prefs.
    virtual void OnAstroThemeChanged() = 0;
  };

  explicit AstroThemeService(Profile* profile);
  ~AstroThemeService() override;

  AstroThemeService(const AstroThemeService&) = delete;
  AstroThemeService& operator=(const AstroThemeService&) = delete;

  // The light/dark decision, as stored. `kSystem` means "follow the OS" and is
  // reported as such rather than resolved here — a page that resolves it
  // itself through prefers-color-scheme stays correct when the OS flips
  // without any round trip.
  ThemeService::BrowserColorScheme GetColorScheme() const;
  void SetColorScheme(ThemeService::BrowserColorScheme scheme);

  // The Bloom colour preset, by name. Always a name this build ships: a
  // profile carrying an unknown one (written by a build with a newer Bloom)
  // reads back as the default rather than as a colour nothing can paint.
  std::string GetColorPreset() const;

  // Returns false and writes nothing when `preset` is not a preset this build
  // ships. Rejecting rather than falling back keeps a typo out of the profile,
  // where it would be indistinguishable from a version skew forever after.
  //
  // It also refuses a preset this build does not OFFER — see
  // IsColorPresetOffered. The check is here, at the one writer, rather than in
  // each caller, because a caller that forgets it hands out somebody else's
  // brand colour and nothing reports that: the colour is real, the browser
  // paints it, and only the person whose brand it is ever finds out. Reading
  // is deliberately not symmetric: a profile that already carries a gated
  // preset keeps being painted with it, because painting what is stored is not
  // the same act as offering it.
  bool SetColorPreset(const std::string& preset);

  void AddObserver(Observer* observer);
  void RemoveObserver(Observer* observer);

 private:
  // Both prefs land here. The preset half is the expensive one, so the two are
  // told apart rather than repainting the world on a light/dark toggle
  // ThemeService has already repainted.
  void OnColorSchemePrefChanged();
  void OnColorPresetPrefChanged();

  // Pushes the stored preset into the process-global mixer input and, when
  // that actually changed anything, drops every cached ColorProvider so open
  // windows repaint.
  void ApplyPresetToNativeUi(bool repaint);

  const raw_ptr<Profile> profile_;
  PrefChangeRegistrar pref_registrar_;
  base::ObserverList<Observer> observers_;
};

}  // namespace astro

#endif  // CHROME_BROWSER_OXY_ASTRO_THEME_SERVICE_H_
