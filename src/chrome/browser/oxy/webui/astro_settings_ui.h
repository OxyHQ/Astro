// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_WEBUI_ASTRO_SETTINGS_UI_H_
#define CHROME_BROWSER_OXY_WEBUI_ASTRO_SETTINGS_UI_H_

#include <memory>

#include "chrome/browser/oxy/webui/astro_settings.mojom.h"
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

class AstroSettingsPageHandler;

// astro://settings.
//
// SERVED UNDER UPSTREAM'S OWN HOST, and that is load-bearing rather than
// incidental. Eight extension APIs — settingsPrivate among them, and it is
// the only transport carrying a pref's POLICY state — are granted by host
// pattern in the two _api_features.json files, and the pattern names the
// settings host. A page served anywhere else gets none of them, silently: the
// object is simply undefined when the first control reads it. Patch 060
// therefore REPLACES upstream's registration rather than adding a second one,
// which would also CHECK-fail on the duplicate origin at startup.
//
// What that inherits, and what it costs, is the whole design: Chromium's prefs
// and their policy state keep arriving through settingsPrivate, upstream's own
// handlers keep working, and everything Astro adds is a named method on a
// typed interface instead.
class AstroSettingsUI : public AstroMojoWebUIPageController,
                        public settings::mojom::PageHandlerFactory {
 public:
  explicit AstroSettingsUI(content::WebUI* web_ui);
  ~AstroSettingsUI() override;

  AstroSettingsUI(const AstroSettingsUI&) = delete;
  AstroSettingsUI& operator=(const AstroSettingsUI&) = delete;

  // Bound from the WebUI interface broker (patch 062).
  void BindInterface(
      mojo::PendingReceiver<settings::mojom::PageHandlerFactory> receiver);
  void BindInterface(mojo::PendingReceiver<mojom::ThemeProvider> receiver);

 private:
  // settings::mojom::PageHandlerFactory:
  void CreatePageHandler(
      mojo::PendingReceiver<settings::mojom::PageHandler> handler) override;

  AstroThemeProvider theme_provider_;
  std::unique_ptr<AstroSettingsPageHandler> page_handler_;
  mojo::Receiver<settings::mojom::PageHandlerFactory> factory_receiver_{this};

  WEB_UI_CONTROLLER_TYPE_DECL();
};

class AstroSettingsUIConfig
    : public content::DefaultWebUIConfig<AstroSettingsUI> {
 public:
  AstroSettingsUIConfig();
};

}  // namespace astro

#endif  // CHROME_BROWSER_OXY_WEBUI_ASTRO_SETTINGS_UI_H_
