// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_ADBLOCK_ASTRO_ADBLOCK_SERVICE_FACTORY_H_
#define CHROME_BROWSER_OXY_ADBLOCK_ASTRO_ADBLOCK_SERVICE_FACTORY_H_

#include "base/no_destructor.h"
#include "chrome/browser/profiles/profile_keyed_service_factory.h"

class Profile;

namespace oxy::adblock {

class AstroAdBlockService;

// Factory for creating AstroAdBlockService instances per profile.
class AstroAdBlockServiceFactory : public ProfileKeyedServiceFactory {
 public:
  static AstroAdBlockService* GetForProfile(Profile* profile);
  static AstroAdBlockServiceFactory* GetInstance();

  AstroAdBlockServiceFactory(const AstroAdBlockServiceFactory&) = delete;
  AstroAdBlockServiceFactory& operator=(const AstroAdBlockServiceFactory&) =
      delete;

 private:
  friend base::NoDestructor<AstroAdBlockServiceFactory>;

  AstroAdBlockServiceFactory();
  ~AstroAdBlockServiceFactory() override;

  // BrowserContextKeyedServiceFactory:
  std::unique_ptr<KeyedService> BuildServiceInstanceForBrowserContext(
      content::BrowserContext* context) const override;
};

}  // namespace oxy::adblock

#endif  // CHROME_BROWSER_OXY_ADBLOCK_ASTRO_ADBLOCK_SERVICE_FACTORY_H_
