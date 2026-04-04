// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_ADBLOCK_ASTRO_ADBLOCK_URL_LOADER_THROTTLE_H_
#define CHROME_BROWSER_OXY_ADBLOCK_ASTRO_ADBLOCK_URL_LOADER_THROTTLE_H_

#include <memory>

#include "base/functional/callback.h"
#include "base/memory/raw_ptr.h"
#include "third_party/blink/public/common/loader/url_loader_throttle.h"
#include "url/gurl.h"

namespace content {
class WebContents;
}

namespace oxy::adblock {

class AstroAdBlockService;

// Callback invoked on the UI thread when a request is blocked.
using OnResourceBlockedCallback = base::RepeatingCallback<void(const GURL&)>;

// URLLoaderThrottle that intercepts network requests and blocks those
// matching ad/tracker filter rules. One instance per network request.
//
// Created by ChromeContentBrowserClient::CreateURLLoaderThrottles()
// for every sub-resource request when ad blocking is enabled.
class AstroAdBlockURLLoaderThrottle : public blink::URLLoaderThrottle {
 public:
  // Returns a throttle instance if ad blocking is applicable for this
  // request context, or nullptr if blocking is disabled/not applicable.
  static std::unique_ptr<AstroAdBlockURLLoaderThrottle> MaybeCreate(
      AstroAdBlockService* service,
      const GURL& tab_url,
      const base::RepeatingCallback<content::WebContents*()>& wc_getter);

  ~AstroAdBlockURLLoaderThrottle() override;

  AstroAdBlockURLLoaderThrottle(const AstroAdBlockURLLoaderThrottle&) = delete;
  AstroAdBlockURLLoaderThrottle& operator=(
      const AstroAdBlockURLLoaderThrottle&) = delete;

  // blink::URLLoaderThrottle:
  void WillStartRequest(network::ResourceRequest* request,
                        bool* defer) override;
  void WillRedirectRequest(
      net::RedirectInfo* redirect_info,
      const network::mojom::URLResponseHead& response_head,
      bool* defer,
      std::vector<std::string>* to_be_removed_request_headers,
      net::HttpRequestHeaders* modified_request_headers,
      net::HttpRequestHeaders* modified_cors_exempt_request_headers) override;
  void DetachFromCurrentSequence() override;

 private:
  AstroAdBlockURLLoaderThrottle(
      AstroAdBlockService* service,
      const GURL& tab_url,
      OnResourceBlockedCallback on_blocked);

  // Reports a blocked URL to the tab helper on the UI thread.
  void ReportBlocked(const GURL& blocked_url);

  raw_ptr<AstroAdBlockService> service_;
  GURL tab_url_;
  OnResourceBlockedCallback on_blocked_;
};

}  // namespace oxy::adblock

#endif  // CHROME_BROWSER_OXY_ADBLOCK_ASTRO_ADBLOCK_URL_LOADER_THROTTLE_H_
