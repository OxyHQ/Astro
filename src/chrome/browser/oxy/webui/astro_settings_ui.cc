// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/oxy/webui/astro_settings_ui.h"

#include <memory>
#include <utility>

#include "chrome/browser/oxy/webui/astro_settings_page_handler.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/ui/webui/settings/about_handler.h"
#include "chrome/browser/ui/webui/settings/appearance_handler.h"
#include "chrome/browser/ui/webui/settings/browser_lifetime_handler.h"
#include "chrome/browser/ui/webui/settings/downloads_handler.h"
#include "chrome/browser/ui/webui/settings/import_data_handler.h"
#include "chrome/browser/ui/webui/settings/profile_info_handler.h"
#include "chrome/browser/ui/webui/settings/reset_settings_handler.h"
#include "chrome/browser/ui/webui/settings/safety_hub_handler.h"
#include "chrome/browser/ui/webui/settings/search_engines_handler.h"
#include "chrome/browser/ui/webui/settings/settings_clear_browsing_data_handler.h"
#include "chrome/browser/ui/webui/settings/settings_default_browser_handler.h"
#include "chrome/browser/ui/webui/settings/settings_manage_profile_handler.h"
#include "chrome/browser/ui/webui/settings/settings_secure_dns_handler.h"
#include "chrome/browser/ui/webui/settings/settings_startup_pages_handler.h"
#include "chrome/browser/ui/webui/settings/site_settings_handler.h"
#include "chrome/browser/ui/webui/settings/system_handler.h"
#include "chrome/common/webui_url_constants.h"
#include "chrome/grit/astro_webui_resources.h"
#include "chrome/grit/astro_webui_resources_map.h"
#include "content/public/browser/web_ui.h"
#include "content/public/common/url_constants.h"

namespace astro {

namespace {

const WebUIPage& SettingsPage() {
  // The host is upstream's constant, not a literal, and not a host of Astro's
  // own — see the class comment in the header for why the grant depends on it.
  static const WebUIPage kPage{
      .host = chrome::kChromeUISettingsHost,

      // The whole Astro WebUI app, compiled into astro_webui_resources.pak by
      // //chrome/browser/oxy/webui:resources. Every Astro surface is one
      // multi-entry Vite build, so every page serves the same resource set and
      // routes to its own entry from the document.
      .resources = kAstroWebuiResources,
      .default_resource = IDR_ASTRO_WEBUI_INDEX_HTML,

      .csp =
          {
              // script-src is left at Chromium's default for trusted WebUI
              // (`chrome://resources 'self'`, Trusted Types enforced). The app
              // ships one bundle from its own origin and needs nothing more.
              .script_src = nullptr,

              // WIDENING, MEASURED. Not Bloom's doing and not removable:
              // react-native-web and Reanimated create <style> elements and
              // fill them through CSSOM, and CSP blocks the element. See
              // WebUIPageCsp::style_src in astro_webui_page.h for the
              // measurement and for the narrowing that is available instead.
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
  // THIS LIST IS NOT A MENU. Every handler below services a message the app
  // actually sends, and every message the app sends is serviced by a handler
  // below — a join checked in both directions by
  // tools/tests/cases/settings-sends-reach-an-adopted-handler.sh against the
  // declarations in webui/app/settings-handler-messages.json. It is checked
  // because the failure is silent: `chrome.send` to a message no installed
  // handler registered reaches DUMP_WILL_BE_NOTREACHED in
  // content/browser/webui/web_ui_impl.cc, which is a no-op in a release build.
  // The control draws, the button depresses, and nothing happens. Four of this
  // page's sections shipped in exactly that state.
  //
  // The converse hazard, now that these are live, is arguments. A handler that
  // was a no-op tolerated anything; several of these CHECK on the shape of
  // what they are given, and `setProfileName` CHECKs that the trimmed name is
  // non-empty. Read the handler before adding a call site.
  web_ui->AddMessageHandler(
      std::make_unique<::settings::AppearanceHandler>(web_ui));
  web_ui->AddMessageHandler(std::make_unique<::settings::BrowserLifetimeHandler>());
  web_ui->AddMessageHandler(
      std::make_unique<::settings::ClearBrowsingDataHandler>(web_ui, profile));
  web_ui->AddMessageHandler(
      std::make_unique<::settings::DefaultBrowserHandler>());
  web_ui->AddMessageHandler(
      std::make_unique<::settings::DownloadsHandler>(profile));
  web_ui->AddMessageHandler(std::make_unique<::settings::ImportDataHandler>());
  web_ui->AddMessageHandler(
      std::make_unique<::settings::ManageProfileHandler>(profile));
  web_ui->AddMessageHandler(
      std::make_unique<::settings::ProfileInfoHandler>(profile));
  web_ui->AddMessageHandler(
      std::make_unique<::settings::ResetSettingsHandler>(profile));
  // NOT ::settings::. SafetyHubHandler is the one handler in that directory
  // declared at global scope — it derives from settings::SettingsPageUIHandler
  // without joining the namespace, and settings_ui.cc only gets away with the
  // bare name because it is itself inside `namespace settings`.
  web_ui->AddMessageHandler(std::make_unique<::SafetyHubHandler>(profile));
  web_ui->AddMessageHandler(
      std::make_unique<::settings::SearchEnginesHandler>(profile));
  web_ui->AddMessageHandler(std::make_unique<::settings::SecureDnsHandler>());
  web_ui->AddMessageHandler(
      std::make_unique<::settings::SiteSettingsHandler>(profile));
  web_ui->AddMessageHandler(
      std::make_unique<::settings::StartupPagesHandler>(web_ui));
  web_ui->AddMessageHandler(std::make_unique<::settings::SystemHandler>());
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
