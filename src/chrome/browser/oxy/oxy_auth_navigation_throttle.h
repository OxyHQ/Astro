// Copyright 2026 Oxy. All rights reserved.

#ifndef CHROME_BROWSER_OXY_OXY_AUTH_NAVIGATION_THROTTLE_H_
#define CHROME_BROWSER_OXY_OXY_AUTH_NAVIGATION_THROTTLE_H_

#include "content/public/browser/navigation_throttle.h"

namespace content {
class NavigationThrottleRegistry;
}

namespace oxy {

// Intercepts navigations to the Oxy auth callback URL
// (https://auth.oxy.so/redirect/astro) and captures the OAuth tokens.
// Uses NavigationThrottle to intercept both browser-initiated and
// renderer-initiated navigations (e.g. window.location.href redirects).
class OxyAuthNavigationThrottle : public content::NavigationThrottle {
 public:
  static void MaybeCreateAndAdd(
      content::NavigationThrottleRegistry& registry);

  explicit OxyAuthNavigationThrottle(
      content::NavigationThrottleRegistry& registry);
  ~OxyAuthNavigationThrottle() override;

  // content::NavigationThrottle:
  ThrottleCheckResult WillStartRequest() override;
  ThrottleCheckResult WillRedirectRequest() override;
  const char* GetNameForLogging() override;

 private:
  ThrottleCheckResult CheckForAuthCallback();
};

}  // namespace oxy

#endif  // CHROME_BROWSER_OXY_OXY_AUTH_NAVIGATION_THROTTLE_H_
