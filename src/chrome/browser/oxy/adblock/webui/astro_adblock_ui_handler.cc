// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/oxy/adblock/webui/astro_adblock_ui_handler.h"

#include "base/values.h"
#include "chrome/browser/oxy/adblock/astro_adblock_service.h"
#include "chrome/browser/oxy/adblock/astro_adblock_service_factory.h"
#include "chrome/browser/profiles/profile.h"
#include "components/prefs/pref_service.h"
#include "content/public/browser/web_ui.h"

namespace oxy::adblock {

AstroAdBlockUIHandler::AstroAdBlockUIHandler() = default;
AstroAdBlockUIHandler::~AstroAdBlockUIHandler() = default;

void AstroAdBlockUIHandler::RegisterMessages() {
  web_ui()->RegisterMessageCallback(
      "getAdBlockState",
      base::BindRepeating(&AstroAdBlockUIHandler::HandleGetAdBlockState,
                          base::Unretained(this)));
  web_ui()->RegisterMessageCallback(
      "removeSiteOverride",
      base::BindRepeating(&AstroAdBlockUIHandler::HandleRemoveSiteOverride,
                          base::Unretained(this)));
  web_ui()->RegisterMessageCallback(
      "saveCustomRules",
      base::BindRepeating(&AstroAdBlockUIHandler::HandleSaveCustomRules,
                          base::Unretained(this)));
}

void AstroAdBlockUIHandler::HandleGetAdBlockState(
    const base::Value::List& args) {
  AllowJavascript();

  auto* profile = Profile::FromWebUI(web_ui());
  auto* prefs = profile->GetPrefs();

  base::Value::Dict state;
  state.Set("enabled", prefs->GetBoolean(kAdBlockEnabled));

  // Get site overrides.
  const auto& overrides = prefs->GetDict(kAdBlockSiteOverrides);
  state.Set("siteOverrides", overrides.Clone());

  // Get custom rules (if stored in prefs).
  state.Set("customRules",
            prefs->HasPrefPath("oxy.adblock.custom_rules")
                ? prefs->GetString("oxy.adblock.custom_rules")
                : "");

  CallJavascriptFunction("onAdBlockState", base::Value(std::move(state)));
}

void AstroAdBlockUIHandler::HandleRemoveSiteOverride(
    const base::Value::List& args) {
  if (args.empty() || !args[0].is_string()) {
    return;
  }

  const std::string& site = args[0].GetString();
  auto* profile = Profile::FromWebUI(web_ui());
  auto* service = AstroAdBlockServiceFactory::GetForProfile(profile);
  if (service) {
    // Pass enabled=true to remove the override (revert to default).
    GURL site_url("https://" + site);
    service->SetSiteOverride(site_url, /*enabled=*/true);
  }

  // Refresh the UI.
  HandleGetAdBlockState(base::Value::List());
}

void AstroAdBlockUIHandler::HandleSaveCustomRules(
    const base::Value::List& args) {
  if (args.empty() || !args[0].is_string()) {
    return;
  }

  const std::string& rules = args[0].GetString();
  auto* profile = Profile::FromWebUI(web_ui());
  auto* prefs = profile->GetPrefs();
  prefs->SetString("oxy.adblock.custom_rules", rules);

  // In a full implementation, we would also reload the engine with these
  // custom rules. For now, they'll be applied on next browser restart.
}

}  // namespace oxy::adblock
