// Copyright 2026 Oxy. Astro product module.

#include "astro/browser/webui/astro_settings_next_ui.h"

#include "astro/common/url_constants.h"
#include "chrome/common/webui_url_constants.h"
#include "content/public/browser/web_ui.h"

namespace astro {

AstroSettingsNextUI::AstroSettingsNextUI(content::WebUI* web_ui)
    : settings::SettingsUI(web_ui) {
  // Everything the page needs is set up by the base constructor: its resources,
  // its localized strings, its message handlers and the forty-eight values its
  // components assert on. This subclass exists as the place Astro's own styling
  // is layered on top, and nothing upstream does is undone here.
}

AstroSettingsNextUI::~AstroSettingsNextUI() = default;

AstroSettingsNextUIConfig::AstroSettingsNextUIConfig()
    : DefaultWebUIConfig(kAstroUIScheme, chrome::kChromeUISettingsHost) {}

}  // namespace astro
