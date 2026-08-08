// Copyright 2026 Oxy. Astro product module.

#include "astro/browser/webui/astro_settings_page.h"

#include <string>

#include "astro/browser/webui/astro_webui_page.h"
#include "astro/common/url_constants.h"
#include "content/public/browser/web_ui.h"

namespace astro {

AstroSettingsPage::AstroSettingsPage(content::WebUI* web_ui, const GURL& url)
    : settings::SettingsUI(web_ui) {
  // The base constructor has installed the handlers. Now replace what the page
  // is made of: AddAstroWebUiDataSource registers a source for the host
  // actually navigated to, serving the Bloom app's three files and nothing
  // else.
  AddAstroWebUiDataSource(web_ui, url);
}

AstroSettingsPage::~AstroSettingsPage() = default;

AstroSettingsPageConfig::AstroSettingsPageConfig(std::string_view host)
    : DefaultWebUIConfig(kAstroUIScheme, host) {}

}  // namespace astro
