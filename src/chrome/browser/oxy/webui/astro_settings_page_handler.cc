// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/oxy/webui/astro_settings_page_handler.h"

#include <string>
#include <utility>

#include "chrome/browser/oxy/astro_theme_service.h"
#include "chrome/browser/oxy/astro_theme_service_factory.h"
#include "chrome/browser/themes/theme_service.h"

namespace astro {

namespace {

ThemeService::BrowserColorScheme FromMojo(mojom::ThemeMode mode) {
  switch (mode) {
    case mojom::ThemeMode::kSystem:
      return ThemeService::BrowserColorScheme::kSystem;
    case mojom::ThemeMode::kLight:
      return ThemeService::BrowserColorScheme::kLight;
    case mojom::ThemeMode::kDark:
      return ThemeService::BrowserColorScheme::kDark;
  }
}

}  // namespace

AstroSettingsPageHandler::AstroSettingsPageHandler(
    Profile* profile,
    mojo::PendingReceiver<settings::mojom::PageHandler> receiver)
    : theme_service_(AstroThemeServiceFactory::GetForProfile(profile)),
      receiver_(this, std::move(receiver)) {}

AstroSettingsPageHandler::~AstroSettingsPageHandler() = default;

void AstroSettingsPageHandler::SetThemeMode(mojom::ThemeMode mode) {
  theme_service_->SetColorScheme(FromMojo(mode));
}

void AstroSettingsPageHandler::SetColorPreset(
    const std::string& preset,
    SetColorPresetCallback callback) {
  std::move(callback).Run(theme_service_->SetColorPreset(preset));
}

}  // namespace astro
