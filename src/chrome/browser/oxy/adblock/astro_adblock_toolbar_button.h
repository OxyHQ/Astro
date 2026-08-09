// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_ADBLOCK_ASTRO_ADBLOCK_TOOLBAR_BUTTON_H_
#define CHROME_BROWSER_OXY_ADBLOCK_ASTRO_ADBLOCK_TOOLBAR_BUTTON_H_

#include <memory>

#include "base/memory/raw_ptr.h"
#include "base/scoped_observation.h"
#include "chrome/browser/oxy/adblock/astro_adblock_tab_helper.h"
#include "chrome/browser/ui/browser.h"
#include "chrome/browser/ui/tabs/tab_strip_model_observer.h"
#include "chrome/browser/ui/views/toolbar/toolbar_button.h"
#include "ui/base/metadata/metadata_header_macros.h"
#include "ui/views/widget/widget.h"
#include "ui/views/widget/widget_observer.h"

namespace oxy::adblock {

class AstroAdBlockBubbleDelegate;

// Toolbar button that shows the Astro ad blocker shield icon with a
// badge indicating the number of blocked resources on the current page.
// Clicking opens a bubble with per-site controls.
class AstroAdBlockToolbarButton
    : public ToolbarButton,
      public AstroAdBlockTabHelper::Observer,
      public TabStripModelObserver,
      public views::WidgetObserver {
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

  // views::WidgetObserver:
  //
  // The bubble widget is going away, so the delegate it was built from has to
  // go too -- but not from inside this call. See the members below.
  void OnWidgetDestroying(views::Widget* widget) override;

  // Returns the tab helper for the active tab, or nullptr.
  AstroAdBlockTabHelper* GetActiveTabHelper();

  // Starts/stops observing the current tab's helper.
  void ObserveTab(content::WebContents* web_contents);
  void StopObservingTab();

  raw_ptr<Browser> browser_;
  raw_ptr<AstroAdBlockTabHelper> current_tab_helper_ = nullptr;
  int current_blocked_count_ = 0;

  // The bubble's delegate, owned here, because nothing else will own it.
  //
  // `BubbleDialogDelegate::CreateBubble` takes a std::unique_ptr and calls
  // release() on it, and `WidgetDelegate::DeleteDelegate` deletes the delegate
  // only when `owned_by_widget_` is set -- which `SetOwnedByWidget` is the
  // only way to set, and its pass key is a closed friend list. A View-derived
  // delegate escapes this by being owned by the widget's view hierarchy, and
  // AstroAdBlockBubbleDelegate cannot be one: BubbleDialogDelegateView's
  // constructor is behind a closed friend list of its own.
  //
  // So a delegate handed to CreateBubble and then forgotten is simply leaked.
  // When the bubble closes, DeleteDelegate nulls the delegate's `widget_` and
  // returns, leaving the object alive with its AnchorWidgetObserver still
  // registered on the BrowserWidget -- and upstream's
  // AnchorWidgetObserver::OnWidgetThemeChanged is
  // `owner_->GetWidget()->ThemeChanged()` with no null check. Measured: one
  // open-and-close of this bubble made the next theme change of any kind
  // segfault the browser.
  //
  // The widget is deliberately NOT owned here. It keeps upstream's default
  // ownership, so closing a bubble goes through exactly the path it always
  // did; the only thing this button adds is deleting the delegate afterwards.
  // CLIENT_OWNS_WIDGET with Widget::MakeCloseSynchronous was tried first,
  // since it is what the comment atop SetOwnedByWidget recommends, and it
  // broke closing outright -- see OnWidgetDestroying for the reason, which is
  // the same reason the delete there is deferred.
  std::unique_ptr<AstroAdBlockBubbleDelegate> bubble_delegate_;
  base::ScopedObservation<views::Widget, views::WidgetObserver>
      bubble_observation_{this};

  base::WeakPtrFactory<AstroAdBlockToolbarButton> weak_factory_{this};
};

}  // namespace oxy::adblock

#endif  // CHROME_BROWSER_OXY_ADBLOCK_ASTRO_ADBLOCK_TOOLBAR_BUTTON_H_
