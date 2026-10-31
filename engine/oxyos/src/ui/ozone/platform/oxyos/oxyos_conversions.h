// Copyright 2026 Oxy. Apache-2.0.

#ifndef UI_OZONE_PLATFORM_OXYOS_OXYOS_CONVERSIONS_H_
#define UI_OZONE_PLATFORM_OXYOS_OXYOS_CONVERSIONS_H_

#include <cstdint>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include "base/time/time.h"
#include "oxyos_client.h"
#include "third_party/skia/include/core/SkBitmap.h"
#include "ui/base/cursor/mojom/cursor_type.mojom-forward.h"
#include "ui/base/owned_window_anchor.h"
#include "ui/gfx/geometry/point.h"
#include "ui/gfx/geometry/point_f.h"
#include "ui/gfx/geometry/rect.h"
#include "ui/gfx/geometry/size.h"
#include "ui/ozone/platform/oxyos/oxyos_menu_bar.h"

namespace ui {

inline constexpr uint32_t kOxyOSScaleUnit = 120;

gfx::Size OxyOSBufferSize(const gfx::Size& logical, uint32_t scale_120);

float OxyOSScale(uint32_t scale_120);

gfx::Size OxyOSLogicalSize(const gfx::Size& pixels, float scale);

gfx::PointF OxyOSPointerLocation(int32_t x_256, int32_t y_256, float scale);

std::optional<uint8_t> OxyOSPointerShape(mojom::CursorType type);

struct OxyOSPointerImage {
  OxyOSPointerImage();
  OxyOSPointerImage(OxyOSPointerImage&&);
  OxyOSPointerImage& operator=(OxyOSPointerImage&&);
  ~OxyOSPointerImage();

  uint32_t width = 0;
  uint32_t height = 0;
  std::vector<uint8_t> pixels;
  uint32_t hotspot_x = 0;
  uint32_t hotspot_y = 0;
  uint32_t scale_120 = kOxyOSScaleUnit;
};

inline constexpr uint32_t kOxyOSPointerImageMaxSide = 256;
inline constexpr uint16_t kOxyOSPointerImageProtocolVersion = 5;

std::optional<OxyOSPointerImage> OxyOSPointerImageOf(const SkBitmap& bitmap,
                                                     const gfx::Point& hotspot,
                                                     float scale);

OxyOSPointerImage OxyOSHiddenPointerImage();

int OxyOSButtonFlag(uint32_t code);

base::TimeTicks OxyOSEventTime(uint64_t time_ns);

OxyOSPositioner OxyOSPopupPositioner(const OwnedWindowAnchor& anchor,
                                     const gfx::Size& size);

std::string OxyOSTitle(std::u16string_view title, size_t limit);

std::vector<OxyOSMenuItem> OxyOSMenuItemsOf(
    const std::vector<OxyOSMenuEntry>& entries);

}

#endif
