// Copyright 2026 Oxy. Apache-2.0.

#ifndef CHROME_BROWSER_ASTRO_AC_SELECTION_MENU_H_
#define CHROME_BROWSER_ASTRO_AC_SELECTION_MENU_H_

#include "base/values.h"

namespace astro {

void InstallSelectionMenu();
void SetSelectionMenuItems(const base::ListValue& items);

}

#endif
