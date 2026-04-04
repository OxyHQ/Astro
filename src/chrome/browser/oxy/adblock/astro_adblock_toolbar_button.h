// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_ADBLOCK_ASTRO_ADBLOCK_TOOLBAR_BUTTON_H_
#define CHROME_BROWSER_OXY_ADBLOCK_ASTRO_ADBLOCK_TOOLBAR_BUTTON_H_

#include "base/memory/raw_ptr.h"
#include "chrome/browser/oxy/adblock/astro_adblock_tab_helper.h"
#include "chrome/browser/ui/browser.h"
#include "chrome/browser/ui/tabs/tab_strip_model_observer.h"
#include "chrome/browser/ui/views/toolbar/toolbar_button.h"

namespace oxy::adblock {

class AstroAdBlockBubbleView;

// Toolbar button that shows the Astro ad blocker shield icon with a
// badge indicating the number of blocked resources on the current page.
// Clicking opens a bubble with per-site controls.
class AstroAdBlockToolbarButton
    : public ToolbarButton,
      public AstroAdBlockTabHelper::Observer,
      public TabStripModelObserver {
 public:
  explicit AstroAdBlockToolbarButton(Browser* browser);
  ~AstroAdBlockToolbarButton() override;

  AstroAdBlockToolbarButton(const AstroAdBlockToolbarButton&) = delete;
  AstroAdBlockToolbarButton& operator=(const AstroAdBlockToolbarButton&) =
      delete;

  // Updates the icon and badge for the current tab state.
  void UpdateState();

 private:
  // ToolbarButton:
  void UpdateIcon() override;

  // AstroAdBlockTabHelper::Observer:
  void OnBlockedCountChanged(int count) override;

  // TabStripModelObserver:
  void OnTabStripModelChanged(
      TabStripModel* tab_strip_model,
      const TabStripModelChange& change,
      const TabStripSelectionChange& selection) override;

  // Button press handler �� toggles the bubble.
  void ButtonPressed();

  // Shows the ad block bubble anchored to this button.
  void ShowBubble();

  // Returns the tab helper for the active tab, or nullptr.
  AstroAdBlockTabHelper* GetActiveTabHelper();

  // Starts/stops observing the current tab's helper.
  void ObserveTab(content::WebContents* web_contents);
  void StopObservingTab();

  raw_ptr<Browser> browser_;
  raw_ptr<AstroAdBlockTabHelper> current_tab_helper_ = nullptr;
  int current_blocked_count_ = 0;

  base::WeakPtrFactory<AstroAdBlockToolbarButton> weak_factory_{this};
};

}  // namespace oxy::adblock

#endif  // CHROME_BROWSER_OXY_ADBLOCK_ASTRO_ADBLOCK_TOOLBAR_BUTTON_H_
