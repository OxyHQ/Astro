// Copyright 2026 Oxy. Astro product module.

#ifndef ASTRO_BROWSER_WEBUI_ASTRO_WEBUI_PAGE_H_
#define ASTRO_BROWSER_WEBUI_ASTRO_WEBUI_PAGE_H_

#include <string_view>

#include "content/public/browser/web_ui_controller.h"
#include "content/public/browser/webui_config.h"
#include "url/gurl.h"

namespace astro {

// One controller for every page Astro owns.
//
// Astro's internal pages are a single Vite + Tailwind + Bloom app
// (//astro/browser/resources/webui). Each page is a separate ORIGIN because
// that is how Chromium navigates and how the extension APIs are granted --
// astro://settings and astro://history are not the same security principal --
// but they are the same bytes, and the app picks its page from the host it was
// served on.
//
// So this is one controller registered once per host, not a class per page. A
// page is added by adding a route in the app and a host below; there is no C++
// to write for it.
// Register the data source that serves the Bloom app on `url`'s host.
//
// Shared, because two controllers need it: the generic one below, and
// AstroSettingsPage, which derives from Chromium's settings controller to
// inherit its message handlers. Duplicating it would mean two answers to
// "which files does an astro:// page serve".
void AddAstroWebUiDataSource(content::WebUI* web_ui, const GURL& url);

class AstroWebUiPage : public content::WebUIController {
 public:
  // The URL, not just the WebUI: the data source has to be registered under
  // the host that was actually navigated to, or its resources resolve to
  // nothing. content's DefaultWebUIConfig supports this two-argument shape.
  AstroWebUiPage(content::WebUI* web_ui, const GURL& url);
  AstroWebUiPage(const AstroWebUiPage&) = delete;
  AstroWebUiPage& operator=(const AstroWebUiPage&) = delete;
  ~AstroWebUiPage() override;
};

class AstroWebUiPageConfig
    : public content::DefaultWebUIConfig<AstroWebUiPage> {
 public:
  explicit AstroWebUiPageConfig(std::string_view host);
};

}  // namespace astro

#endif  // ASTRO_BROWSER_WEBUI_ASTRO_WEBUI_PAGE_H_
