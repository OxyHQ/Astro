// Copyright 2026 Oxy. Apache-2.0.

#ifndef CHROME_BROWSER_ASTRO_AC_TRASH_H_
#define CHROME_BROWSER_ASTRO_AC_TRASH_H_

#include "base/functional/callback_forward.h"

namespace base {
class FilePath;
}

namespace astro {

void MoveToTrash(const base::FilePath& path,
                 base::OnceCallback<void(bool)> done);

}

#endif
