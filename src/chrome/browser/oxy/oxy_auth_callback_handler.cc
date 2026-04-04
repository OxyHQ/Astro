// Copyright 2026 Oxy. All rights reserved.

#include "chrome/browser/oxy/oxy_auth_callback_handler.h"

#include "base/strings/string_number_conversions.h"
#include "net/base/url_util.h"

namespace oxy {

bool IsOxyAuthCallback(const GURL& url) {
  // Match astro://auth/callback or chrome://auth/callback
  if ((url.SchemeIs("astro") || url.SchemeIs("chrome")) &&
      url.host() == "auth" && url.path() == "/callback") {
    return true;
  }
  // Match https://auth.oxy.so/redirect/astro (HTTPS callback for web compat)
  if (url.SchemeIs("https") && url.host() == "auth.oxy.so" &&
      url.path() == "/redirect/astro") {
    return true;
  }
  return false;
}

OxyAuthCallbackParams ParseOxyAuthCallback(const GURL& url) {
  OxyAuthCallbackParams params;

  if (!IsOxyAuthCallback(url)) {
    return params;
  }

  std::string expires_str;
  net::GetValueForKeyInQuery(url, "session_id", &params.session_id);
  net::GetValueForKeyInQuery(url, "access_token", &params.access_token);
  net::GetValueForKeyInQuery(url, "refresh_token", &params.refresh_token);
  net::GetValueForKeyInQuery(url, "user_id", &params.user_id);
  net::GetValueForKeyInQuery(url, "username", &params.username);
  net::GetValueForKeyInQuery(url, "avatar_url", &params.avatar_url);
  net::GetValueForKeyInQuery(url, "expires_at", &expires_str);

  if (!expires_str.empty()) {
    base::StringToInt64(expires_str, &params.expires_at);
  }

  params.is_valid = !params.access_token.empty() && !params.user_id.empty();
  return params;
}

}  // namespace oxy
