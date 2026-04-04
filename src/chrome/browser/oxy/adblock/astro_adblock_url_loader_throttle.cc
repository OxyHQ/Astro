// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/oxy/adblock/astro_adblock_url_loader_throttle.h"

#include "chrome/browser/oxy/adblock/astro_adblock_service.h"
#include "chrome/browser/oxy/adblock/astro_adblock_tab_helper.h"
#include "content/public/browser/browser_thread.h"
#include "content/public/browser/web_contents.h"
#include "net/base/net_errors.h"
#include "services/network/public/cpp/resource_request.h"

namespace oxy::adblock {

// static
std::unique_ptr<AstroAdBlockURLLoaderThrottle>
AstroAdBlockURLLoaderThrottle::MaybeCreate(
    AstroAdBlockService* service,
    const GURL& tab_url,
    const base::RepeatingCallback<content::WebContents*()>& wc_getter) {
  if (!service || !service->IsEnabled()) {
    return nullptr;
  }

  if (!service->IsEnabledForSite(tab_url)) {
    return nullptr;
  }

  // Create a callback that posts blocked URL notifications to the tab helper.
  OnResourceBlockedCallback on_blocked;
  if (wc_getter) {
    on_blocked = base::BindRepeating(
        [](base::RepeatingCallback<content::WebContents*()> getter,
           const GURL& blocked_url) {
          content::GetUIThreadTaskRunner({})->PostTask(
              FROM_HERE,
              base::BindOnce(
                  [](base::RepeatingCallback<content::WebContents*()> g,
                     const GURL& url) {
                    auto* wc = g.Run();
                    if (!wc) return;
                    auto* helper =
                        AstroAdBlockTabHelper::FromWebContents(wc);
                    if (helper) {
                      helper->OnResourceBlocked(url);
                    }
                  },
                  g, blocked_url));
        },
        wc_getter);
  }

  return base::WrapUnique(
      new AstroAdBlockURLLoaderThrottle(service, tab_url,
                                        std::move(on_blocked)));
}

AstroAdBlockURLLoaderThrottle::AstroAdBlockURLLoaderThrottle(
    AstroAdBlockService* service,
    const GURL& tab_url,
    OnResourceBlockedCallback on_blocked)
    : service_(service),
      tab_url_(tab_url),
      on_blocked_(std::move(on_blocked)) {}

AstroAdBlockURLLoaderThrottle::~AstroAdBlockURLLoaderThrottle() = default;

void AstroAdBlockURLLoaderThrottle::WillStartRequest(
    network::ResourceRequest* request,
    bool* defer) {
  if (!service_) {
    return;
  }

  if (service_->ShouldBlockRequest(request->url, tab_url_,
                                   request->destination)) {
    ReportBlocked(request->url);
    delegate_->CancelWithError(net::ERR_BLOCKED_BY_CLIENT);
  }
}

void AstroAdBlockURLLoaderThrottle::WillRedirectRequest(
    net::RedirectInfo* redirect_info,
    const network::mojom::URLResponseHead& /* response_head */,
    bool* /* defer */,
    std::vector<std::string>* /* to_be_removed_request_headers */,
    net::HttpRequestHeaders* /* modified_request_headers */,
    net::HttpRequestHeaders* /* modified_cors_exempt_request_headers */) {
  if (!service_) {
    return;
  }

  if (service_->ShouldBlockRequest(redirect_info->new_url, tab_url_,
                                   network::mojom::RequestDestination::kEmpty)) {
    ReportBlocked(redirect_info->new_url);
    delegate_->CancelWithError(net::ERR_BLOCKED_BY_CLIENT);
  }
}

void AstroAdBlockURLLoaderThrottle::DetachFromCurrentSequence() {}

void AstroAdBlockURLLoaderThrottle::ReportBlocked(const GURL& blocked_url) {
  if (on_blocked_) {
    on_blocked_.Run(blocked_url);
  }
}

}  // namespace oxy::adblock
