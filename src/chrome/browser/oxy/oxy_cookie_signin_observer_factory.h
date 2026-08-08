// Copyright 2026 Oxy. All rights reserved.

#ifndef CHROME_BROWSER_OXY_OXY_COOKIE_SIGNIN_OBSERVER_FACTORY_H_
#define CHROME_BROWSER_OXY_OXY_COOKIE_SIGNIN_OBSERVER_FACTORY_H_

#include "base/no_destructor.h"
#include "chrome/browser/profiles/profile_keyed_service_factory.h"

class Profile;

namespace oxy {

class OxyCookieSigninObserver;

class OxyCookieSigninObserverFactory : public ProfileKeyedServiceFactory {
 public:
  static OxyCookieSigninObserver* GetForProfile(Profile* profile);
  static OxyCookieSigninObserverFactory* GetInstance();

  OxyCookieSigninObserverFactory(const OxyCookieSigninObserverFactory&) = delete;
  OxyCookieSigninObserverFactory& operator=(const OxyCookieSigninObserverFactory&) = delete;

 private:
  friend base::NoDestructor<OxyCookieSigninObserverFactory>;

  OxyCookieSigninObserverFactory();
  ~OxyCookieSigninObserverFactory() override;

  // BrowserContextKeyedServiceFactory:
  std::unique_ptr<KeyedService> BuildServiceInstanceForBrowserContext(
      content::BrowserContext* context) const override;
};

}  // namespace oxy

#endif  // CHROME_BROWSER_OXY_OXY_COOKIE_SIGNIN_OBSERVER_FACTORY_H_
