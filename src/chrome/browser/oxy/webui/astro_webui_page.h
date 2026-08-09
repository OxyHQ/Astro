// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_WEBUI_ASTRO_WEBUI_PAGE_H_
#define CHROME_BROWSER_OXY_WEBUI_ASTRO_WEBUI_PAGE_H_

#include <string>
#include <string_view>

#include "base/containers/span.h"
#include "content/public/browser/web_ui_controller.h"
#include "ui/base/webui/resource_path.h"
#include "ui/webui/mojo_web_ui_controller.h"

namespace content {
class WebUI;
}

namespace astro {

// The Content-Security-Policy an Astro page declares, one directive per field.
//
// A null field leaves Chromium's default for that directive in place, which is
// not the same as leaving it open: trusted WebUI already ships
// `script-src chrome://resources 'self'` and Trusted Types ON, and has no
// default at all for style/connect/font/img. So a null `script_src` inherits a
// strict rule and a null `connect_src` inherits none — the fields are not
// symmetric and a page has to say what it needs.
//
// Nothing here can turn Trusted Types off. `DisableTrustedTypesCSP` exists on
// the data source and is deliberately not reachable through this struct: a
// page that trips a Trusted Types sink gets a NAMED policy, never a browser
// with the protection switched off.
struct WebUIPageCsp {
  const char* script_src = nullptr;
  const char* style_src = nullptr;
  const char* img_src = nullptr;
  const char* font_src = nullptr;
  const char* connect_src = nullptr;
};

// Everything that distinguishes one Astro WebUI page from another.
struct WebUIPage {
  // The WebUI host, from a constant — never a spelled-out literal. The scheme
  // is a build-time product decision (`content::kChromeUIScheme` reads `astro`
  // in an Astro build) and the host is a registration key that
  // WebUIConfigMap CHECKs for duplicates, so both belong in one place each.
  std::string_view host;

  // The page's assets, as GRIT compiled them into astro_webui_resources.pak.
  //
  // This is the whole of how an Astro page finds its bundle. There is no path
  // on disk, no directory beside the executable and no filesystem read: the
  // resources are inside the binary's resource bundle, which is what gives
  // them Chromium's own integrity, compression and load-order guarantees. A
  // resource named here that GRIT did not compile is a LINK error, not a blank
  // page discovered by a user.
  base::span<const webui::ResourcePath> resources;

  // The resource served for any request the map above does not answer, which
  // is what makes a client-side route like astro://settings/privacy work.
  int default_resource = 0;

  WebUIPageCsp csp;
};

// The origin of a built-in WebUI host, spelled with the scheme THIS build
// composes: `WebUIOrigin("resources")` is `chrome://resources` today and
// `astro://resources` in a build carrying the scheme composition of #12.
//
// Every Astro CSP string that names a WebUI host goes through here, because a
// CSP source that stops matching does not error — it DENIES. A hard-coded
// `chrome://resources` in a page's script-src survives the scheme rename as a
// page whose scripts silently fail to load.
//
// This is the runtime form of what `CONTENT_WEBUI_SCHEME_LITERAL` does at
// preprocessing time. That macro is introduced by the scheme composition and
// does not exist in this tree; three page controllers used it anyway and did
// not compile, for as long as nothing compiled them.
std::string WebUIOrigin(std::string_view host);

// Creates the page's WebUIDataSource and attaches it to the browser context.
//
// Call once from a controller's constructor. Every Astro page goes through
// here so that the CSP a page declares, the way its assets are found, and the
// diagnostics when they are missing are one implementation rather than one per
// page — the shape that let two pages read `resources/astro-alia` while the
// build staged `resources/astro-$page`, and render blank about it.
void CreateAstroWebUIDataSource(content::WebUI* web_ui, const WebUIPage& page);

// Base for an Astro page with no Mojo interfaces.
class AstroWebUIPageController : public content::WebUIController {
 public:
  AstroWebUIPageController(content::WebUI* web_ui, const WebUIPage& page);
  ~AstroWebUIPageController() override;

  AstroWebUIPageController(const AstroWebUIPageController&) = delete;
  AstroWebUIPageController& operator=(const AstroWebUIPageController&) = delete;
};

// Base for an Astro page that binds Mojo interfaces.
//
// `enable_chrome_send` is passed through because Astro's settings surface
// adopts upstream settings handlers, and those speak chrome.send. A page
// binding only Astro's own typed interfaces leaves it false and cannot be
// reached by an untyped message at all.
class AstroMojoWebUIPageController : public ui::MojoWebUIController {
 public:
  AstroMojoWebUIPageController(content::WebUI* web_ui,
                               const WebUIPage& page,
                               bool enable_chrome_send);
  ~AstroMojoWebUIPageController() override;

  AstroMojoWebUIPageController(const AstroMojoWebUIPageController&) = delete;
  AstroMojoWebUIPageController& operator=(const AstroMojoWebUIPageController&) =
      delete;
};

}  // namespace astro

#endif  // CHROME_BROWSER_OXY_WEBUI_ASTRO_WEBUI_PAGE_H_
