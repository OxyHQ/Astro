// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/oxy/webui/astro_adblock_ui.h"

#include <memory>
#include <utility>

#include "chrome/browser/profiles/profile.h"
#include "chrome/grit/astro_webui_resources.h"
#include "chrome/grit/astro_webui_resources_map.h"
#include "content/public/browser/web_ui.h"
#include "content/public/common/url_constants.h"

namespace astro {

namespace {

const WebUIPage& AdBlockPage() {
  static const WebUIPage kPage{
      .host = kAstroAdBlockHost,

      // The same resource set every Astro surface serves. One multi-entry Vite
      // build; the document picks its entry from the host it was served under.
      //
      // This is what the port bought. What it replaces served a 284-line HTML
      // document held in a `static constexpr char[]` inside this file, through
      // a `SetRequestFilter` whose predicate answered `true` for every path and
      // returned the same bytes to all of them, with `SetDefaultResource(-1)`
      // beside it. So the page's bytes were in the binary and carried none of
      // the resource bundle's guarantees: no compression, no resource id, no
      // build-time check that anything it referenced existed, and a filter that
      // answered a request for `favicon.ico` with the document.
      .resources = kAstroWebuiResources,
      .default_resource = IDR_ASTRO_WEBUI_INDEX_HTML,

      .csp =
          {
              // Chromium's default for trusted WebUI (`chrome://resources
              // 'self'`, Trusted Types enforced). What this replaces widened
              // script-src with `'unsafe-inline'` for its own inline <script>
              // — and that script still did not work: Trusted Types is a
              // separate default that the widening does not touch, so the
              // page's only DOM-building path died on
              // `list.innerHTML = ''` with "This document requires
              // 'TrustedHTML' assignment", measured in the shipped binary.
              // Every state the browser sent it went unrendered.
              .script_src = nullptr,

              // WIDENING, MEASURED. Not Bloom's doing and not removable:
              // react-native-web and Reanimated create <style> elements and
              // fill them through CSSOM, and CSP blocks the element. See
              // WebUIPageCsp::style_src in astro_webui_page.h.
              .style_src = "style-src 'self' 'unsafe-inline';",

              // NARROWING, MEASURED per page — see WebUIPageCsp::style_src_attr.
              .style_src_attr = "style-src-attr 'none';",

              // The shield mark is inline SVG and there are no other images.
              .img_src = "img-src 'self' data:;",

              // Fonts are data-URIs inside the bundle.
              .font_src = "font-src data:;",

              // Nothing on this page talks to a server. The filter lists are
              // fetched by the browser's own updater, on its own schedule,
              // from the browser process — never by this document.
              .connect_src = "connect-src 'none';",
          },
  };
  return kPage;
}

}  // namespace

AstroAdBlockUI::AstroAdBlockUI(content::WebUI* web_ui)
    // chrome.send is NOT enabled. The three untyped messages this page used to
    // send are gone; it speaks two typed interfaces and nothing else.
    : AstroMojoWebUIPageController(web_ui,
                                   AdBlockPage(),
                                   /*enable_chrome_send=*/false),
      theme_provider_(Profile::FromWebUI(web_ui)) {}

AstroAdBlockUI::~AstroAdBlockUI() = default;

void AstroAdBlockUI::BindInterface(
    mojo::PendingReceiver<mojom::ThemeProvider> receiver) {
  theme_provider_.Bind(std::move(receiver));
}

void AstroAdBlockUI::BindInterface(
    mojo::PendingReceiver<adblock::mojom::PageHandlerFactory> receiver) {
  factory_receiver_.reset();
  factory_receiver_.Bind(std::move(receiver));
}

void AstroAdBlockUI::CreatePageHandler(
    mojo::PendingRemote<adblock::mojom::Page> page,
    mojo::PendingReceiver<adblock::mojom::PageHandler> handler) {
  page_handler_ = std::make_unique<AstroAdBlockPageHandler>(
      Profile::FromWebUI(web_ui()), std::move(page), std::move(handler));
}

WEB_UI_CONTROLLER_TYPE_IMPL(AstroAdBlockUI)

AstroAdBlockUIConfig::AstroAdBlockUIConfig()
    : content::DefaultWebUIConfig<AstroAdBlockUI>(content::kChromeUIScheme,
                                                  kAstroAdBlockHost) {}

}  // namespace astro
