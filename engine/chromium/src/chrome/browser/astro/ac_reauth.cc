// Copyright 2026 Oxy. Apache-2.0.

#include "chrome/browser/astro/ac_reauth.h"

#include <stdlib.h>
#include <string.h>

#include <memory>
#include <utility>

#include "base/command_line.h"
#include "base/functional/bind.h"
#include "base/logging.h"
#include "base/memory/weak_ptr.h"
#include "base/strings/utf_string_conversions.h"
#include "chrome/browser/astro/ac_engine.h"
#include "components/device_reauth/device_authenticator.h"
#include "components/os_crypt/common/os_crypt_switches.h"
#include "build/build_config.h"

#if BUILDFLAG(IS_LINUX)
#include <string_view>

#include "base/time/time.h"
#include "chrome/browser/astro/ac_polkit_authenticator.h"
#else
#include "chrome/browser/device_reauth/chrome_device_authenticator_factory.h"
#endif

#if BUILDFLAG(IS_MAC)
#include <Security/Security.h>

#include "base/apple/scoped_cftyperef.h"
#endif

namespace astro {
namespace {

bool HiddenTestInstance() {
  const char* background = getenv("ASTRO_BACKGROUND");
  return background && !strcmp(background, "1");
}

#if BUILDFLAG(IS_MAC)
bool SignedForDistribution() {
  base::apple::ScopedCFTypeRef<SecCodeRef> self;
  if (SecCodeCopySelf(kSecCSDefaultFlags, self.InitializeInto()) !=
      errSecSuccess) {
    return true;
  }
  base::apple::ScopedCFTypeRef<SecRequirementRef> distribution;
  if (SecRequirementCreateWithString(
          CFSTR("anchor apple generic and "
                "(certificate leaf[field.1.2.840.113635.100.6.1.9] exists or "
                "certificate 1[field.1.2.840.113635.100.6.2.6] exists and "
                "certificate leaf[field.1.2.840.113635.100.6.1.13] exists)"),
          kSecCSDefaultFlags, distribution.InitializeInto()) != errSecSuccess) {
    return true;
  }
  return SecCodeCheckValidity(self.get(), kSecCSDefaultFlags,
                              distribution.get()) == errSecSuccess;
}
#endif

bool TestGrantHonoured() {
#if BUILDFLAG(IS_MAC)
  static const bool honoured =
      !SignedForDistribution() &&
      base::CommandLine::ForCurrentProcess()->HasSwitch(
          os_crypt::switches::kUseMockKeychain);
  return honoured;
#else
  return false;
#endif
}

bool TestGrant() {
  const char* grant = getenv("ASTRO_TEST_REAUTH");
  return grant && !strcmp(grant, "granted") && TestGrantHonoured();
}

#if !BUILDFLAG(IS_LINUX)
const char* Histogram(device_reauth::DeviceAuthSource source) {
  return source == device_reauth::DeviceAuthSource::kPasswordManager
             ? "PasswordManager.ReauthToAccessPasswordInSettings"
             : "Autofill.PaymentMethods.SettingsPage.Reauth";
}
#endif

class ReauthState : public ProfileState {
 public:
  explicit ReauthState(Profile* profile) : ProfileState(profile) {}

  void Start(device_reauth::DeviceAuthSource source,
             const std::u16string& purpose,
             base::TimeDelta validity,
             base::OnceCallback<void(bool)> done) {
    base::WeakPtr<ReauthState> self = weak_factory_.GetWeakPtr();
    const int generation = ++generation_;
    while (authenticator_) {
      std::unique_ptr<device_reauth::DeviceAuthenticator> older =
          std::move(authenticator_);
      older->Cancel();
      older.reset();
      if (!self) {
        return;
      }
      if (generation_ != generation) {
        std::move(done).Run(false);
        return;
      }
    }
#if BUILDFLAG(IS_LINUX)
    if (validity.is_positive() && !last_granted_.is_null() &&
        base::TimeTicks::Now() - last_granted_ < validity) {
      std::move(done).Run(true);
      return;
    }
    authenticator_ = std::make_unique<PolkitAuthenticator>(base::BindRepeating(
        &ReauthState::Unavailable, weak_factory_.GetWeakPtr()));
#else
    authenticator_ = ChromeDeviceAuthenticatorFactory::GetForProfile(
        profile(), device_reauth::DeviceAuthParams(validity, source,
                                                   Histogram(source)));
#endif
    authenticator_->AuthenticateWithMessage(
        purpose, base::BindOnce(&ReauthState::Done, self, generation,
                                std::move(done)));
  }

 private:
  void Release() override {
    weak_factory_.InvalidateWeakPtrs();
    authenticator_.reset();
  }

  void Done(int generation,
            base::OnceCallback<void(bool)> done,
            bool authenticated) {
#if BUILDFLAG(IS_LINUX)
    if (authenticated) {
      last_granted_ = base::TimeTicks::Now();
    }
#endif
    if (generation == generation_) {
      authenticator_.reset();
    }
    std::move(done).Run(authenticated);
  }

#if BUILDFLAG(IS_LINUX)
  void Unavailable(std::string_view reason) {
    LOG(WARNING) << "[astro] OS reauth denied: " << reason;
    Emit("reauth.unavailable", profile(),
         base::DictValue().Set("reason", reason));
  }

  base::TimeTicks last_granted_;
#endif

  std::unique_ptr<device_reauth::DeviceAuthenticator> authenticator_;
  int generation_ = 0;
  base::WeakPtrFactory<ReauthState> weak_factory_{this};
};

}

void Reauth(Profile* profile,
            device_reauth::DeviceAuthSource source,
            const std::u16string& purpose,
            base::TimeDelta validity,
            base::OnceCallback<void(bool)> done) {
  if (HiddenTestInstance()) {
    const bool granted = TestGrant();
    LOG(WARNING) << "[astro] OS reauth (" << purpose
                 << ") in a hidden test instance, no prompt: "
                 << (granted ? "granted" : "denied");
    Emit("reauth.requested", profile,
         base::DictValue().Set("purpose", purpose).Set("granted", granted));
    std::move(done).Run(granted);
    return;
  }
  StateFor<ReauthState>(profile).Start(source, purpose, validity,
                                       std::move(done));
}

}
