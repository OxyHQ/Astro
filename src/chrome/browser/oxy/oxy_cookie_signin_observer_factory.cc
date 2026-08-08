// Copyright 2026 Oxy. All rights reserved.

#include "chrome/browser/oxy/oxy_cookie_signin_observer_factory.h"

#include <memory>

#include "chrome/browser/oxy/oxy_cookie_signin_observer.h"
#include "chrome/browser/profiles/profile.h"
#include "content/public/browser/browser_context.h"

namespace oxy {

// static
OxyCookieSigninObserver* OxyCookieSigninObserverFactory::GetForProfile(
    Profile* profile) {
  return static_cast<OxyCookieSigninObserver*>(
      GetInstance()->GetServiceForBrowserContext(profile, /*create=*/true));
}

// static
OxyCookieSigninObserverFactory* OxyCookieSigninObserverFactory::GetInstance() {
  static base::NoDestructor<OxyCookieSigninObserverFactory> instance;
  return instance.get();
}

OxyCookieSigninObserverFactory::OxyCookieSigninObserverFactory()
    : ProfileKeyedServiceFactory(
          "OxyCookieSigninObserver",
          ProfileSelections::Builder()
              .WithRegular(ProfileSelection::kOriginalOnly)
              .WithGuest(ProfileSelection::kNone)
              .Build()) {}

OxyCookieSigninObserverFactory::~OxyCookieSigninObserverFactory() = default;

std::unique_ptr<KeyedService>
OxyCookieSigninObserverFactory::BuildServiceInstanceForBrowserContext(
    content::BrowserContext* context) const {
  Profile* profile = Profile::FromBrowserContext(context);
  return std::make_unique<OxyCookieSigninObserver>(profile);
}

}  // namespace oxy
