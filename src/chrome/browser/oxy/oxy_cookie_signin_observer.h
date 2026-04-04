// Copyright 2026 Oxy. All rights reserved.

#ifndef CHROME_BROWSER_OXY_OXY_COOKIE_SIGNIN_OBSERVER_H_
#define CHROME_BROWSER_OXY_OXY_COOKIE_SIGNIN_OBSERVER_H_

#include <memory>
#include <optional>
#include <string>

#include "base/memory/raw_ptr.h"
#include "base/memory/weak_ptr.h"
#include "components/keyed_service/core/keyed_service.h"
#include "mojo/public/cpp/bindings/receiver.h"
#include "services/network/public/mojom/cookie_manager.mojom.h"

namespace network {
class SimpleURLLoader;
}  // namespace network

class Profile;

namespace oxy {

// Observes cookie changes on *.oxy.so domains.
// When an Oxy session cookie is detected (user signed in to an Oxy website),
// fetches the user profile from the Oxy API and stores it in prefs --
// completing the browser-level sign-in. This mirrors Chrome's behavior where
// signing in to a Google website signs you into the browser.
//
// Flow:
//   1. User signs in on auth.oxy.so/login (plain page, no special params)
//   2. auth.oxy.so sets a fedcm_session cookie with the session ID
//   3. This observer detects the cookie change
//   4. Calls GET /session/user/:sessionId on api.oxy.so to get user profile
//   5. Calls GET /session/token/:sessionId to get access + refresh tokens
//   6. Stores everything in prefs -> profile menu updates
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
  void HandleOxySessionCookie(const std::string& session_id);

  // API calls to fetch user profile and tokens using the session ID.
  void FetchUserProfile(const std::string& session_id);
  void OnUserProfileFetched(
                            std::optional<std::string> response_body);

  void FetchSessionTokens(const std::string& session_id);
  void OnSessionTokensFetched(std::optional<std::string> response_body);

  raw_ptr<Profile> profile_;
  mojo::Receiver<network::mojom::CookieChangeListener> receiver_{this};

  // Loaders are kept alive until their callbacks fire.
  std::unique_ptr<network::SimpleURLLoader> user_profile_loader_;
  std::unique_ptr<network::SimpleURLLoader> session_tokens_loader_;
  std::string pending_session_id_;

  base::WeakPtrFactory<OxyCookieSigninObserver> weak_factory_{this};
};

}  // namespace oxy

#endif  // CHROME_BROWSER_OXY_OXY_COOKIE_SIGNIN_OBSERVER_H_
