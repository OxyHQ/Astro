// Copyright 2026 Oxy. Apache-2.0.

#ifndef CHROME_BROWSER_ASTRO_AC_CHROME_UI_H_
#define CHROME_BROWSER_ASTRO_AC_CHROME_UI_H_

#include <string>

#include "base/functional/callback_forward.h"
#include "base/values.h"

namespace content {
class WebContents;
}

namespace astro {

void InstallDeviceChooser();
void InstallCastDialog();

void ChromeUICall(const std::string& method,
                  const base::DictValue& params,
                  content::WebContents* tab,
                  base::OnceCallback<void(base::Value)> done);

bool DeviceChooserCall(const std::string& method,
                       const base::DictValue& params,
                       content::WebContents* tab,
                       base::Value* result);

}

#endif
