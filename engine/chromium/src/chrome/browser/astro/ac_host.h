// Copyright 2026 Oxy. Apache-2.0.

#ifndef CHROME_BROWSER_ASTRO_AC_HOST_H_
#define CHROME_BROWSER_ASTRO_AC_HOST_H_

#include <string>

#include "base/values.h"

namespace content {
class WebContents;
}

namespace astro {

bool HostShowsTab(content::WebContents* contents);
void HostTabEvent(content::WebContents* contents,
                  const std::string& kind,
                  base::DictValue payload);
void HostEvent(const std::string& kind, base::DictValue payload);

void InstallPermissionPrompts();
void InstallPasswordPrompts();
void InstallExternalAppPrompts();
void InstallExtensionPrompts();
void ResolveExtensionInstallPrompt(const std::string& request_id, bool accepted);
void ResolveExternalApp(const std::string& request_id, bool open, bool remember);
void ResolvePasswordPrompt(content::WebContents* contents,
                           const std::string& action,
                           const std::string& username,
                           const std::string& password);
void ResolvePermission(const std::string& request_id,
                       const std::string& result,
                       bool remember);

}

#endif
