// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/oxy/webui/astro_settings_ui.h"

#include <memory>
#include <utility>

#include "chrome/browser/oxy/webui/astro_settings_page_handler.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/ui/webui/settings/about_handler.h"
#include "chrome/browser/ui/webui/settings/browser_lifetime_handler.h"
#include "chrome/browser/ui/webui/settings/search_engines_handler.h"
#include "chrome/browser/ui/webui/settings/settings_clear_browsing_data_handler.h"
#include "chrome/common/webui_url_constants.h"
#include "content/public/browser/web_ui.h"
#include "content/public/common/url_constants.h"

namespace astro {

namespace {

// The assets directory tools/build.sh stages this page's bundle into. Read by
// ServeAstroWebUIResource until issue #16 moves the bundle into a .pak; the
// two spellings agreeing is a contract with the build and nothing but
// agreement enforces it.
constexpr char kSettingsResourceDirectory[] = "astro-settings";

const WebUIPage& SettingsPage() {
  // The host is upstream's constant, not a literal, and not a host of Astro's
  // own — see the class comment in the header for why the grant depends on it.
  static const WebUIPage kPage{
      .host = chrome::kChromeUISettingsHost,
      .resource_directory = kSettingsResourceDirectory,
      .csp =
          {
              // script-src is left at Chromium's default for trusted WebUI
              // (`chrome://resources 'self'`, Trusted Types enforced). The app
              // ships one bundle from its own origin and needs nothing more.
              .script_src = nullptr,

              // WIDENING, DECLARED AND DATED — 2026-08-09.
              //
              // Bloom's web forks inject a <style> element on mount for their
              // keyframes and pseudo-classes, which `style-src 'self'` blocks.
              // React and react-native-web write through the CSSOM, which CSP
              // does not police, so this covers Bloom's injection and nothing
              // else. It comes out when Bloom ships constructable stylesheets
              // (new CSSStyleSheet + adoptedStyleSheets); tracked on the F5
              // step of the Astro Next plan, issue #14.
              .style_src = "style-src 'self' 'unsafe-inline';",

              // Astro's own assets plus inlined images from the bundle. No
              // remote host: nothing on this page loads over the network.
              .img_src = "img-src 'self' data:;",

              // Fonts are data-URIs in the platform bundle, by design — a
              // browser's settings page must render before any network exists.
              .font_src = "font-src data:;",

              // Nothing here talks to a server. Everything the page reads
              // comes over Mojo or the extension bindings, neither of which is
              // a fetch, so this directive costs the page nothing and closes
              // the whole class of exfiltration through it.
              .connect_src = "connect-src 'none';",
          },
  };
  return kPage;
}

}  // namespace

AstroSettingsUI::AstroSettingsUI(content::WebUI* web_ui)
    // chrome.send is enabled because the upstream handlers adopted below speak
    // it: FireWebUIListener and cr.sendWithPromise are its two directions.
    // Astro's own controls do not use it and never should.
    : AstroMojoWebUIPageController(web_ui,
                                   SettingsPage(),
                                   /*enable_chrome_send=*/true),
      theme_provider_(Profile::FromWebUI(web_ui)) {
  Profile* profile = Profile::FromWebUI(web_ui);

  // Upstream settings handlers, adopted wholesale. They carry no Polymer
  // coupling — they are WebUIMessageHandlers that answer chrome.send messages —
  // so reimplementing what they do would be reimplementing browsing-data
  // deletion, the search-engine list and the version/update flow, each of
  // which is a correctness surface Astro has no reason to own.
  //
  // This is the v1 set. The rest (site settings, downloads, languages,
  // performance, reset, import, default browser, …) are adopted the same way
  // as the app grows the sections that need them.
  web_ui->AddMessageHandler(std::make_unique<::settings::BrowserLifetimeHandler>());
  web_ui->AddMessageHandler(
      std::make_unique<::settings::ClearBrowsingDataHandler>(web_ui, profile));
  web_ui->AddMessageHandler(
      std::make_unique<::settings::SearchEnginesHandler>(profile));
  web_ui->AddMessageHandler(std::make_unique<::settings::AboutHandler>(profile));
}

AstroSettingsUI::~AstroSettingsUI() = default;

void AstroSettingsUI::BindInterface(
    mojo::PendingReceiver<settings::mojom::PageHandlerFactory> receiver) {
  factory_receiver_.reset();
  factory_receiver_.Bind(std::move(receiver));
}

void AstroSettingsUI::BindInterface(
    mojo::PendingReceiver<mojom::ThemeProvider> receiver) {
  theme_provider_.Bind(std::move(receiver));
}

void AstroSettingsUI::CreatePageHandler(
    mojo::PendingReceiver<settings::mojom::PageHandler> handler) {
  page_handler_ = std::make_unique<AstroSettingsPageHandler>(
      Profile::FromWebUI(web_ui()), std::move(handler));
}

WEB_UI_CONTROLLER_TYPE_IMPL(AstroSettingsUI)

AstroSettingsUIConfig::AstroSettingsUIConfig()
    : content::DefaultWebUIConfig<AstroSettingsUI>(
          content::kChromeUIScheme,
          chrome::kChromeUISettingsHost) {}

}  // namespace astro
