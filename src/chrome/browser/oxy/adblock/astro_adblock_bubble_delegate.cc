// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/oxy/adblock/astro_adblock_bubble_delegate.h"

#include "base/strings/string_number_conversions.h"
#include "base/strings/utf_string_conversions.h"
#include "chrome/browser/oxy/adblock/astro_adblock_service.h"
#include "chrome/browser/oxy/adblock/astro_adblock_tab_helper.h"
#include "chrome/browser/ui/browser.h"
#include "content/public/browser/web_contents.h"
#include "ui/base/mojom/dialog_button.mojom.h"
#include "ui/gfx/font_list.h"
#include "ui/views/controls/button/toggle_button.h"
#include "ui/views/controls/label.h"
#include "ui/views/controls/separator.h"
#include "ui/views/layout/box_layout.h"
#include "ui/views/layout/flex_layout.h"
#include "ui/views/style/typography.h"
#include "ui/views/view.h"
#include "ui/views/view_class_properties.h"
#include "url/gurl.h"

namespace oxy::adblock {

namespace {

constexpr int kBubbleWidth = 280;
constexpr int kPadding = 16;

}  // namespace

AstroAdBlockBubbleDelegate::AstroAdBlockBubbleDelegate(
    views::View* anchor_view,
    Browser* browser,
    content::WebContents* web_contents,
    AstroAdBlockService* service)
    : BubbleDialogDelegate(anchor_view, views::BubbleBorder::TOP_RIGHT),
      browser_(browser),
      web_contents_(web_contents),
      service_(service) {
  SetTitle(u"Astro Ad Blocker");
  SetButtons(static_cast<int>(ui::mojom::DialogButton::kNone));
  set_fixed_width(kBubbleWidth);

  // Observe the tab helper for live updates.
  tab_helper_ = AstroAdBlockTabHelper::FromWebContents(web_contents);
  if (tab_helper_) {
    tab_helper_->AddObserver(this);
  }
}

AstroAdBlockBubbleDelegate::~AstroAdBlockBubbleDelegate() {
  if (tab_helper_) {
    tab_helper_->RemoveObserver(this);
  }
}

void AstroAdBlockBubbleDelegate::Init() {
  auto contents = std::make_unique<views::View>();
  auto* layout = contents->SetLayoutManager(std::make_unique<views::BoxLayout>(
      views::BoxLayout::Orientation::kVertical, gfx::Insets(kPadding),
      /*between_child_spacing=*/12));
  layout->set_cross_axis_alignment(
      views::BoxLayout::CrossAxisAlignment::kStretch);

  // Blocked count header.
  blocked_count_label_ =
      contents->AddChildView(std::make_unique<views::Label>());
  blocked_count_label_->SetHorizontalAlignment(gfx::ALIGN_LEFT);
  blocked_count_label_->SetTextStyle(views::style::STYLE_HEADLINE_4);

  // Separator.
  contents->AddChildView(std::make_unique<views::Separator>());

  // Per-site toggle row.
  auto* toggle_row = contents->AddChildView(std::make_unique<views::View>());
  auto* toggle_layout =
      toggle_row->SetLayoutManager(std::make_unique<views::FlexLayout>());
  toggle_layout->SetOrientation(views::LayoutOrientation::kHorizontal);
  toggle_layout->SetMainAxisAlignment(views::LayoutAlignment::kStart);
  toggle_layout->SetCrossAxisAlignment(views::LayoutAlignment::kCenter);

  site_label_ = toggle_row->AddChildView(std::make_unique<views::Label>());
  site_label_->SetHorizontalAlignment(gfx::ALIGN_LEFT);
  site_label_->SetProperty(
      views::kFlexBehaviorKey,
      views::FlexSpecification(views::MinimumFlexSizeRule::kScaleToZero,
                               views::MaximumFlexSizeRule::kUnbounded));

  site_toggle_ =
      toggle_row->AddChildView(std::make_unique<views::ToggleButton>(
          base::BindRepeating(&AstroAdBlockBubbleDelegate::OnSiteToggleChanged,
                              base::Unretained(this))));

  SetContentsView(std::move(contents));

  UpdateUI();
}

void AstroAdBlockBubbleDelegate::OnBlockedCountChanged(int count) {
  UpdateUI();
}

void AstroAdBlockBubbleDelegate::OnSiteToggleChanged() {
  if (!service_ || !web_contents_) {
    return;
  }

  GURL site_url = web_contents_->GetLastCommittedURL();
  bool enabled = site_toggle_->GetIsOn();
  service_->SetSiteOverride(site_url, enabled);
}

void AstroAdBlockBubbleDelegate::UpdateUI() {
  if (!blocked_count_label_ || !site_label_ || !site_toggle_) {
    return;
  }

  // Update blocked count.
  int count = tab_helper_ ? tab_helper_->GetTotalBlockedCount() : 0;
  if (count == 0) {
    blocked_count_label_->SetText(u"No ads blocked on this page");
  } else {
    std::u16string count_str = base::NumberToString16(count);
    blocked_count_label_->SetText(count_str + u" ad" +
                                  (count != 1 ? u"s" : u"") + u" and tracker" +
                                  (count != 1 ? u"s" : u"") + u" blocked");
  }

  // Update site label and toggle.
  if (web_contents_) {
    GURL url = web_contents_->GetLastCommittedURL();
    std::u16string host = base::UTF8ToUTF16(url.host());
    site_label_->SetText(u"Block ads on " + host);

    bool site_enabled = service_ && service_->IsEnabledForSite(url);
    site_toggle_->SetIsOn(site_enabled);
    site_toggle_->SetAccessibleName(u"Toggle ad blocking for " + host);
  }
}

}  // namespace oxy::adblock
