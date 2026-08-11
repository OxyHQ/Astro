// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/oxy/webui/astro_ntp_ui.h"

#include <memory>
#include <utility>

#include "base/no_destructor.h"
#include "base/strings/strcat.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/ui/webui/favicon_source.h"
#include "chrome/grit/astro_webui_resources.h"
#include "chrome/grit/astro_webui_resources_map.h"
#include "components/favicon_base/favicon_url_parser.h"
#include "content/public/browser/url_data_source.h"
#include "content/public/browser/web_ui.h"
#include "content/public/common/url_constants.h"

namespace astro {

namespace {

// `img-src`, which is the one directive on this page that names another WebUI
// host and therefore cannot be a literal.
//
// A CSP source that stops matching does not error, it DENIES — so a hard-coded
// `chrome://favicon2` would survive the scheme rename of #12 as a new tab page
// whose every icon silently fails to load. WebUIOrigin composes the host with
// the scheme this build actually uses.
const char* FaviconImgSrc() {
  static const base::NoDestructor<std::string> kValue(base::StrCat(
      {"img-src 'self' data: ", WebUIOrigin("favicon2"), ";"}));
  return kValue->c_str();
}

const WebUIPage& NewTabPage() {
  // A function-local static rather than a namespace-scope one: the img-src
  // string is composed from the scheme this build uses, so it is a function
  // call rather than a literal and cannot be a static initialiser. Not a
  // base::NoDestructor either — WebUIPage is trivially destructible, and
  // NoDestructor static_asserts against exactly that.
  static const WebUIPage kPage{
      .host = kAstroNtpHost,

      // The same resource set every Astro surface serves. One multi-entry
      // Vite build; the document picks its entry from the host it was served
      // under.
      .resources = kAstroWebuiResources,
      .default_resource = IDR_ASTRO_WEBUI_INDEX_HTML,

      .csp =
          {
              // Chromium's default for trusted WebUI
              // (`chrome://resources 'self'`, Trusted Types enforced). What
              // this replaces widened script-src with `'unsafe-inline'` and
              // then called `DisableTrustedTypesCSP()` outright.
              .script_src = nullptr,

              // WIDENING, MEASURED. Not Bloom's doing and not removable:
              // react-native-web and Reanimated create <style> elements and
              // fill them through CSSOM, and CSP blocks the element. See
              // WebUIPageCsp::style_src in astro_webui_page.h for the
              // measurement and for the narrowing that is available instead.
              .style_src = "style-src 'self' 'unsafe-inline';",

              // NARROWING, MEASURED. `style-src-attr` is the half of style-src
              // that covers the `style` ATTRIBUTE, and nothing on this page
              // ever writes one — React's style prop, Reanimated and
              // react-native-web all go through CSSOM property writes, which
              // CSP does not police. The per-page counts and how they were
              // taken are in WebUIPageCsp::style_src_attr.
              .style_src_attr = "style-src-attr 'none';",

              // favicon2 is the browser's own icon source, registered below.
              // It is the reason quick links and most-visited tiles can show
              // a site's icon without the page reaching the network: the
              // browser serves what it already has.
              .img_src = FaviconImgSrc(),

              // Fonts are data-URIs inside the bundle. This is also where a
              // de-Googled browser stops asking fonts.gstatic.com for the
              // typeface of its own new tab page, which the page this
              // replaces did on every tab.
              .font_src = "font-src data:;",

              // Nothing on this page talks to a server. The weather widget
              // that used to try is disabled behind this, and said so.
              .connect_src = "connect-src 'none';",
          },
  };
  return kPage;
}

}  // namespace

AstroNtpUI::AstroNtpUI(content::WebUI* web_ui)
    // chrome.send is NOT enabled. The page speaks two typed interfaces and
    // nothing else; the six untyped messages it used to send are gone.
    : AstroMojoWebUIPageController(web_ui,
                                   NewTabPage(),
                                   /*enable_chrome_send=*/false),
      theme_provider_(Profile::FromWebUI(web_ui)) {
  Profile* profile = Profile::FromWebUI(web_ui);

  // The browser's icon service, for quick links and most-visited tiles. Served
  // from a WebUI host of its own, so the page reads icons the browser already
  // has rather than fetching them from the sites — which is both the privacy
  // answer and the reason `connect-src 'none'` costs the page nothing.
  content::URLDataSource::Add(
      profile, std::make_unique<FaviconSource>(
                   profile, chrome::FaviconUrlFormat::kFavicon2));
}

AstroNtpUI::~AstroNtpUI() = default;

void AstroNtpUI::BindInterface(
    mojo::PendingReceiver<mojom::ThemeProvider> receiver) {
  theme_provider_.Bind(std::move(receiver));
}

void AstroNtpUI::BindInterface(
    mojo::PendingReceiver<ntp::mojom::PageHandlerFactory> receiver) {
  factory_receiver_.reset();
  factory_receiver_.Bind(std::move(receiver));
}

void AstroNtpUI::CreatePageHandler(
    mojo::PendingRemote<ntp::mojom::Page> page,
    mojo::PendingReceiver<ntp::mojom::PageHandler> handler) {
  page_handler_ = std::make_unique<AstroNtpPageHandler>(
      Profile::FromWebUI(web_ui()), web_ui()->GetWebContents(), std::move(page),
      std::move(handler));
}

WEB_UI_CONTROLLER_TYPE_IMPL(AstroNtpUI)

AstroNtpUIConfig::AstroNtpUIConfig()
    : content::DefaultWebUIConfig<AstroNtpUI>(content::kChromeUIScheme,
                                              kAstroNtpHost) {}

}  // namespace astro
