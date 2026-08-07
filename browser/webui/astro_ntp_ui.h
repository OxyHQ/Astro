// Copyright 2026 Oxy. Astro product module.

#ifndef ASTRO_BROWSER_WEBUI_ASTRO_NTP_UI_H_
#define ASTRO_BROWSER_WEBUI_ASTRO_NTP_UI_H_

#include "content/public/browser/web_ui_controller.h"
#include "content/public/browser/webui_config.h"

namespace astro {

// Astro's new tab page.
//
// A page Astro genuinely owns: upstream's is Google's, and what ungoogled
// leaves behind is a minimal third-party stand-in. So unlike settings, there is
// nothing here worth preserving from upstream -- this replaces it outright.
//
// Built with Bloom on react-native-web, the same components and the same design
// layer as the rest of Oxy, so a control here behaves as it does in Mention or
// the console rather than being a browser-shaped imitation of one.
class AstroNtpUI : public content::WebUIController {
 public:
  explicit AstroNtpUI(content::WebUI* web_ui);
  AstroNtpUI(const AstroNtpUI&) = delete;
  AstroNtpUI& operator=(const AstroNtpUI&) = delete;
  ~AstroNtpUI() override;
};

class AstroNtpUIConfig : public content::DefaultWebUIConfig<AstroNtpUI> {
 public:
  AstroNtpUIConfig();
};

}  // namespace astro

#endif  // ASTRO_BROWSER_WEBUI_ASTRO_NTP_UI_H_
