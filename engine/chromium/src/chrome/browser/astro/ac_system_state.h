// Copyright 2026 Oxy. Apache-2.0.

#ifndef CHROME_BROWSER_ASTRO_AC_SYSTEM_STATE_H_
#define CHROME_BROWSER_ASTRO_AC_SYSTEM_STATE_H_

#include "base/functional/callback_forward.h"
#include "base/values.h"

namespace astro {

void CurrentSystemState(base::OnceCallback<void(base::Value)> done);

}

#endif
