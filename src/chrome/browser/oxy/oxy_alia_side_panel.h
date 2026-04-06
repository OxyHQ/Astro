// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_OXY_ALIA_SIDE_PANEL_H_
#define CHROME_BROWSER_OXY_OXY_ALIA_SIDE_PANEL_H_

class Browser;
class SidePanelRegistry;

namespace oxy {

// The chrome:// URL for the Alia AI WebUI page.
inline constexpr char kAliaWebUrl[] = "chrome://alia/";

// Registers the Alia AI side panel entry in the global registry.
// The panel loads the Alia web app in an embedded WebView and passes the
// current page URL/title as context query parameters.
//
// Safe to call multiple times — skips registration if already present.
void RegisterAliaSidePanelEntry(Browser* browser,
                                SidePanelRegistry* global_registry);

}  // namespace oxy

#endif  // CHROME_BROWSER_OXY_OXY_ALIA_SIDE_PANEL_H_
