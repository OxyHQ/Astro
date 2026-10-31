// Copyright 2026 Oxy. Apache-2.0.

#ifndef CHROME_BROWSER_ASTRO_AC_EXTENSION_VIEWS_H_
#define CHROME_BROWSER_ASTRO_AC_EXTENSION_VIEWS_H_

#include <optional>
#include <utility>

class BrowserWindowInterface;
class GURL;

namespace content {
class WebContents;
}

namespace astro {

std::optional<int> OpenExtensionView(BrowserWindowInterface* browser,
                                     const GURL& url,
                                     bool popup);
content::WebContents* ExtensionViewContents(int id);
std::optional<std::pair<int, int>> ExtensionPopupSize(content::WebContents* contents);
void CloseExtensionView(int id);
void InstallExtensionViewHooks();

}

#endif
