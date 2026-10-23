// Copyright 2026 Oxy. Apache-2.0.

#ifndef ASTRO_CORE_AC_HOST_VISIBILITY_H_
#define ASTRO_CORE_AC_HOST_VISIBILITY_H_

#include <optional>

namespace content {
class WebContents;
}

namespace astrocore {

void NoteTabShownByHost(content::WebContents* contents, bool shown);

std::optional<bool> ShownByHost(content::WebContents* contents);

void StartHostVisibility();

}

#endif
