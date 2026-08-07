// Copyright 2026 Oxy. Astro product module.

#include "astro/browser/webui/astro_web_ui_configs.h"

#include <memory>

#include "astro/browser/webui/astro_test_ui.h"
#include "content/public/browser/webui_config_map.h"

namespace astro {

void RegisterAstroWebUIConfigs() {
  // AddWebUIConfig, never AddUntrustedWebUIConfig. The map CHECKs the config's
  // scheme against the trusted set, so a config landing in the wrong function
  // is a startup crash rather than a silently over-privileged page — which is
  // the correct trade, and the reason neither call below is wrapped in
  // anything that could swallow it.
  content::WebUIConfigMap::GetInstance().AddWebUIConfig(
      std::make_unique<AstroTestUIConfig>());

  // Nothing else belongs here. Astro's internal scheme is composed at build
  // time from //astro/build/product.gni, so content::kChromeUIScheme already
  // reads "astro" and every one of Chromium's own configs — Settings, Version,
  // Flags, History, Downloads — registers itself under astro:// in
  // RegisterChromeWebUIConfigs(). A config added here to "bring" an upstream
  // page across would register a SECOND config on an origin upstream already
  // owns, and WebUIConfigMap::AddWebUIConfigImpl CHECKs that:
  //
  //     CHECK(it.second) << url;   // astro://settings
  //
  // AstroSettingsUIConfig did exactly that and crashed the browser at startup.
  // It was deleted rather than guarded: it existed only to bridge astro:// to
  // an upstream controller while the root constant still read "chrome", and
  // that gap no longer exists. Only pages Astro itself OWNS belong in this
  // function.
}

void RegisterAstroUntrustedWebUIConfigs() {
  content::WebUIConfigMap::GetInstance().AddUntrustedWebUIConfig(
      std::make_unique<AstroTestUntrustedUIConfig>());
}

}  // namespace astro
