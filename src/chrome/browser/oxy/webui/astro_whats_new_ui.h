// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_WEBUI_ASTRO_WHATS_NEW_UI_H_
#define CHROME_BROWSER_OXY_WEBUI_ASTRO_WHATS_NEW_UI_H_

#include "chrome/browser/oxy/webui/astro_theme.mojom.h"
#include "chrome/browser/oxy/webui/astro_theme_provider.h"
#include "chrome/browser/oxy/webui/astro_webui_page.h"
#include "content/public/browser/webui_config.h"
#include "mojo/public/cpp/bindings/pending_receiver.h"

namespace content {
class WebUI;
}

namespace astro {

// Astro's What's New page.
//
// The HOST is upstream's, `chrome::kChromeUIWhatsNewHost`, and it is taken over
// rather than shared: `WebUIConfigMap::AddWebUIConfigImpl` CHECKs on a
// duplicate origin, so `071-whats-new-webui-takeover.patch` SWAPS upstream's
// registration line for this config. That patch is also what makes the page
// reachable at all — upstream's `WhatsNewUIConfig::IsWebUIEnabled` returns
// `whats_new::IsEnabled()`, which outside a Google-branded build reads a
// feature flag that is disabled by default, so navigating to the host in this
// browser answered net::ERR_INVALID_URL.
//
// Unlike settings, taking this host buys no extension grant — nothing in either
// `_api_features.json` names it. It is taken because it is the address the
// browser's own "What's New" affordances point at, and a second host would
// leave those pointing at a page that does not resolve.
class AstroWhatsNewUI : public AstroMojoWebUIPageController {
 public:
  explicit AstroWhatsNewUI(content::WebUI* web_ui);
  ~AstroWhatsNewUI() override;

  AstroWhatsNewUI(const AstroWhatsNewUI&) = delete;
  AstroWhatsNewUI& operator=(const AstroWhatsNewUI&) = delete;

  void BindInterface(mojo::PendingReceiver<mojom::ThemeProvider> receiver);

 private:
  AstroThemeProvider theme_provider_;

  WEB_UI_CONTROLLER_TYPE_DECL();
};

class AstroWhatsNewUIConfig
    : public content::DefaultWebUIConfig<AstroWhatsNewUI> {
 public:
  AstroWhatsNewUIConfig();
};

}  // namespace astro

#endif  // CHROME_BROWSER_OXY_WEBUI_ASTRO_WHATS_NEW_UI_H_
