// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/oxy/oxy_alia_side_panel.h"

#include <string>

#include "base/strings/string_util.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/ui/browser.h"
#include "chrome/browser/ui/views/side_panel/side_panel_entry.h"
#include "chrome/browser/ui/views/side_panel/side_panel_entry_scope.h"
#include "chrome/browser/ui/views/side_panel/side_panel_registry.h"
#include "content/public/browser/web_contents.h"
#include "net/base/url_util.h"
#include "url/gurl.h"
#include "ui/views/controls/webview/webview.h"

namespace oxy {

namespace {

// Builds the Alia URL with current page context as query parameters.
// This enables Alia to provide context-aware AI assistance for the
// page the user is currently viewing.
GURL BuildAliaUrlWithContext(Browser* browser) {
  std::string url(kAliaWebUrl);

  // Build the base URL with embed mode for sidebar-optimized UI.
  GURL alia_gurl(url);
  alia_gurl = net::AppendQueryParameter(alia_gurl, "embed", "sidepanel");

  // Pass current page context to Alia via query parameters.
  content::WebContents* active_contents =
      browser->tab_strip_model()->GetActiveWebContents();
  if (active_contents) {
    GURL page_url = active_contents->GetLastCommittedURL();
    std::u16string page_title = active_contents->GetTitle();

    if (page_url.is_valid() && !page_url.is_empty() &&
        page_url.SchemeIsHTTPOrHTTPS()) {
      alia_gurl = net::AppendQueryParameter(alia_gurl, "context_url",
                                            page_url.spec());
      if (!page_title.empty()) {
        alia_gurl = net::AppendQueryParameter(
            alia_gurl, "context_title", base::UTF16ToUTF8(page_title));
      }
    }
  }

  return alia_gurl;
}

// Creates the WebView that hosts the Alia web app inside the side panel.
std::unique_ptr<views::View> CreateAliaWebView(Browser* browser,
                                               SidePanelEntryScope& scope) {
  Profile* profile = browser->profile();
  auto web_view = std::make_unique<views::WebView>(profile);

  GURL url = BuildAliaUrlWithContext(browser);
  web_view->LoadInitialURL(url);

  return web_view;
}

}  // namespace

void RegisterAliaSidePanelEntry(Browser* browser,
                                SidePanelRegistry* global_registry) {
  SidePanelEntry::Key alia_key(SidePanelEntry::Id::kAlia);

  // Skip if already registered.
  if (global_registry->GetEntryForKey(alia_key)) {
    return;
  }

  // Register the Alia side panel entry. The callback captures `browser` as
  // a raw pointer — this is safe because the entry is owned by the registry,
  // which is destroyed during browser teardown (before Browser* is freed).
  global_registry->Register(std::make_unique<SidePanelEntry>(
      alia_key,
      base::BindRepeating(&CreateAliaWebView, base::Unretained(browser)),
      /*default_content_width_callback=*/base::NullCallback()));
}

}  // namespace oxy
