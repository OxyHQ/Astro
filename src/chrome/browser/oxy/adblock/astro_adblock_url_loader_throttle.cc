// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/oxy/adblock/astro_adblock_url_loader_throttle.h"

#include "chrome/browser/oxy/adblock/astro_adblock_service.h"
#include "net/base/net_errors.h"
#include "services/network/public/cpp/resource_request.h"

namespace oxy::adblock {

// static
std::unique_ptr<AstroAdBlockURLLoaderThrottle>
AstroAdBlockURLLoaderThrottle::MaybeCreate(AstroAdBlockService* service,
                                           const GURL& tab_url) {
  if (!service || !service->IsEnabled()) {
    return nullptr;
  }

  if (!service->IsEnabledForSite(tab_url)) {
    return nullptr;
  }

  return base::WrapUnique(
      new AstroAdBlockURLLoaderThrottle(service, tab_url));
}

AstroAdBlockURLLoaderThrottle::AstroAdBlockURLLoaderThrottle(
    AstroAdBlockService* service,
    const GURL& tab_url)
    : service_(service), tab_url_(tab_url) {}

AstroAdBlockURLLoaderThrottle::~AstroAdBlockURLLoaderThrottle() = default;

void AstroAdBlockURLLoaderThrottle::WillStartRequest(
    network::ResourceRequest* request,
    bool* defer) {
  if (!service_) {
    return;
  }

  if (service_->ShouldBlockRequest(request->url, tab_url_,
                                   request->destination)) {
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

  // Check the redirect target against filter rules.
  if (service_->ShouldBlockRequest(redirect_info->new_url, tab_url_,
                                   network::mojom::RequestDestination::kEmpty)) {
    delegate_->CancelWithError(net::ERR_BLOCKED_BY_CLIENT);
  }
}

void AstroAdBlockURLLoaderThrottle::DetachFromCurrentSequence() {}

}  // namespace oxy::adblock
