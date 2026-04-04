// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_ADBLOCK_WEBUI_ASTRO_ADBLOCK_UI_HANDLER_H_
#define CHROME_BROWSER_OXY_ADBLOCK_WEBUI_ASTRO_ADBLOCK_UI_HANDLER_H_

#include "content/public/browser/web_ui_message_handler.h"

namespace oxy::adblock {

// Handles messages from the astro://adblock WebUI page.
class AstroAdBlockUIHandler : public content::WebUIMessageHandler {
 public:
  AstroAdBlockUIHandler();
  ~AstroAdBlockUIHandler() override;

  AstroAdBlockUIHandler(const AstroAdBlockUIHandler&) = delete;
  AstroAdBlockUIHandler& operator=(const AstroAdBlockUIHandler&) = delete;

 private:
  // content::WebUIMessageHandler:
  void RegisterMessages() override;

  // Message handlers.
  void HandleGetAdBlockState(const base::Value::List& args);
  void HandleRemoveSiteOverride(const base::Value::List& args);
  void HandleSaveCustomRules(const base::Value::List& args);
};

}  // namespace oxy::adblock

#endif  // CHROME_BROWSER_OXY_ADBLOCK_WEBUI_ASTRO_ADBLOCK_UI_HANDLER_H_
