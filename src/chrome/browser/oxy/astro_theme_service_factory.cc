// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/oxy/astro_theme_service_factory.h"

#include <memory>

#include "chrome/browser/oxy/astro_theme_service.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/themes/theme_service_factory.h"
#include "content/public/browser/browser_context.h"

namespace astro {

// static
AstroThemeService* AstroThemeServiceFactory::GetForProfile(Profile* profile) {
  return static_cast<AstroThemeService*>(
      GetInstance()->GetServiceForBrowserContext(profile, /*create=*/true));
}

// static
AstroThemeServiceFactory* AstroThemeServiceFactory::GetInstance() {
  static base::NoDestructor<AstroThemeServiceFactory> instance;
  return instance.get();
}

AstroThemeServiceFactory::AstroThemeServiceFactory()
    : ProfileKeyedServiceFactory(
          "AstroThemeService",
          // An incognito window is chrome around the same profile's theme, not
          // a place to choose a different one, so it redirects to the original
          // rather than getting an instance whose writes go nowhere.
          ProfileSelections::Builder()
              .WithRegular(ProfileSelection::kRedirectedToOriginal)
              .WithGuest(ProfileSelection::kRedirectedToOriginal)
              .Build()) {
  DependsOn(ThemeServiceFactory::GetInstance());
}

AstroThemeServiceFactory::~AstroThemeServiceFactory() = default;

std::unique_ptr<KeyedService>
AstroThemeServiceFactory::BuildServiceInstanceForBrowserContext(
    content::BrowserContext* context) const {
  return std::make_unique<AstroThemeService>(
      Profile::FromBrowserContext(context));
}

bool AstroThemeServiceFactory::ServiceIsCreatedWithBrowserContext() const {
  // The stored preset has to be in the colour mixer before the first window
  // paints. Created on first use, the browser would open in the default
  // colours and switch as soon as something happened to ask for the theme.
  return true;
}

}  // namespace astro
