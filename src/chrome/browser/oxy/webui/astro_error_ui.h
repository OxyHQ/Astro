// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_WEBUI_ASTRO_ERROR_UI_H_
#define CHROME_BROWSER_OXY_WEBUI_ASTRO_ERROR_UI_H_

#include "content/public/browser/webui_config.h"
#include "ui/webui/mojo_web_ui_controller.h"

namespace oxy {

// Host name for the Astro Error page: chrome://astro-error
inline constexpr char kAstroErrorHost[] = "astro-error";

// WebUI controller for the Astro error page.
// Serves the Vite-built error UI from disk (index.html, CSS, JS assets)
// located in the resources/astro-error/ directory.
class AstroErrorUI : public ui::MojoWebUIController {
 public:
  explicit AstroErrorUI(content::WebUI* web_ui);
  ~AstroErrorUI() override;

  AstroErrorUI(const AstroErrorUI&) = delete;
  AstroErrorUI& operator=(const AstroErrorUI&) = delete;
};

// WebUI config that registers chrome://astro-error.
class AstroErrorUIConfig : public content::DefaultWebUIConfig<AstroErrorUI> {
 public:
  AstroErrorUIConfig();
};

}  // namespace oxy

#endif  // CHROME_BROWSER_OXY_WEBUI_ASTRO_ERROR_UI_H_
