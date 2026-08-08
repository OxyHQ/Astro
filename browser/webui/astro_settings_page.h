// Copyright 2026 Oxy. Astro product module.

#ifndef ASTRO_BROWSER_WEBUI_ASTRO_SETTINGS_PAGE_H_
#define ASTRO_BROWSER_WEBUI_ASTRO_SETTINGS_PAGE_H_

#include <string_view>

#include "chrome/browser/ui/webui/settings/settings_ui.h"
#include "content/public/browser/webui_config.h"
#include "url/gurl.h"

namespace astro {

// Astro's settings page: Chromium's settings BACK END, Astro's front end.
//
// The UI is Astro's own Vite + Tailwind + Bloom app
// (//astro/browser/resources/webui). None of Chromium's settings UI is reused.
//
// What IS reused -- and the only thing worth reusing -- is the API that
// actually controls the browser. Deriving from settings::SettingsUI installs
// the same forty-three message handlers upstream's page installs: search
// engines, site settings, downloads, languages, import, reset, default
// browser, startup pages, secure DNS, security keys, protocol handlers, and
// the rest. Every one of them is real browser control that exists ONLY as a
// WebUIMessageHandler; reimplementing them in //astro would be writing a
// second copy of the browser's own plumbing.
//
// So the app calls them exactly as upstream's page does, through chrome.send /
// cr.sendWithPromise, and this class exists to make that possible without
// inheriting a single line of upstream's markup.
//
// The base constructor also registers a data source for upstream's own host.
// This class then registers Astro's, under the host actually navigated to, so
// the bytes served are the Bloom app's.
class AstroSettingsPage : public settings::SettingsUI {
 public:
  AstroSettingsPage(content::WebUI* web_ui, const GURL& url);
  AstroSettingsPage(const AstroSettingsPage&) = delete;
  AstroSettingsPage& operator=(const AstroSettingsPage&) = delete;
  ~AstroSettingsPage() override;
};

class AstroSettingsPageConfig
    : public content::DefaultWebUIConfig<AstroSettingsPage> {
 public:
  explicit AstroSettingsPageConfig(std::string_view host);
};

}  // namespace astro

#endif  // ASTRO_BROWSER_WEBUI_ASTRO_SETTINGS_PAGE_H_
