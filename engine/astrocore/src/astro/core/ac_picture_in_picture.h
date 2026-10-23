// Copyright 2026 Oxy. Apache-2.0.

#ifndef ASTRO_CORE_AC_PICTURE_IN_PICTURE_H_
#define ASTRO_CORE_AC_PICTURE_IN_PICTURE_H_

#include <string>

namespace content {
class WebContents;
}

namespace astrocore {

void StartPictureInPictureObserver();

bool PictureInPictureTracing();
void TracePictureInPicture(const std::string& line);

void TraceAutoPictureInPictureInputs(content::WebContents* contents, const char* when);

}

#endif
