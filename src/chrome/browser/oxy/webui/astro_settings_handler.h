// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_WEBUI_ASTRO_SETTINGS_HANDLER_H_
#define CHROME_BROWSER_OXY_WEBUI_ASTRO_SETTINGS_HANDLER_H_

#include "base/memory/raw_ptr.h"
#include "base/values.h"
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

  // JS -> C++ handlers (generic pref read/write)
  void HandleGetPref(const base::ListValue& args);
  void HandleSetPref(const base::ListValue& args);
  void HandleGetAllPrefs(const base::ListValue& args);

  // JS -> C++ handlers (custom actions)
  void HandleSetTheme(const base::ListValue& args);
  void HandleClearBrowsingData(const base::ListValue& args);
  void HandleOpenPage(const base::ListValue& args);

  // Resolves profile and prefs lazily from web_ui().
  PrefService* GetPrefs();

  // Finds the correct PrefService (profile or local_state) for a setting ID.
  PrefService* FindPrefService(const std::string& pref_id,
                               const char** out_pref_path);

  // Writes a value to a pref with automatic type coercion to prevent
  // CHECK failures from type mismatches.
  void SafeSetPref(PrefService* prefs,
                   const char* path,
                   const base::Value& value);
};

}  // namespace oxy

#endif  // CHROME_BROWSER_OXY_WEBUI_ASTRO_SETTINGS_HANDLER_H_
