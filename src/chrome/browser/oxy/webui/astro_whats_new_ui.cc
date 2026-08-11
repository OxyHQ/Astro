// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/oxy/webui/astro_whats_new_ui.h"

#include <utility>

#include "chrome/browser/profiles/profile.h"
#include "chrome/common/webui_url_constants.h"
#include "chrome/grit/astro_webui_resources.h"
#include "chrome/grit/astro_webui_resources_map.h"
#include "content/public/browser/web_ui.h"
#include "content/public/common/url_constants.h"

namespace astro {

namespace {

const WebUIPage& WhatsNewPage() {
  static const WebUIPage kPage{
      // Upstream's constant, never a literal: this page exists at this address
      // precisely because it is upstream's, and a hand-spelled copy would let
      // the two drift into a duplicate registration, which CHECKs at startup.
      .host = chrome::kChromeUIWhatsNewHost,

      .resources = kAstroWebuiResources,
      .default_resource = IDR_ASTRO_WEBUI_INDEX_HTML,

      .csp =
          {
              // Chromium's default for trusted WebUI.
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

              // The mark is inline SVG and there are no other images.
              .img_src = "img-src 'self' data:;",

              // Fonts are data-URIs inside the bundle. The page this replaces
              // declared `font-src 'self' https://fonts.gstatic.com`, so the
              // one page a de-Googled browser shows after an update asked
              // Google for its typeface.
              .font_src = "font-src data:;",

              // Nothing here talks to a server. The six entries are shipped
              // editorial content compiled into the binary, not a feed —
              // upstream's What's New fetches its content from Google, and not
              // doing that is most of the reason this page exists.
              .connect_src = "connect-src 'none';",
          },
  };
  return kPage;
}

}  // namespace

AstroWhatsNewUI::AstroWhatsNewUI(content::WebUI* web_ui)
    : AstroMojoWebUIPageController(web_ui,
                                   WhatsNewPage(),
                                   /*enable_chrome_send=*/false),
      theme_provider_(Profile::FromWebUI(web_ui)) {}

AstroWhatsNewUI::~AstroWhatsNewUI() = default;

void AstroWhatsNewUI::BindInterface(
    mojo::PendingReceiver<mojom::ThemeProvider> receiver) {
  theme_provider_.Bind(std::move(receiver));
}

WEB_UI_CONTROLLER_TYPE_IMPL(AstroWhatsNewUI)

AstroWhatsNewUIConfig::AstroWhatsNewUIConfig()
    : content::DefaultWebUIConfig<AstroWhatsNewUI>(
          content::kChromeUIScheme,
          chrome::kChromeUIWhatsNewHost) {}

}  // namespace astro
