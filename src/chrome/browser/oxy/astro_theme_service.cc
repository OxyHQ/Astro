// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/oxy/astro_theme_service.h"

#include <optional>
#include <string>

#include "base/functional/bind.h"
#include "base/logging.h"
#include "chrome/browser/oxy/astro_pref_names.h"
#include "chrome/browser/oxy/ui/astro_color_mixer.h"
#include "chrome/browser/oxy/ui/astro_color_tokens.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/themes/theme_service_factory.h"
#include "chrome/common/pref_names.h"
#include "components/prefs/pref_service.h"
#include "ui/native_theme/native_theme.h"

namespace astro {

AstroThemeService::AstroThemeService(Profile* profile) : profile_(profile) {
  pref_registrar_.Init(profile_->GetPrefs());
  pref_registrar_.Add(
      ::prefs::kBrowserColorScheme,
      base::BindRepeating(&AstroThemeService::OnColorSchemePrefChanged,
                          base::Unretained(this)));
  pref_registrar_.Add(
      prefs::kThemePreset,
      base::BindRepeating(&AstroThemeService::OnColorPresetPrefChanged,
                          base::Unretained(this)));

  // The stored preset has to reach the mixer before the first window paints,
  // which is why the factory builds this service with the profile rather than
  // on first use. No repaint here: nothing has been painted yet, and
  // NotifyOnNativeThemeUpdated is expensive enough that upstream says so in a
  // comment.
  ApplyPresetToNativeUi(/*repaint=*/false);
}

AstroThemeService::~AstroThemeService() = default;

ThemeService::BrowserColorScheme AstroThemeService::GetColorScheme() const {
  return ThemeServiceFactory::GetForProfile(profile_)->GetBrowserColorScheme();
}

void AstroThemeService::SetColorScheme(
    ThemeService::BrowserColorScheme scheme) {
  // Through ThemeService rather than straight at the pref: it is the owner of
  // that pref and does more than store it (it re-resolves the profile's
  // NativeTheme). Writing the pref behind its back would apply eventually and
  // differently.
  ThemeServiceFactory::GetForProfile(profile_)->SetBrowserColorScheme(scheme);
}

std::string AstroThemeService::GetColorPreset() const {
  const std::string stored =
      profile_->GetPrefs()->GetString(prefs::kThemePreset);
  if (ColorPresetFromName(stored).has_value()) {
    return stored;
  }
  // A name this build does not have came from somewhere real — a profile
  // written by a build carrying a newer Bloom, or a preset renamed upstream.
  // The stored value is left alone so that build still finds it.
  return prefs::kDefaultThemePreset;
}

bool AstroThemeService::SetColorPreset(const std::string& preset) {
  if (!ColorPresetFromName(preset).has_value()) {
    LOG(ERROR) << "Astro: refusing to store unknown colour preset '" << preset
               << "'; this build of Bloom ships " << kColorPresetCount
               << " presets and that is not one of them";
    return false;
  }
  profile_->GetPrefs()->SetString(prefs::kThemePreset, preset);
  return true;
}

void AstroThemeService::AddObserver(Observer* observer) {
  observers_.AddObserver(observer);
}

void AstroThemeService::RemoveObserver(Observer* observer) {
  observers_.RemoveObserver(observer);
}

void AstroThemeService::OnColorSchemePrefChanged() {
  // ThemeService owns this pref and has already moved NativeTheme, so the
  // native UI is repainting without any help. Only the pages need telling.
  for (Observer& observer : observers_) {
    observer.OnAstroThemeChanged();
  }
}

void AstroThemeService::OnColorPresetPrefChanged() {
  ApplyPresetToNativeUi(/*repaint=*/true);
  for (Observer& observer : observers_) {
    observer.OnAstroThemeChanged();
  }
}

void AstroThemeService::ApplyPresetToNativeUi(bool repaint) {
  const std::optional<ColorPreset> preset =
      ColorPresetFromName(GetColorPreset());
  // GetColorPreset only ever returns a name this build ships, and the default
  // it falls back to is static_asserted in astro_color_mixer.cc.
  CHECK(preset.has_value());

  SetActiveColorPreset(*preset);
  if (repaint) {
    // The mixer input is process-global (see astro_color_mixer.h), so every
    // cached ColorProvider in the process is now stale. This is what makes the
    // toolbar, tab strip and menus change colour with no restart.
    ui::NativeTheme::GetInstanceForNativeUi()->NotifyOnNativeThemeUpdated();
  }
}

}  // namespace astro
