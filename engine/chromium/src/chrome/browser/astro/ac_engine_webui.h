// Copyright 2026 Oxy. Apache-2.0.

#ifndef CHROME_BROWSER_ASTRO_AC_ENGINE_WEBUI_H_
#define CHROME_BROWSER_ASTRO_AC_ENGINE_WEBUI_H_

#include <memory>

#include "content/public/browser/web_ui_message_handler.h"

class Profile;

namespace astro {

std::unique_ptr<content::WebUIMessageHandler> CreateEngineWebUIHandler(
    Profile* profile);

}

#endif
