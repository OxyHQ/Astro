// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_WEBUI_ASTRO_WEBUI_DEV_SOURCE_H_
#define CHROME_BROWSER_OXY_WEBUI_ASTRO_WEBUI_DEV_SOURCE_H_

#include <string_view>

#include "chrome/browser/oxy/webui/astro_webui_buildflags.h"

static_assert(BUILDFLAG(ASTRO_WEBUI_DEV_TOOLS),
              "astro_webui_dev_source is developer-only and must not be "
              "compiled into a release binary. Nothing may include this "
              "header outside a BUILDFLAG(ASTRO_WEBUI_DEV_TOOLS) guard.");

namespace content {
class WebUIDataSource;
}

namespace astro {

// Points `source` at the directory named by `--astro-webui-dir`, if the switch
// was passed.
//
// This exists so a developer can iterate on the Vite app without relinking the
// browser: `bun run build` writes the directory, the browser reads it, reload.
// It is the ONLY code in Astro that serves a WebUI page from the filesystem,
// it exists only in a build configured with `astro_webui_dev_tools = true`,
// and it is inert unless the switch is on the command line.
//
// The whole arrangement is a reaction to what the previous one cost. Astro
// served its settings page from a directory beside the executable in every
// build, so a packaging mistake reached users as a blank page with no error
// and no log line, indistinguishable from a browser bug. A developer
// affordance that a release binary does not contain cannot do that.
void MaybeServeAstroWebUIFromDirectory(content::WebUIDataSource* source,
                                       std::string_view host);

}  // namespace astro

#endif  // CHROME_BROWSER_OXY_WEBUI_ASTRO_WEBUI_DEV_SOURCE_H_
