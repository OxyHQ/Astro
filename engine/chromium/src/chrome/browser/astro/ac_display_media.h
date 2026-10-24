// Copyright 2026 Oxy. Apache-2.0.

#ifndef CHROME_BROWSER_ASTRO_AC_DISPLAY_MEDIA_H_
#define CHROME_BROWSER_ASTRO_AC_DISPLAY_MEDIA_H_

#include <string>

#include "base/values.h"

namespace content {
class WebContents;
}

namespace astro {

void InstallDisplayMediaPicker();
void ResolveDisplayMedia(content::WebContents* contents,
                         const std::string& request_id,
                         const std::string& source_id);
base::Value DisplayMediaSourceId(content::WebContents* contents);

}

#endif
