// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/oxy/adblock/astro_adblock_service_factory.h"

#include <memory>

#include "chrome/browser/oxy/adblock/astro_adblock_service.h"
#include "chrome/browser/profiles/profile.h"

namespace oxy::adblock {

// static
AstroAdBlockService* AstroAdBlockServiceFactory::GetForProfile(
    Profile* profile) {
  if (!profile || profile->IsOffTheRecord()) {
    return nullptr;
  }
  return static_cast<AstroAdBlockService*>(
      GetInstance()->GetServiceForBrowserContext(profile, /*create=*/true));
}

// static
AstroAdBlockServiceFactory* AstroAdBlockServiceFactory::GetInstance() {
  static base::NoDestructor<AstroAdBlockServiceFactory> instance;
  return instance.get();
}

AstroAdBlockServiceFactory::AstroAdBlockServiceFactory()
    : ProfileKeyedServiceFactory("AstroAdBlockService") {}

AstroAdBlockServiceFactory::~AstroAdBlockServiceFactory() = default;

std::unique_ptr<KeyedService>
AstroAdBlockServiceFactory::BuildServiceInstanceForBrowserContext(
    content::BrowserContext* context) const {
  Profile* profile = Profile::FromBrowserContext(context);
  return std::make_unique<AstroAdBlockService>(
      profile->GetPrefs(), profile->GetPath());
}

}  // namespace oxy::adblock
