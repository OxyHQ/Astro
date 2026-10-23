// Copyright 2026 Oxy. Apache-2.0.

#ifndef CHROME_BROWSER_ASTRO_AC_UI_SOURCE_H_
#define CHROME_BROWSER_ASTRO_AC_UI_SOURCE_H_

namespace content {
class WebUIDataSource;
}

namespace astro {

inline constexpr char kAstroUiDirSwitch[] = "astro-ui-dir";
inline constexpr char kAstroUiDirName[] = "astro-ui";

void ServeUiFromDisk(content::WebUIDataSource* source);

}

#endif
