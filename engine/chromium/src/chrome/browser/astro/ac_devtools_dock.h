// Copyright 2026 Oxy. Apache-2.0.

#ifndef CHROME_BROWSER_ASTRO_AC_DEVTOOLS_DOCK_H_
#define CHROME_BROWSER_ASTRO_AC_DEVTOOLS_DOCK_H_

#include <string>

#include "base/values.h"

namespace content {
class WebContents;
}

namespace astro {

void InstallDockedDevTools();
void ShowDevTools(content::WebContents* contents, const std::string& panel);
base::DictValue DockedDevToolsState(content::WebContents* inspected);

}

#endif
