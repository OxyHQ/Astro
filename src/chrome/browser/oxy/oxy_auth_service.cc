// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/oxy/oxy_auth_service.h"

#include "base/logging.h"
#include "base/strings/string_number_conversions.h"
#include "base/time/time.h"
#include "chrome/browser/oxy/oxy_auth_token_store.h"
#include "components/prefs/pref_service.h"
#include "net/base/url_util.h"
#include "url/gurl.h"

namespace oxy {

namespace {
// Refresh tokens 5 minutes before they expire
constexpr base::TimeDelta kRefreshBuffer = base::Minutes(5);
}  // namespace

OxyAuthService::OxyAuthService(PrefService* prefs) : prefs_(prefs) {
  // Try to restore session from stored tokens
  LoadTokens();
}

OxyAuthService::~OxyAuthService() = default;

bool OxyAuthService::IsSignedIn() const {
  return is_signed_in_ && !access_token_.empty();
}

std::optional<OxyUser> OxyAuthService::GetCurrentUser() const {
  if (!is_signed_in_) {
    return std::nullopt;
  }
  return current_user_;
}

std::string OxyAuthService::GetAccessToken() const {
  return access_token_;
}

void OxyAuthService::HandleAuthCallback(
    const std::string& session_id,
    const std::string& access_token,
    const std::string& refresh_token,
    const std::string& user_id,
    const std::string& username,
    const std::string& avatar_url,
    int64_t expires_at) {
  session_id_ = session_id;
  access_token_ = access_token;
  refresh_token_ = refresh_token;

  current_user_.id = user_id;
  current_user_.username = username;
  current_user_.avatar_url = avatar_url;

  token_expiry_ = base::Time::FromSecondsSinceUnixEpoch(
      static_cast<double>(expires_at));

  is_signed_in_ = true;

  // Persist tokens securely
  StoreTokens(access_token, refresh_token);

  // Save user info to prefs (non-sensitive)
  prefs_->SetString(kOxySessionId, session_id);
  prefs_->SetString(kOxyUserId, user_id);
  prefs_->SetString(kOxyUsername, username);
  prefs_->SetString(kOxyUserAvatar, avatar_url);
  prefs_->SetString(kOxyTokenExpiry,
                    base::NumberToString(expires_at));

  // Schedule refresh
  ScheduleTokenRefresh();

  // Notify observers
  NotifyAuthStateChanged();

  LOG(INFO) << "Oxy: Signed in as " << username;
}

void OxyAuthService::SignOut() {
  is_signed_in_ = false;
  access_token_.clear();
  refresh_token_.clear();
  session_id_.clear();
  current_user_ = OxyUser();
  token_expiry_ = base::Time();
  refresh_timer_.Stop();

  // Clear stored tokens
  OxyAuthTokenStore::ClearTokens();

  // Clear prefs
  prefs_->ClearPref(kOxySessionId);
  prefs_->ClearPref(kOxyUserId);
  prefs_->ClearPref(kOxyUsername);
  prefs_->ClearPref(kOxyUserAvatar);
  prefs_->ClearPref(kOxyTokenExpiry);

  NotifyAuthStateChanged();

  LOG(INFO) << "Oxy: Signed out";
}

std::string OxyAuthService::GetSignInUrl() const {
  // Build the auth URL with callback parameters
  GURL auth_url(std::string(kOxyAuthUrl) + "/login");
  auth_url = net::AppendQueryParameter(auth_url, "client_id", "astro-browser");
  auth_url = net::AppendQueryParameter(auth_url, "redirect_uri",
                                       "astro://auth/callback");
  auth_url = net::AppendQueryParameter(auth_url, "response_type", "token");
  return auth_url.spec();
}

void OxyAuthService::AddObserver(Observer* observer) {
  observers_.AddObserver(observer);
}

void OxyAuthService::RemoveObserver(Observer* observer) {
  observers_.RemoveObserver(observer);
}

void OxyAuthService::Shutdown() {
  refresh_timer_.Stop();
  observers_.Clear();
}

void OxyAuthService::StoreTokens(const std::string& access_token,
                                 const std::string& refresh_token) {
  OxyAuthTokenStore::StoreAccessToken(access_token);
  OxyAuthTokenStore::StoreRefreshToken(refresh_token);
}

bool OxyAuthService::LoadTokens() {
  std::string access_token = OxyAuthTokenStore::LoadAccessToken();
  std::string refresh_token = OxyAuthTokenStore::LoadRefreshToken();

  if (access_token.empty()) {
    return false;
  }

  access_token_ = access_token;
  refresh_token_ = refresh_token;
  session_id_ = prefs_->GetString(kOxySessionId);

  // Restore user info from prefs
  current_user_.id = prefs_->GetString(kOxyUserId);
  current_user_.username = prefs_->GetString(kOxyUsername);
  current_user_.avatar_url = prefs_->GetString(kOxyUserAvatar);

  // Check token expiry
  std::string expiry_str = prefs_->GetString(kOxyTokenExpiry);
  int64_t expiry_seconds = 0;
  if (base::StringToInt64(expiry_str, &expiry_seconds)) {
    token_expiry_ = base::Time::FromSecondsSinceUnixEpoch(
        static_cast<double>(expiry_seconds));
  }

  if (!current_user_.id.empty()) {
    is_signed_in_ = true;
    ScheduleTokenRefresh();
    LOG(INFO) << "Oxy: Restored session for " << current_user_.username;
    return true;
  }

  return false;
}

void OxyAuthService::ScheduleTokenRefresh() {
  if (token_expiry_.is_null()) {
    return;
  }

  base::TimeDelta delay = token_expiry_ - base::Time::Now() - kRefreshBuffer;
  if (delay.is_negative()) {
    // Token already expired or about to, refresh now
    RefreshToken();
    return;
  }

  refresh_timer_.Start(FROM_HERE, delay,
                       base::BindOnce(&OxyAuthService::RefreshToken,
                                      base::Unretained(this)));
}

void OxyAuthService::RefreshToken() {
  // TODO(Phase 2): Implement token refresh via
  // api.oxy.so/session/token/:sessionId
  // For now, sign out if token expires
  if (base::Time::Now() > token_expiry_) {
    LOG(WARNING) << "Oxy: Token expired, signing out";
    SignOut();
  }
}

void OxyAuthService::NotifyAuthStateChanged() {
  for (auto& observer : observers_) {
    observer.OnOxyAuthStateChanged(is_signed_in_);
    if (is_signed_in_) {
      observer.OnOxyUserInfoUpdated(current_user_);
    }
  }
}

}  // namespace oxy
