// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_WEBUI_ASTRO_NTP_UI_H_
#define CHROME_BROWSER_OXY_WEBUI_ASTRO_NTP_UI_H_

#include "content/public/browser/web_ui_controller.h"
#include "content/public/browser/webui_config.h"

namespace oxy {

// Host name for the Astro NTP: chrome://astro-ntp (displayed as astro://newtab)
inline constexpr char kAstroNtpHost[] = "astro-ntp";

// WebUI controller for the Astro New Tab Page.
// Serves the Vite-built NTP from disk (index.html, CSS, JS assets)
// located adjacent to the browser executable.
class AstroNtpUI : public content::WebUIController {
 public:
  explicit AstroNtpUI(content::WebUI* web_ui);
  ~AstroNtpUI() override;

  AstroNtpUI(const AstroNtpUI&) = delete;
  AstroNtpUI& operator=(const AstroNtpUI&) = delete;
};

// WebUI config that registers chrome://astro-ntp.
class AstroNtpUIConfig : public content::DefaultWebUIConfig<AstroNtpUI> {
 public:
  AstroNtpUIConfig();
};

}  // namespace oxy

#endif  // CHROME_BROWSER_OXY_WEBUI_ASTRO_NTP_UI_H_
