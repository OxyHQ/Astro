// Copyright 2026 Oxy. Apache-2.0.

#ifndef CHROME_BROWSER_ASTRO_AC_SYNC_FILES_H_
#define CHROME_BROWSER_ASTRO_AC_SYNC_FILES_H_

#include <string>

#include "base/functional/callback_forward.h"
#include "base/values.h"

class Profile;

namespace astro {

void SyncFilesCall(Profile* profile,
                   const std::string& method,
                   const base::DictValue& args,
                   base::OnceCallback<void(base::Value)> done);

}

#endif
