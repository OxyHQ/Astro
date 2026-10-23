// Copyright 2026 Oxy. Apache-2.0.

#include "chrome/browser/astro/ac_omnibox.h"

#include "base/values.h"

AC_ENGINE_CALL(ac_omnibox_opened) {
  astro::Call call(profile_dir, args_json, reply, context);
  if (!call) {
    return;
  }
  call.TakeReply().Send(base::DictValue().Set("prewarm", 2));
}
