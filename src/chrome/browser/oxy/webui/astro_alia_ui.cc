// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/oxy/webui/astro_alia_ui.h"

#include <utility>

#include "chrome/browser/profiles/profile.h"
#include "chrome/grit/astro_webui_resources.h"
#include "chrome/grit/astro_webui_resources_map.h"
#include "content/public/browser/web_ui.h"
#include "content/public/common/url_constants.h"

namespace astro {

namespace {

const WebUIPage& AliaPage() {
  static const WebUIPage kPage{
      .host = kAstroAliaHost,

      // The same resource set every Astro surface serves. One multi-entry Vite
      // build; the document picks its entry from the host it was served under.
      //
      // Serving from the pak also repairs the side panel, which is how this
      // page is normally opened. `oxy_alia_side_panel.cc` appends the tab's
      // address as a query parameter, and the disk-serving handler this
      // replaces fell back to index.html only for request paths containing no
      // '.' — so `context_url=https%3A%2F%2F<any real site>` fell through to
      // "file not found" and the panel showed net::ERR_FAILED on every ordinary
      // web page. Measured against the shipped binary. SetDefaultResource
      // answers every unmatched path with the document and has no such
      // heuristic to get wrong.
      .resources = kAstroWebuiResources,
      .default_resource = IDR_ASTRO_WEBUI_INDEX_HTML,

      .csp =
          {
              // Chromium's default for trusted WebUI (`chrome://resources
              // 'self'`, Trusted Types enforced). What this replaces widened
              // script-src with `'unsafe-inline'` and then called
              // `DisableTrustedTypesCSP()` outright, on the one Astro page that
              // rendered a remote model's output as HTML.
              .script_src = nullptr,

              // WIDENING, MEASURED. Not Bloom's doing and not removable:
              // react-native-web and Reanimated create <style> elements and
              // fill them through CSSOM, and CSP blocks the element. See
              // WebUIPageCsp::style_src in astro_webui_page.h for the
              // measurement and for the narrowing that is available instead.
              .style_src = "style-src 'self' 'unsafe-inline';",

              // The mark is inline SVG and there are no other images.
              .img_src = "img-src 'self' data:;",

              // Fonts are data-URIs inside the bundle, which is also where this
              // page stops asking fonts.gstatic.com for a typeface — the
              // previous one declared `font-src 'self' https://fonts.gstatic.com`
              // on a de-Googled browser's own surface.
              .font_src = "font-src data:;",

              // THE LOAD-BEARING DIRECTIVE.
              //
              // A trusted page that can reach the network is what issue #17
              // exists to remove, so the shell is built without that ability
              // from the start rather than having it taken away later. The
              // conversation belongs to an unprivileged document reached
              // through a browser-process broker; nothing this origin runs may
              // open a socket of its own.
              .connect_src = "connect-src 'none';",
          },
  };
  return kPage;
}

}  // namespace

AstroAliaUI::AstroAliaUI(content::WebUI* web_ui)
    // chrome.send is NOT enabled: this page adopts no upstream handler and
    // speaks one typed interface.
    : AstroMojoWebUIPageController(web_ui,
                                   AliaPage(),
                                   /*enable_chrome_send=*/false),
      theme_provider_(Profile::FromWebUI(web_ui)) {}

AstroAliaUI::~AstroAliaUI() = default;

void AstroAliaUI::BindInterface(
    mojo::PendingReceiver<mojom::ThemeProvider> receiver) {
  theme_provider_.Bind(std::move(receiver));
}

WEB_UI_CONTROLLER_TYPE_IMPL(AstroAliaUI)

AstroAliaUIConfig::AstroAliaUIConfig()
    : content::DefaultWebUIConfig<AstroAliaUI>(content::kChromeUIScheme,
                                               kAstroAliaHost) {}

}  // namespace astro
