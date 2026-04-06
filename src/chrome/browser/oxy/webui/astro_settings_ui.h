// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_WEBUI_ASTRO_SETTINGS_UI_H_
#define CHROME_BROWSER_OXY_WEBUI_ASTRO_SETTINGS_UI_H_

#include "content/public/browser/webui_config.h"
#include "ui/webui/mojo_web_ui_controller.h"

namespace oxy {

// Host name for the Astro Settings page: chrome://settings
// Replaces Chrome's built-in settings page.
inline constexpr char kAstroSettingsHost[] = "settings";

// WebUI controller for the Astro settings page.
// Serves the Vite-built settings UI from disk and provides
// PrefService-backed read/write handlers for browser settings.
class AstroSettingsUI : public ui::MojoWebUIController {
 public:
  explicit AstroSettingsUI(content::WebUI* web_ui);
  ~AstroSettingsUI() override;

  AstroSettingsUI(const AstroSettingsUI&) = delete;
  AstroSettingsUI& operator=(const AstroSettingsUI&) = delete;
};

// WebUI config that registers chrome://astro-settings.
class AstroSettingsUIConfig
    : public content::DefaultWebUIConfig<AstroSettingsUI> {
 public:
  AstroSettingsUIConfig();
};

}  // namespace oxy

#endif  // CHROME_BROWSER_OXY_WEBUI_ASTRO_SETTINGS_UI_H_
