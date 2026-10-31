// Copyright 2026 Oxy. Apache-2.0.

#ifndef CHROME_BROWSER_ASTRO_AC_ACCOUNT_FETCH_H_
#define CHROME_BROWSER_ASTRO_AC_ACCOUNT_FETCH_H_

#include <map>
#include <memory>

#include "base/functional/callback.h"
#include "base/memory/raw_ptr.h"
#include "base/memory/weak_ptr.h"
#include "base/values.h"
#include "mojo/public/cpp/bindings/receiver.h"
#include "mojo/public/cpp/bindings/remote.h"
#include "mojo/public/cpp/bindings/unique_receiver_set.h"
#include "services/network/public/mojom/network_context.mojom.h"
#include "services/network/public/mojom/url_loader_factory.mojom.h"

class Profile;

namespace network {
class SimpleURLLoader;
}

namespace astro {

class AccountFetcher : public network::mojom::TrustedURLLoaderHeaderClient {
 public:
  using Done = base::OnceCallback<void(base::Value)>;
  using StreamEvent = base::RepeatingCallback<void(int, base::Value)>;

  explicit AccountFetcher(Profile* profile);
  AccountFetcher(const AccountFetcher&) = delete;
  AccountFetcher& operator=(const AccountFetcher&) = delete;
  ~AccountFetcher() override;

  void Fetch(const base::Value& url,
             const base::Value& method,
             const base::Value& headers,
             const base::Value& body,
             Done done);

  void Stream(int stream_id,
              const base::Value& url,
              const base::Value& method,
              const base::Value& headers,
              const base::Value& body,
              Done started,
              StreamEvent event);
  void CancelStream(int stream_id);

 private:
  class StreamLoad;

  void OnLoaderCreated(
      int32_t request_id,
      mojo::PendingReceiver<network::mojom::TrustedHeaderClient> receiver)
      override;
  void OnLoaderForCorsPreflightCreated(
      const network::ResourceRequest& request,
      mojo::PendingReceiver<network::mojom::TrustedHeaderClient> receiver)
      override;

  network::mojom::URLLoaderFactory* Factory();
  std::unique_ptr<network::SimpleURLLoader> Loader(const base::Value& url,
                                                   const base::Value& method,
                                                   const base::Value& headers,
                                                   const base::Value& body);
  void Fetched(int id, Done done, std::optional<std::string> body);
  void StreamEnded(int stream_id);

  raw_ptr<Profile> profile_;
  mojo::Remote<network::mojom::URLLoaderFactory> factory_;
  mojo::Receiver<network::mojom::TrustedURLLoaderHeaderClient> header_client_{
      this};
  mojo::UniqueReceiverSet<network::mojom::TrustedHeaderClient> loaders_;
  std::map<int, std::unique_ptr<network::SimpleURLLoader>> fetches_;
  std::map<int, std::unique_ptr<StreamLoad>> streams_;
  int next_fetch_ = 0;
  base::WeakPtrFactory<AccountFetcher> weak_factory_{this};
};

}

#endif
