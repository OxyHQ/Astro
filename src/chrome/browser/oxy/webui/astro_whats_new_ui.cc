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

              // WIDENING, DECLARED AND DATED — 2026-08-09.
              //
              // Bloom's web forks inject a <style> element on mount for their
              // keyframes and pseudo-classes. Same widening, same reason and
              // same removal condition as astro://settings; it comes out when
              // Bloom ships constructable stylesheets. F5 of the Astro Next
              // plan, issue #14.
              .style_src = "style-src 'self' 'unsafe-inline';",

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
