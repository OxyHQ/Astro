#include "astro/core/ac_browser_window.h"

#import <AppKit/AppKit.h>

#include <stdlib.h>
#include <string.h>

#include <map>
#include <set>

#include "base/functional/bind.h"
#include "base/logging.h"
#include "base/no_destructor.h"
#include "base/task/single_thread_task_runner.h"
#include "chrome/browser/ui/unload_controller.h"
#include "chrome/app/chrome_command_ids.h"

#include "chrome/browser/devtools/devtools_ui_controller.h"
#include "chrome/browser/lifetime/browser_shutdown.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/themes/theme_service.h"
#include "chrome/browser/ui/browser.h"
#include "chrome/browser/ui/autofill/save_address_bubble_controller.h"
#include "chrome/browser/ui/autofill/update_address_bubble_controller.h"
#include "chrome/browser/ui/browser_window/public/browser_window_features.h"
#include "chrome/browser/ui/exclusive_access/exclusive_access_manager.h"
#include "chrome/browser/ui/exclusive_access/fullscreen_controller.h"
#include "chrome/browser/ui/find_bar/find_bar.h"
#include "chrome/browser/ui/find_bar/find_bar_controller.h"
#include "ui/gfx/range/range.h"
#include "chrome/browser/ui/views/bubble_anchor_util_views.h"
#include "chrome/browser/ui/views/exclusive_access/exclusive_access_bubble_views.h"
#include "chrome/browser/ui/views/eye_dropper/eye_dropper.h"
#include "chrome/browser/ui/views/frame/contents_container_view.h"
#include "components/tabs/public/tab_interface.h"
#include "content/public/browser/eye_dropper.h"
#include "content/public/browser/eye_dropper_listener.h"
#include "components/input/native_web_keyboard_event.h"
#include "content/public/browser/keyboard_event_processing_result.h"
#include "content/public/browser/render_widget_host.h"
#include "content/public/browser/render_widget_host_view.h"
#import "astro/core/astrocore_internal.h"
#include "content/public/browser/web_contents.h"
#include "astro/core/ac_autofill_prompt.h"
#include "astro/core/ac_browser.h"
#include "astro/core/ac_extension_shortcuts.h"
#include "astro/core/ac_lifetime.h"
#include "astro/core/ac_modal_dialog_host.h"
#include "third_party/skia/include/core/SkColor.h"
#include "ui/base/accelerators/accelerator.h"
#include "ui/content_accelerators/accelerator_util.h"
#include "ui/base/ui_base_features.h"
#include "ui/display/types/display_constants.h"
#include "ui/events/event_constants.h"
#include "ui/events/keycodes/keyboard_codes.h"
#include "ui/base/mojom/window_show_state.mojom.h"
#include "ui/color/color_provider_manager.h"
#include "ui/gfx/geometry/rect.h"
#include "ui/gfx/mac/coordinate_conversion.h"
#include "ui/native_theme/native_theme.h"
#include "ui/views/widget/widget.h"

namespace astrocore {

ACLocationBar::ACLocationBar() : LocationBar(nullptr) {}
ACLocationBar::~ACLocationBar() = default;
OmniboxView* ACLocationBar::GetOmniboxView() {
  return nullptr;
}
OmniboxPopupView* ACLocationBar::GetOmniboxPopupView() {
  return nullptr;
}
OmniboxController* ACLocationBar::GetOmniboxController() {
  return nullptr;
}
bool ACLocationBar::ShouldCloseOmniboxPopup(ui::MouseEvent* event) {
  return false;
}
content::WebContents* ACLocationBar::GetWebContents() {
  return browser_ ? browser_->GetTabStripModel()->GetActiveWebContents()
                  : nullptr;
}
LocationBarModel* ACLocationBar::GetLocationBarModel() {
  return nullptr;
}
std::optional<bubble_anchor_util::AnchorConfiguration>
ACLocationBar::GetChipAnchor() {
  return std::nullopt;
}
ChipController* ACLocationBar::GetChipController() {
  return nullptr;
}
ui::TrackedElement* ACLocationBar::GetAnchorOrNull() {
  return nullptr;
}
BrowserWindowInterface* ACLocationBar::GetBrowser() {
  return browser_;
}
Profile* ACLocationBar::GetProfile() {
  return browser_ ? browser_->GetProfile() : nullptr;
}
bool ACLocationBar::IsInitialized() const {
  return true;
}
bool ACLocationBar::IsVisible() const {
  return false;
}
bool ACLocationBar::IsDrawn() const {
  return false;
}
bool ACLocationBar::IsFullscreen() const {
  return false;
}
bool ACLocationBar::IsEditingOrEmpty() const {
  return false;
}
bool ACLocationBar::IsMouseHovered() const {
  return false;
}
bool ACLocationBar::IsFocusWithin() const {
  return false;
}
gfx::Rect ACLocationBar::Bounds() const {
  return gfx::Rect();
}
gfx::Rect ACLocationBar::BoundsInScreen() const {
  return gfx::Rect();
}
gfx::Size ACLocationBar::MinimumSize() const {
  return gfx::Size();
}
gfx::Size ACLocationBar::PreferredSize() const {
  return gfx::Size();
}
bool ACLocationBar::HasSecurityStateChanged() {
  return false;
}
LocationBarTesting* ACLocationBar::GetLocationBarForTesting() {
  return nullptr;
}

ACAutofillBubbleHandler::ACAutofillBubbleHandler() = default;
ACAutofillBubbleHandler::~ACAutofillBubbleHandler() = default;

#define AC_NO_BUBBLE(...) \
  {                       \
    return nullptr;       \
  }
autofill::AutofillBubbleBase* ACAutofillBubbleHandler::ShowSaveCreditCardBubble(
    content::WebContents* web_contents,
    autofill::SaveCardBubbleController* controller,
    bool) {
  return ShowSaveCardPrompt(web_contents, controller);
}
autofill::AutofillBubbleBase* ACAutofillBubbleHandler::ShowIbanBubble(
    content::WebContents* web_contents,
    autofill::IbanBubbleController*,
    bool,
    autofill::IbanBubbleType) {
  return SkipIbanBubble(web_contents);
}
autofill::AutofillBubbleBase* ACAutofillBubbleHandler::
    ShowOfferNotificationBubble(content::WebContents* web_contents,
                                autofill::OfferNotificationBubbleController*,
                                bool) {
  return SkipOfferNotification(web_contents);
}
autofill::AutofillBubbleBase* ACAutofillBubbleHandler::
    ShowSaveAutofillAiDataBubble(content::WebContents*,
                                 autofill::AutofillAiImportDataController*)
        AC_NO_BUBBLE()
autofill::AutofillBubbleBase* ACAutofillBubbleHandler::
    ShowAutofillAiLocalSaveNotification(
        content::WebContents*,
        autofill::AutofillAiImportDataController*) AC_NO_BUBBLE()
autofill::AutofillBubbleBase* ACAutofillBubbleHandler::
    ShowSaveAddressProfileBubble(
        content::WebContents* web_contents,
        std::unique_ptr<autofill::SaveAddressBubbleController> controller,
        bool) {
  return ShowSaveAddressPrompt(web_contents, std::move(controller));
}
#if BUILDFLAG(ENABLE_DICE_SUPPORT)
autofill::AutofillBubbleBase* ACAutofillBubbleHandler::ShowAddressSignInPromo(
    content::WebContents* web_contents,
    const autofill::AutofillProfile&) {
  return SkipAddressSignInPromo(web_contents);
}
#endif
autofill::AutofillBubbleBase* ACAutofillBubbleHandler::
    ShowUpdateAddressProfileBubble(
        content::WebContents* web_contents,
        std::unique_ptr<autofill::UpdateAddressBubbleController> controller,
        bool) {
  return ShowUpdateAddressPrompt(web_contents, std::move(controller));
}
autofill::AutofillBubbleBase* ACAutofillBubbleHandler::
    ShowFilledCardInformationBubble(
        content::WebContents*,
        autofill::FilledCardInformationBubbleController*,
        bool) AC_NO_BUBBLE()
autofill::AutofillBubbleBase* ACAutofillBubbleHandler::
    ShowVirtualCardEnrollBubble(content::WebContents*,
                                autofill::VirtualCardEnrollBubbleController*,
                                bool) AC_NO_BUBBLE()
autofill::AutofillBubbleBase* ACAutofillBubbleHandler::
    ShowVirtualCardEnrollConfirmationBubble(
        content::WebContents*,
        autofill::VirtualCardEnrollBubbleController*) AC_NO_BUBBLE()
autofill::AutofillBubbleBase* ACAutofillBubbleHandler::
    ShowMandatoryReauthBubble(content::WebContents*,
                              autofill::MandatoryReauthBubbleController*,
                              bool,
                              autofill::MandatoryReauthBubbleType)
        AC_NO_BUBBLE()
autofill::AutofillBubbleBase* ACAutofillBubbleHandler::
    ShowSaveCardConfirmationBubble(
        content::WebContents* web_contents,
        autofill::SaveCardBubbleController* controller) {
  return ShowSaveCardPrompt(web_contents, controller);
}
autofill::AutofillBubbleBase* ACAutofillBubbleHandler::
    ShowSaveIbanConfirmationBubble(content::WebContents*,
                                   autofill::IbanBubbleController*)
        AC_NO_BUBBLE()
autofill::AutofillBubbleBase* ACAutofillBubbleHandler::
    ShowOmniboxAutofillBubble(content::WebContents*,
                              autofill::OmniboxAutofillBubbleController*)
        AC_NO_BUBBLE()
autofill::AutofillBubbleBase* ACAutofillBubbleHandler::
    ShowPaymentsChurnedUsersBubble(
        content::WebContents*,
        autofill::PaymentsChurnedUsersBubbleController*,
        bool) AC_NO_BUBBLE()
autofill::AutofillBubbleBase* ACAutofillBubbleHandler::
    ShowPaymentsChurnedUsersConfirmationBubble(
        content::WebContents*,
        autofill::PaymentsChurnedUsersBubbleController*) AC_NO_BUBBLE()
autofill::AutofillBubbleBase* ACAutofillBubbleHandler::
    ShowWalletReminderNoticeBubble(
        content::WebContents*,
        autofill::WalletReminderNoticeBubbleController*,
        bool) AC_NO_BUBBLE()
#undef AC_NO_BUBBLE

namespace {

std::set<const BrowserWindow*>& LiveWindows() {
  static base::NoDestructor<std::set<const BrowserWindow*>> windows;
  return *windows;
}
std::map<const BrowserWindowInterface*, base::WeakPtr<WindowHost>>& Records() {
  static base::NoDestructor<
      std::map<const BrowserWindowInterface*, base::WeakPtr<WindowHost>>>
      records;
  return *records;
}

}

ACBrowserWindow* ACBrowserWindow::FromWindow(const BrowserWindow* window) {
  if (!window || !LiveWindows().contains(window)) {
    return nullptr;
  }
  return static_cast<ACBrowserWindow*>(const_cast<BrowserWindow*>(window));
}

void ACBrowserWindow::Register(const BrowserWindowInterface* browser) {
  Records()[browser] = host_;
}

bool ACBrowserWindow::IsOurs(const BrowserWindowInterface* browser) {
  return browser && Records().contains(browser);
}

WindowHost* ACBrowserWindow::HostOf(const BrowserWindowInterface* browser) {
  auto it = browser ? Records().find(browser) : Records().end();
  return it == Records().end() ? nullptr : it->second.get();
}

void ACBrowserWindow::Forget(const BrowserWindowInterface* browser) {
  Records().erase(browser);
}

ACBrowserWindow::ACBrowserWindow(base::WeakPtr<WindowHost> host)
    : host_(std::move(host)), location_bar_(std::make_unique<ACLocationBar>()) {
  LiveWindows().insert(this);
}

ACBrowserWindow::~ACBrowserWindow() {
  LiveWindows().erase(this);
  extension_shortcuts_.reset();
  DestroyAnyExclusiveAccessBubble();
  devtools_ui_controller_.reset();
  autofill_bubble_handler_registration_.reset();
  if (browser_) {
    browser_->GetFeatures().TearDownPreBrowserWindowDestruction();
  }
  if (host_) {
    host_->BrowserWindowDestroyed(this);
  }
}

void ACBrowserWindow::AttachBrowser(Browser* browser) {
  browser_ = browser;
  Register(browser);
  autofill_bubble_handler_registration_.emplace(
      browser->GetUnownedUserDataHost(), autofill_bubble_handler_);
  location_bar_->set_browser(browser);
  devtools_ui_controller_ = std::make_unique<DevtoolsUIController>(
      browser,
      std::vector<raw_ptr<ContentsContainerView, DanglingUntriaged>>());
  extension_shortcuts_ = std::make_unique<ExtensionShortcuts>(browser);
}

bool ACBrowserWindow::HandleExtensionKeyEquivalent(NSEvent* event) {
  if (!extension_shortcuts_ || !host_ || event.type != NSEventTypeKeyDown) {
    return false;
  }
  const ui::Accelerator accelerator = ExtensionShortcuts::AcceleratorFor(event);
  return extension_shortcuts_->Run(accelerator);
}

void ACBrowserWindow::DeleteBrowserWindow() {
  delete this;
}

bool ACBrowserWindow::IsActive() const {
  if (!host_ || !host_->widget()) {
    return false;
  }
  return host_->widget()->IsActive() && host_->IsActiveBrowser(browser_);
}

bool ACBrowserWindow::IsMaximized() const {
  return host_ && host_->widget() && host_->widget()->IsMaximized();
}

bool ACBrowserWindow::IsMinimized() const {
  return host_ && host_->widget() && host_->widget()->IsMinimized();
}

bool ACBrowserWindow::IsFullscreen() const {
  if (tab_fullscreen_ ||
      (host_ && (host_->acted_fullscreen() ||
                 (host_->widget() && host_->widget()->IsFullscreen())))) {
    return true;
  }
  ExclusiveAccessManager* manager =
      browser_ ? ExclusiveAccessManager::From(browser_) : nullptr;
  return manager && manager->fullscreen_controller()->IsTabFullscreen();
}

gfx::NativeWindow ACBrowserWindow::GetNativeWindow() const {
  return host_ && host_->widget() ? host_->widget()->GetNativeWindow()
                                  : gfx::NativeWindow();
}

gfx::Rect ACBrowserWindow::GetRestoredBounds() const {
  return host_ && host_->widget() ? host_->widget()->GetRestoredBounds()
                                  : gfx::Rect();
}

ui::mojom::WindowShowState ACBrowserWindow::GetRestoredState() const {
  return ui::mojom::WindowShowState::kNormal;
}

gfx::Rect ACBrowserWindow::GetBounds() const {
  return host_ && host_->widget() ? host_->widget()->GetWindowBoundsInScreen()
                                  : gfx::Rect();
}

namespace {

void RequestShow(WindowHost* host, bool active) {
  if (!host) {
    return;
  }
  AstroCoreWindow* owner = host->owner();
  id<AstroCoreWindowDelegate> delegate = owner.delegate;
  if ([delegate respondsToSelector:@selector(window:showRequestedActive:)]) {
    [delegate window:owner showRequestedActive:active];
  }
}

}

void ACBrowserWindow::Show() {
  RequestShow(host_.get(), true);
}

bool ACBrowserWindow::IsVisible() const {
  return host_ && host_->widget() && host_->widget()->IsVisible() &&
         host_->IsActiveBrowser(browser_);
}

void ACBrowserWindow::ShowInactive() {
  RequestShow(host_.get(), false);
}

void ACBrowserWindow::Close() {
  if (!browser_) {
    return;
  }
  Profile* profile = browser_->GetProfile();
  closed_by_chrome_ = host_ && !host_->closing() && !browser_shutdown::IsTryingToQuit() &&
                      !IsProfileDying(profile) && !IsProfileDeleting(profile);
  UnloadController* unload = UnloadController::From(browser_);
  if (unload) {
    if ((host_ && host_->closing()) || browser_shutdown::IsTryingToQuit()) {
      CloseBlankTabsBeforeWindowCloses(browser_);
    }
    unload->OnWindowClosing();
  }
}

void ACBrowserWindow::Activate() {
  if (host_ && browser_) {
    base::SingleThreadTaskRunner::GetCurrentDefault()->PostTask(
        FROM_HERE, base::BindOnce(
                       [](base::WeakPtr<WindowHost> host,
                          base::WeakPtr<BrowserWindowInterface> browser) {
                         if (host && browser) {
                           host->RequestActivation(static_cast<Browser*>(browser.get()));
                         }
                       },
                       host_, browser_->GetWeakPtr()));
  }
}

void ACBrowserWindow::SetBounds(const gfx::Rect& bounds) {
  if (host_ && host_->widget()) {
    host_->widget()->SetBounds(bounds);
  }
}

ui::ZOrderLevel ACBrowserWindow::GetZOrderLevel() const {
  return ui::ZOrderLevel::kNormal;
}

bool ACBrowserWindow::IsOnCurrentWorkspace() const {
  return host_ && !host_->internal();
}

bool ACBrowserWindow::IsVisibleOnScreen() const {
  return IsVisible();
}

bool ACBrowserWindow::DoBrowserControlsShrinkRendererSize(
    const content::WebContents* contents) const {
  return false;
}

ui::NativeTheme* ACBrowserWindow::GetNativeTheme() {
  return ui::NativeTheme::GetInstanceForNativeUi();
}

const ui::ThemeProvider* ACBrowserWindow::GetThemeProvider() const {
  return browser_ ? &ThemeService::GetThemeProviderForProfile(
                        browser_->GetProfile())
                  : nullptr;
}

const ui::ColorProvider* ACBrowserWindow::GetColorProvider() const {
  if (host_ && host_->widget()) {
    return host_->widget()->GetColorProvider();
  }
  return ui::ColorProviderManager::Get().GetColorProviderFor(
      ui::ColorProviderKey());
}

int ACBrowserWindow::GetTopControlsHeight() const {
  return 0;
}

std::vector<StatusBubble*> ACBrowserWindow::GetStatusBubbles() {
  return {};
}

void ACBrowserWindow::OnActiveTabChanged(content::WebContents* old_contents,
                                         content::WebContents* new_contents,
                                         int index,
                                         int reason) {
  if (host_ && browser_) {
    host_->ActiveTabChanged(browser_, new_contents);
  }
}

gfx::Size ACBrowserWindow::GetContentsSize() const {
  if (!host_ || !host_->host_view()) {
    return gfx::Size();
  }
  NSSize size = host_->host_view().bounds.size;
  return gfx::Size(size.width, size.height);
}

autofill::AutofillBubbleHandler* ACBrowserWindow::GetAutofillBubbleHandler() {
  return &autofill_bubble_handler_;
}

LocationBar* ACBrowserWindow::GetLocationBar() const {
  return location_bar_.get();
}

bool ACBrowserWindow::UpdateToolbarSecurityState() {
  return false;
}

bool ACBrowserWindow::IsTabStripEditable() const {
  return true;
}

bool ACBrowserWindow::IsToolbarVisible() const {
  return false;
}

bool ACBrowserWindow::IsToolbarShowing() const {
  return false;
}

bool ACBrowserWindow::IsLocationBarVisible() const {
  return false;
}

ShowTranslateBubbleResult ACBrowserWindow::ShowTranslateBubble(
    content::WebContents* contents,
    translate::TranslateStep step,
    const std::string& source_language,
    const std::string& target_language,
    translate::TranslateErrors error_type,
    bool is_user_gesture) {
  return ShowTranslateBubbleResult::kBrowserWindowNotValid;
}

DownloadBubbleUIController* ACBrowserWindow::GetDownloadBubbleUIController() {
  return nullptr;
}

void ACBrowserWindow::ConfirmBrowserCloseWithPendingDownloads(
    int download_count,
    DownloadCloseType dialog_type,
    base::OnceCallback<void(bool)> callback) {
  if (host_ && !host_->closing() && !IsQuitting()) {
    host_->ConfirmCloseWithDownloads(download_count, std::move(callback));
    return;
  }
  base::SingleThreadTaskRunner::GetCurrentDefault()->PostTask(
      FROM_HERE, base::BindOnce(std::move(callback), true));
}

namespace {

bool MenuHasKeyEquivalent(NSMenu* menu, NSEvent* event) {
  const NSEventModifierFlags mask =
      NSEventModifierFlagCommand | NSEventModifierFlagOption |
      NSEventModifierFlagControl | NSEventModifierFlagShift;
  const NSEventModifierFlags flags = event.modifierFlags & mask;
  NSString* chars = event.charactersIgnoringModifiers.lowercaseString;
  for (NSMenuItem* item in menu.itemArray) {
    if (item.hasSubmenu) {
      if (MenuHasKeyEquivalent(item.submenu, event)) {
        return true;
      }
      continue;
    }
    NSString* key = item.keyEquivalent;
    if (!key.length) {
      continue;
    }
    NSEventModifierFlags item_flags = item.keyEquivalentModifierMask & mask;
    if (![key isEqualToString:key.lowercaseString]) {
      item_flags |= NSEventModifierFlagShift;
    }
    if (item_flags == flags && [key.lowercaseString isEqualToString:chars]) {
      return true;
    }
  }
  return false;
}

NSEvent* UnhandledKeyDown(const input::NativeWebKeyboardEvent& event) {
  if (event.skip_if_unhandled ||
      event.GetType() == input::NativeWebKeyboardEvent::Type::kChar) {
    return nil;
  }
  NSEvent* ns_event = event.os_event.Get();
  return ns_event.type == NSEventTypeKeyDown ? ns_event : nil;
}

}

content::KeyboardEventProcessingResult ACBrowserWindow::PreHandleKeyboardEvent(
    const input::NativeWebKeyboardEvent& event) {
  NSEvent* ns_event = event.os_event.Get();
  if (!ns_event || ns_event.type != NSEventTypeKeyDown || !host_) {
    return content::KeyboardEventProcessingResult::NOT_HANDLED;
  }
  AstroCoreWindow* owner = host_->owner();
  id<AstroCoreWindowDelegate> delegate = owner.delegate;
  if ([delegate respondsToSelector:@selector(window:preHandleKeyEvent:)] &&
      [delegate window:owner preHandleKeyEvent:ns_event]) {
    return content::KeyboardEventProcessingResult::HANDLED;
  }
  if (extension_shortcuts_ &&
      extension_shortcuts_->Run(ui::GetAcceleratorFromNativeWebKeyboardEvent(event))) {
    return content::KeyboardEventProcessingResult::HANDLED;
  }
  if ((ns_event.modifierFlags & NSEventModifierFlagCommand) &&
      MenuHasKeyEquivalent(NSApp.mainMenu, ns_event)) {
    return content::KeyboardEventProcessingResult::NOT_HANDLED_IS_SHORTCUT;
  }
  return content::KeyboardEventProcessingResult::NOT_HANDLED;
}

bool ACBrowserWindow::HandleKeyboardEvent(
    const input::NativeWebKeyboardEvent& event) {
  NSEvent* ns_event = UnhandledKeyDown(event);
  if (!ns_event || !host_) {
    return false;
  }
  AstroCoreWindow* owner = host_->owner();
  id<AstroCoreWindowDelegate> delegate = owner.delegate;
  if ([delegate respondsToSelector:@selector(window:handleKeyEvent:)] &&
      [delegate window:owner handleKeyEvent:ns_event]) {
    return true;
  }
  if (!(ns_event.modifierFlags & (NSEventModifierFlagCommand | NSEventModifierFlagControl |
                                  NSEventModifierFlagFunction))) {
    return false;
  }
  return [NSApp.mainMenu performKeyEquivalent:ns_event];
}

std::unique_ptr<FindBar> ACBrowserWindow::CreateFindBar() {
  return std::make_unique<ACFindBar>();
}

ACFindBar::ACFindBar() = default;
ACFindBar::~ACFindBar() = default;
FindBarController* ACFindBar::GetFindBarController() const {
  return controller_;
}
void ACFindBar::SetFindBarController(FindBarController* controller) {
  controller_ = controller;
}
void ACFindBar::Show(bool animate, bool focus) {
  visible_ = true;
}
void ACFindBar::Hide(bool animate) {
  visible_ = false;
}
void ACFindBar::SetFindTextAndSelectedRange(const std::u16string& find_text,
                                            const gfx::Range& selected_range) {
  find_text_ = find_text;
}
std::u16string_view ACFindBar::GetFindText() const {
  return find_text_;
}
gfx::Range ACFindBar::GetSelectedRange() const {
  return gfx::Range();
}
bool ACFindBar::IsFindBarVisible() const {
  return visible_;
}
bool ACFindBar::HasGlobalFindPasteboard() const {
  return true;
}
bool ACFindBar::CanPopulateFromSelectedText() {
  return true;
}
const FindBarTesting* ACFindBar::GetFindBarTesting() const {
  return nullptr;
}
bool ACFindBar::HasFocus() const {
  return false;
}
views::Widget* ACFindBar::GetHostWidget() {
  return nullptr;
}

web_modal::WebContentsModalDialogHost*
ACBrowserWindow::GetWebContentsModalDialogHost() {
  return host_.get();
}

web_modal::WebContentsModalDialogHost*
ACBrowserWindow::GetWebContentsModalDialogHostFor(
    content::WebContents* web_contents) {
  if (web_contents && tabs::TabInterface::MaybeGetFromContents(web_contents)) {
    return ACTabDialogHost::GetOrCreateForWebContents(web_contents);
  }
  return host_.get();
}

ExclusiveAccessContext* ACBrowserWindow::GetExclusiveAccessContext() {
  return this;
}

Profile* ACBrowserWindow::GetProfile() {
  return browser_ ? browser_->GetProfile() : nullptr;
}

void ACBrowserWindow::EnterFullscreen(const url::Origin& origin,
                                      ExclusiveAccessBubbleType bubble_type,
                                      FullscreenTabParams fullscreen_tab_params) {
  tab_fullscreen_ = true;
  base::WeakPtr<ACBrowserWindow> self = weak_factory_.GetWeakPtr();
  ReportFullscreenTab();
  if (self) {
    PostWindowFullscreenStateChanged();
  }
}

void ACBrowserWindow::ExitFullscreen() {
  tab_fullscreen_ = false;
  ReportFullscreenTab();
}

void ACBrowserWindow::PostWindowFullscreenStateChanged() {
  base::SingleThreadTaskRunner::GetCurrentDefault()->PostTask(
      FROM_HERE, base::BindOnce(
                     [](base::WeakPtr<ACBrowserWindow> window) {
                       ExclusiveAccessManager* manager =
                           window ? window->GetExclusiveAccessManager()
                                  : nullptr;
                       if (manager && window->tab_fullscreen_) {
                         manager->fullscreen_controller()
                             ->WindowFullscreenStateChanged();
                       }
                     },
                     weak_factory_.GetWeakPtr()));
}

void ACBrowserWindow::UpdateExclusiveAccessBubble(
    const ExclusiveAccessBubbleParams& params,
    ExclusiveAccessBubbleHideCallback first_hide_callback) {
  base::WeakPtr<ACBrowserWindow> self = weak_factory_.GetWeakPtr();
  ReportFullscreenTab();
  if (!self) {
    return;
  }
  const bool can_show = host_ && host_->widget() && browser_ &&
                        GetExclusiveAccessManager();
  const bool should_close_bubble =
      !can_show ||
      (!params.has_download && params.type == EXCLUSIVE_ACCESS_BUBBLE_TYPE_NONE);
  if (should_close_bubble) {
    if (first_hide_callback) {
      std::move(first_hide_callback)
          .Run(ExclusiveAccessBubbleHideReason::kNotShown);
    }
    if (!exclusive_access_bubble_ ||
        exclusive_access_bubble_destruction_task_id_) {
      return;
    }
    exclusive_access_bubble_->HideImmediately();
    exclusive_access_bubble_destruction_task_id_ =
        exclusive_access_bubble_task_tracker_.PostTask(
            base::SingleThreadTaskRunner::GetCurrentDefault().get(), FROM_HERE,
            base::BindOnce(&ACBrowserWindow::DestroyAnyExclusiveAccessBubble,
                           weak_factory_.GetWeakPtr()));
    return;
  }
  if (exclusive_access_bubble_) {
    if (exclusive_access_bubble_destruction_task_id_) {
      exclusive_access_bubble_task_tracker_.TryCancel(
          *exclusive_access_bubble_destruction_task_id_);
      exclusive_access_bubble_destruction_task_id_.reset();
    }
    exclusive_access_bubble_->Update(params, std::move(first_hide_callback));
    return;
  }
  exclusive_access_bubble_ = std::make_unique<ExclusiveAccessBubbleViews>(
      this, params, std::move(first_hide_callback));
}

void ACBrowserWindow::OnExclusiveAccessUserInput() {
  if (exclusive_access_bubble_) {
    exclusive_access_bubble_->OnUserInput();
  }
}

ExclusiveAccessManager* ACBrowserWindow::GetExclusiveAccessManager() {
  return browser_ ? ExclusiveAccessManager::From(browser_)
                  : nullptr;
}

ui::AcceleratorProvider* ACBrowserWindow::GetAcceleratorProvider() {
  return this;
}

bool ACBrowserWindow::GetAcceleratorForCommandId(
    int command_id,
    ui::Accelerator* accelerator) const {
  if (command_id != IDC_FULLSCREEN) {
    return false;
  }
  *accelerator =
      ui::Accelerator(ui::VKEY_F, ui::EF_CONTROL_DOWN | ui::EF_COMMAND_DOWN);
  return true;
}

gfx::NativeView ACBrowserWindow::GetBubbleParentView() const {
  return host_ && host_->widget() ? host_->widget()->GetNativeView()
                                  : gfx::NativeView();
}

gfx::Rect ACBrowserWindow::GetClientAreaBoundsInScreen() const {
  return host_ && host_->widget()
             ? host_->widget()->GetClientAreaBoundsInScreen()
             : gfx::Rect();
}

bool ACBrowserWindow::IsImmersiveModeEnabled() const {
  return false;
}

gfx::Rect ACBrowserWindow::GetTopContainerBoundsInScreen() {
  return gfx::Rect();
}

void ACBrowserWindow::RepositionExclusiveAccessBubble() {
  if (exclusive_access_bubble_) {
    exclusive_access_bubble_->RepositionIfVisible();
  }
}

void ACBrowserWindow::DestroyAnyExclusiveAccessBubble() {
  exclusive_access_bubble_.reset();
  exclusive_access_bubble_destruction_task_id_.reset();
}

void ACBrowserWindow::ReportFullscreenTab() {
  ExclusiveAccessManager* manager =
      browser_ ? ExclusiveAccessManager::From(browser_) : nullptr;
  FullscreenController* controller =
      manager ? manager->fullscreen_controller() : nullptr;
  content::WebContents* now = controller && controller->IsTabFullscreen()
                                  ? controller->exclusive_access_tab()
                                  : nullptr;
  content::WebContents* was = fullscreen_tab_.get();
  if (now == was) {
    return;
  }
  fullscreen_tab_ = now ? now->GetWeakPtr() : nullptr;
  if (!host_ || !browser_) {
    return;
  }
  base::WeakPtr<content::WebContents> entering = fullscreen_tab_;
  if (was) {
    base::SingleThreadTaskRunner::GetCurrentDefault()->PostTask(
        FROM_HERE, base::BindOnce(
                       [](base::WeakPtr<content::WebContents> left) {
                         content::RenderWidgetHostView* view =
                             left ? left->GetRenderWidgetHostView() : nullptr;
                         if (view && !left->IsFullscreen()) {
                           view->GetRenderWidgetHost()
                               ->SynchronizeVisualProperties();
                         }
                       },
                       was->GetWeakPtr()));
    host_->FullscreenChanged(was, false);
  }
  if (content::WebContents* contents = entering.get();
      contents && contents == fullscreen_tab_.get() && host_) {
    host_->FullscreenChanged(contents, true);
  }
}

bool ACBrowserWindow::IsExclusiveAccessBubbleDisplayed() const {
  return exclusive_access_bubble_ && (exclusive_access_bubble_->IsShowing() ||
                                      exclusive_access_bubble_->IsVisible());
}

content::WebContents* ACBrowserWindow::GetWebContentsForExclusiveAccess() {
  return browser_ ? browser_->GetTabStripModel()->GetActiveWebContents()
                  : nullptr;
}

bool ACBrowserWindow::CanUserEnterFullscreen() const {
  return true;
}

bool ACBrowserWindow::CanUserExitFullscreen() const {
  return true;
}

std::string ACBrowserWindow::GetWorkspace() const {
  return std::string();
}

bool ACBrowserWindow::IsVisibleOnAllWorkspaces() const {
  return false;
}

void ACBrowserWindow::ShowEmojiPanel() {
  base::WeakPtr<ACBrowserWindow> self = weak_factory_.GetWeakPtr();
  if (content::WebContents* contents =
          browser_ ? browser_->GetTabStripModel()->GetActiveWebContents()
                   : nullptr) {
    if (!contents->ForSecurityDropFullscreen(display::kInvalidDisplayId) ||
        !self) {
      return;
    }
  }
  if (host_ && host_->widget()) {
    host_->widget()->ShowEmojiPanel();
    return;
  }
  [NSApp orderFrontCharacterPalette:nil];
}

namespace {

class BackgroundEyeDropper : public content::EyeDropper {
 public:
  explicit BackgroundEyeDropper(content::EyeDropperListener* listener)
      : listener_(listener) {
    LOG(WARNING) << "[astrocore] eye dropper (background run: picks #123456)";
    base::SingleThreadTaskRunner::GetCurrentDefault()->PostTask(
        FROM_HERE, base::BindOnce(&BackgroundEyeDropper::Pick,
                                  weak_factory_.GetWeakPtr()));
  }

 private:
  void Pick() { listener_->ColorSelected(SkColorSetRGB(0x12, 0x34, 0x56)); }

  raw_ptr<content::EyeDropperListener> listener_;
  base::WeakPtrFactory<BackgroundEyeDropper> weak_factory_{this};
};

}

std::unique_ptr<content::EyeDropper> ACBrowserWindow::OpenEyeDropper(
    content::RenderFrameHost* frame,
    content::EyeDropperListener* listener) {
  const char* background = getenv("ASTRO_BACKGROUND");
  if (background && !strcmp(background, "1") && listener) {
    return features::IsEyeDropperEnabled()
               ? std::make_unique<BackgroundEyeDropper>(listener)
               : nullptr;
  }
  return ShowEyeDropper(frame, listener);
}

bool ACBrowserWindow::IsUnframedModeEnabled() const {
  return false;
}

bool ACBrowserWindow::GetCanResize() {
  return true;
}

ui::mojom::WindowShowState ACBrowserWindow::GetWindowShowState() const {
  if (IsMinimized()) {
    return ui::mojom::WindowShowState::kMinimized;
  }
  if (IsFullscreen()) {
    return ui::mojom::WindowShowState::kFullscreen;
  }
  return ui::mojom::WindowShowState::kNormal;
}

BrowserView* ACBrowserWindow::AsBrowserView() {
  return nullptr;
}

}
