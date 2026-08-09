// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_ASTRO_THEME_SERVICE_H_
#define CHROME_BROWSER_OXY_ASTRO_THEME_SERVICE_H_

#include <string>

#include "base/memory/raw_ptr.h"
#include "base/observer_list.h"
#include "base/observer_list_types.h"
#include "chrome/browser/themes/theme_service.h"
#include "components/keyed_service/core/keyed_service.h"
#include "components/prefs/pref_change_registrar.h"

class Profile;

namespace astro {

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
