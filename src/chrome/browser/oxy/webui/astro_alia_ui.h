// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_WEBUI_ASTRO_ALIA_UI_H_
#define CHROME_BROWSER_OXY_WEBUI_ASTRO_ALIA_UI_H_

#include "chrome/browser/oxy/webui/astro_theme.mojom.h"
#include "chrome/browser/oxy/webui/astro_theme_provider.h"
#include "chrome/browser/oxy/webui/astro_webui_page.h"
#include "content/public/browser/webui_config.h"
#include "mojo/public/cpp/bindings/pending_receiver.h"

namespace content {
class WebUI;
}

namespace astro {

// The host the Alia panel is served from.
inline constexpr char kAstroAliaHost[] = "alia";

// Alia's shell.
//
// One entry of the single Astro WebUI app, served from the same
// astro_webui_resources.pak as every other astro:// surface. It binds exactly
// one interface — astro.mojom.ThemeProvider, read-only, which every Astro page
// holds — and that is the whole of what it can reach.
//
// The grant it does NOT have is the point of the page rather than an omission.
// `connect-src 'none'` and no data-plane interface mean this document cannot
// talk to a server at all, which is the precondition for issue #17's
// arrangement: a trusted shell, an unprivileged `astro-untrusted://alia-content`
// document inside it, and a typed bridge in between that decides what may be
// said about the tab you are on. The page this replaced fetched an AI API
// directly from a privileged origin, which is the shape #17 exists to forbid;
// it never worked either, because its own CSP named a different host than its
// code called.
class AstroAliaUI : public AstroMojoWebUIPageController {
 public:
  explicit AstroAliaUI(content::WebUI* web_ui);
  ~AstroAliaUI() override;

  AstroAliaUI(const AstroAliaUI&) = delete;
  AstroAliaUI& operator=(const AstroAliaUI&) = delete;

  void BindInterface(mojo::PendingReceiver<mojom::ThemeProvider> receiver);

 private:
  AstroThemeProvider theme_provider_;

  WEB_UI_CONTROLLER_TYPE_DECL();
};

class AstroAliaUIConfig : public content::DefaultWebUIConfig<AstroAliaUI> {
 public:
  AstroAliaUIConfig();
};

}  // namespace astro

#endif  // CHROME_BROWSER_OXY_WEBUI_ASTRO_ALIA_UI_H_
