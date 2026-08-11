// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/oxy/webui/astro_webui_page.h"

#include <string>
#include <utility>

#include "base/strings/strcat.h"
#include "chrome/browser/oxy/webui/astro_webui_buildflags.h"
#include "content/public/browser/browser_context.h"
#include "content/public/browser/web_contents.h"
#include "content/public/browser/web_ui.h"
#include "content/public/browser/web_ui_data_source.h"
#include "content/public/common/url_constants.h"
#include "services/network/public/mojom/content_security_policy.mojom.h"

#if BUILDFLAG(ASTRO_WEBUI_DEV_TOOLS)
#include "chrome/browser/oxy/webui/astro_webui_dev_source.h"
#endif

namespace astro {

namespace {

void ApplyCsp(content::WebUIDataSource* source, const WebUIPageCsp& csp) {
  using network::mojom::CSPDirectiveName;
  const struct {
    CSPDirectiveName directive;
    const char* value;
  } kDirectives[] = {
      {CSPDirectiveName::ScriptSrc, csp.script_src},
      {CSPDirectiveName::StyleSrc, csp.style_src},
      // Beside StyleSrc because it is half of it, not because the order
      // matters: these become separate entries in the data source's policy map
      // and CSP resolves `style-src-attr` over `style-src` for an attribute
      // wherever in the header the two appear.
      {CSPDirectiveName::StyleSrcAttr, csp.style_src_attr},
      {CSPDirectiveName::ImgSrc, csp.img_src},
      {CSPDirectiveName::FontSrc, csp.font_src},
      {CSPDirectiveName::ConnectSrc, csp.connect_src},
  };
  for (const auto& entry : kDirectives) {
    if (entry.value) {
      source->OverrideContentSecurityPolicy(entry.directive, entry.value);
    }
  }
}

}  // namespace

std::string WebUIOrigin(std::string_view host) {
  return base::StrCat({content::kChromeUIScheme, "://", host});
}

void CreateAstroWebUIDataSource(content::WebUI* web_ui, const WebUIPage& page) {
  content::WebUIDataSource* source = content::WebUIDataSource::CreateAndAdd(
      web_ui->GetWebContents()->GetBrowserContext(), std::string(page.host));

  // THE SEAM, now closed.
  //
  // Every Astro page is served out of astro_webui_resources.pak. AddResourcePaths
  // maps each emitted filename to the resource id GRIT assigned it, and
  // SetDefaultResource answers everything else with the app document — which is
  // what makes a client-side route resolve, and what a single-page app needs
  // from a WebUIDataSource.
  //
  // What used to be here read files from a directory beside the executable.
  // That is gone from release builds entirely rather than kept as a fallback:
  // a fallback is exactly what turns a packaging fault into a page that
  // renders blank on a user's machine instead of failing the build that caused
  // it.
  source->AddResourcePaths(page.resources);
  source->SetDefaultResource(page.default_resource);

#if BUILDFLAG(ASTRO_WEBUI_DEV_TOOLS)
  // Developer builds only, and only when the switch is actually passed.
  MaybeServeAstroWebUIFromDirectory(source, page.host);
#endif

  ApplyCsp(source, page.csp);
}

AstroWebUIPageController::AstroWebUIPageController(content::WebUI* web_ui,
                                                   const WebUIPage& page)
    : content::WebUIController(web_ui) {
  CreateAstroWebUIDataSource(web_ui, page);
}

AstroWebUIPageController::~AstroWebUIPageController() = default;

AstroMojoWebUIPageController::AstroMojoWebUIPageController(
    content::WebUI* web_ui,
    const WebUIPage& page,
    bool enable_chrome_send)
    : ui::MojoWebUIController(web_ui, enable_chrome_send) {
  CreateAstroWebUIDataSource(web_ui, page);
}

AstroMojoWebUIPageController::~AstroMojoWebUIPageController() = default;

}  // namespace astro
