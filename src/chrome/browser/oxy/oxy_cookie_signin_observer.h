// Copyright 2026 Oxy. All rights reserved.

#ifndef CHROME_BROWSER_OXY_OXY_COOKIE_SIGNIN_OBSERVER_H_
#define CHROME_BROWSER_OXY_OXY_COOKIE_SIGNIN_OBSERVER_H_

#include "base/memory/raw_ptr.h"
#include "components/keyed_service/core/keyed_service.h"
#include "mojo/public/cpp/bindings/receiver.h"
#include "services/network/public/mojom/cookie_manager.mojom.h"

class Profile;

namespace oxy {

// Observes cookie changes on *.oxy.so domains.
// When an Oxy session cookie is detected (user signed in to an Oxy website),
// triggers automatic browser-level sign-in -- mirroring Chrome's behavior
// where signing in to a Google website signs you into the browser.
class OxyCookieSigninObserver : public KeyedService,
                                public network::mojom::CookieChangeListener {
 public:
  explicit OxyCookieSigninObserver(Profile* profile);
  ~OxyCookieSigninObserver() override;

  OxyCookieSigninObserver(const OxyCookieSigninObserver&) = delete;
  OxyCookieSigninObserver& operator=(const OxyCookieSigninObserver&) = delete;

 private:
  // KeyedService:
  void Shutdown() override;

  // network::mojom::CookieChangeListener:
  void OnCookieChange(const net::CookieChangeInfo& change) override;

  void StartListening();
  void HandleOxySessionCookie(const std::string& cookie_value);

  raw_ptr<Profile> profile_;
  mojo::Receiver<network::mojom::CookieChangeListener> receiver_{this};
};

}  // namespace oxy

#endif  // CHROME_BROWSER_OXY_OXY_COOKIE_SIGNIN_OBSERVER_H_
