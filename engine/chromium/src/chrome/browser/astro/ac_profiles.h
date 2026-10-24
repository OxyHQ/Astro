// Copyright 2026 Oxy. Apache-2.0.

#ifndef CHROME_BROWSER_ASTRO_AC_PROFILES_H_
#define CHROME_BROWSER_ASTRO_AC_PROFILES_H_

#include <string>

#include "base/functional/callback_forward.h"
#include "base/values.h"

namespace astro {

void ReleaseProfile(const std::string& name);
void DeleteProfileData(const std::string& name,
                       base::OnceCallback<void(base::Value)> done);

}

#endif
