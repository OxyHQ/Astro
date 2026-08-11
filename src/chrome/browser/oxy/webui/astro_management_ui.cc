// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/oxy/webui/astro_management_ui.h"

#include <memory>
#include <utility>
#include <vector>

#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/ui/webui/management/management_ui.h"
#include "chrome/browser/ui/webui/management/management_ui_handler.h"
#include "chrome/common/webui_url_constants.h"
#include "chrome/grit/astro_webui_resources.h"
#include "chrome/grit/astro_webui_resources_map.h"
#include "content/public/browser/web_ui.h"
#include "content/public/browser/web_ui_data_source.h"
#include "content/public/common/url_constants.h"

namespace astro {

namespace {

const WebUIPage& ManagementPage() {
  static const WebUIPage kPage{
      // Upstream's constant, never a literal: this page exists at this address
      // precisely because it is upstream's, and a hand-spelled copy would let
      // the two drift into a duplicate registration, which CHECKs at startup.
      .host = chrome::kChromeUIManagementHost,

      .resources = kAstroWebuiResources,
      .default_resource = IDR_ASTRO_WEBUI_INDEX_HTML,

      .csp =
          {
              // Chromium's default for trusted WebUI (`chrome://resources
              // 'self'`, Trusted Types enforced).
              //
              // Trusted Types matters more here than on most pages. Upstream's
              // `browserManagementNotice` is not a sentence, it is HTML — the
              // browser hands the page a string containing a whole `<a
              // target="_blank" href="https://support.google.com/chrome?p=
              // is_chrome_managed">` element, and upstream renders it by
              // injection. A page that tried that here would die exactly as
              // the old ad blocker page did. Astro's does not receive it: see
              // the page's own note for why the sentence is Astro's instead.
              .script_src = nullptr,

              // WIDENING, MEASURED. Not Bloom's doing and not removable:
              // react-native-web and Reanimated create <style> elements and
              // fill them through CSSOM, and CSP blocks the element. See
              // WebUIPageCsp::style_src in astro_webui_page.h.
              .style_src = "style-src 'self' 'unsafe-inline';",

              // NARROWING, MEASURED per page — see WebUIPageCsp::style_src_attr.
              .style_src_attr = "style-src-attr 'none';",

              // The mark is inline SVG and there are no other images. Notably
              // NOT `chrome://theme`, which upstream's page uses for the
              // enterprise illustration it ships.
              .img_src = "img-src 'self' data:;",

              // Fonts are data-URIs inside the bundle.
              .font_src = "font-src data:;",

              // Nothing here talks to a server, which on this page is a
              // statement about the product rather than a formality: the
              // surface it replaces linked to support.google.com from the
              // browser's own explanation of who manages it, and advertised
              // the Google Admin console from a banner.
              .connect_src = "connect-src 'none';",
          },
  };
  return kPage;
}

}  // namespace

AstroManagementUI::AstroManagementUI(content::WebUI* web_ui)
    // chrome.send IS enabled, because the upstream handler adopted below
    // speaks it: cr.sendWithPromise is its only direction here, and every
    // message this page sends is answered by that handler. Astro's own
    // controls do not use it and never should.
    : AstroMojoWebUIPageController(web_ui,
                                   ManagementPage(),
                                   /*enable_chrome_send=*/true),
      theme_provider_(Profile::FromWebUI(web_ui)) {
  // Upstream's own labels, into this page's loadTimeData.
  //
  // Needed because the adopted handler answers the reporting lists as GRIT
  // MESSAGE IDS rather than as text — `{messageId: "managementExtensionReport
  // Perms", reportingType: ...}` — and upstream's page resolves them from
  // loadTimeData. Astro's app carries its own catalogue for its own strings,
  // but a surface that adopts an upstream handler wholesale has to speak the
  // handler's language for the strings the handler names.
  //
  // `remove_links=true`, which is upstream's own switch and the whole reason
  // this is defensible: it selects the variants with no anchor in them. The
  // page therefore gets the browser's wording and none of its links off the
  // machine, which is the same posture as `connect-src 'none'` above.
  std::vector<webui::LocalizedString> localized_strings;
  ManagementUI::GetLocalizedStrings(localized_strings, /*remove_links=*/true);
  data_source()->AddLocalizedStrings(localized_strings);

  // Upstream's handler, wholesale and unmodified. It answers ten messages; the
  // Astro page sends seven of them and never sends the three that belong to
  // the promotion banner. A message no installed handler registered reaches
  // DUMP_WILL_BE_NOTREACHED in web_ui_impl.cc, which is a no-op in a release
  // build — so the join runs the other way too, and is checked by
  // tools/tests/cases/settings-sends-reach-an-adopted-handler.sh against
  // webui/app/settings-handler-messages.json.
  web_ui->AddMessageHandler(
      ManagementUIHandler::Create(Profile::FromWebUI(web_ui)));
}

AstroManagementUI::~AstroManagementUI() = default;

void AstroManagementUI::BindInterface(
    mojo::PendingReceiver<mojom::ThemeProvider> receiver) {
  theme_provider_.Bind(std::move(receiver));
}

WEB_UI_CONTROLLER_TYPE_IMPL(AstroManagementUI)

AstroManagementUIConfig::AstroManagementUIConfig()
    : content::DefaultWebUIConfig<AstroManagementUI>(
          content::kChromeUIScheme,
          chrome::kChromeUIManagementHost) {}

}  // namespace astro
