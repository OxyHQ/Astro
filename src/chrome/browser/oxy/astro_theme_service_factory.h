// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_ASTRO_THEME_SERVICE_FACTORY_H_
#define CHROME_BROWSER_OXY_ASTRO_THEME_SERVICE_FACTORY_H_

#include <memory>

#include "base/no_destructor.h"
#include "chrome/browser/profiles/profile_keyed_service_factory.h"

class KeyedService;
class Profile;

namespace astro {

class AstroThemeService;

class AstroThemeServiceFactory : public ProfileKeyedServiceFactory {
 public:
  static AstroThemeService* GetForProfile(Profile* profile);
  static AstroThemeServiceFactory* GetInstance();

  AstroThemeServiceFactory(const AstroThemeServiceFactory&) = delete;
  AstroThemeServiceFactory& operator=(const AstroThemeServiceFactory&) = delete;

 private:
  friend base::NoDestructor<AstroThemeServiceFactory>;

  AstroThemeServiceFactory();
  ~AstroThemeServiceFactory() override;

  // BrowserContextKeyedServiceFactory:
  std::unique_ptr<KeyedService> BuildServiceInstanceForBrowserContext(
      content::BrowserContext* context) const override;
  bool ServiceIsCreatedWithBrowserContext() const override;
};

}  // namespace astro

#endif  // CHROME_BROWSER_OXY_ASTRO_THEME_SERVICE_FACTORY_H_
