// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_WEBUI_ASTRO_MANAGEMENT_UI_H_
#define CHROME_BROWSER_OXY_WEBUI_ASTRO_MANAGEMENT_UI_H_

#include "chrome/browser/oxy/webui/astro_theme.mojom.h"
#include "chrome/browser/oxy/webui/astro_theme_provider.h"
#include "chrome/browser/oxy/webui/astro_webui_page.h"
#include "content/public/browser/webui_config.h"
#include "mojo/public/cpp/bindings/pending_receiver.h"

namespace content {
class WebUI;
}

namespace astro {

// Astro's management page, on upstream's own host.
//
// Served from `astro://management`, which is upstream's `chrome://management`
// under the scheme this build composes. The host comes from
// `chrome::kChromeUIManagementHost` rather than a literal, and patch 073 SWAPS
// upstream's registration rather than adding one beside it —
// `WebUIConfigMap::AddWebUIConfigImpl` CHECKs on a duplicate origin.
//
// WHY THE TAKEOVER IS SAFE HERE, WHICH IS NOT TRUE OF EVERY UPSTREAM SURFACE.
// A registration swap hands the browser a different controller class for the
// same host, so anything outside the config that names the CONCRETE type stops
// working. `WebUIController::GetAs<T>()` returns nullptr on a type mismatch and
// the call sites in the views layer routinely dereference it without a check,
// which makes that a browser-process crash rather than a page that fails to
// load. Measured before this port: `ManagementUI` is named in zero files under
// `chrome/browser/ui/views/`, where the reading-list panel's controller is
// named in three and the first-run intro's in two. Re-run
// `grep -rn "WebUIContentsWrapperT<T>\|SidePanelWebUIViewT<T>\|GetAs<T>"
// chrome/browser/ui/views/` before taking over the next one.
//
// It adopts `ManagementUIHandler` wholesale, the same move the settings page
// makes with fifteen upstream handlers: what that handler answers is enterprise
// policy state — reporting, extensions, managed websites, applications, threat
// protection — and reimplementing it would be reimplementing the enterprise
// management surface, which Astro has no reason to own.
//
// THREE of upstream's ten messages are deliberately NOT reachable, because the
// page that sends them is gone: `shouldShowPromotion`, `setBannerDismissed` and
// `recordBannerRedirected` drive a banner whose button opens
// `https://admin.google.com/ac/chrome/guides/?ref=browser&utm_source=chrome_policy_cec`
// and reports two interaction events about it. The handler still registers
// them — it is upstream's and unmodified — so nothing breaks; the Astro page
// simply never sends them. See webui/app/src/pages/management for the rest of
// the inventory.
class AstroManagementUI : public AstroMojoWebUIPageController {
 public:
  explicit AstroManagementUI(content::WebUI* web_ui);
  ~AstroManagementUI() override;

  AstroManagementUI(const AstroManagementUI&) = delete;
  AstroManagementUI& operator=(const AstroManagementUI&) = delete;

  void BindInterface(mojo::PendingReceiver<mojom::ThemeProvider> receiver);

 private:
  AstroThemeProvider theme_provider_;

  WEB_UI_CONTROLLER_TYPE_DECL();
};

class AstroManagementUIConfig
    : public content::DefaultWebUIConfig<AstroManagementUI> {
 public:
  AstroManagementUIConfig();
};

}  // namespace astro

#endif  // CHROME_BROWSER_OXY_WEBUI_ASTRO_MANAGEMENT_UI_H_
