// Copyright 2026 Oxy. Apache-2.0.

#ifndef CHROME_BROWSER_ASTRO_AC_UI_SOURCE_H_
#define CHROME_BROWSER_ASTRO_AC_UI_SOURCE_H_

#include <string_view>

#include "base/files/file_path.h"

class Profile;

namespace content {
class WebUIDataSource;
}

namespace astro {

inline constexpr char kAstroUiDirSwitch[] = "astro-ui-dir";

void ServeUi(content::WebUIDataSource* source, Profile* profile);
base::FilePath BesideEngine(std::string_view relative);

}

#endif
