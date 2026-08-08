// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/oxy/webui/astro_ntp_ui.h"

#include <string>

#include "base/files/file_path.h"
#include "base/files/file_util.h"
#include "base/functional/bind.h"
#include "base/logging.h"
#include "base/memory/ref_counted_memory.h"
#include "base/path_service.h"
#include "base/values.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/ui/browser.h"
#include "chrome/browser/ui/browser_finder.h"
#include "chrome/browser/ui/browser_window/public/browser_window_features.h"
#include "chrome/browser/ui/views/side_panel/side_panel_entry_id.h"
#include "chrome/browser/ui/views/side_panel/side_panel_ui.h"
#include "components/prefs/pref_service.h"
#include "content/public/browser/web_contents.h"
#include "content/public/browser/web_ui.h"
#include "content/public/browser/web_ui_data_source.h"
#include "content/public/common/url_constants.h"
#include "services/network/public/mojom/content_security_policy.mojom.h"

namespace oxy {

namespace {

// Returns the path to the astro-ntp resources directory.
// Resources are located at <exe_dir>/astro-ntp/ alongside the browser binary.
base::FilePath GetNtpResourcesDir() {
  base::FilePath exe_dir;
  base::PathService::Get(base::DIR_EXE, &exe_dir);
  return exe_dir.AppendASCII("resources").AppendASCII("astro-ntp");
}

// Profile pointer set during construction so the request handler can
// read prefs and inject them into the HTML (same role as loadTimeData).
Profile* g_ntp_profile = nullptr;

void HandleNtpRequest(const std::string& path,
                      content::WebUIDataSource::GotDataCallback callback) {
  base::FilePath resources_dir = GetNtpResourcesDir();
  std::string file_path_str = path.empty() ? "index.html" : path;

  if (file_path_str.find("..") != std::string::npos) {
    std::move(callback).Run(nullptr);
    return;
  }

  base::FilePath file_path = resources_dir.AppendASCII(file_path_str);

  std::string contents;
  if (!base::ReadFileToString(file_path, &contents)) {
    // SPA fallback: paths without extensions get index.html
    if (file_path_str.find('.') == std::string::npos) {
      file_path = resources_dir.AppendASCII("index.html");
      file_path_str = "index.html";
      if (!base::ReadFileToString(file_path, &contents)) {
        std::move(callback).Run(nullptr);
        return;
      }
    } else {
      std::move(callback).Run(nullptr);
      return;
    }
  }

  // Inject NTP widget prefs as a data attribute on <html>.
  // CSP blocks inline <script> tags, so we use a data attribute instead.
  // The NTP JS reads this via document.documentElement.dataset.ntpPrefs.
  if (file_path_str == "index.html" && g_ntp_profile) {
    PrefService* prefs = g_ntp_profile->GetPrefs();
    std::string json = "{"
      "\"weather\":" + std::string(prefs->GetBoolean("astro.ntp_show_weather") ? "true" : "false") + ","
      "\"clock\":" + std::string(prefs->GetBoolean("astro.ntp_show_clock") ? "true" : "false") + ","
      "\"quickLinks\":" + std::string(prefs->GetBoolean("astro.ntp_show_quick_links") ? "true" : "false") + ","
      "\"notes\":" + std::string(prefs->GetBoolean("astro.ntp_show_notes") ? "true" : "false") + ","
      "\"sites\":" + std::string(prefs->GetBoolean("astro.ntp_show_sites") ? "true" : "false") + ","
      "\"discover\":" + std::string(prefs->GetBoolean("astro.ntp_show_discover") ? "true" : "false") + ","
      "\"alia\":" + std::string(prefs->GetBoolean("astro.ntp_show_alia") ? "true" : "false") +
      "}";
    size_t pos = contents.find("<html");
    size_t end = contents.find(">", pos);
    if (pos != std::string::npos && end != std::string::npos) {
      contents.insert(end, " data-ntp-prefs='" + json + "'");
    }
  }

  auto bytes = base::MakeRefCounted<base::RefCountedString>(
      std::move(contents));
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
  // The NTP loads Mojo bindings from chrome://new-tab-page-third-party and
  // fetches favicons from chrome://favicon2.
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::ScriptSrc,
      "script-src " CONTENT_WEBUI_SCHEME_LITERAL
      "://resources " CONTENT_WEBUI_SCHEME_LITERAL
      "://new-tab-page-third-party " CONTENT_WEBUI_SCHEME_LITERAL
      "://webui-test 'self' 'unsafe-inline';");
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::StyleSrc,
      "style-src 'self' 'unsafe-inline' " CONTENT_WEBUI_SCHEME_LITERAL
      "://theme https://fonts.googleapis.com;");
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::FontSrc,
      "font-src 'self' https://fonts.gstatic.com;");
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::ImgSrc,
      "img-src 'self' " CONTENT_WEBUI_SCHEME_LITERAL
      "://favicon2 " CONTENT_WEBUI_SCHEME_LITERAL "://theme data:;");

  // Disable Trusted Types enforcement for our custom NTP since the Vite
  // build output doesn't use Trusted Types.
  source->DisableTrustedTypesCSP();
}

}  // namespace

// -- AstroNtpHandler ----------------------------------------------------------

AstroNtpHandler::AstroNtpHandler() = default;
AstroNtpHandler::~AstroNtpHandler() = default;

void AstroNtpHandler::RegisterMessages() {
  web_ui()->RegisterMessageCallback(
      "getWidgetPrefs",
      base::BindRepeating(&AstroNtpHandler::HandleGetWidgetPrefs,
                          base::Unretained(this)));
  web_ui()->RegisterMessageCallback(
      "getBlockedCount",
      base::BindRepeating(&AstroNtpHandler::HandleGetBlockedCount,
                          base::Unretained(this)));
}

void AstroNtpHandler::OnJavascriptAllowed() {
  // Watch all NTP widget prefs for live changes from the settings page.
  auto* prefs = Profile::FromWebUI(web_ui())->GetPrefs();
  pref_registrar_.Init(prefs);
  static constexpr const char* kWidgetPrefs[] = {
    "astro.ntp_show_weather", "astro.ntp_show_clock",
    "astro.ntp_show_quick_links", "astro.ntp_show_notes",
    "astro.ntp_show_sites", "astro.ntp_show_discover",
    "astro.ntp_show_alia",
  };
  for (const char* pref : kWidgetPrefs) {
    pref_registrar_.Add(
        pref, base::BindRepeating(&AstroNtpHandler::OnWidgetPrefChanged,
                                  base::Unretained(this)));
  }
  // Watch the lifetime blocked count so the NTP badge updates live as the
  // ad blocker cancels requests on other tabs.
  pref_registrar_.Add(
      "oxy.adblock.lifetime_blocked_count",
      base::BindRepeating(&AstroNtpHandler::OnBlockedCountChanged,
                          base::Unretained(this)));
}

void AstroNtpHandler::OnJavascriptDisallowed() {
  pref_registrar_.RemoveAll();
}

void AstroNtpHandler::OnWidgetPrefChanged() {
  auto* prefs = Profile::FromWebUI(web_ui())->GetPrefs();
  FireWebUIListener("onWidgetPrefs",
      base::Value(prefs->GetBoolean("astro.ntp_show_weather")),
      base::Value(prefs->GetBoolean("astro.ntp_show_clock")),
      base::Value(prefs->GetBoolean("astro.ntp_show_quick_links")),
      base::Value(prefs->GetBoolean("astro.ntp_show_notes")),
      base::Value(prefs->GetBoolean("astro.ntp_show_sites")),
      base::Value(prefs->GetBoolean("astro.ntp_show_discover")),
      base::Value(prefs->GetBoolean("astro.ntp_show_alia")));
}

void AstroNtpHandler::OnBlockedCountChanged() {
  auto* prefs = Profile::FromWebUI(web_ui())->GetPrefs();
  FireWebUIListener(
      "onBlockedCount",
      base::Value(prefs->GetInteger("oxy.adblock.lifetime_blocked_count")));
}

void AstroNtpHandler::HandleGetWidgetPrefs(const base::ListValue& args) {
  AllowJavascript();
  // Send current values immediately (triggers the pref watcher setup too).
  OnWidgetPrefChanged();
}

void AstroNtpHandler::HandleGetBlockedCount(const base::ListValue& args) {
  AllowJavascript();
  OnBlockedCountChanged();
}

// -- AstroNtpUI ---------------------------------------------------------------

AstroNtpUI::AstroNtpUI(content::WebUI* web_ui)
    : content::WebUIController(web_ui) {
  g_ntp_profile = Profile::FromWebUI(web_ui);
  CreateAndAddDataSource(web_ui);

  // Register the message handler for widget prefs (chrome.send-based).
  web_ui->AddMessageHandler(std::make_unique<AstroNtpHandler>());

  // Handle chrome.send() messages from the NTP frontend.
  web_ui->RegisterMessageCallback(
      "openCustomizeChrome",
      base::BindRepeating(
          [](content::WebUI* ui, const base::ListValue&) {
            Browser* browser =
                chrome::FindBrowserWithTab(ui->GetWebContents());
            if (!browser) return;
            SidePanelUI* sp = browser->GetFeatures().side_panel_ui();
            if (sp) sp->Show(SidePanelEntryId::kCustomizeChrome);
          },
          base::Unretained(web_ui)));
  web_ui->RegisterMessageCallback(
      "openAliaSidePanel",
      base::BindRepeating(
          [](content::WebUI* ui, const base::ListValue&) {
            Browser* browser =
                chrome::FindBrowserWithTab(ui->GetWebContents());
            if (!browser) return;
            SidePanelUI* sp = browser->GetFeatures().side_panel_ui();
            if (sp) sp->Show(SidePanelEntryId::kAlia);
          },
          base::Unretained(web_ui)));
}

AstroNtpUI::~AstroNtpUI() = default;

AstroNtpUIConfig::AstroNtpUIConfig()
    : content::DefaultWebUIConfig<AstroNtpUI>(
          content::kChromeUIScheme,
          kAstroNtpHost) {}

}  // namespace oxy
