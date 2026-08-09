// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_ADBLOCK_ASTRO_ADBLOCK_BUBBLE_DELEGATE_H_
#define CHROME_BROWSER_OXY_ADBLOCK_ASTRO_ADBLOCK_BUBBLE_DELEGATE_H_

#include "base/memory/raw_ptr.h"
#include "chrome/browser/oxy/adblock/astro_adblock_tab_helper.h"
#include "ui/views/bubble/bubble_dialog_delegate_view.h"

class Browser;

namespace content {
class WebContents;
}

namespace views {
class Label;
class ToggleButton;
}  // namespace views

namespace oxy::adblock {

class AstroAdBlockService;

// Bubble shown when the user clicks the ad blocker toolbar button.
// Displays blocked count for the current page and a per-site toggle.
//
// Derives from BubbleDialogDelegate rather than BubbleDialogDelegateView: the
// latter is deprecated upstream and its constructor is private behind a closed
// friend list marked "DO NOT ADD TO THIS LIST". The contents live in a separate
// View built by Init().
//
// Being a delegate that is NOT a View has a consequence worth stating here,
// because getting it wrong crashed the browser: nothing deletes this object on
// its own. A View-derived delegate is owned by the widget's view hierarchy;
// this one is owned by whoever constructs it, which is
// AstroAdBlockToolbarButton, and it MUST outlive the widget built from it.
// There is deliberately no static "show" helper: the one that used to be here
// created the delegate, handed it to CreateBubble and returned, leaving an
// object nobody owned and whose anchor observation outlived its widget. See
// the ownership comment on AstroAdBlockToolbarButton's members.
class AstroAdBlockBubbleDelegate : public views::BubbleDialogDelegate,
                                   public AstroAdBlockTabHelper::Observer {
 public:
  AstroAdBlockBubbleDelegate(views::View* anchor_view,
                             Browser* browser,
                             content::WebContents* web_contents,
                             AstroAdBlockService* service);
  ~AstroAdBlockBubbleDelegate() override;

  AstroAdBlockBubbleDelegate(const AstroAdBlockBubbleDelegate&) = delete;
  AstroAdBlockBubbleDelegate& operator=(const AstroAdBlockBubbleDelegate&) =
      delete;

 private:
  // views::BubbleDialogDelegate:
  void Init() override;

  // AstroAdBlockTabHelper::Observer:
  void OnBlockedCountChanged(int count) override;

  // Called when the per-site toggle is changed.
  void OnSiteToggleChanged();

  // Updates the UI labels.
  void UpdateUI();

  raw_ptr<Browser> browser_;
  raw_ptr<content::WebContents> web_contents_;
  raw_ptr<AstroAdBlockService> service_;

  // Child views (owned by the contents view).
  raw_ptr<views::Label> blocked_count_label_ = nullptr;
  raw_ptr<views::Label> site_label_ = nullptr;
  raw_ptr<views::ToggleButton> site_toggle_ = nullptr;

  raw_ptr<AstroAdBlockTabHelper> tab_helper_ = nullptr;
};

}  // namespace oxy::adblock

#endif  // CHROME_BROWSER_OXY_ADBLOCK_ASTRO_ADBLOCK_BUBBLE_DELEGATE_H_
