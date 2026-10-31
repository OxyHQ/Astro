// Copyright 2026 Oxy. Apache-2.0.

#ifndef CHROME_BROWSER_ASTRO_AC_MENU_BAR_H_
#define CHROME_BROWSER_ASTRO_AC_MENU_BAR_H_

#include "base/functional/callback_forward.h"
#include "base/values.h"

namespace content {
class WebContents;
}

namespace astro {

bool SetWindowMenuBar(content::WebContents* page,
                      const base::ListValue& entries,
                      base::RepeatingCallback<void(int index)> activated);

bool RunEditCommand(content::WebContents* page, const std::string& command);

}

#endif
