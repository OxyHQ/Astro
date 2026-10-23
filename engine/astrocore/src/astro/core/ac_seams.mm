#include "astro/core/ac_seams.h"

#include <memory>

#include "base/functional/callback.h"
#include "chrome/browser/lifetime/browser_shutdown.h"
#include "chrome/browser/ui/browser_window/public/browser_window_interface.h"
#include "chrome/browser/ui/browser_window/public/global_browser_collection.h"
#include "components/permissions/chooser_controller.h"
#include "components/tabs/public/tab_interface.h"
#include "content/public/browser/web_contents.h"
#include "extensions/browser/extension_install_prompt_client.h"
#include "extensions/common/extension_id.h"
#include "astro/core/ac_hooks.h"
#include "astro/core/ac_browser.h"
#include "astro/core/ac_cast_dialog.h"
#include "astro/core/ac_browser_window.h"
#include "astro/core/ac_device_chooser.h"

namespace astrocore {

namespace {

bool HandlePasswordBubble(content::WebContents* web_contents) {
  WindowHost* host = WindowHost::ForBrowser(
      GlobalBrowserCollection::GetInstance()->FindBrowserWithTab(web_contents));
  return host && host->OfferPasswordSave(web_contents);
}

bool HandleExtensionSidePanel(BrowserWindowInterface* browser_window,
                              content::WebContents* web_contents,
                              const extensions::ExtensionId& extension_id,
                              bool open) {
  content::WebContents* contents = web_contents;
  if (!contents && browser_window && browser_window->GetActiveTabInterface()) {
    contents = browser_window->GetActiveTabInterface()->GetContents();
  }
  BrowserWindowInterface* browser =
      contents ? GlobalBrowserCollection::GetInstance()->FindBrowserWithTab(contents)
               : browser_window;
  if (!contents || !WindowHost::ForBrowser(browser)) {
    return false;
  }
  return HostExtensionSidePanel(contents, extension_id, open);
}

bool IsHiddenFromExtensions(const BrowserWindowInterface* browser) {
  WindowHost* host = WindowHost::ForBrowser(browser);
  return host && host->internal();
}

bool KeepsWindowWithoutTabs(const BrowserWindowInterface* browser) {
  WindowHost* host = WindowHost::ForBrowser(browser);
  return host && !host->closing() && !browser_shutdown::IsTryingToQuit();
}

std::unique_ptr<BrowserWebContentsDelegate> CreateWebContentsDelegate(
    BrowserWindowInterface* browser,
    ExclusiveAccessManager& exclusive_access_manager,
    chrome::BrowserCommandController& command_controller,
    UnloadController& unload_controller,
    web_app::AppBrowserController* app_browser_controller,
    BrowserWindow& window,
    DesktopBrowserWindowCapabilities& capabilities,
    BrowserUiController& browser_ui_controller) {
  ACBrowserWindow* ours = ACBrowserWindow::FromWindow(&window);
  if (!ours) {
    return nullptr;
  }
  ours->Register(browser);
  return std::make_unique<ACWebContentsDelegate>(
      browser, exclusive_access_manager, command_controller, unload_controller,
      app_browser_controller, window, capabilities, browser_ui_controller,
      ours->host_weak());
}

void DevToolsDockChanged(BrowserWindowInterface* browser,
                         content::WebContents* inspected,
                         content::WebContents* devtools) {
  if (WindowHost* host = WindowHost::ForBrowser(browser)) {
    host->DevToolsDockChanged(inspected, devtools);
  }
}

}

void InstallChromeHooks() {
  g_astro_password_bubble = &HandlePasswordBubble;
  g_astro_extension_install_prompt = &HostExtensionInstallPrompt;
  g_astro_device_chooser = &HandleDeviceChooser;
  g_astro_wants_cast_dialog = &WantsCastDialog;
  g_astro_cast_dialog = &HandleCastDialog;
  g_astro_extension_side_panel = &HandleExtensionSidePanel;
  g_astro_hidden_from_extensions = &IsHiddenFromExtensions;
  g_astro_keeps_window_without_tabs = &KeepsWindowWithoutTabs;
  g_astro_devtools_dock_changed = &DevToolsDockChanged;
  g_astro_create_web_contents_delegate = &CreateWebContentsDelegate;
  g_astro_initial_main_document_accessed = &InitialMainDocumentAccessed;
  g_astro_viewless_browsers = true;
}

}
