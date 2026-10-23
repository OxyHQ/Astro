// Copyright 2026 Oxy. Apache-2.0.

#ifndef ASTRO_CORE_AC_DESKTOP_CAPTURE_H_
#define ASTRO_CORE_AC_DESKTOP_CAPTURE_H_

#include <string>

namespace content {
struct MediaStreamRequest;
class WebContents;
}

namespace astrocore {

void AllowDesktopCapture(content::WebContents* contents,
                         const std::string& source,
                         const std::string& frame_id,
                         const std::string& origin);

void ApplyDesktopCaptureGrant(content::WebContents* contents,
                              content::MediaStreamRequest& request);

}

#endif
