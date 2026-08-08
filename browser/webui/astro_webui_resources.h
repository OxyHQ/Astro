// Copyright 2026 Oxy. Astro product module.

#ifndef ASTRO_BROWSER_WEBUI_ASTRO_WEBUI_RESOURCES_H_
#define ASTRO_BROWSER_WEBUI_ASTRO_WEBUI_RESOURCES_H_

#include <string_view>

namespace astro {

// Astro's WebUI app -- ONE bundle for every internal page -- compiled into the
// binary by //astro/build/embed_resources.py. Nothing is read from disk at
// runtime.
extern const std::string_view kAstroWebUiIndexHtml;
extern const std::string_view kAstroWebUiCss;
extern const std::string_view kAstroWebUiJs;

}  // namespace astro

#endif  // ASTRO_BROWSER_WEBUI_ASTRO_WEBUI_RESOURCES_H_
