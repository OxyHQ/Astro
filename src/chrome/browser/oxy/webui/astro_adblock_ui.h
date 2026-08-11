// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_WEBUI_ASTRO_ADBLOCK_UI_H_
#define CHROME_BROWSER_OXY_WEBUI_ASTRO_ADBLOCK_UI_H_

#include <memory>

#include "chrome/browser/oxy/webui/astro_adblock.mojom.h"
#include "chrome/browser/oxy/webui/astro_adblock_page_handler.h"
#include "chrome/browser/oxy/webui/astro_theme.mojom.h"
#include "chrome/browser/oxy/webui/astro_theme_provider.h"
#include "chrome/browser/oxy/webui/astro_webui_page.h"
#include "content/public/browser/webui_config.h"
#include "mojo/public/cpp/bindings/pending_receiver.h"
#include "mojo/public/cpp/bindings/receiver.h"

namespace content {
class WebUI;
}

namespace astro {

// The host the ad blocker page is served from. Astro's own — nothing upstream
// registers it, so this page is ADDED rather than swapped in.
inline constexpr char kAstroAdBlockHost[] = "adblock";

// Astro's ad blocker page.
//
// It lives here, in `chrome/browser/oxy/webui/`, and not with the rest of the
// blocker in `chrome/browser/oxy/adblock/webui/` where it was born. Not a
// filing preference: `//chrome/browser/oxy:webui_controllers` already depends
// on `//chrome/browser/oxy/adblock` — the new tab page reads the blocked count
// from it — so a controller in the adblock target that reached back for
// `astro_webui_page.h` would be a GN dependency cycle. Every Astro page
// controller belongs to one target for that reason.
//
// It binds two interfaces, and the split between them is the grant:
//
//   astro.mojom.ThemeProvider              read-only, held by every Astro page.
//   astro.adblock.mojom.PageHandlerFactory this page's own data plane.
//
// It does NOT bind astro.settings.mojom, so the ad blocker page can read the
// theme and cannot change it.
class AstroAdBlockUI : public AstroMojoWebUIPageController,
                       public adblock::mojom::PageHandlerFactory {
 public:
  explicit AstroAdBlockUI(content::WebUI* web_ui);
  ~AstroAdBlockUI() override;

  AstroAdBlockUI(const AstroAdBlockUI&) = delete;
  AstroAdBlockUI& operator=(const AstroAdBlockUI&) = delete;

  void BindInterface(mojo::PendingReceiver<mojom::ThemeProvider> receiver);
  void BindInterface(
      mojo::PendingReceiver<adblock::mojom::PageHandlerFactory> receiver);

 private:
  // adblock::mojom::PageHandlerFactory:
  void CreatePageHandler(
      mojo::PendingRemote<adblock::mojom::Page> page,
      mojo::PendingReceiver<adblock::mojom::PageHandler> handler) override;

  AstroThemeProvider theme_provider_;
  std::unique_ptr<AstroAdBlockPageHandler> page_handler_;
  mojo::Receiver<adblock::mojom::PageHandlerFactory> factory_receiver_{this};

  WEB_UI_CONTROLLER_TYPE_DECL();
};

class AstroAdBlockUIConfig
    : public content::DefaultWebUIConfig<AstroAdBlockUI> {
 public:
  AstroAdBlockUIConfig();
};

}  // namespace astro

#endif  // CHROME_BROWSER_OXY_WEBUI_ASTRO_ADBLOCK_UI_H_
