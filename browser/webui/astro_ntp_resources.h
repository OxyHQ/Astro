// Copyright 2026 Oxy. Astro product module.

#ifndef ASTRO_BROWSER_WEBUI_ASTRO_NTP_RESOURCES_H_
#define ASTRO_BROWSER_WEBUI_ASTRO_NTP_RESOURCES_H_

#include <string_view>

namespace astro {

// The new tab page's built bundle, compiled into the binary by
// //astro/build/embed_resources.py. Nothing is read from disk at runtime.
extern const std::string_view kAstroNtpIndexHtml;
extern const std::string_view kAstroNtpCss;
extern const std::string_view kAstroNtpJs;

}  // namespace astro

#endif  // ASTRO_BROWSER_WEBUI_ASTRO_NTP_RESOURCES_H_
