// Copyright 2026 Oxy. Apache-2.0.

#ifndef CHROME_BROWSER_ASTRO_AC_CALENDAR_H_
#define CHROME_BROWSER_ASTRO_AC_CALENDAR_H_

#include <string>

#include "base/functional/callback.h"
#include "base/values.h"

namespace astro {

bool CalendarCall(const std::string& method,
                  const base::DictValue& args,
                  base::OnceCallback<void(base::Value)>& done);

}

#endif
