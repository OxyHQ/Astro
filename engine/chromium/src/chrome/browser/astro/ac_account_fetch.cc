// Copyright 2026 Oxy. Apache-2.0.

#include "chrome/browser/astro/ac_account_fetch.h"

#include <optional>
#include <string>
#include <utility>

#include "base/base64.h"
#include "base/containers/fixed_flat_set.h"
#include "base/functional/bind.h"
#include "base/strings/string_util.h"
#include "chrome/browser/profiles/profile.h"
#include "content/public/browser/storage_partition.h"
#include "net/base/net_errors.h"
#include "net/base/url_util.h"
#include "net/http/http_request_headers.h"
#include "net/http/http_response_headers.h"
#include "net/http/http_util.h"
#include "net/traffic_annotation/network_traffic_annotation.h"
#include "services/network/public/cpp/resource_request.h"
#include "services/network/public/cpp/simple_url_loader.h"
#include "services/network/public/mojom/url_response_head.mojom.h"
#include "url/gurl.h"
#include "url/url_constants.h"

namespace astro {

namespace {

constexpr size_t kMaxBody = 8 * 1024 * 1024;

constexpr auto kAccountHosts =
    base::MakeFixedFlatSet<std::string_view>({"api.oxy.so", "api.nilo.so"});

constexpr auto kMethods = base::MakeFixedFlatSet<std::string_view>(
    {"GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"});

constexpr net::NetworkTrafficAnnotationTag kAccountFetchAnnotation =
    net::DefineNetworkTrafficAnnotation("astro_account_fetch", R"(
      semantics {
        sender: "Astro"
        description:
          "Astro's interface signing in with the person's Oxy account and "
          "reading their Nilo calendar, as Oxy's native apps do."
        trigger: "Signing in with Oxy, and refreshing the calendar."
        data: "The Oxy session's bearer token and the request's own body."
        destination: OTHER
      }
      policy {
        cookies_allowed: NO
        setting: "Sign out of Oxy in Settings › Calendar."
        policy_exception_justification: "Not implemented."
      })");

bool IsAccountOrigin(const GURL& url) {
  if (url.SchemeIs(url::kHttpsScheme) && kAccountHosts.contains(url.host()) &&
      url.EffectiveIntPort() == 443) {
    return true;
  }
  return url.SchemeIsHTTPOrHTTPS() && net::IsLocalhost(url);
}

class NativeRequestHeaders : public network::mojom::TrustedHeaderClient {
 public:
  void OnBeforeSendHeaders(const GURL& request_url,
                           const net::HttpRequestHeaders& headers,
                           OnBeforeSendHeadersCallback callback) override {
    net::HttpRequestHeaders sent;
    for (const auto& header : headers.GetHeaderVector()) {
      if (!base::StartsWith(header.key, "sec-fetch-",
                            base::CompareCase::INSENSITIVE_ASCII)) {
        sent.SetHeader(header.key, header.value);
      }
    }
    std::move(callback).Run(net::OK, sent, std::nullopt);
  }

  void OnHeadersReceived(const std::string& headers,
                         const net::IPEndPoint& remote_endpoint,
                         const std::optional<net::SSLInfo>& ssl_info,
                         OnHeadersReceivedCallback callback) override {
    std::move(callback).Run(net::OK, std::nullopt, std::nullopt);
  }
};

base::Value Failure(std::string_view error) {
  return base::Value(base::DictValue().Set("error", error));
}

}

AccountFetcher::AccountFetcher(Profile* profile) : profile_(profile) {}

AccountFetcher::~AccountFetcher() = default;

network::mojom::URLLoaderFactory* AccountFetcher::Factory() {
  if (factory_.is_bound() && factory_.is_connected()) {
    return factory_.get();
  }
  factory_.reset();
  header_client_.reset();
  auto params = network::mojom::URLLoaderFactoryParams::New();
  params->process_id = network::OriginatingProcessId::browser();
  params->is_orb_enabled = false;
  params->header_client = header_client_.BindNewPipeAndPassRemote();
  profile_->GetDefaultStoragePartition()
      ->GetNetworkContext()
      ->CreateURLLoaderFactory(factory_.BindNewPipeAndPassReceiver(),
                               std::move(params));
  return factory_.get();
}

void AccountFetcher::OnLoaderCreated(
    int32_t request_id,
    mojo::PendingReceiver<network::mojom::TrustedHeaderClient> receiver) {
  loaders_.Add(std::make_unique<NativeRequestHeaders>(), std::move(receiver));
}

void AccountFetcher::OnLoaderForCorsPreflightCreated(
    const network::ResourceRequest& request,
    mojo::PendingReceiver<network::mojom::TrustedHeaderClient> receiver) {
  loaders_.Add(std::make_unique<NativeRequestHeaders>(), std::move(receiver));
}

void AccountFetcher::Fetch(const base::Value& url_value,
                           const base::Value& method_value,
                           const base::Value& headers,
                           const base::Value& body,
                           Done done) {
  if (!url_value.is_string() || !method_value.is_string()) {
    return std::move(done).Run(Failure("refused"));
  }
  GURL url(url_value.GetString());
  const std::string method = base::ToUpperASCII(method_value.GetString());
  if (!url.is_valid() || !IsAccountOrigin(url) || !kMethods.contains(method)) {
    return std::move(done).Run(Failure("refused"));
  }
  auto request = std::make_unique<network::ResourceRequest>();
  request->url = url;
  request->method = method;
  request->credentials_mode = network::mojom::CredentialsMode::kOmit;
  std::string content_type;
  if (headers.is_dict()) {
    for (const auto [name, value] : headers.GetDict()) {
      if (!value.is_string() || !net::HttpUtil::IsValidHeaderName(name) ||
          !net::HttpUtil::IsValidHeaderValue(value.GetString()) ||
          !net::HttpUtil::IsSafeHeader(name, value.GetString())) {
        continue;
      }
      if (base::EqualsCaseInsensitiveASCII(
              name, net::HttpRequestHeaders::kContentType)) {
        content_type = value.GetString();
        continue;
      }
      request->headers.SetHeader(name, value.GetString());
    }
  }
  auto loader = network::SimpleURLLoader::Create(std::move(request),
                                                 kAccountFetchAnnotation);
  loader->SetAllowHttpErrorResults(true);
  loader->SetURLLoaderFactoryOptions(
      network::mojom::kURLLoadOptionUseHeaderClient);
  if (body.is_string() && method != "GET" && method != "HEAD") {
    loader->AttachStringForUpload(
        body.GetString(),
        content_type.empty() ? "text/plain;charset=UTF-8" : content_type);
  }
  const int id = ++next_fetch_;
  network::SimpleURLLoader* raw = loader.get();
  fetches_[id] = std::move(loader);
  raw->DownloadToString(Factory(),
                        base::BindOnce(&AccountFetcher::Fetched,
                                       weak_factory_.GetWeakPtr(), id,
                                       std::move(done)),
                        kMaxBody);
}

void AccountFetcher::Fetched(int id,
                             Done done,
                             std::optional<std::string> body) {
  auto found = fetches_.find(id);
  if (found == fetches_.end()) {
    return;
  }
  std::unique_ptr<network::SimpleURLLoader> loader = std::move(found->second);
  fetches_.erase(found);
  const network::mojom::URLResponseHead* head = loader->ResponseInfo();
  if (!head || !head->headers) {
    return std::move(done).Run(Failure(net::ErrorToString(loader->NetError())));
  }
  base::ListValue response_headers;
  size_t iterator = 0;
  std::string name;
  std::string value;
  while (head->headers->EnumerateHeaderLines(&iterator, &name, &value)) {
    response_headers.Append(base::ListValue().Append(name).Append(value));
  }
  std::move(done).Run(base::Value(
      base::DictValue()
          .Set("status", head->headers->response_code())
          .Set("headers", std::move(response_headers))
          .Set("body", body ? base::Value(base::Base64Encode(*body))
                            : base::Value())));
}

}
