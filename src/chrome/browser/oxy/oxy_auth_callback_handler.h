// Copyright 2026 Oxy. All rights reserved.

#ifndef CHROME_BROWSER_OXY_OXY_AUTH_CALLBACK_HANDLER_H_
#define CHROME_BROWSER_OXY_OXY_AUTH_CALLBACK_HANDLER_H_

#include <string>
#include "url/gurl.h"

namespace oxy {

// Checks if a URL is an Oxy auth callback (astro://auth/callback)
bool IsOxyAuthCallback(const GURL& url);

// Parses the auth callback URL and extracts tokens.
// Expected format: astro://auth/callback?session_id=X&access_token=X&refresh_token=X&user_id=X&username=X&avatar_url=X&expires_at=X
struct OxyAuthCallbackParams {
  std::string session_id;
  std::string access_token;
  std::string refresh_token;
  std::string user_id;
  std::string username;
  std::string avatar_url;
  std::string expires_at;
  bool is_valid = false;
};

OxyAuthCallbackParams ParseOxyAuthCallback(const GURL& url);

}  // namespace oxy

#endif  // CHROME_BROWSER_OXY_OXY_AUTH_CALLBACK_HANDLER_H_
