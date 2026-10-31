// Copyright 2026 Oxy. Apache-2.0.

#include "chrome/browser/astro/ac_ai_policy.h"

#include <optional>
#include <string>

#include "base/values.h"
#include "build/build_config.h"
#include "chrome/browser/policy/profile_policy_connector.h"
#include "chrome/browser/profiles/profile.h"
#include "components/policy/core/common/policy_map.h"
#include "components/policy/core/common/policy_namespace.h"
#include "components/policy/core/common/policy_service.h"

#if BUILDFLAG(IS_MAC)
#include <CoreFoundation/CoreFoundation.h>

#include "base/apple/foundation_util.h"
#include "base/apple/scoped_cftyperef.h"
#include "base/strings/sys_string_conversions.h"
#endif

namespace {

constexpr char kAiContentPolicy[] = "AstroAIContentPolicy";

#if BUILDFLAG(IS_MAC)
std::optional<std::string> ManagedPreference() {
  base::apple::ScopedCFTypeRef<CFStringRef> key(
      base::SysUTF8ToCFStringRef(kAiContentPolicy));
  if (!CFPreferencesAppValueIsForced(key.get(),
                                     kCFPreferencesCurrentApplication)) {
    return std::nullopt;
  }
  base::apple::ScopedCFTypeRef<CFPropertyListRef> value(
      CFPreferencesCopyAppValue(key.get(), kCFPreferencesCurrentApplication));
  CFStringRef text = base::apple::CFCast<CFStringRef>(value.get());
  if (!text) {
    return std::nullopt;
  }
  return base::SysCFStringRefToUTF8(text);
}
#endif

}

AC_ENGINE_CALL(ac_ai_policy) {
  astro::Call call(profile_dir, args_json, reply, context);
  if (!call) {
    return;
  }
  base::DictValue result;
  policy::ProfilePolicyConnector* connector =
      call.profile()->GetProfilePolicyConnector();
  policy::PolicyService* service =
      connector ? connector->policy_service() : nullptr;
  if (service) {
    const policy::PolicyMap& policies = service->GetPolicies(
        policy::PolicyNamespace(policy::POLICY_DOMAIN_CHROME, std::string()));
    if (const base::Value* value = policies.GetValueUnsafe(kAiContentPolicy)) {
      result.Set("policy", value->Clone());
    }
  }
#if BUILDFLAG(IS_MAC)
  if (!result.contains("policy")) {
    if (std::optional<std::string> managed = ManagedPreference()) {
      result.Set("policy", *managed);
    }
  }
#endif
  call.TakeReply().Send(std::move(result));
}
