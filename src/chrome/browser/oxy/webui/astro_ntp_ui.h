// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_WEBUI_ASTRO_NTP_UI_H_
#define CHROME_BROWSER_OXY_WEBUI_ASTRO_NTP_UI_H_

#include "components/prefs/pref_change_registrar.h"
#include "content/public/browser/web_ui_controller.h"
#include "content/public/browser/web_ui_message_handler.h"
#include "content/public/browser/webui_config.h"

namespace oxy {

// Host name for the Astro NTP: chrome://astro-ntp (displayed as astro://newtab)
inline constexpr char kAstroNtpHost[] = "astro-ntp";

// WebUI controller for the Astro New Tab Page.
class AstroNtpUI : public content::WebUIController {
 public:
  explicit AstroNtpUI(content::WebUI* web_ui);
  ~AstroNtpUI() override;

  AstroNtpUI(const AstroNtpUI&) = delete;
  AstroNtpUI& operator=(const AstroNtpUI&) = delete;
};

// Handles chrome.send() messages from the NTP frontend,
// providing widget visibility prefs from PrefService.
class AstroNtpHandler : public content::WebUIMessageHandler {
 public:
  AstroNtpHandler();
  ~AstroNtpHandler() override;

  AstroNtpHandler(const AstroNtpHandler&) = delete;
  AstroNtpHandler& operator=(const AstroNtpHandler&) = delete;

 private:
  // content::WebUIMessageHandler:
  void RegisterMessages() override;

  void HandleGetWidgetPrefs(const base::ListValue& args);
  void HandleGetBlockedCount(const base::ListValue& args);

  // Called when any astro.ntp_show_* pref changes. Pushes the new
  // values to the frontend so the NTP updates instantly.
  void OnWidgetPrefChanged();

  // Called when oxy.adblock.lifetime_blocked_count changes so the NTP
  // badge updates without needing a refresh.
  void OnBlockedCountChanged();

  void OnJavascriptAllowed() override;
  void OnJavascriptDisallowed() override;

  PrefChangeRegistrar pref_registrar_;
};

// WebUI config that registers chrome://astro-ntp.
class AstroNtpUIConfig : public content::DefaultWebUIConfig<AstroNtpUI> {
 public:
  AstroNtpUIConfig();
};

}  // namespace oxy

#endif  // CHROME_BROWSER_OXY_WEBUI_ASTRO_NTP_UI_H_
