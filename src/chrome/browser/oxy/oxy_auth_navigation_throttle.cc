// Copyright 2026 Oxy. All rights reserved.

#include "chrome/browser/oxy/oxy_auth_navigation_throttle.h"

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
