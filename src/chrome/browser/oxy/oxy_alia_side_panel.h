// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_OXY_ALIA_SIDE_PANEL_H_
#define CHROME_BROWSER_OXY_OXY_ALIA_SIDE_PANEL_H_

#include <memory>

#include "base/memory/raw_ptr.h"

class Browser;
class SidePanelEntryScope;
class SidePanelRegistry;

namespace views {
class View;
}  // namespace views

namespace oxy {

// The production URL for the Alia AI web app.
inline constexpr char kAliaWebUrl[] = "https://alia.onl";

// AliaSidePanelCoordinator handles the creation and registration of the
// Alia AI assistant SidePanelEntry. Alia loads as an embedded web view
// pointing to the Alia web app, with the current page URL passed as context.
class AliaSidePanelCoordinator {
 public:
  explicit AliaSidePanelCoordinator(Browser* browser);
  ~AliaSidePanelCoordinator();

  AliaSidePanelCoordinator(const AliaSidePanelCoordinator&) = delete;
  AliaSidePanelCoordinator& operator=(const AliaSidePanelCoordinator&) = delete;

  // Creates and registers the Alia side panel entry in the global registry.
  void CreateAndRegisterEntry(SidePanelRegistry* global_registry);

 private:
  // Creates the web view that hosts the Alia web app inside the side panel.
  std::unique_ptr<views::View> CreateAliaWebView(SidePanelEntryScope& scope);

  // Builds the Alia URL with page context query parameters.
  std::string GetAliaUrlWithContext() const;

  raw_ptr<Browser> browser_;
};

}  // namespace oxy

#endif  // CHROME_BROWSER_OXY_OXY_ALIA_SIDE_PANEL_H_
