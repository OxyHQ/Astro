// Copyright 2026 Oxy. Apache-2.0.

#ifndef UI_OZONE_PLATFORM_OXYOS_OXYOS_CONVERSIONS_H_
#define UI_OZONE_PLATFORM_OXYOS_OXYOS_CONVERSIONS_H_

#include <cstdint>
#include <string>
#include <string_view>

#include "oxyos_client.h"
#include "ui/base/cursor/mojom/cursor_type.mojom-forward.h"
#include "ui/base/owned_window_anchor.h"
#include "ui/gfx/geometry/point_f.h"
#include "ui/gfx/geometry/rect.h"
#include "ui/gfx/geometry/size.h"

namespace ui {

inline constexpr uint32_t kOxyOSScaleUnit = 120;

gfx::Size OxyOSBufferSize(const gfx::Size& logical, uint32_t scale_120);

float OxyOSScale(uint32_t scale_120);

gfx::Size OxyOSLogicalSize(const gfx::Size& pixels, float scale);

gfx::PointF OxyOSPointerLocation(int32_t x_256, int32_t y_256, float scale);

uint8_t OxyOSPointerShape(mojom::CursorType type);

int OxyOSButtonFlag(uint32_t code);

OxyOSPositioner OxyOSPopupPositioner(const OwnedWindowAnchor& anchor,
                                     const gfx::Size& size);

std::string OxyOSTitle(std::u16string_view title, size_t limit);

}

#endif
