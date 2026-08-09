// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_WEBUI_ASTRO_NTP_UI_H_
#define CHROME_BROWSER_OXY_WEBUI_ASTRO_NTP_UI_H_

#include <memory>

#include "chrome/browser/oxy/webui/astro_ntp.mojom.h"
#include "chrome/browser/oxy/webui/astro_ntp_page_handler.h"
#include "chrome/browser/oxy/webui/astro_theme.mojom.h"
#include "chrome/browser/oxy/webui/astro_theme_provider.h"
#include "chrome/browser/oxy/webui/astro_webui_page.h"
#include "content/public/browser/webui_config.h"
#include "mojo/public/cpp/bindings/pending_receiver.h"
#include "mojo/public/cpp/bindings/receiver.h"
#include "ui/webui/mojo_web_ui_controller.h"

namespace content {
class WebUI;
}

namespace astro {

// The host the new tab page is served from.
//
// NOT `newtab`, which is upstream's own host string, and not for want of
// wanting it: `WebUIConfigMap::AddWebUIConfigImpl` CHECKs on a duplicate
// origin, so taking that name means SWAPPING upstream's registration rather
// than adding one. It also buys nothing today —
// `055-ntp-redirect-to-astro.patch` already makes `search::GetNewTabPageURL`
// resolve to this host and `IsInstantNTPURL` recognise it, so the omnibox
// shows `newtab` and every browser-created new tab arrives here. The canonical
// spelling is #22's own open question and is answered by the scheme
// composition of #12, not here.
inline constexpr char kAstroNtpHost[] = "astro-ntp";

// Astro's New Tab Page.
//
// One entry of the single Astro WebUI app, served from the same
// astro_webui_resources.pak as every other astro:// surface, which is what
// gives it Bloom's tokens and the live theme without a page-local copy of
// either. It binds three interfaces, and the split between them is the grant:
//
//   astro.mojom.ThemeProvider     read-only, held by every Astro page.
//   astro.ntp.mojom.PageHandler   this page's own data plane (widgets, links,
//                                 notes, tiles, search).
//
// It does NOT bind astro.settings.mojom, so the new tab page can read the
// theme and cannot change it — the control for that lives on the one surface
// that owns it.
class AstroNtpUI : public AstroMojoWebUIPageController,
                   public ntp::mojom::PageHandlerFactory {
 public:
  explicit AstroNtpUI(content::WebUI* web_ui);
  ~AstroNtpUI() override;

  AstroNtpUI(const AstroNtpUI&) = delete;
  AstroNtpUI& operator=(const AstroNtpUI&) = delete;

  void BindInterface(mojo::PendingReceiver<mojom::ThemeProvider> receiver);
  void BindInterface(
      mojo::PendingReceiver<ntp::mojom::PageHandlerFactory> receiver);

 private:
  // ntp::mojom::PageHandlerFactory:
  void CreatePageHandler(
      mojo::PendingRemote<ntp::mojom::Page> page,
      mojo::PendingReceiver<ntp::mojom::PageHandler> handler) override;

  AstroThemeProvider theme_provider_;
  std::unique_ptr<AstroNtpPageHandler> page_handler_;
  mojo::Receiver<ntp::mojom::PageHandlerFactory> factory_receiver_{this};

  WEB_UI_CONTROLLER_TYPE_DECL();
};

class AstroNtpUIConfig : public content::DefaultWebUIConfig<AstroNtpUI> {
 public:
  AstroNtpUIConfig();
};

}  // namespace astro

#endif  // CHROME_BROWSER_OXY_WEBUI_ASTRO_NTP_UI_H_
