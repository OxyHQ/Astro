// Copyright 2026 Oxy. Astro product module.

#include "astro/browser/webui/astro_ntp_ui.h"

#include <string>

#include "astro/browser/webui/astro_ntp_resources.h"
#include "astro/common/url_constants.h"
#include "base/functional/bind.h"
#include "base/memory/ref_counted_memory.h"
#include "chrome/common/webui_url_constants.h"
#include "content/public/browser/web_contents.h"
#include "content/public/browser/web_ui.h"
#include "content/public/browser/web_ui_data_source.h"
#include "services/network/public/mojom/content_security_policy.mojom.h"

namespace astro {
namespace {

std::string_view ContentForPath(const std::string& path) {
  if (path.empty() || path == "index.html") {
    return kAstroNtpIndexHtml;
  }
  if (path == "ntp.js") {
    return kAstroNtpJs;
  }
  if (path == "ntp.css") {
    return kAstroNtpCss;
  }
  return {};
}

bool ShouldHandleRequest(const std::string& path) {
  return !ContentForPath(path).empty();
}

void HandleRequest(const std::string& path,
                   content::WebUIDataSource::GotDataCallback callback) {
  std::string_view content = ContentForPath(path);
  // ShouldHandleRequest already refused anything unknown, so an empty response
  // here would mean the two disagree. Answering nullptr is the honest result: a
  // blank page is worse than a failed load, because it looks like it rendered.
  if (content.empty()) {
    std::move(callback).Run(nullptr);
    return;
  }
  std::move(callback).Run(
      base::MakeRefCounted<base::RefCountedString>(std::string(content)));
}

}  // namespace

AstroNtpUI::AstroNtpUI(content::WebUI* web_ui)
    : content::WebUIController(web_ui) {
  content::WebUIDataSource* source = content::WebUIDataSource::CreateAndAdd(
      web_ui->GetWebContents()->GetBrowserContext(),
      chrome::kChromeUINewTabPageHost);

  source->SetRequestFilter(base::BindRepeating(&ShouldHandleRequest),
                           base::BindRepeating(&HandleRequest));

  // React needs inline styles: react-native-web writes them onto elements, and
  // Bloom applies its colours that way. Scripts stay restricted to this origin.
  //
  // 'unsafe-inline' for styles is a real widening and is written here rather
  // than inherited, so it is visible to whoever reads this file next. Scripts
  // are NOT widened: the bundle is served from this origin and nothing else may
  // execute.
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::ScriptSrc, "script-src 'self';");
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::StyleSrc,
      "style-src 'self' 'unsafe-inline';");
  // Fonts are inlined into the stylesheet as data: URIs, so the page needs no
  // network at all -- but data: must be permitted for them to load.
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::FontSrc, "font-src data:;");
}

AstroNtpUI::~AstroNtpUI() = default;

AstroNtpUIConfig::AstroNtpUIConfig()
    : DefaultWebUIConfig(kAstroUIScheme, chrome::kChromeUINewTabPageHost) {}

}  // namespace astro
