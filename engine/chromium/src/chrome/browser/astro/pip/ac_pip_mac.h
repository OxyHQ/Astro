// Copyright 2026 Oxy. Apache-2.0.

#ifndef CHROME_BROWSER_ASTRO_PIP_AC_PIP_MAC_H_
#define CHROME_BROWSER_ASTRO_PIP_AC_PIP_MAC_H_

#include <optional>

#include "base/time/time.h"
#include "ui/gfx/geometry/rect.h"
#include "ui/gfx/native_ui_types.h"

std::optional<gfx::Rect> LoadAstroPictureInPictureBounds();
void SaveAstroPictureInPictureBounds(const gfx::Rect& bounds);

void FadeOutAstroPictureInPicture(gfx::NativeWindow window,
                                      base::TimeDelta duration);
void ResetAstroPictureInPictureFade(gfx::NativeWindow window);

#endif
