// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/oxy/webui/astro_theme_provider.h"

#include <utility>

#include "chrome/browser/oxy/astro_theme_service_factory.h"

namespace astro {

namespace {

mojom::ThemeMode ToMojo(ThemeService::BrowserColorScheme scheme) {
  switch (scheme) {
    case ThemeService::BrowserColorScheme::kSystem:
      return mojom::ThemeMode::kSystem;
    case ThemeService::BrowserColorScheme::kLight:
      return mojom::ThemeMode::kLight;
    case ThemeService::BrowserColorScheme::kDark:
      return mojom::ThemeMode::kDark;
  }
}

}  // namespace

AstroThemeProvider::AstroThemeProvider(Profile* profile)
    : service_(AstroThemeServiceFactory::GetForProfile(profile)) {
  observation_.Observe(service_);
}

AstroThemeProvider::~AstroThemeProvider() = default;

void AstroThemeProvider::Bind(
    mojo::PendingReceiver<mojom::ThemeProvider> receiver) {
  // A page that reloads binds again over the same controller.
  receiver_.reset();
  receiver_.Bind(std::move(receiver));
}

void AstroThemeProvider::GetTheme(GetThemeCallback callback) {
  std::move(callback).Run(CurrentTheme());
}

void AstroThemeProvider::AddObserver(
    mojo::PendingRemote<mojom::ThemeObserver> observer) {
  observers_.Add(std::move(observer));
}

void AstroThemeProvider::OnAstroThemeChanged() {
  for (const auto& observer : observers_) {
    observer->OnThemeChanged(CurrentTheme());
  }
}

mojom::ThemePtr AstroThemeProvider::CurrentTheme() const {
  return mojom::Theme::New(ToMojo(service_->GetColorScheme()),
                           service_->GetColorPreset());
}

}  // namespace astro
