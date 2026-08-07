// Copyright 2026 Oxy. Astro product module.

#ifndef ASTRO_BROWSER_WEBUI_ASTRO_WEB_UI_CONFIGS_H_
#define ASTRO_BROWSER_WEBUI_ASTRO_WEB_UI_CONFIGS_H_

namespace astro {

// Registers every astro:// WebUI with content::WebUIConfigMap.
void RegisterAstroWebUIConfigs();

// Registers every astro-untrusted:// WebUI with content::WebUIConfigMap.
//
// Two functions rather than one, and the reason is the reason upstream gives
// for having two methods on the map itself
// (content/public/browser/webui_config_map.h:52-54): the scheme is already
// carried by the config, so a single function would work — and a reader
// skimming the call site would have no way to see which kind of page was being
// added. Chromium's own startup registers the two separately for the same
// reason, at chrome/browser/chrome_browser_main.cc:1833-1834.
//
// Both live in one file because Astro currently has one page. If that stops
// being true, split this the way chrome/browser/ui/webui does — into
// astro_web_ui_configs.cc and astro_untrusted_web_ui_configs.cc — rather than
// letting one file accumulate both lists.
void RegisterAstroUntrustedWebUIConfigs();

}  // namespace astro

#endif  // ASTRO_BROWSER_WEBUI_ASTRO_WEB_UI_CONFIGS_H_
