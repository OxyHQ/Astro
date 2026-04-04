// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/oxy/oxy_alia_side_panel.h"

#include "base/strings/string_util.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/ui/browser.h"
#include "chrome/browser/ui/views/side_panel/side_panel_entry.h"
#include "chrome/browser/ui/views/side_panel/side_panel_entry_scope.h"
#include "chrome/browser/ui/views/side_panel/side_panel_registry.h"
#include "content/public/browser/web_contents.h"
#include "net/base/escape.h"
#include "url/gurl.h"
#include "ui/views/controls/webview/webview.h"

namespace oxy {

AliaSidePanelCoordinator::AliaSidePanelCoordinator(Browser* browser)
    : browser_(browser) {}

AliaSidePanelCoordinator::~AliaSidePanelCoordinator() = default;

void AliaSidePanelCoordinator::CreateAndRegisterEntry(
    SidePanelRegistry* global_registry) {
  if (global_registry->GetEntryForKey(
          SidePanelEntry::Key(SidePanelEntry::Id::kAlia))) {
    return;
  }

  global_registry->Register(std::make_unique<SidePanelEntry>(
      SidePanelEntry::Key(SidePanelEntry::Id::kAlia),
      base::BindRepeating(&AliaSidePanelCoordinator::CreateAliaWebView,
                          base::Unretained(this)),
      /*default_content_width_callback=*/base::NullCallback()));
}

std::unique_ptr<views::View> AliaSidePanelCoordinator::CreateAliaWebView(
    SidePanelEntryScope& scope) {
  Profile* profile = browser_->profile();
  auto web_view = std::make_unique<views::WebView>(profile);

  // Load Alia with current page context.
  GURL url(GetAliaUrlWithContext());
  web_view->LoadInitialURL(url);

  return web_view;
}

std::string AliaSidePanelCoordinator::GetAliaUrlWithContext() const {
  std::string url = kAliaWebUrl;

  // Pass current page context to Alia via query parameters.
  content::WebContents* active_contents =
      browser_->tab_strip_model()->GetActiveWebContents();
  if (active_contents) {
    GURL page_url = active_contents->GetLastCommittedURL();
    std::u16string page_title = active_contents->GetTitle();

    if (page_url.is_valid() && !page_url.is_empty()) {
      url += "?context_url=" +
             net::EscapeQueryParamValue(page_url.spec(), /*use_plus=*/true);

      if (!page_title.empty()) {
        url += "&context_title=" +
               net::EscapeQueryParamValue(base::UTF16ToUTF8(page_title),
                                          /*use_plus=*/true);
      }
    }
  }

  // Append embed mode so Alia web app can render sidebar-optimized UI.
  if (url.find('?') != std::string::npos) {
    url += "&embed=sidepanel";
  } else {
    url += "?embed=sidepanel";
  }

  return url;
}

}  // namespace oxy
