// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/oxy/webui/astro_ntp_ui.h"

#include <string>

#include "base/files/file_path.h"
#include "base/files/file_util.h"
#include "base/logging.h"
#include "base/memory/ref_counted_memory.h"
#include "base/path_service.h"
#include "content/public/browser/web_ui.h"
#include "content/public/browser/web_ui_data_source.h"
#include "content/public/common/url_constants.h"

namespace oxy {

namespace {

// Returns the path to the astro-ntp resources directory.
// Resources are located at <exe_dir>/astro-ntp/ alongside the browser binary.
base::FilePath GetNtpResourcesDir() {
  base::FilePath exe_dir;
  base::PathService::Get(base::DIR_EXE, &exe_dir);
  return exe_dir.AppendASCII("astro-ntp");
}

// Resolves a WebUI request path to a file on disk and returns its contents.
// For the root path (""), serves index.html.
// For other paths (e.g., "assets/index-XXX.js"), serves the corresponding file.
void HandleNtpRequest(const std::string& path,
                      content::WebUIDataSource::GotDataCallback callback) {
  base::FilePath resources_dir = GetNtpResourcesDir();

  // Map empty path to index.html
  std::string file_path_str = path.empty() ? "index.html" : path;

  // Security: reject paths that attempt directory traversal
  if (file_path_str.find("..") != std::string::npos) {
    LOG(WARNING) << "Astro NTP: rejected path with directory traversal: "
                 << file_path_str;
    std::move(callback).Run(nullptr);
    return;
  }

  base::FilePath file_path =
      resources_dir.AppendASCII(file_path_str);

  std::string contents;
  if (!base::ReadFileToString(file_path, &contents)) {
    LOG(WARNING) << "Astro NTP: failed to read resource: "
                 << file_path.value();
    std::move(callback).Run(nullptr);
    return;
  }

  auto bytes =
      base::MakeRefCounted<base::RefCountedString>(std::move(contents));
  std::move(callback).Run(bytes);
}

void CreateAndAddDataSource(content::WebUI* web_ui) {
  content::WebUIDataSource* source =
      content::WebUIDataSource::CreateAndAdd(
          web_ui->GetWebContents()->GetBrowserContext(), kAstroNtpHost);

  // Intercept all requests and serve from disk.
  source->SetRequestFilter(
      base::BindRepeating(
          [](const std::string& path) -> bool { return true; }),
      base::BindRepeating(&HandleNtpRequest));

  // The Vite build produces inline scripts and external JS/CSS modules.
  // Relax CSP to allow inline scripts (theme detection), module scripts,
  // inline styles, and Google Fonts loading.
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::ScriptSrc,
      "script-src 'self' 'unsafe-inline';");
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::StyleSrc,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;");
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::FontSrc,
      "font-src 'self' https://fonts.gstatic.com;");
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::ImgSrc,
      "img-src 'self' data:;");

  // Disable Trusted Types enforcement for our custom NTP since the Vite
  // build output doesn't use Trusted Types.
  source->DisableTrustedTypesCSP();
}

}  // namespace

AstroNtpUI::AstroNtpUI(content::WebUI* web_ui)
    : content::WebUIController(web_ui) {
  CreateAndAddDataSource(web_ui);
}

AstroNtpUI::~AstroNtpUI() = default;

AstroNtpUIConfig::AstroNtpUIConfig()
    : content::DefaultWebUIConfig<AstroNtpUI>(
          content::kChromeUIScheme,
          kAstroNtpHost) {}

}  // namespace oxy
