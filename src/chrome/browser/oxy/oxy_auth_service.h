// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_OXY_AUTH_SERVICE_H_
#define CHROME_BROWSER_OXY_OXY_AUTH_SERVICE_H_

#include <string>
#include <optional>

#include "base/memory/raw_ptr.h"
#include "base/observer_list.h"
#include "base/timer/timer.h"
#include "components/keyed_service/core/keyed_service.h"

class PrefService;

namespace oxy {

// URLs for Oxy authentication services
inline constexpr char kOxyAuthUrl[] = "https://auth.oxy.so";
inline constexpr char kOxyApiUrl[] = "https://api.oxy.so";
inline constexpr char kOxyAuthCallbackScheme[] = "astro";
inline constexpr char kOxyAuthCallbackPath[] = "auth/callback";

// Pref keys for Oxy auth state
inline constexpr char kOxyAccessToken[] = "oxy.access_token";
inline constexpr char kOxyRefreshToken[] = "oxy.refresh_token";
inline constexpr char kOxySessionId[] = "oxy.session_id";
inline constexpr char kOxyUserId[] = "oxy.user_id";
inline constexpr char kOxyUsername[] = "oxy.username";
inline constexpr char kOxyUserAvatar[] = "oxy.user_avatar";
inline constexpr char kOxyTokenExpiry[] = "oxy.token_expiry";

struct OxyUser {
  std::string id;
  std::string username;
  std::string avatar_url;
  std::string email;
};

// Manages Oxy authentication state for a browser profile.
// One instance per profile, created via OxyAuthServiceFactory.
class OxyAuthService : public KeyedService {
 public:
  class Observer : public base::CheckedObserver {
   public:
    // Called when authentication state changes (sign in/out).
    virtual void OnOxyAuthStateChanged(bool is_signed_in) {}
    // Called when user info is updated.
    virtual void OnOxyUserInfoUpdated(const OxyUser& user) {}
  };

  explicit OxyAuthService(PrefService* prefs);
  ~OxyAuthService() override;

  OxyAuthService(const OxyAuthService&) = delete;
  OxyAuthService& operator=(const OxyAuthService&) = delete;

  // Authentication state
  bool IsSignedIn() const;
  std::optional<OxyUser> GetCurrentUser() const;
  std::string GetAccessToken() const;

  // Sign in: called when auth callback is received from auth.oxy.so
  void HandleAuthCallback(const std::string& session_id,
                          const std::string& access_token,
                          const std::string& refresh_token,
                          const std::string& user_id,
                          const std::string& username,
                          const std::string& avatar_url,
                          int64_t expires_at);

  // Sign out: clears all stored credentials
  void SignOut();

  // Returns the sign-in URL to open in a tab
  std::string GetSignInUrl() const;

  // Observer management
  void AddObserver(Observer* observer);
  void RemoveObserver(Observer* observer);

 private:
  // KeyedService:
  void Shutdown() override;

  // Stores tokens securely using OSCrypt
  void StoreTokens(const std::string& access_token,
                   const std::string& refresh_token);

  // Loads tokens from secure storage
  bool LoadTokens();

  // Schedules token refresh before expiry
  void ScheduleTokenRefresh();
  void RefreshToken();

  // Notifies observers of state changes
  void NotifyAuthStateChanged();

  raw_ptr<PrefService> prefs_;
  base::ObserverList<Observer> observers_;
  base::OneShotTimer refresh_timer_;

  // Cached state
  bool is_signed_in_ = false;
  OxyUser current_user_;
  std::string access_token_;
  std::string refresh_token_;
  std::string session_id_;
  base::Time token_expiry_;
};

}  // namespace oxy

#endif  // CHROME_BROWSER_OXY_OXY_AUTH_SERVICE_H_
