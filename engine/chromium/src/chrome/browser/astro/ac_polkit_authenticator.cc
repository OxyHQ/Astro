// Copyright 2026 Oxy. Apache-2.0.

#include "chrome/browser/astro/ac_polkit_authenticator.h"

#include <sys/types.h>
#include <unistd.h>

#include <cstdint>
#include <utility>

#include "base/functional/bind.h"
#include "base/functional/callback_helpers.h"
#include "base/strings/strcat.h"
#include "base/strings/string_number_conversions.h"
#include "base/time/time.h"
#include "components/dbus/thread_linux/dbus_thread_linux.h"
#include "dbus/bus.h"
#include "dbus/message.h"
#include "dbus/object_path.h"
#include "dbus/object_proxy.h"

namespace astro {
namespace {

constexpr char kPolkitService[] = "org.freedesktop.PolicyKit1";
constexpr char kAuthorityPath[] = "/org/freedesktop/PolicyKit1/Authority";
constexpr char kAuthorityInterface[] = "org.freedesktop.PolicyKit1.Authority";
constexpr char kNotRegistered[] = "is not registered";
constexpr char kServiceUnknown[] = "org.freedesktop.DBus.Error.ServiceUnknown";
constexpr char kNameHasNoOwner[] = "org.freedesktop.DBus.Error.NameHasNoOwner";
constexpr char kPolkitCancelled[] = "org.freedesktop.PolicyKit1.Error.Cancelled";
constexpr uint32_t kAllowUserInteraction = 1;
constexpr base::TimeDelta kPromptDeadline = base::Minutes(5);

std::string NextCancellationId() {
  static uint64_t next = 0;
  return base::StrCat({"astro-", base::NumberToString(getpid()), "-",
                       base::NumberToString(++next)});
}

template <typename AppendValue>
void AppendEntry(dbus::MessageWriter& dict,
                 const char* key,
                 AppendValue append_value) {
  dbus::MessageWriter entry(nullptr);
  dict.OpenDictEntry(&entry);
  entry.AppendString(key);
  append_value(entry);
  dict.CloseContainer(&entry);
}

void AppendThisProcess(dbus::MessageWriter& writer) {
  dbus::MessageWriter subject(nullptr);
  writer.OpenStruct(&subject);
  subject.AppendString("unix-process");
  dbus::MessageWriter details(nullptr);
  subject.OpenArray("{sv}", &details);
  AppendEntry(details, "pid", [](dbus::MessageWriter& entry) {
    entry.AppendVariantOfUint32(static_cast<uint32_t>(getpid()));
  });
  AppendEntry(details, "start-time", [](dbus::MessageWriter& entry) {
    entry.AppendVariantOfUint64(0);
  });
  AppendEntry(details, "uid", [](dbus::MessageWriter& entry) {
    entry.AppendVariantOfInt32(static_cast<int32_t>(getuid()));
  });
  subject.CloseContainer(&details);
  writer.CloseContainer(&subject);
}

std::string ErrorText(dbus::ErrorResponse* error) {
  dbus::MessageReader reader(error);
  std::string text;
  reader.PopString(&text);
  return text;
}

}

PolkitAuthenticator::PolkitAuthenticator(Unavailable unavailable)
    : unavailable_(std::move(unavailable)) {}

PolkitAuthenticator::~PolkitAuthenticator() {
  if (callback_) {
    CancelInPolkit();
  }
}

bool PolkitAuthenticator::CanAuthenticateWithBiometrics() {
  return false;
}

bool PolkitAuthenticator::CanAuthenticateWithBiometricOrScreenLock() {
  return true;
}

void PolkitAuthenticator::AuthenticateWithMessage(
    const std::u16string& message,
    AuthenticateCallback callback) {
  if (callback_) {
    Cancel();
  }
  callback_ = std::move(callback);
  bus_ = dbus_thread_linux::GetSharedSystemBus();
  authority_ = bus_ ? bus_->GetObjectProxy(kPolkitService,
                                           dbus::ObjectPath(kAuthorityPath))
                    : nullptr;
  if (!authority_) {
    unavailable_.Run("Astro can't reach the system bus, so it can't ask polkit "
                     "to confirm it's you.");
    return Finish(false);
  }
  cancellation_id_ = NextCancellationId();
  dbus::MethodCall check(kAuthorityInterface, "CheckAuthorization");
  dbus::MessageWriter writer(&check);
  AppendThisProcess(writer);
  writer.AppendString(kPolkitAction);
  dbus::MessageWriter details(nullptr);
  writer.OpenArray("{ss}", &details);
  writer.CloseContainer(&details);
  writer.AppendUint32(kAllowUserInteraction);
  writer.AppendString(cancellation_id_);
  authority_->CallMethodWithErrorResponse(
      &check, kPromptDeadline.InMilliseconds(),
      base::BindOnce(&PolkitAuthenticator::Replied,
                     weak_factory_.GetWeakPtr()));
}

void PolkitAuthenticator::Cancel() {
  if (!callback_) {
    return;
  }
  CancelInPolkit();
  weak_factory_.InvalidateWeakPtrs();
  Finish(false);
}

void PolkitAuthenticator::Replied(dbus::Response* response,
                                  dbus::ErrorResponse* error) {
  if (error) {
    const std::string name = error->GetErrorName();
    const std::string text = ErrorText(error);
    if (name == kPolkitCancelled) {
      return Finish(false);
    }
    if (text.find(kNotRegistered) != std::string::npos) {
      unavailable_.Run(base::StrCat(
          {"Astro's polkit action ", kPolkitAction,
           " isn't installed, so Astro can't ask you to confirm it's you. "
           "Copy so.oxy.astro.policy from Astro's folder to "
           "/usr/share/polkit-1/actions/."}));
    } else if (name == kServiceUnknown || name == kNameHasNoOwner) {
      unavailable_.Run(
          "polkit isn't running on this system, so Astro can't ask you to "
          "confirm it's you.");
    } else {
      CancelInPolkit();
      unavailable_.Run(base::StrCat(
          {"polkit didn't answer (", name, "), so Astro can't confirm it's "
           "you."}));
    }
    return Finish(false);
  }
  if (!response) {
    unavailable_.Run(
        "polkit didn't answer, so Astro can't ask you to confirm it's you.");
    return Finish(false);
  }
  dbus::MessageReader reader(response);
  dbus::MessageReader result(nullptr);
  bool authorized = false;
  bool challenge = false;
  if (!reader.PopStruct(&result) || !result.PopBool(&authorized) ||
      !result.PopBool(&challenge)) {
    unavailable_.Run(
        "polkit sent an answer Astro can't read, so it can't confirm it's "
        "you.");
    return Finish(false);
  }
  if (!authorized && challenge) {
    unavailable_.Run(
        "No polkit authentication agent is running in this session, so Astro "
        "can't ask for your password.");
  }
  Finish(authorized);
}

void PolkitAuthenticator::Finish(bool authenticated) {
  cancellation_id_.clear();
  if (callback_) {
    std::move(callback_).Run(authenticated);
  }
}

void PolkitAuthenticator::CancelInPolkit() {
  if (!authority_ || cancellation_id_.empty()) {
    return;
  }
  dbus::MethodCall cancel(kAuthorityInterface, "CancelCheckAuthorization");
  dbus::MessageWriter writer(&cancel);
  writer.AppendString(cancellation_id_);
  authority_->CallMethod(&cancel, dbus::ObjectProxy::TIMEOUT_USE_DEFAULT,
                         base::DoNothing());
  cancellation_id_.clear();
}

}
