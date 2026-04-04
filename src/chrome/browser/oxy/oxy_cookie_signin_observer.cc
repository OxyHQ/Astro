// Copyright 2026 Oxy. All rights reserved.

#include "chrome/browser/oxy/oxy_cookie_signin_observer.h"

#include <string>

#include "base/json/json_reader.h"
#include "base/logging.h"
#include "chrome/browser/oxy/oxy_auth_service.h"
#include "chrome/browser/oxy/oxy_auth_token_store.h"
#include "chrome/browser/profiles/profile.h"
#include "components/prefs/pref_service.h"
#include "content/public/browser/storage_partition.h"
#include "net/cookies/cookie_change_dispatcher.h"
#include "net/traffic_annotation/network_traffic_annotation.h"
#include "services/network/public/cpp/resource_request.h"
#include "services/network/public/cpp/shared_url_loader_factory.h"
#include "services/network/public/cpp/simple_url_loader.h"
#include "services/network/public/mojom/cookie_manager.mojom.h"
#include "services/network/public/mojom/url_response_head.mojom.h"

namespace oxy {

namespace {

// The auth.oxy.so server sets this cookie after login via /fedcm/set-session.
// Its value is the session ID used to query the Oxy API.
constexpr char kOxyCookieName[] = "fedcm_session";

// Maximum response body size for API calls (1 MB).
constexpr int kMaxResponseBodySize = 1024 * 1024;

net::NetworkTrafficAnnotationTag GetUserFetchAnnotation() {
  return net::DefineNetworkTrafficAnnotation("oxy_cookie_signin_user_fetch",
      R"(
      semantics {
        sender: "Astro Oxy Cookie Sign-in"
        description:
          "After the user signs in on auth.oxy.so, the browser detects the "
          "session cookie and fetches the user's profile from api.oxy.so so "
          "it can display the username and avatar in the profile menu."
        trigger:
          "A session cookie is set on auth.oxy.so, indicating the user just "
          "signed in."
        data: "The session ID from the cookie."
        destination: OTHER
        internal {
          contacts { email: "team@oxy.so" }
        }
      }
      policy {
        cookies_allowed: NO
        setting: "Users can sign out via the profile menu."
      })");
}

net::NetworkTrafficAnnotationTag GetTokenFetchAnnotation() {
  return net::DefineNetworkTrafficAnnotation("oxy_cookie_signin_token_fetch",
      R"(
      semantics {
        sender: "Astro Oxy Cookie Sign-in"
        description:
          "After the user signs in on auth.oxy.so, the browser fetches an "
          "access token and refresh token from api.oxy.so using the session "
          "ID. These tokens are used for authenticated API requests."
        trigger:
          "User profile was successfully fetched after cookie-based sign-in."
        data: "The session ID from the cookie."
        destination: OTHER
        internal {
          contacts { email: "team@oxy.so" }
        }
      }
      policy {
        cookies_allowed: NO
        setting: "Users can sign out via the profile menu."
      })");
}

}  // namespace

OxyCookieSigninObserver::OxyCookieSigninObserver(Profile* profile)
    : profile_(profile) {
  StartListening();
}

OxyCookieSigninObserver::~OxyCookieSigninObserver() = default;

void OxyCookieSigninObserver::Shutdown() {
  weak_factory_.InvalidateWeakPtrs();
  user_profile_loader_.reset();
  session_tokens_loader_.reset();
  receiver_.reset();
}

void OxyCookieSigninObserver::StartListening() {
  network::mojom::CookieManager* cookie_manager =
      profile_->GetDefaultStoragePartition()
          ->GetCookieManagerForBrowserProcess();

  // Listen for the fedcm_session cookie on auth.oxy.so.
  // This mirrors Chrome's GAIA cookie observer pattern.
  cookie_manager->AddCookieChangeListener(
      GURL("https://auth.oxy.so"), kOxyCookieName,
      receiver_.BindNewPipeAndPassRemote());
}

void OxyCookieSigninObserver::OnCookieChange(
    const net::CookieChangeInfo& change) {
  const net::CanonicalCookie& cookie = change.cookie;

  // Safety check: only handle our specific cookie on oxy.so domains.
  if (cookie.Name() != kOxyCookieName ||
      cookie.Domain().find("oxy.so") == std::string::npos) {
    return;
  }

  // Cookie added or overwritten = user signed in on auth.oxy.so
  if (change.cause == net::CookieChangeCause::INSERTED ||
      change.cause == net::CookieChangeCause::OVERWRITE) {
    LOG(INFO) << "Oxy: Detected session cookie on auth.oxy.so";
    HandleOxySessionCookie(cookie.Value());
    return;
  }

  // Cookie explicitly deleted = user signed out on auth.oxy.so
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
    const std::string& session_id) {
  PrefService* prefs = profile_->GetPrefs();

  // Only auto-sign-in if not already signed in to the browser.
  std::string current_user = prefs->GetString(kOxyUserId);
  if (!current_user.empty()) {
    return;
  }

  if (session_id.empty()) {
    return;
  }

  // Store the session ID immediately so other components know auth is pending.
  prefs->SetString(kOxySessionId, session_id);

  // Fetch the user profile from the API to complete the sign-in.
  FetchUserProfile(session_id);
}

// --------------------------------------------------------------------------
// API: Fetch user profile
// --------------------------------------------------------------------------

void OxyCookieSigninObserver::FetchUserProfile(
    const std::string& session_id) {
  // Build the URL: GET /session/user/:sessionId
  std::string url = std::string(kOxyApiUrl) + "/session/user/" + session_id;

  auto resource_request = std::make_unique<network::ResourceRequest>();
  resource_request->url = GURL(url);
  resource_request->method = "GET";
  resource_request->headers.SetHeader("Accept", "application/json");
  // No cookies or Authorization header needed -- this is a public endpoint
  // that takes the session ID in the URL path.
  resource_request->credentials_mode = network::mojom::CredentialsMode::kOmit;

  user_profile_loader_ = network::SimpleURLLoader::Create(
      std::move(resource_request), GetUserFetchAnnotation());
  user_profile_loader_->SetAllowHttpErrorResults(true);

  auto* url_loader_factory =
      profile_->GetDefaultStoragePartition()
          ->GetURLLoaderFactoryForBrowserProcess()
          .get();

  user_profile_loader_->DownloadToString(
      url_loader_factory,
      base::BindOnce(&OxyCookieSigninObserver::OnUserProfileFetched,
                     weak_factory_.GetWeakPtr(), session_id),
      kMaxResponseBodySize);
}

void OxyCookieSigninObserver::OnUserProfileFetched(
    const std::string& session_id,
    std::unique_ptr<std::string> response_body) {
  // Release the loader now that the request is complete.
  user_profile_loader_.reset();

  if (!response_body) {
    LOG(WARNING) << "Oxy: Failed to fetch user profile (no response)";
    return;
  }

  // Parse the JSON response.
  // The API returns { data: { _id, username, email, avatar, name, ... } }
  auto json = base::JSONReader::Read(*response_body, base::JSON_PARSE_RFC);
  if (!json || !json->is_dict()) {
    LOG(WARNING) << "Oxy: Failed to parse user profile response";
    return;
  }

  const auto& root = json->GetDict();

  // The API wraps the user object in a "data" field.
  const base::Value::Dict* user_dict = root.FindDict("data");
  if (!user_dict) {
    // Fall back to reading directly from root if no wrapper.
    user_dict = &root;
  }

  const std::string* user_id = user_dict->FindString("_id");
  const std::string* username = user_dict->FindString("username");
  const std::string* avatar = user_dict->FindString("avatar");

  if (!user_id || user_id->empty()) {
    LOG(WARNING) << "Oxy: User profile response missing _id";
    return;
  }

  // Store user info in prefs so the profile menu can display it.
  PrefService* prefs = profile_->GetPrefs();
  prefs->SetString(kOxyUserId, *user_id);

  if (username) {
    prefs->SetString(kOxyUsername, *username);
  }

  if (avatar && !avatar->empty()) {
    // Build the avatar URL from the file ID.
    std::string avatar_url = std::string(kOxyApiUrl) + "/assets/" + *avatar +
                             "/stream?variant=thumb&fallback=placeholderVisible";
    prefs->SetString(kOxyUserAvatar, avatar_url);
  }

  LOG(INFO) << "Oxy: Browser sign-in complete for user " << *user_id
            << " (cookie-based flow)";

  // Now fetch the access/refresh tokens for authenticated API requests.
  FetchSessionTokens(session_id);
}

// --------------------------------------------------------------------------
// API: Fetch session tokens (access_token + refresh_token)
// --------------------------------------------------------------------------

void OxyCookieSigninObserver::FetchSessionTokens(
    const std::string& session_id) {
  // Build the URL: GET /session/token/:sessionId
  std::string url = std::string(kOxyApiUrl) + "/session/token/" + session_id;

  auto resource_request = std::make_unique<network::ResourceRequest>();
  resource_request->url = GURL(url);
  resource_request->method = "GET";
  resource_request->headers.SetHeader("Accept", "application/json");
  resource_request->credentials_mode = network::mojom::CredentialsMode::kOmit;

  session_tokens_loader_ = network::SimpleURLLoader::Create(
      std::move(resource_request), GetTokenFetchAnnotation());
  session_tokens_loader_->SetAllowHttpErrorResults(true);

  auto* url_loader_factory =
      profile_->GetDefaultStoragePartition()
          ->GetURLLoaderFactoryForBrowserProcess()
          .get();

  session_tokens_loader_->DownloadToString(
      url_loader_factory,
      base::BindOnce(&OxyCookieSigninObserver::OnSessionTokensFetched,
                     weak_factory_.GetWeakPtr()),
      kMaxResponseBodySize);
}

void OxyCookieSigninObserver::OnSessionTokensFetched(
    std::unique_ptr<std::string> response_body) {
  // Release the loader.
  session_tokens_loader_.reset();

  if (!response_body) {
    LOG(WARNING) << "Oxy: Failed to fetch session tokens (no response)";
    return;
  }

  auto json = base::JSONReader::Read(*response_body, base::JSON_PARSE_RFC);
  if (!json || !json->is_dict()) {
    LOG(WARNING) << "Oxy: Failed to parse session tokens response";
    return;
  }

  const auto& root = json->GetDict();
  const base::Value::Dict* data = root.FindDict("data");
  if (!data) {
    data = &root;
  }

  const std::string* access_token = data->FindString("accessToken");
  const std::string* refresh_token = data->FindString("refreshToken");

  if (access_token && !access_token->empty()) {
    OxyAuthTokenStore::StoreAccessToken(*access_token);
    LOG(INFO) << "Oxy: Access token stored from cookie-based sign-in";
  }

  if (refresh_token && !refresh_token->empty()) {
    OxyAuthTokenStore::StoreRefreshToken(*refresh_token);
  }

  // Store token expiry if present.
  auto expires_at = data->FindDouble("expiresAt");
  if (expires_at.has_value()) {
    PrefService* prefs = profile_->GetPrefs();
    prefs->SetString(kOxyTokenExpiry,
                     std::to_string(static_cast<int64_t>(*expires_at)));
  }
}

}  // namespace oxy
