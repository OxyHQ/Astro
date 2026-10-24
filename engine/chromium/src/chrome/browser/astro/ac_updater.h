// Copyright 2026 Oxy. Apache-2.0.

#ifndef CHROME_BROWSER_ASTRO_AC_UPDATER_H_
#define CHROME_BROWSER_ASTRO_AC_UPDATER_H_

#include <string>

#include "base/functional/callback_forward.h"
#include "base/values.h"

namespace astro {

void UpdaterCall(const std::string& method,
                 const base::DictValue& args,
                 base::OnceCallback<void(base::Value)> done);

}

#endif
