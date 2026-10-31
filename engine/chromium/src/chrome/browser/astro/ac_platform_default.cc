// Copyright 2026 Oxy. Apache-2.0.

#include <optional>
#include <string>
#include <utility>

#include "base/functional/callback.h"
#include "base/logging.h"
#include "base/values.h"
#include "build/build_config.h"
#include "chrome/browser/astro/ac_engine.h"
#include "chrome/browser/astro/ac_external_apps.h"
#include "chrome/browser/astro/ac_input_frame_rate.h"
#include "chrome/browser/astro/pip/ac_pip_mac.h"
#include "chrome/common/pref_names.h"
#include "components/prefs/pref_service.h"
#include "components/prefs/scoped_user_pref_update.h"

namespace astro {
namespace {

const char* const kPairs = prefs::kProtocolHandlerPerOriginAllowedProtocols;

}

void HoldFullFrameRateDuringInput() {}

}

std::optional<gfx::Rect> LoadAstroPictureInPictureBounds() {
  return std::nullopt;
}

void SaveAstroPictureInPictureBounds(const gfx::Rect& bounds) {}

void FadeOutAstroPictureInPicture(gfx::NativeWindow window,
                                  base::TimeDelta duration) {}

void ResetAstroPictureInPictureFade(gfx::NativeWindow window) {}

AC_ENGINE_CALL(ac_external_apps_allowances) {
  astro::Call call(profile_dir, args_json, reply, context);
  if (!call) {
    return;
  }
  base::ListValue allowances;
  for (const auto [origin, schemes] :
       call.profile()->GetPrefs()->GetDict(astro::kPairs)) {
    if (!schemes.is_dict()) {
      continue;
    }
    for (const auto [scheme, allowed] : schemes.GetDict()) {
      if (allowed.is_bool() && allowed.GetBool()) {
        allowances.Append(base::DictValue()
                              .Set("origin", origin)
                              .Set("scheme", scheme)
                              .Set("app", base::Value())
                              .Set("icon", base::Value()));
      }
    }
  }
  call.TakeReply().Send(
      base::DictValue().Set("allowances", std::move(allowances)));
}

AC_ENGINE_CALL(ac_external_apps_remove) {
  astro::Call call(profile_dir, args_json, reply, context);
  if (!call) {
    return;
  }
  const std::string origin = call.String("origin");
  const std::string scheme = call.String("scheme");
  if (origin.empty() || scheme.empty()) {
    return call.TakeReply().Error("origin and scheme required");
  }
  ScopedDictPrefUpdate pairs(call.profile()->GetPrefs(), astro::kPairs);
  if (base::DictValue* schemes = pairs->FindDict(origin)) {
    schemes->Remove(scheme);
    if (schemes->empty()) {
      pairs->Remove(origin);
    }
  }
  call.TakeReply().Ok();
}
