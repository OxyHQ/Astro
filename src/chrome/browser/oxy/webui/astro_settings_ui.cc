// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/oxy/webui/astro_settings_ui.h"

#include <string>

#include "base/files/file_path.h"
#include "base/files/file_util.h"
#include "base/logging.h"
#include "base/memory/ref_counted_memory.h"
#include "base/path_service.h"
#include "chrome/browser/oxy/webui/astro_settings_handler.h"
#include "content/public/browser/web_contents.h"
#include "content/public/common/bindings_policy.h"
#include "content/public/browser/web_ui.h"
#include "content/public/browser/web_ui_data_source.h"
#include "content/public/common/url_constants.h"
#include "services/network/public/mojom/content_security_policy.mojom.h"

namespace oxy {

namespace {

base::FilePath GetSettingsResourcesDir() {
  base::FilePath exe_dir;
  base::PathService::Get(base::DIR_EXE, &exe_dir);
  return exe_dir.AppendASCII("resources").AppendASCII("astro-settings");
}

void HandleSettingsRequest(
    const std::string& path,
    content::WebUIDataSource::GotDataCallback callback) {
  base::FilePath resources_dir = GetSettingsResourcesDir();

  std::string file_path_str = path.empty() ? "index.html" : path;

  // Security: reject paths that attempt directory traversal.
  if (file_path_str.find("..") != std::string::npos) {
    LOG(WARNING) << "Astro Settings: rejected path with directory traversal: "
                 << file_path_str;
    std::move(callback).Run(nullptr);
    return;
  }

  base::FilePath file_path = resources_dir.AppendASCII(file_path_str);

  std::string contents;
  if (!base::ReadFileToString(file_path, &contents)) {
    // SPA fallback: serve index.html for paths without file extensions
    if (file_path_str.find('.') == std::string::npos) {
      file_path = resources_dir.AppendASCII("index.html");
      if (base::ReadFileToString(file_path, &contents)) {
        auto bytes = base::MakeRefCounted<base::RefCountedString>(
            std::move(contents));
        std::move(callback).Run(bytes);
        return;
      }
    }
    LOG(WARNING) << "Astro Settings: failed to read resource: "
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
          web_ui->GetWebContents()->GetBrowserContext(), kAstroSettingsHost);

  // Intercept all requests and serve from disk.
  source->SetRequestFilter(
      base::BindRepeating(
          [](const std::string& path) -> bool { return true; }),
      base::BindRepeating(&HandleSettingsRequest));

  // The Vite build produces inline scripts and external JS/CSS modules.
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::ScriptSrc,
      "script-src chrome://resources 'self' 'unsafe-inline';");
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::StyleSrc,
      "style-src 'self' 'unsafe-inline' chrome://theme;");
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::ImgSrc,
      "img-src 'self' data:;");

  // Disable Trusted Types enforcement since the Vite build output
  // doesn't use Trusted Types.
  source->DisableTrustedTypesCSP();
}

}  // namespace

AstroSettingsUI::AstroSettingsUI(content::WebUI* web_ui)
    : ui::MojoWebUIController(web_ui, /*enable_chrome_send=*/true) {

  CreateAndAddDataSource(web_ui);

  // Register the message handler that bridges JS <-> PrefService.
  web_ui->AddMessageHandler(std::make_unique<AstroSettingsHandler>());
}

AstroSettingsUI::~AstroSettingsUI() = default;

AstroSettingsUIConfig::AstroSettingsUIConfig()
    : content::DefaultWebUIConfig<AstroSettingsUI>(
          content::kChromeUIScheme,
          kAstroSettingsHost) {}

}  // namespace oxy
