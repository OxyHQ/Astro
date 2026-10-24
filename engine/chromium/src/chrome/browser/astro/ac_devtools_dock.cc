// Copyright 2026 Oxy. Apache-2.0.

#include "chrome/browser/astro/ac_devtools_dock.h"

#include <map>
#include <memory>
#include <string>
#include <utility>
#include <vector>

#include "base/memory/raw_ptr.h"
#include "base/memory/weak_ptr.h"
#include "base/no_destructor.h"
#include "base/scoped_observation.h"
#include "chrome/browser/astro/ac_host.h"
#include "chrome/browser/astro/ac_profile_tabs.h"
#include "chrome/browser/devtools/devtools_contents_resizing_strategy.h"
#include "chrome/browser/devtools/devtools_dock_side.h"
#include "chrome/browser/devtools/devtools_toggle_action.h"
#include "chrome/browser/devtools/devtools_ui_controller.h"
#include "chrome/browser/devtools/devtools_window.h"
#include "chrome/browser/ui/browser_window/public/browser_collection_observer.h"
#include "chrome/browser/ui/browser_window/public/browser_window_interface.h"
#include "chrome/browser/ui/browser_window/public/global_browser_collection.h"
#include "components/guest_contents/browser/guest_contents_handle.h"
#include "components/tabs/public/tab_interface.h"
#include "content/public/browser/web_contents.h"
#include "content/public/browser/web_contents_user_data.h"
#include "ui/gfx/geometry/rect.h"

extern void (*g_astro_devtools_dock_changed)(BrowserWindowInterface* browser,
                                             content::WebContents* inspected,
                                             content::WebContents* devtools);
extern bool (*g_astro_keeps_window_hidden)(BrowserWindowInterface* browser);

class ContentsContainerView;

namespace astro {
namespace {

class DockingControllers : public BrowserCollectionObserver {
 public:
  static DockingControllers& Get() {
    static base::NoDestructor<DockingControllers> controllers;
    return *controllers;
  }

  void Start() {
    if (observation_.IsObserving()) {
      return;
    }
    observation_.Observe(GlobalBrowserCollection::GetInstance());
    GlobalBrowserCollection::GetInstance()->ForEach(
        [this](BrowserWindowInterface* browser) {
          Ensure(browser);
          return true;
        });
  }

  void Ensure(BrowserWindowInterface* browser) {
    if (!browser ||
        browser->GetType() != BrowserWindowInterface::Type::TYPE_NORMAL ||
        DevtoolsUIController::From(browser)) {
      return;
    }
    ForgetDestroyedBrowsers();
    Docked& docked = controllers_[browser];
    docked.browser = browser->GetWeakPtr();
    docked.controller = std::make_unique<DevtoolsUIController>(
        browser,
        std::vector<raw_ptr<ContentsContainerView, DanglingUntriaged>>());
  }

  void OnBrowserCreated(BrowserWindowInterface* browser) override {
    Ensure(browser);
  }

  void OnBrowserClosed(BrowserWindowInterface* browser) override {
    controllers_.erase(browser);
  }

 private:
  struct Docked {
    base::WeakPtr<BrowserWindowInterface> browser;
    std::unique_ptr<DevtoolsUIController> controller;
  };

  void ForgetDestroyedBrowsers() {
    for (auto it = controllers_.begin(); it != controllers_.end();) {
      if (it->second.browser) {
        ++it;
        continue;
      }
      (void)it->second.controller.release();
      it = controllers_.erase(it);
    }
  }

  std::map<BrowserWindowInterface*, Docked> controllers_;
  base::ScopedObservation<GlobalBrowserCollection, BrowserCollectionObserver>
      observation_{this};
};

class DockState : public content::WebContentsUserData<DockState> {
 public:
  ~DockState() override = default;

  base::WeakPtr<content::WebContents> devtools;
  int session = 0;
  base::DictValue reported;

 private:
  friend content::WebContentsUserData<DockState>;
  explicit DockState(content::WebContents* contents)
      : content::WebContentsUserData<DockState>(*contents) {}
  WEB_CONTENTS_USER_DATA_KEY_DECL();
};

WEB_CONTENTS_USER_DATA_KEY_IMPL(DockState);

int NextSession() {
  static int last_session = 0;
  return ++last_session;
}

content::WebContents* DockedContents(
    content::WebContents* inspected,
    DevToolsContentsResizingStrategy* strategy) {
  DevToolsWindow* window =
      inspected ? DevToolsWindow::GetInstanceForInspectedWebContents(inspected)
                : nullptr;
  if (!window || !window->IsDocked()) {
    return nullptr;
  }
  return DevToolsWindow::GetInTabWebContents(inspected, strategy);
}

const char* DockSideName(devtools::DockSide side) {
  switch (side) {
    case devtools::DockSide::kLeft:
      return "left";
    case devtools::DockSide::kRight:
      return "right";
    case devtools::DockSide::kBottom:
      return "bottom";
    case devtools::DockSide::kNone:
      return "none";
  }
  return "none";
}

void DetachGuest(content::WebContents* contents) {
  if (auto* handle =
          guest_contents::GuestContentsHandle::FromWebContents(contents)) {
    handle->DetachFromOuterWebContents();
  }
}

base::DictValue Reconcile(content::WebContents* inspected) {
  DevToolsContentsResizingStrategy strategy;
  content::WebContents* devtools = DockedContents(inspected, &strategy);
  DockState* state = DockState::FromWebContents(inspected);
  if (!devtools && !state) {
    return base::DictValue().Set("open", false);
  }
  if (!state) {
    DockState::CreateForWebContents(inspected);
    state = DockState::FromWebContents(inspected);
  }
  if (state->devtools.get() != devtools) {
    if (content::WebContents* previous = state->devtools.get()) {
      DetachGuest(previous);
    }
    state->devtools = devtools ? devtools->GetWeakPtr()
                               : base::WeakPtr<content::WebContents>();
    state->session = devtools ? NextSession() : 0;
  }
  if (!devtools) {
    return base::DictValue().Set("open", false);
  }
  auto* handle =
      guest_contents::GuestContentsHandle::CreateForWebContents(devtools);
  const gfx::Rect& bounds = strategy.bounds();
  return base::DictValue()
      .Set("open", true)
      .Set("guestId", handle->id().ToString())
      .Set("session", state->session)
      .Set("dockSide", DockSideName(strategy.dock_side()))
      .Set("hideInspected", strategy.hide_inspected_contents())
      .Set("bounds", base::DictValue()
                         .Set("x", bounds.x())
                         .Set("y", bounds.y())
                         .Set("width", bounds.width())
                         .Set("height", bounds.height()));
}

void DockChanged(BrowserWindowInterface*,
                 content::WebContents* inspected,
                 content::WebContents*) {
  if (!inspected) {
    return;
  }
  base::DictValue payload = Reconcile(inspected);
  DockState* state = DockState::FromWebContents(inspected);
  if (state) {
    if (state->reported == payload) {
      return;
    }
    state->reported = payload.Clone();
  }
  HostTabEvent(inspected, "devTools", std::move(payload));
}

bool KeepsWindowHidden(BrowserWindowInterface* browser) {
  return IsProfileTabHost(browser);
}

void EnsureDockable(content::WebContents* contents) {
  tabs::TabInterface* tab = tabs::TabInterface::MaybeGetFromContents(contents);
  if (tab && tab->GetBrowserWindowInterface()) {
    DockingControllers::Get().Ensure(tab->GetBrowserWindowInterface());
  }
}

}

void InstallDockedDevTools() {
  g_astro_devtools_dock_changed = &DockChanged;
  g_astro_keeps_window_hidden = &KeepsWindowHidden;
  DockingControllers::Get().Start();
}

void ShowDevTools(content::WebContents* contents, const std::string& panel) {
  if (!contents) {
    return;
  }
  EnsureDockable(contents);
  if (panel == "toggle") {
    if (content::WebContents* docked = DockedContents(contents, nullptr)) {
      docked->DispatchBeforeUnload(false);
      return;
    }
    DevToolsWindow::OpenDevToolsWindow(
        contents, DevToolsToggleAction::Show(),
        DevToolsOpenedByAction::kMainMenuOrMainShortcut);
    return;
  }
  if (panel == "inspect") {
    DevToolsWindow::OpenDevToolsWindow(
        contents, DevToolsToggleAction::Inspect(),
        DevToolsOpenedByAction::kMainMenuOrMainShortcut);
    return;
  }
  if (panel == "console") {
    DevToolsWindow::OpenDevToolsWindow(
        contents, DevToolsToggleAction::ShowConsolePanel(),
        DevToolsOpenedByAction::kMainMenuOrMainShortcut);
    return;
  }
  DevToolsWindow::OpenDevToolsWindow(
      contents,
      panel == "elements" ? DevToolsToggleAction::ShowElementsPanel()
                          : DevToolsToggleAction::Show(),
      DevToolsOpenedByAction::kUnknown);
}

base::DictValue DockedDevToolsState(content::WebContents* inspected) {
  base::DictValue state = Reconcile(inspected);
  if (DockState* dock = DockState::FromWebContents(inspected)) {
    dock->reported = state.Clone();
  }
  return state;
}

}
