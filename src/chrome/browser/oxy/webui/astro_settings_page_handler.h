// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_WEBUI_ASTRO_SETTINGS_PAGE_HANDLER_H_
#define CHROME_BROWSER_OXY_WEBUI_ASTRO_SETTINGS_PAGE_HANDLER_H_

#include <string>

#include "base/memory/raw_ptr.h"
#include "chrome/browser/oxy/webui/astro_settings.mojom.h"
#include "chrome/browser/oxy/webui/astro_theme.mojom.h"
#include "mojo/public/cpp/bindings/pending_receiver.h"
#include "mojo/public/cpp/bindings/receiver.h"

class Profile;

namespace astro {

class AstroThemeService;

// The browser side of astro://settings' own controls.
//
// Every method here is one named decision. There is no path from this
// interface to an arbitrary pref: Chromium's prefs reach the page through
// chrome.settingsPrivate, which the settings host is granted and which carries
// the policy state a hand-rolled bridge would drop.
class AstroSettingsPageHandler : public settings::mojom::PageHandler {
 public:
  AstroSettingsPageHandler(
      Profile* profile,
      mojo::PendingReceiver<settings::mojom::PageHandler> receiver);
  ~AstroSettingsPageHandler() override;

  AstroSettingsPageHandler(const AstroSettingsPageHandler&) = delete;
  AstroSettingsPageHandler& operator=(const AstroSettingsPageHandler&) = delete;

 private:
  // settings::mojom::PageHandler:
  void SetThemeMode(mojom::ThemeMode mode) override;
  void SetColorPreset(const std::string& preset,
                      SetColorPresetCallback callback) override;

  const raw_ptr<AstroThemeService> theme_service_;
  mojo::Receiver<settings::mojom::PageHandler> receiver_;
};

}  // namespace astro

#endif  // CHROME_BROWSER_OXY_WEBUI_ASTRO_SETTINGS_PAGE_HANDLER_H_
