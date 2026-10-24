// Copyright 2026 Oxy. Apache-2.0.

#ifndef CHROME_BROWSER_ASTRO_AC_EXTENSION_SHORTCUTS_H_
#define CHROME_BROWSER_ASTRO_AC_EXTENSION_SHORTCUTS_H_

#include "base/functional/callback.h"

namespace ui {
class Accelerator;
}

namespace astro {

void InstallExtensionShortcuts(
    base::RepeatingCallback<bool(const ui::Accelerator&)> reserved);

}

#endif
