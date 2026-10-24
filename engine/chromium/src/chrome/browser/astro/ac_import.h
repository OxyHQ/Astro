// Copyright 2026 Oxy. Apache-2.0.

#ifndef CHROME_BROWSER_ASTRO_AC_IMPORT_H_
#define CHROME_BROWSER_ASTRO_AC_IMPORT_H_

#include <string>

#include "base/functional/callback_forward.h"
#include "base/values.h"

namespace astro {

void ImportCall(const std::string& method,
                base::DictValue args,
                base::RepeatingCallback<void(base::DictValue)> event,
                base::OnceCallback<void(base::DictValue)> done);

}

#endif
