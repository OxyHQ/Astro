// Copyright 2026 Oxy. Apache-2.0.

#ifndef CHROME_BROWSER_ASTRO_AC_WINDOW_KEYS_H_
#define CHROME_BROWSER_ASTRO_AC_WINDOW_KEYS_H_

#include <string>
#include <vector>

#include "base/values.h"

class BrowserWindowInterface;

namespace astro {

void InstallWindowKeys();
void SetWindowShortcuts(std::vector<std::string> active,
                        std::vector<std::string> owned);
void SetWindowKeyCapture(BrowserWindowInterface* browser, bool capture);
void HostWindowKey(BrowserWindowInterface* browser,
                   const std::string& kind,
                   base::DictValue payload);

}

#endif
