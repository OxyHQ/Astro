// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_ADBLOCK_ASTRO_ADBLOCK_TOOLBAR_BUTTON_H_
#define CHROME_BROWSER_OXY_ADBLOCK_ASTRO_ADBLOCK_TOOLBAR_BUTTON_H_

#include <memory>

#include "base/memory/raw_ptr.h"
#include "chrome/browser/oxy/adblock/astro_adblock_tab_helper.h"
#include "chrome/browser/ui/browser.h"
#include "chrome/browser/ui/tabs/tab_strip_model_observer.h"
#include "chrome/browser/ui/views/toolbar/toolbar_button.h"
#include "ui/base/metadata/metadata_header_macros.h"
#include "ui/views/widget/widget.h"

namespace oxy::adblock {

class AstroAdBlockBubbleDelegate;

// Toolbar button that shows the Astro ad blocker shield icon with a
// badge indicating the number of blocked resources on the current page.
// Clicking opens a bubble with per-site controls.
class AstroAdBlockToolbarButton
    : public ToolbarButton,
      public AstroAdBlockTabHelper::Observer,
      public TabStripModelObserver {
  METADATA_HEADER(AstroAdBlockToolbarButton, ToolbarButton)
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

  // views::View:
  //
  // Where the first UpdateState() happens. Not the constructor: UpdateIcon()
  // reaches the ColorProvider, a View has none until it is in a Widget, and
  // the constructor runs from ToolbarView::Init() before that. It segfaulted
  // on the browser's very first window.
  void OnThemeChanged() override;

  // AstroAdBlockTabHelper::Observer:
  void OnBlockedCountChanged(int count) override;

  // TabStripModelObserver:
  void OnTabStripModelChanged(
      TabStripModel* tab_strip_model,
      const TabStripModelChange& change,
      const TabStripSelectionChange& selection) override;

  // Button press handler.
  void ButtonPressed();

  // Shows the ad block bubble anchored to this button.
  void ShowBubble();

  // Tears down the open bubble. Wired to the widget through
  // Widget::MakeCloseSynchronous, so it runs for every way a bubble ends:
  // clicking away, pressing escape, or this button asking it to.
  void CloseBubble(views::Widget::ClosedReason reason);

  // Returns the tab helper for the active tab, or nullptr.
  AstroAdBlockTabHelper* GetActiveTabHelper();

  // Starts/stops observing the current tab's helper.
  void ObserveTab(content::WebContents* web_contents);
  void StopObservingTab();

  raw_ptr<Browser> browser_;
  raw_ptr<AstroAdBlockTabHelper> current_tab_helper_ = nullptr;
  int current_blocked_count_ = 0;

  // The bubble, owned here, because nothing else will own it.
  //
  // `BubbleDialogDelegate::CreateBubble` takes a std::unique_ptr and calls
  // release() on it, and `WidgetDelegate::DeleteDelegate` deletes the delegate
  // only when `owned_by_widget_` is set -- which `SetOwnedByWidget` is the
  // only way to set, and its pass key is a closed friend list. So a delegate
  // handed to CreateBubble and then forgotten is simply leaked: when the
  // bubble closes, DeleteDelegate nulls the delegate's `widget_` and returns,
  // leaving the object alive with its anchor observation still registered on
  // the BrowserWidget. Upstream's AnchorWidgetObserver::OnWidgetThemeChanged
  // then runs `owner_->GetWidget()->ThemeChanged()` on that null widget, so
  // the next theme change of any kind segfaulted the browser -- measured, one
  // open-and-close of this bubble was enough.
  //
  // Owning both is upstream's recommended model for a delegate that is not
  // itself a View (see the comment atop `WidgetDelegate::SetOwnedByWidget`),
  // and CLIENT_OWNS_WIDGET plus `MakeCloseSynchronous` is how it is spelled.
  //
  // Declaration order is load-bearing: members are destroyed in reverse, so
  // the widget goes first and the delegate it points at outlives it.
  std::unique_ptr<AstroAdBlockBubbleDelegate> bubble_delegate_;
  std::unique_ptr<views::Widget> bubble_widget_;

  base::WeakPtrFactory<AstroAdBlockToolbarButton> weak_factory_{this};
};

}  // namespace oxy::adblock

#endif  // CHROME_BROWSER_OXY_ADBLOCK_ASTRO_ADBLOCK_TOOLBAR_BUTTON_H_
