// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_WEBUI_ASTRO_SETTINGS_HANDLER_H_
#define CHROME_BROWSER_OXY_WEBUI_ASTRO_SETTINGS_HANDLER_H_

#include "base/memory/raw_ptr.h"
#include "content/public/browser/web_ui_message_handler.h"

class PrefService;
class Profile;

namespace oxy {

// Handles chrome.send() messages from the astro://settings page.
// Maps settings UI identifiers to real Chromium PrefService paths
// and provides getPref / setPref / getAllPrefs operations.
class AstroSettingsHandler : public content::WebUIMessageHandler {
 public:
  AstroSettingsHandler();
  ~AstroSettingsHandler() override;

  AstroSettingsHandler(const AstroSettingsHandler&) = delete;
  AstroSettingsHandler& operator=(const AstroSettingsHandler&) = delete;

 private:
  // content::WebUIMessageHandler:
  void RegisterMessages() override;

  // JS -> C++ handlers
  void HandleGetPref(const base::Value::List& args);
  void HandleSetPref(const base::Value::List& args);
  void HandleGetAllPrefs(const base::Value::List& args);

  // Resolves profile and prefs lazily from web_ui() so we don't
  // need to accept them in the constructor (matching adblock pattern).
  PrefService* GetPrefs();
};

}  // namespace oxy

#endif  // CHROME_BROWSER_OXY_WEBUI_ASTRO_SETTINGS_HANDLER_H_
