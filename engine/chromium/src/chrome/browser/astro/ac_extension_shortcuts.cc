// Copyright 2026 Oxy. Apache-2.0.

#include "chrome/browser/astro/ac_extension_shortcuts.h"

#include <utility>

#include "astro/core/ac_hooks.h"  // nogncheck
#include "base/no_destructor.h"
#include "base/values.h"
#include "chrome/browser/astro/ac_host.h"
#include "chrome/browser/ui/browser_window/public/browser_window_interface.h"
#include "chrome/browser/ui/tabs/tab_strip_model.h"
#include "content/public/browser/web_contents.h"
#include "extensions/common/extension_id.h"
#include "ui/base/accelerators/accelerator.h"

extern bool (*g_astro_extension_action_command)(
    BrowserWindowInterface* browser,
    const extensions::ExtensionId& extension_id);

namespace astro {
namespace {

base::RepeatingCallback<bool(const ui::Accelerator&)>& Reserved() {
  static base::NoDestructor<base::RepeatingCallback<bool(const ui::Accelerator&)>>
      reserved;
  return *reserved;
}

bool ReservedAccelerator(const ui::Accelerator& accelerator) {
  return Reserved() && Reserved().Run(accelerator);
}

bool ActionCommand(BrowserWindowInterface* browser,
                   const extensions::ExtensionId& extension_id) {
  content::WebContents* contents =
      browser && browser->GetTabStripModel()
          ? browser->GetTabStripModel()->GetActiveWebContents()
          : nullptr;
  if (!contents || !HostShowsTab(contents)) {
    return false;
  }
  HostTabEvent(contents, "actionShortcut",
               base::DictValue().Set("extensionId", extension_id));
  return true;
}

}

void InstallExtensionShortcuts(
    base::RepeatingCallback<bool(const ui::Accelerator&)> reserved) {
  Reserved() = std::move(reserved);
  g_astro_reserved_accelerator = &ReservedAccelerator;
  g_astro_extension_action_command = &ActionCommand;
}

}
