// Copyright 2026 Oxy. Apache-2.0.

#include <optional>
#include <string>

#include "base/files/file_path.h"
#include "chrome/browser/astro/ac_engine.h"
#include "chrome/browser/astro/ac_scripts_policy.h"

namespace astro {

void RegisterManagementPolicyProviders(Profile*, extensions::ManagementPolicy*) {}

void AddScriptsPagesThrottle(content::NavigationThrottleRegistry&) {}

bool NamesScriptsFolder(const base::FilePath&) {
  return false;
}

std::optional<std::string> ScriptsFolderInstallProblem(const base::FilePath&) {
  return "Astro Scripts is not available on Windows";
}

base::FilePath ScriptsFolder() {
  return base::FilePath();
}

base::ScopedClosureRunner BeginScriptsInstall() {
  return base::ScopedClosureRunner();
}

}

AC_ENGINE_CALL(ac_cli_control) {
  astro::Reply(reply, context).Error("the command line is not available on Windows");
}
