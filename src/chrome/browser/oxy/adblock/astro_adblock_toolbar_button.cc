// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/oxy/adblock/astro_adblock_toolbar_button.h"

#include "base/strings/string_number_conversions.h"
#include "chrome/browser/oxy/adblock/astro_adblock_bubble_view.h"
#include "chrome/browser/oxy/adblock/astro_adblock_service.h"
#include "chrome/browser/oxy/adblock/astro_adblock_service_factory.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/ui/browser_tabstrip.h"
#include "chrome/browser/ui/tabs/tab_strip_model.h"
#include "chrome/browser/ui/views/chrome_layout_provider.h"
#include "components/vector_icons/vector_icons.h"
#include "ui/base/metadata/metadata_impl_macros.h"
#include "ui/gfx/canvas.h"
#include "ui/gfx/font_list.h"
#include "ui/gfx/paint_vector_icon.h"
#include "ui/views/controls/button/button.h"

namespace oxy::adblock {

AstroAdBlockToolbarButton::AstroAdBlockToolbarButton(Browser* browser)
    : ToolbarButton(base::BindRepeating(
          &AstroAdBlockToolbarButton::ButtonPressed,
          base::Unretained(this))),
      browser_(browser) {
  SetTooltipText(u"Astro Ad Blocker");
  SetAccessibleName(u"Astro Ad Blocker");

  // Use a shield icon from Chromium's vector icons.
  SetVectorIcon(vector_icons::kShieldIcon);

  // Observe tab changes to update badge.
  browser_->tab_strip_model()->AddObserver(this);

  // Initialize state for the current tab.
  if (auto* wc = browser_->tab_strip_model()->GetActiveWebContents()) {
    ObserveTab(wc);
  }
  UpdateState();
}

AstroAdBlockToolbarButton::~AstroAdBlockToolbarButton() {
  StopObservingTab();
  if (browser_ && browser_->tab_strip_model()) {
    browser_->tab_strip_model()->RemoveObserver(this);
  }
}

void AstroAdBlockToolbarButton::UpdateState() {
  auto* helper = GetActiveTabHelper();

  // Check if ad blocking is enabled.
  auto* profile = browser_->profile();
  auto* service = AstroAdBlockServiceFactory::GetForProfile(
      Profile::FromBrowserContext(profile));

  bool is_enabled = service && service->IsEnabled();
  if (helper && is_enabled) {
    auto* wc = browser_->tab_strip_model()->GetActiveWebContents();
    if (wc) {
      is_enabled = service->IsEnabledForSite(wc->GetLastCommittedURL());
    }
  }

  current_blocked_count_ = helper ? helper->GetTotalBlockedCount() : 0;

  // Update tooltip with count.
  if (current_blocked_count_ > 0) {
    std::u16string count_str =
        current_blocked_count_ > 99
            ? u"99+"
            : base::NumberToString16(current_blocked_count_);
    SetTooltipText(u"Astro Ad Blocker - " + count_str + u" blocked");
  } else {
    SetTooltipText(u"Astro Ad Blocker");
  }

  // Visual state: grayed out when disabled for this site.
  SetEnabled(true);

  UpdateIcon();
  SchedulePaint();
}

void AstroAdBlockToolbarButton::UpdateIcon() {
  ToolbarButton::UpdateIcon();
}

void AstroAdBlockToolbarButton::OnBlockedCountChanged(int count) {
  UpdateState();
}

void AstroAdBlockToolbarButton::OnTabStripModelChanged(
    TabStripModel* tab_strip_model,
    const TabStripModelChange& change,
    const TabStripSelectionChange& selection) {
  if (selection.active_tab_changed()) {
    StopObservingTab();
    if (selection.new_contents) {
      ObserveTab(selection.new_contents);
    }
    UpdateState();
  }
}

void AstroAdBlockToolbarButton::ButtonPressed() {
  ShowBubble();
}

void AstroAdBlockToolbarButton::ShowBubble() {
  auto* wc = browser_->tab_strip_model()->GetActiveWebContents();
  if (!wc) {
    return;
  }

  auto* profile = browser_->profile();
  auto* service = AstroAdBlockServiceFactory::GetForProfile(
      Profile::FromBrowserContext(profile));
  if (!service) {
    return;
  }

  AstroAdBlockBubbleView::ShowBubble(this, browser_, wc, service);
}

AstroAdBlockTabHelper* AstroAdBlockToolbarButton::GetActiveTabHelper() {
  auto* wc = browser_->tab_strip_model()->GetActiveWebContents();
  if (!wc) {
    return nullptr;
  }
  return AstroAdBlockTabHelper::FromWebContents(wc);
}

void AstroAdBlockToolbarButton::ObserveTab(content::WebContents* web_contents) {
  auto* helper = AstroAdBlockTabHelper::FromWebContents(web_contents);
  if (helper) {
    current_tab_helper_ = helper;
    helper->AddObserver(this);
  }
}

void AstroAdBlockToolbarButton::StopObservingTab() {
  if (current_tab_helper_) {
    current_tab_helper_->RemoveObserver(this);
    current_tab_helper_ = nullptr;
  }
}

BEGIN_METADATA(AstroAdBlockToolbarButton)
END_METADATA

}  // namespace oxy::adblock
