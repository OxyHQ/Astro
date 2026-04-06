// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_WEBUI_ASTRO_ALIA_UI_H_
#define CHROME_BROWSER_OXY_WEBUI_ASTRO_ALIA_UI_H_

#include "content/public/browser/webui_config.h"
#include "ui/webui/mojo_web_ui_controller.h"

namespace oxy {

// Host name for the Astro Alia AI page: chrome://alia
inline constexpr char kAstroAliaHost[] = "alia";

// WebUI controller for the Astro Alia AI assistant page.
// Serves the Vite-built Alia UI from disk (index.html, CSS, JS assets)
// located in the resources/astro-alia/ directory.
class AstroAliaUI : public ui::MojoWebUIController {
 public:
  explicit AstroAliaUI(content::WebUI* web_ui);
  ~AstroAliaUI() override;

  AstroAliaUI(const AstroAliaUI&) = delete;
  AstroAliaUI& operator=(const AstroAliaUI&) = delete;
};

// WebUI config that registers chrome://astro-alia.
class AstroAliaUIConfig : public content::DefaultWebUIConfig<AstroAliaUI> {
 public:
  AstroAliaUIConfig();
};

}  // namespace oxy

#endif  // CHROME_BROWSER_OXY_WEBUI_ASTRO_ALIA_UI_H_
