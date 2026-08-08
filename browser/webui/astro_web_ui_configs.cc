// Copyright 2026 Oxy. Astro product module.

#include "astro/browser/webui/astro_web_ui_configs.h"

#include <memory>

#include "base/strings/strcat.h"

#include "astro/browser/webui/astro_ntp_ui.h"
#include "astro/browser/webui/astro_settings_next_ui.h"
#include "astro/browser/webui/astro_settings_page.h"
#include "astro/browser/webui/astro_test_ui.h"
#include "astro/browser/webui/astro_webui_page.h"
#include "astro/common/url_constants.h"
#include "chrome/common/webui_url_constants.h"
#include "content/public/browser/webui_config_map.h"
#include "url/gurl.h"
#include "url/url_constants.h"

namespace astro {

void RegisterAstroWebUIConfigs() {
  // AddWebUIConfig, never AddUntrustedWebUIConfig. The map CHECKs the config's
  // scheme against the trusted set, so a config landing in the wrong function
  // is a startup crash rather than a silently over-privileged page — which is
  // the correct trade, and the reason neither call below is wrapped in
  // anything that could swallow it.
  content::WebUIConfigMap::GetInstance().AddWebUIConfig(
      std::make_unique<AstroTestUIConfig>());

  // Settings. Astro serves Chromium's own settings page from its own
  // controller, so the page can be restyled in place while keeping every
  // component, route and translation upstream ships.
  //
  // RemoveConfig first, because RegisterChromeWebUIConfigs() has already run by
  // the time this hook is called and AddWebUIConfigImpl CHECK-fails on a second
  // config for an origin that is already claimed. This is content's own public
  // API for replacing a config -- no patch edits a Chromium file to make room.
  const GURL settings_url(base::StrCat(
      {kAstroUIScheme, url::kStandardSchemeSeparator,
       chrome::kChromeUISettingsHost}));
  // The return value says whether anything was there. Discarding it would let a
  // future Chromium that registers settings differently silently leave this
  // page unregistered, which looks identical to a browser without a settings
  // page at all.
  std::unique_ptr<content::WebUIConfig> replaced =
      content::WebUIConfigMap::GetInstance().RemoveConfig(settings_url);
  CHECK(replaced) << "no config was registered for " << settings_url
                  << "; upstream's settings registration has moved, and "
                     "replacing it must be re-checked rather than assumed";

  content::WebUIConfigMap::GetInstance().AddWebUIConfig(
      std::make_unique<AstroSettingsNextUIConfig>());

  // The new tab page. Unlike settings, nothing upstream is preserved here:
  // Chromium's is Google's, and what ungoogled leaves is a minimal stand-in.
  //
  // BOTH of upstream's new tab hosts. Chromium serves its own page when the
  // default search engine is Google and a "third party" page otherwise
  // (search.cc, NewTabURLDetails::ForProfile) -- so in Astro, where it never
  // is, every new tab reached the third-party host and rendered ungoogled's
  // near-empty stand-in. Astro's page is not a stand-in for Google's, so the
  // branch has nothing to choose between: both hosts serve it, and search.cc
  // keeps behaving exactly as upstream wrote it.
  for (const char* host : {chrome::kChromeUINewTabPageHost,
                           chrome::kChromeUINewTabPageThirdPartyHost}) {
    const GURL ntp_url(base::StrCat(
        {kAstroUIScheme, url::kStandardSchemeSeparator, host}));
    std::unique_ptr<content::WebUIConfig> replaced_ntp =
        content::WebUIConfigMap::GetInstance().RemoveConfig(ntp_url);
    CHECK(replaced_ntp) << "no config was registered for " << ntp_url
                        << "; upstream's new tab page registration has moved";

    content::WebUIConfigMap::GetInstance().AddWebUIConfig(
        std::make_unique<AstroNtpUIConfig>(host));
  }

  // Astro's own pages, all served by ONE app (see AstroWebUiPage).
  //
  // Registered on hosts upstream does not claim, so upstream's page keeps
  // serving its own host until the Bloom page reaches parity and the two swap
  // -- a half-built replacement taking over a real page is worse than an
  // obviously separate one.
  // Settings is the one page that does NOT use the generic controller: it
  // derives from Chromium's settings controller so the app inherits the
  // forty-three message handlers that are the browser's real control surface
  // (see AstroSettingsPage).
  content::WebUIConfigMap::GetInstance().AddWebUIConfig(
      std::make_unique<AstroSettingsPageConfig>(kAstroSettingsNextHost));

  // Nothing else belongs here. Astro's internal scheme is composed at build
  // time from //astro/build/product.gni, so content::kChromeUIScheme already
  // reads "astro" and every one of Chromium's own configs — Settings, Version,
  // Flags, History, Downloads — registers itself under astro:// in
  // RegisterChromeWebUIConfigs(). A config added here to "bring" an upstream
  // page across would register a SECOND config on an origin upstream already
  // owns, and WebUIConfigMap::AddWebUIConfigImpl CHECKs that:
  //
  //     CHECK(it.second) << url;   // astro://settings
  //
  // AstroSettingsUIConfig did exactly that and crashed the browser at startup.
  // It was deleted rather than guarded: it existed only to bridge astro:// to
  // an upstream controller while the root constant still read "chrome", and
  // that gap no longer exists. Only pages Astro itself OWNS belong in this
  // function.
}

void RegisterAstroUntrustedWebUIConfigs() {
  content::WebUIConfigMap::GetInstance().AddUntrustedWebUIConfig(
      std::make_unique<AstroTestUntrustedUIConfig>());
}

}  // namespace astro
