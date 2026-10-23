// Copyright 2026 Oxy. Apache-2.0.

#include "chrome/browser/astro/ac_extension_views.h"

#include <map>
#include <memory>
#include <optional>
#include <string>
#include <utility>

#include "base/functional/bind.h"
#include "base/logging.h"
#include "base/memory/raw_ptr.h"
#include "base/memory/weak_ptr.h"
#include "base/no_destructor.h"
#include "base/scoped_observation.h"
#include "base/task/single_thread_task_runner.h"
#include "base/time/time.h"
#include "base/timer/timer.h"
#include "chrome/browser/astro/ac_host.h"
#include "chrome/browser/extensions/extension_view.h"
#include "chrome/browser/extensions/extension_view_host.h"
#include "chrome/browser/extensions/extension_view_host_factory.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/profiles/profile_observer.h"
#include "chrome/browser/ui/browser.h"
#include "chrome/browser/ui/browser_web_contents_delegate/browser_web_contents_delegate.h"
#include "chrome/browser/ui/browser_window/public/browser_collection_observer.h"
#include "chrome/browser/ui/browser_window/public/browser_window_interface.h"
#include "chrome/browser/ui/browser_window/public/global_browser_collection.h"
#include "chrome/browser/ui/extensions/extension_popup_types.h"
#include "components/guest_contents/browser/guest_contents_handle.h"
#include "components/tabs/public/tab_interface.h"
#include "content/public/browser/render_frame_host.h"
#include "content/public/browser/render_widget_host_view.h"
#include "content/public/browser/web_contents.h"
#include "content/public/browser/web_contents_observer.h"
#include "extensions/browser/extension_host_registry.h"
#include "extensions/browser/extension_registry.h"
#include "extensions/browser/extension_registry_observer.h"
#include "extensions/browser/extension_util.h"
#include "extensions/common/constants.h"
#include "extensions/common/extension.h"
#include "ui/gfx/geometry/size.h"
#include "url/gurl.h"

extern std::optional<bool> (*g_astro_open_action_popup)(
    BrowserWindowInterface& browser,
    const extensions::Extension& extension,
    ShowPopupCallback& callback,
    std::string* error);

extern bool (*g_astro_extension_side_panel)(
    BrowserWindowInterface* browser_window,
    content::WebContents* web_contents,
    const extensions::ExtensionId& extension_id,
    bool open);

namespace astro {
namespace {

class HostedView;

std::map<int, std::unique_ptr<HostedView>>& Views() {
  static base::NoDestructor<std::map<int, std::unique_ptr<HostedView>>> views;
  return *views;
}

void Destroy(int id);

Browser* ChromeBrowser(BrowserWindowInterface* browser) {
  return static_cast<Browser*>(browser);
}

class HostedView : public extensions::ExtensionView,
                   public content::WebContentsObserver,
                   public BrowserCollectionObserver,
                   public extensions::ExtensionRegistryObserver,
                   public extensions::ExtensionHostRegistry::Observer,
                   public ProfileObserver {
 public:
  HostedView(int id,
             std::unique_ptr<extensions::ExtensionViewHost> host,
             BrowserWindowInterface* browser,
             bool popup)
      : id_(id), host_(std::move(host)), browser_(browser), popup_(popup) {
    host_->set_view(this);
    Observe(host_->host_contents());
    host_->SetCloseHandler(base::BindOnce(&HostedView::ClosedByChrome,
                                          weak_factory_.GetWeakPtr()));
    browser_observation_.Observe(GlobalBrowserCollection::GetInstance());
    content::BrowserContext* context = host_->browser_context();
    registry_observation_.Observe(extensions::ExtensionRegistry::Get(context));
    hosts_observation_.Observe(extensions::ExtensionHostRegistry::Get(context));
    profile_observation_.Observe(Profile::FromBrowserContext(context));
  }
  HostedView(const HostedView&) = delete;
  HostedView& operator=(const HostedView&) = delete;
  ~HostedView() override {
    Observe(nullptr);
    FailShown();
  }

  content::WebContents* contents() const { return host_->host_contents(); }
  BrowserWindowInterface* browser() const { return browser_; }
  const std::string& extension_id() const { return host_->extension_id(); }
  const gfx::Size& preferred_size() const { return preferred_size_; }

  void set_shown_callback(ShowPopupCallback callback) {
    FailShown();
    shown_callback_ = std::move(callback);
    if (host_->has_loaded_once()) {
      OnLoaded();
    }
  }
  void Start() { host_->CreateRendererSoon(); }

  void ScheduleDestroy() {
    if (destroy_scheduled_) {
      return;
    }
    destroy_scheduled_ = true;
    FailShown();
    base::SingleThreadTaskRunner::GetCurrentDefault()->PostTask(
        FROM_HERE, base::BindOnce(&Destroy, id_));
  }

  void ReportClosed() {
    if (!closed_by_host_ && contents()) {
      HostTabEvent(contents(), "windowClose", base::DictValue());
    }
  }

  void set_closed_by_host() { closed_by_host_ = true; }

  gfx::NativeView GetNativeView() override {
    return contents()->GetNativeView();
  }
  void ResizeDueToAutoResize(content::WebContents* web_contents,
                             const gfx::Size& new_size) override {
    if (!popup_ || new_size == preferred_size_) {
      return;
    }
    preferred_size_ = new_size;
    HostTabEvent(contents(), "preferredSize",
                 base::DictValue()
                     .Set("width", new_size.width())
                     .Set("height", new_size.height()));
  }
  void RenderFrameCreated(content::RenderFrameHost* render_frame_host) override {
    if (render_frame_host == contents()->GetPrimaryMainFrame()) {
      EnableAutoResize(render_frame_host);
    }
  }
  bool HandleKeyboardEvent(
      content::WebContents* source,
      const input::NativeWebKeyboardEvent& event) override {
    Browser* browser = browser_ ? ChromeBrowser(browser_) : nullptr;
    return browser && BrowserWebContentsDelegate::From(browser)
                          ->HandleKeyboardEvent(source, event);
  }
  void OnLoaded() override {
    if (!shown_callback_) {
      return;
    }
    std::move(shown_callback_)
        .Run(host_->document_element_available() ? host_.get() : nullptr);
  }

  void RenderFrameHostChanged(content::RenderFrameHost* old_host,
                              content::RenderFrameHost* new_host) override {
    if (old_host && new_host == contents()->GetPrimaryMainFrame() &&
        new_host->IsRenderFrameLive()) {
      EnableAutoResize(new_host);
    }
  }

  void OnBrowserClosed(BrowserWindowInterface* browser) override {
    if (browser != browser_) {
      return;
    }
    browser_ = nullptr;
    CloseNow();
  }

  void OnExtensionUnloaded(content::BrowserContext*,
                           const extensions::Extension* extension,
                           extensions::UnloadedExtensionReason) override {
    if (extension->id() == host_->extension_id()) {
      CloseNow();
    }
  }

  void OnExtensionHostRenderProcessGone(
      content::BrowserContext*,
      extensions::ExtensionHost* extension_host) override {
    if (extension_host == host_.get()) {
      ReportClosed();
      ScheduleDestroy();
    }
  }

  void OnProfileWillBeDestroyed(Profile*) override { CloseNow(); }

 private:
  void EnableAutoResize(content::RenderFrameHost* frame) {
    if (popup_ && frame->GetView()) {
      frame->GetView()->EnableAutoResize(gfx::Size(25, 25),
                                         gfx::Size(800, 600));
    }
  }

  void FailShown() {
    if (shown_callback_) {
      std::move(shown_callback_).Run(nullptr);
    }
  }

  void ClosedByChrome(extensions::ExtensionHost*) {
    ReportClosed();
    ScheduleDestroy();
  }

  void CloseNow() {
    ReportClosed();
    Destroy(id_);
  }

  const int id_;
  std::unique_ptr<extensions::ExtensionViewHost> host_;
  raw_ptr<BrowserWindowInterface> browser_;
  const bool popup_;
  bool closed_by_host_ = false;
  gfx::Size preferred_size_;
  ShowPopupCallback shown_callback_;
  bool destroy_scheduled_ = false;
  base::ScopedObservation<GlobalBrowserCollection, BrowserCollectionObserver>
      browser_observation_{this};
  base::ScopedObservation<extensions::ExtensionRegistry,
                          extensions::ExtensionRegistryObserver>
      registry_observation_{this};
  base::ScopedObservation<extensions::ExtensionHostRegistry,
                          extensions::ExtensionHostRegistry::Observer>
      hosts_observation_{this};
  base::ScopedObservation<Profile, ProfileObserver> profile_observation_{this};
  base::WeakPtrFactory<HostedView> weak_factory_{this};
};

void Destroy(int id) {
  auto it = Views().find(id);
  if (it == Views().end()) {
    return;
  }
  std::unique_ptr<HostedView> view = std::move(it->second);
  Views().erase(it);
}

class PendingPopup : public BrowserCollectionObserver {
 public:
  PendingPopup(BrowserWindowInterface* browser,
               std::string extension_id,
               ShowPopupCallback callback);
  ~PendingPopup() override = default;

  bool Matches(const BrowserWindowInterface* browser,
               const std::string& extension_id) const {
    return browser == browser_ && extension_id == extension_id_;
  }
  ShowPopupCallback TakeCallback() { return std::move(callback_); }

  void OnBrowserClosed(BrowserWindowInterface* browser) override;

 private:
  const void* browser_;
  const std::string extension_id_;
  ShowPopupCallback callback_;
  base::OneShotTimer timeout_;
  base::ScopedObservation<GlobalBrowserCollection, BrowserCollectionObserver>
      observation_{this};
  base::WeakPtrFactory<PendingPopup> weak_factory_{this};
};

std::unique_ptr<PendingPopup>& Pending() {
  static base::NoDestructor<std::unique_ptr<PendingPopup>> pending;
  return *pending;
}

void FailPending() {
  std::unique_ptr<PendingPopup> pending = std::move(Pending());
  if (!pending) {
    return;
  }
  ShowPopupCallback callback = pending->TakeCallback();
  pending.reset();
  if (callback) {
    std::move(callback).Run(nullptr);
  }
}

PendingPopup::PendingPopup(BrowserWindowInterface* browser,
                           std::string extension_id,
                           ShowPopupCallback callback)
    : browser_(browser),
      extension_id_(std::move(extension_id)),
      callback_(std::move(callback)) {
  observation_.Observe(GlobalBrowserCollection::GetInstance());
  timeout_.Start(FROM_HERE, base::Seconds(10), base::BindOnce(&FailPending));
}

void PendingPopup::OnBrowserClosed(BrowserWindowInterface* browser) {
  if (browser != browser_) {
    return;
  }
  base::SingleThreadTaskRunner::GetCurrentDefault()->PostTask(
      FROM_HERE, base::BindOnce(
                     [](base::WeakPtr<PendingPopup> pending) {
                       if (pending && Pending().get() == pending.get()) {
                         FailPending();
                       }
                     },
                     weak_factory_.GetWeakPtr()));
}

std::optional<bool> OpenActionPopup(BrowserWindowInterface& browser,
                                    const extensions::Extension& extension,
                                    ShowPopupCallback& callback,
                                    std::string* error) {
  tabs::TabInterface* tab = browser.GetActiveTabInterface();
  content::WebContents* contents = tab ? tab->GetContents() : nullptr;
  if (!contents || !HostShowsTab(contents)) {
    return std::nullopt;
  }
  FailPending();
  Pending() = std::make_unique<PendingPopup>(&browser, extension.id(),
                                             std::move(callback));
  HostTabEvent(contents, "actionPopup",
               base::DictValue().Set("extensionId", extension.id()));
  return true;
}

bool ShowSidePanel(BrowserWindowInterface* browser_window,
                   content::WebContents* web_contents,
                   const extensions::ExtensionId& extension_id,
                   bool open) {
  content::WebContents* contents = web_contents;
  if (!contents && browser_window && browser_window->GetActiveTabInterface()) {
    contents = browser_window->GetActiveTabInterface()->GetContents();
  }
  if (!contents || !HostShowsTab(contents)) {
    return false;
  }
  HostTabEvent(contents, "sidePanel",
               base::DictValue()
                   .Set("extensionId", extension_id)
                   .Set("open", open));
  return true;
}

}

std::optional<int> OpenExtensionView(BrowserWindowInterface* browser,
                                     const GURL& url,
                                     bool popup) {
  Browser* chrome_browser = browser ? ChromeBrowser(browser) : nullptr;
  if (!chrome_browser || !url.SchemeIs(extensions::kExtensionScheme)) {
    return std::nullopt;
  }
  Profile* profile = chrome_browser->GetProfile();
  const extensions::Extension* extension =
      extensions::ExtensionRegistry::Get(profile)->enabled_extensions().GetByID(
          std::string(url.host()));
  if (!extension ||
      (profile->IsOffTheRecord() &&
       !extensions::util::IsIncognitoEnabled(extension->id(), profile))) {
    return std::nullopt;
  }
  std::unique_ptr<extensions::ExtensionViewHost> host =
      popup ? extensions::ExtensionViewHostFactory::CreatePopupHost(
                  *extension, url, chrome_browser)
            : extensions::ExtensionViewHostFactory::CreateSidePanelHost(
                  *extension, url, chrome_browser, nullptr);
  if (!host) {
    return std::nullopt;
  }
  static int last_id = 0;
  const int id = ++last_id;
  auto view = std::make_unique<HostedView>(id, std::move(host), browser, popup);
  HostedView* hosted = view.get();
  guest_contents::GuestContentsHandle::CreateForWebContents(hosted->contents());
  Views()[id] = std::move(view);
  if (popup && Pending() && Pending()->Matches(browser, extension->id())) {
    ShowPopupCallback callback = Pending()->TakeCallback();
    Pending().reset();
    hosted->set_shown_callback(std::move(callback));
  }
  hosted->Start();
  return id;
}

content::WebContents* ExtensionViewContents(int id) {
  auto it = Views().find(id);
  return it == Views().end() ? nullptr : it->second->contents();
}

std::optional<std::pair<int, int>> ExtensionPopupSize(
    content::WebContents* contents) {
  for (const auto& [id, view] : Views()) {
    if (view->contents() == contents && !view->preferred_size().IsEmpty()) {
      return std::make_pair(view->preferred_size().width(),
                            view->preferred_size().height());
    }
  }
  return std::nullopt;
}

void CloseExtensionView(int id) {
  auto it = Views().find(id);
  if (it == Views().end()) {
    return;
  }
  it->second->set_closed_by_host();
  it->second->ScheduleDestroy();
}

void InstallExtensionViewHooks() {
  g_astro_open_action_popup = &OpenActionPopup;
  g_astro_extension_side_panel = &ShowSidePanel;
}

}
