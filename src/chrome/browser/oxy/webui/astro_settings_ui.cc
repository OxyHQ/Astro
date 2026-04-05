// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/oxy/webui/astro_settings_ui.h"

#include "chrome/browser/oxy/webui/astro_settings_handler.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/common/webui_url_constants.h"
#include "content/public/browser/web_ui.h"
#include "content/public/browser/web_ui_data_source.h"
#include "content/public/common/url_constants.h"

namespace oxy {

namespace {

constexpr char kSettingsHost[] = "settings";

void CreateAndAddDataSource(content::WebUI* web_ui) {
  content::WebUIDataSource* source =
      content::WebUIDataSource::CreateAndAdd(
          web_ui->GetWebContents()->GetBrowserContext(), kSettingsHost);

  // TODO(nicag): Serve the built Vite output from grit-packed resources.
  // For now the data source is configured but the actual HTML/CSS/JS assets
  // will be added once the grit resource pipeline is wired up.
  // The resource IDs will be:
  //   IDR_ASTRO_SETTINGS_HTML  - index.html
  //   IDR_ASTRO_SETTINGS_JS    - main bundle
  //   IDR_ASTRO_SETTINGS_CSS   - styles
  source->SetDefaultResource(IDR_ASTRO_SETTINGS_HTML);

  // The Vite build produces inline scripts/styles, so we need to
  // relax CSP to allow them.
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::ScriptSrc,
      "script-src 'self' 'unsafe-inline';");
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::StyleSrc,
      "style-src 'self' 'unsafe-inline';");
}

}  // namespace

AstroSettingsUI::AstroSettingsUI(content::WebUI* web_ui)
    : content::WebUIController(web_ui) {
  CreateAndAddDataSource(web_ui);

  // Register the message handler that bridges JS <-> PrefService.
  web_ui->AddMessageHandler(std::make_unique<AstroSettingsHandler>());
}

AstroSettingsUI::~AstroSettingsUI() = default;

AstroSettingsUIConfig::AstroSettingsUIConfig()
    : content::DefaultWebUIConfig<AstroSettingsUI>(
          content::kChromeUIScheme,
          kSettingsHost) {}

}  // namespace oxy
