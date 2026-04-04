// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_ADBLOCK_WEBUI_ASTRO_ADBLOCK_UI_H_
#define CHROME_BROWSER_OXY_ADBLOCK_WEBUI_ASTRO_ADBLOCK_UI_H_

#include "content/public/browser/web_ui_controller.h"
#include "content/public/browser/webui_config.h"

namespace oxy::adblock {

// WebUI controller for the astro://adblock settings page.
// Provides filter list management, custom rules editing, and
// per-site exception configuration.
class AstroAdBlockUI : public content::WebUIController {
 public:
  explicit AstroAdBlockUI(content::WebUI* web_ui);
  ~AstroAdBlockUI() override;

  AstroAdBlockUI(const AstroAdBlockUI&) = delete;
  AstroAdBlockUI& operator=(const AstroAdBlockUI&) = delete;
};

// WebUI config that registers astro://adblock (chrome://adblock).
class AstroAdBlockUIConfig : public content::DefaultWebUIConfig<AstroAdBlockUI> {
 public:
  AstroAdBlockUIConfig();
};

}  // namespace oxy::adblock

#endif  // CHROME_BROWSER_OXY_ADBLOCK_WEBUI_ASTRO_ADBLOCK_UI_H_
