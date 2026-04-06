// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_WEBUI_ASTRO_WHATS_NEW_UI_H_
#define CHROME_BROWSER_OXY_WEBUI_ASTRO_WHATS_NEW_UI_H_

#include "content/public/browser/webui_config.h"
#include "ui/webui/mojo_web_ui_controller.h"

namespace oxy {

// Host name for the Astro What's New page: chrome://whats-new
// Replaces Chrome's built-in What's New page.
inline constexpr char kAstroWhatsNewHost[] = "whats-new";

// WebUI controller for the Astro What's New page.
// Serves the Vite-built UI from disk (index.html, CSS, JS assets)
// located in the resources/astro-whats-new/ directory.
class AstroWhatsNewUI : public ui::MojoWebUIController {
 public:
  explicit AstroWhatsNewUI(content::WebUI* web_ui);
  ~AstroWhatsNewUI() override;

  AstroWhatsNewUI(const AstroWhatsNewUI&) = delete;
  AstroWhatsNewUI& operator=(const AstroWhatsNewUI&) = delete;
};

// WebUI config that registers chrome://astro-whats-new.
class AstroWhatsNewUIConfig
    : public content::DefaultWebUIConfig<AstroWhatsNewUI> {
 public:
  AstroWhatsNewUIConfig();
};

}  // namespace oxy

#endif  // CHROME_BROWSER_OXY_WEBUI_ASTRO_WHATS_NEW_UI_H_
