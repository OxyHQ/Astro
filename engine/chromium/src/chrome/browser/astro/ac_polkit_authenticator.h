// Copyright 2026 Oxy. Apache-2.0.

#ifndef CHROME_BROWSER_ASTRO_AC_POLKIT_AUTHENTICATOR_H_
#define CHROME_BROWSER_ASTRO_AC_POLKIT_AUTHENTICATOR_H_

#include <string>
#include <string_view>

#include "base/functional/callback.h"
#include "base/memory/raw_ptr.h"
#include "base/memory/scoped_refptr.h"
#include "base/memory/weak_ptr.h"
#include "components/device_reauth/device_authenticator.h"

namespace dbus {
class Bus;
class ErrorResponse;
class ObjectProxy;
class Response;
}

namespace astro {

inline constexpr char kPolkitAction[] = "so.oxy.astro.unlock";

class PolkitAuthenticator : public device_reauth::DeviceAuthenticator {
 public:
  using Unavailable = base::RepeatingCallback<void(std::string_view reason)>;

  explicit PolkitAuthenticator(Unavailable unavailable);
  PolkitAuthenticator(const PolkitAuthenticator&) = delete;
  PolkitAuthenticator& operator=(const PolkitAuthenticator&) = delete;
  ~PolkitAuthenticator() override;

  bool CanAuthenticateWithBiometrics() override;
  bool CanAuthenticateWithBiometricOrScreenLock() override;
  void AuthenticateWithMessage(const std::u16string& message,
                               AuthenticateCallback callback) override;
  void Cancel() override;

 private:
  void Replied(dbus::Response* response, dbus::ErrorResponse* error);
  void Finish(bool authenticated);
  void CancelInPolkit();

  scoped_refptr<dbus::Bus> bus_;
  raw_ptr<dbus::ObjectProxy> authority_ = nullptr;
  std::string cancellation_id_;
  AuthenticateCallback callback_;
  Unavailable unavailable_;
  base::WeakPtrFactory<PolkitAuthenticator> weak_factory_{this};
};

}

#endif
