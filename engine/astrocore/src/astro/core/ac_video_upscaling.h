// Copyright 2026 Oxy. Apache-2.0.

#ifndef ASTRO_CORE_AC_VIDEO_UPSCALING_H_
#define ASTRO_CORE_AC_VIDEO_UPSCALING_H_

#include <optional>

@class NSDictionary;

namespace astrocore {

void StartVideoUpscaling();

void SetVideoUpscalingEnabled(bool enabled);

void SetVideoUpscalingTestConditions(std::optional<bool> low_power,
                                     std::optional<bool> thermal_pressure);

void VideoUpscalingInputsChanged();

NSDictionary* VideoUpscalingState();

}

#endif
