// Copyright 2026 Oxy. Astro product module.

#include "astro/browser/webui/astro_webui_page.h"

#include <string>

#include "astro/browser/webui/astro_webui_resources.h"
#include "astro/common/url_constants.h"
#include "base/functional/bind.h"
#include "base/memory/ref_counted_memory.h"
#include "content/public/browser/web_contents.h"
#include "content/public/browser/web_ui.h"
#include "content/public/browser/web_ui_data_source.h"
#include "services/network/public/mojom/content_security_policy.mojom.h"

namespace astro {
namespace {

std::string_view ContentForPath(const std::string& path) {
  if (path.empty() || path == "index.html") {
    return kAstroWebUiIndexHtml;
  }
  if (path == "astro_webui.js") {
    return kAstroWebUiJs;
  }
  if (path == "astro_webui.css") {
    return kAstroWebUiCss;
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

void AddAstroWebUiDataSource(content::WebUI* web_ui, const GURL& url) {
  content::WebUIDataSource* source = content::WebUIDataSource::CreateAndAdd(
      web_ui->GetWebContents()->GetBrowserContext(), std::string(url.host()));

  source->SetRequestFilter(base::BindRepeating(&ShouldHandleRequest),
                           base::BindRepeating(&HandleRequest));

  // React needs inline styles: react-native-web writes them onto elements, and
  // Bloom applies its colours that way.
  //
  // 'unsafe-inline' for STYLES is a real widening and is written here rather
  // than inherited, so it is visible to whoever reads this file next. Scripts
  // are NOT widened: the bundle is served from this origin and nothing else may
  // execute.
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::ScriptSrc, "script-src 'self';");
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::StyleSrc,
      "style-src 'self' 'unsafe-inline';");
}

AstroWebUiPage::AstroWebUiPage(content::WebUI* web_ui, const GURL& url)
    : content::WebUIController(web_ui) {
  AddAstroWebUiDataSource(web_ui, url);
}

AstroWebUiPage::~AstroWebUiPage() = default;

AstroWebUiPageConfig::AstroWebUiPageConfig(std::string_view host)
    : DefaultWebUIConfig(kAstroUIScheme, host) {}

}  // namespace astro
