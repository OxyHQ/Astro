// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_WEBUI_ASTRO_SETTINGS_UI_H_
#define CHROME_BROWSER_OXY_WEBUI_ASTRO_SETTINGS_UI_H_

#include "content/public/browser/web_ui_controller.h"
#include "content/public/browser/webui_config.h"

namespace oxy {

// WebUI controller for the astro://settings page.
// Serves the Vite-built settings UI and provides PrefService-backed
// read/write handlers for all browser settings.
class AstroSettingsUI : public content::WebUIController {
 public:
  explicit AstroSettingsUI(content::WebUI* web_ui);
  ~AstroSettingsUI() override;

  AstroSettingsUI(const AstroSettingsUI&) = delete;
  AstroSettingsUI& operator=(const AstroSettingsUI&) = delete;
};

// WebUI config that registers astro://settings (chrome://settings).
class AstroSettingsUIConfig
    : public content::DefaultWebUIConfig<AstroSettingsUI> {
 public:
  AstroSettingsUIConfig();
};

}  // namespace oxy

#endif  // CHROME_BROWSER_OXY_WEBUI_ASTRO_SETTINGS_UI_H_
