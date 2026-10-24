// Copyright 2026 Oxy. Apache-2.0.

#include "base/command_line.h"
#include "base/files/file_path.h"
#include "base/values.h"
#include "chrome/browser/astro/ac_host.h"
#include "chrome/browser/ui/browser_window/public/browser_window_interface.h"
#include "chrome/browser/ui/browser_window/public/browser_window_interface_iterator.h"
#include "chrome/browser/ui/startup/startup_tab.h"
#include "chrome/browser/ui/startup/startup_tab_provider.h"
#include "chrome/common/chrome_switches.h"
#include "ui/base/base_window.h"

extern bool (*g_astro_open_urls)(const base::CommandLine& command_line,
                                 const base::FilePath& cur_dir);

namespace astro {

namespace {

bool OpenUrlsFromOtherApps(const base::CommandLine& command_line,
                           const base::FilePath& cur_dir) {
  if (!HostHasPages() || command_line.HasSwitch(switches::kIncognito) ||
      command_line.HasSwitch(switches::kApp) ||
      command_line.HasSwitch(switches::kAppId)) {
    return false;
  }
  base::ListValue urls;
  for (const StartupTab& tab :
       StartupTabProviderImpl().GetCommandLineTabs(command_line, cur_dir,
                                                   nullptr)) {
    if (tab.url.is_valid()) {
      urls.Append(tab.url.spec());
    }
  }
  if (urls.empty()) {
    return false;
  }
  if (BrowserWindowInterface* browser =
          GetLastActiveBrowserWindowInterfaceWithAnyProfile();
      browser && browser->GetWindow()) {
    browser->GetWindow()->Activate();
  }
  HostEvent("openURLs", base::DictValue().Set("urls", std::move(urls)));
  return true;
}

}

void InstallOpenUrls() {
  g_astro_open_urls = &OpenUrlsFromOtherApps;
}

}
