// Copyright 2026 Oxy. All rights reserved.

#include "chrome/browser/oxy/oxy_auth_navigation_throttle.h"

#include <algorithm>

#include "base/base64.h"
#include "base/json/json_reader.h"
#include "base/logging.h"
#include "chrome/browser/oxy/oxy_auth_callback_handler.h"
#include "chrome/browser/oxy/oxy_auth_token_store.h"
#include "chrome/browser/profiles/profile.h"
#include "components/prefs/pref_service.h"
#include "content/public/browser/navigation_handle.h"
#include "content/public/browser/page_navigator.h"
#include "content/public/browser/web_contents.h"
#include "url/gurl.h"

namespace oxy {

// static
void OxyAuthNavigationThrottle::MaybeCreateAndAdd(
    content::NavigationThrottleRegistry& registry) {
  const GURL& url = registry.GetNavigationHandle().GetURL();
  if (IsOxyAuthCallback(url) || (url.SchemeIs("https") && url.host() == "auth.oxy.so")) {
    registry.AddThrottle(
        std::make_unique<OxyAuthNavigationThrottle>(registry));
  }
}

OxyAuthNavigationThrottle::OxyAuthNavigationThrottle(
    content::NavigationThrottleRegistry& registry)
    : content::NavigationThrottle(registry) {}

OxyAuthNavigationThrottle::~OxyAuthNavigationThrottle() = default;

content::NavigationThrottle::ThrottleCheckResult
OxyAuthNavigationThrottle::WillStartRequest() {
  return CheckForAuthCallback();
}

content::NavigationThrottle::ThrottleCheckResult
OxyAuthNavigationThrottle::WillRedirectRequest() {
  return CheckForAuthCallback();
}

const char* OxyAuthNavigationThrottle::GetNameForLogging() {
  return "OxyAuthNavigationThrottle";
}

content::NavigationThrottle::ThrottleCheckResult
OxyAuthNavigationThrottle::CheckForAuthCallback() {
  const GURL& url = navigation_handle()->GetURL();

  if (!IsOxyAuthCallback(url)) {
    return content::NavigationThrottle::PROCEED;
  }

  auto params = ParseOxyAuthCallback(url);
  if (!params.is_valid) {
    return content::NavigationThrottle::PROCEED;
  }

  // If user_id not in URL params, extract from JWT access_token.
  if (params.user_id.empty() && !params.access_token.empty()) {
    // JWT format: header.payload.signature (base64url encoded)
    size_t first_dot = params.access_token.find('.');
    size_t second_dot = params.access_token.find('.', first_dot + 1);
    if (first_dot != std::string::npos && second_dot != std::string::npos) {
      std::string payload_b64 = params.access_token.substr(
          first_dot + 1, second_dot - first_dot - 1);
      // Base64url to base64.
      std::replace(payload_b64.begin(), payload_b64.end(), '-', '+');
      std::replace(payload_b64.begin(), payload_b64.end(), '_', '/');
      // Pad if needed.
      while (payload_b64.size() % 4 != 0)
        payload_b64 += '=';

      std::string payload;
      if (base::Base64Decode(payload_b64, &payload)) {
        auto json = base::JSONReader::Read(payload, base::JSON_PARSE_RFC);
        if (json && json->is_dict()) {
          const std::string* user_id =
              json->GetDict().FindString("userId");
          if (user_id)
            params.user_id = *user_id;
          const std::string* session_id =
              json->GetDict().FindString("sessionId");
          if (session_id && params.session_id.empty())
            params.session_id = *session_id;
        }
      }
    }
  }

  // Get profile and store tokens.
  content::WebContents* web_contents = navigation_handle()->GetWebContents();
  if (web_contents) {
    Profile* profile =
        Profile::FromBrowserContext(web_contents->GetBrowserContext());
    if (profile) {
      PrefService* prefs = profile->GetPrefs();
      prefs->SetString("oxy.session_id", params.session_id);
      prefs->SetString("oxy.user_id", params.user_id);
      prefs->SetString("oxy.username", params.username);
      prefs->SetString("oxy.user_avatar", params.avatar_url);
      prefs->SetString("oxy.token_expiry", params.expires_at);

      OxyAuthTokenStore::StoreAccessToken(params.access_token);
      OxyAuthTokenStore::StoreRefreshToken(params.refresh_token);

      LOG(INFO) << "Oxy: Signed in as " << params.username
                << " (via NavigationThrottle)";
    }
  }

  // Cancel this navigation and redirect to new tab page.
  if (web_contents) {
    web_contents->OpenURL(
        content::OpenURLParams(
            GURL("chrome://newtab/"), content::Referrer(),
            WindowOpenDisposition::CURRENT_TAB,
            ui::PAGE_TRANSITION_AUTO_TOPLEVEL, /*is_renderer_initiated=*/false),
        /*navigation_handle_callback=*/{});
  }

  return content::NavigationThrottle::CANCEL_AND_IGNORE;
}

}  // namespace oxy
