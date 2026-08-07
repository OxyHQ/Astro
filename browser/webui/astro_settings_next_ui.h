// Copyright 2026 Oxy. Astro product module.

#ifndef ASTRO_BROWSER_WEBUI_ASTRO_SETTINGS_NEXT_UI_H_
#define ASTRO_BROWSER_WEBUI_ASTRO_SETTINGS_NEXT_UI_H_

#include "chrome/browser/ui/webui/settings/settings_ui.h"
#include "content/public/browser/webui_config.h"

namespace astro {

// Astro's own settings page, served entirely from the .pak.
//
// It REPLACES Chromium's registration on the settings host rather than sitting
// beside it on a second one, and the reason is not tidiness.
//
// Chromium's settings page addresses itself: its HTML, its lazy-loaded routes
// and its shared resources all resolve against the page's own origin. Served
// from a second host, the page asks astro://settings/settings.js from
// astro://settings-next/ and its own Content Security Policy refuses it. The
// available workaround -- rewriting upstream's HTML as it is served -- was
// rejected: a page that only works because something edits it on the way out is
// exactly the kind of arrangement this module exists to end.
//
// So the swap is done properly, through WebUIConfigMap::RemoveConfig, which
// content offers publicly for this. No patch edits a Chromium file, and the
// page keeps its own origin, so every URL inside it resolves as upstream wrote
// it.

// Derived from upstream's controller rather than reimplementing it. Its
// constructor makes forty-eight separate additions to the page's data source --
// booleans, strings, handlers -- and a page missing any one of them fails with
// an assertion naming a value nobody remembers adding. Inheriting is what makes
// "restyle without losing anything" literally true rather than aspirational.
class AstroSettingsNextUI : public settings::SettingsUI {
 public:
  explicit AstroSettingsNextUI(content::WebUI* web_ui);
  AstroSettingsNextUI(const AstroSettingsNextUI&) = delete;
  AstroSettingsNextUI& operator=(const AstroSettingsNextUI&) = delete;
  ~AstroSettingsNextUI() override;
};

class AstroSettingsNextUIConfig
    : public content::DefaultWebUIConfig<AstroSettingsNextUI> {
 public:
  AstroSettingsNextUIConfig();
};

}  // namespace astro

#endif  // ASTRO_BROWSER_WEBUI_ASTRO_SETTINGS_NEXT_UI_H_
