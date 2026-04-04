// Copyright 2026 Oxy. All rights reserved.

#include "chrome/browser/oxy/oxy_cookie_signin_observer.h"

#include "base/logging.h"
#include "chrome/browser/oxy/oxy_auth_service.h"
#include "chrome/browser/oxy/oxy_auth_token_store.h"
#include "chrome/browser/profiles/profile.h"
#include "components/prefs/pref_service.h"
#include "content/public/browser/storage_partition.h"
#include "net/cookies/cookie_change_dispatcher.h"
#include "services/network/public/mojom/cookie_manager.mojom.h"

namespace oxy {

namespace {
constexpr char kOxySessionCookieName[] = "oxy_session";
}  // namespace

OxyCookieSigninObserver::OxyCookieSigninObserver(Profile* profile)
    : profile_(profile) {
  StartListening();
}

OxyCookieSigninObserver::~OxyCookieSigninObserver() = default;

void OxyCookieSigninObserver::Shutdown() {
  receiver_.reset();
}

void OxyCookieSigninObserver::StartListening() {
  network::mojom::CookieManager* cookie_manager =
      profile_->GetDefaultStoragePartition()
          ->GetCookieManagerForBrowserProcess();

  // Listen for cookie changes on auth.oxy.so for the session cookie.
  // This mirrors Chrome's GAIA cookie observer pattern.
  cookie_manager->AddCookieChangeListener(
      GURL("https://auth.oxy.so"), kOxySessionCookieName,
      receiver_.BindNewPipeAndPassRemote());
}

void OxyCookieSigninObserver::OnCookieChange(
    const net::CookieChangeInfo& change) {
  const net::CanonicalCookie& cookie = change.cookie;

  // Only handle cookies on oxy.so domains
  if (cookie.Name() != kOxySessionCookieName ||
      cookie.Domain().find("oxy.so") == std::string::npos) {
    return;
  }

  // Cookie added or overwritten = user signed in on an Oxy website
  if (change.cause == net::CookieChangeCause::INSERTED ||
      change.cause == net::CookieChangeCause::OVERWRITE) {
    LOG(INFO) << "Oxy: Detected session cookie on oxy.so";
    HandleOxySessionCookie(cookie.Value());
    return;
  }

  // Cookie explicitly deleted = user signed out on an Oxy website
  if (change.cause == net::CookieChangeCause::EXPLICIT) {
    PrefService* prefs = profile_->GetPrefs();
    std::string current_user = prefs->GetString(kOxyUserId);
    if (!current_user.empty()) {
      LOG(INFO) << "Oxy: Session cookie removed, signing out of Astro";
      prefs->ClearPref(kOxySessionId);
      prefs->ClearPref(kOxyUserId);
      prefs->ClearPref(kOxyUsername);
      prefs->ClearPref(kOxyUserAvatar);
      prefs->ClearPref(kOxyTokenExpiry);
      OxyAuthTokenStore::ClearTokens();
    }
  }
}

void OxyCookieSigninObserver::HandleOxySessionCookie(
    const std::string& cookie_value) {
  PrefService* prefs = profile_->GetPrefs();

  // Only auto-sign-in if not already signed in to the browser
  std::string current_user = prefs->GetString(kOxyUserId);
  if (!current_user.empty()) {
    return;
  }

  // Store the session ID from the cookie. The full token exchange
  // (session -> access_token + refresh_token + user info) will happen
  // when we validate against api.oxy.so on the next API call.
  prefs->SetString(kOxySessionId, cookie_value);

  LOG(INFO) << "Oxy: Auto-detected sign-in via cookie, session stored. "
            << "Full token exchange pending next API call.";
}

}  // namespace oxy
