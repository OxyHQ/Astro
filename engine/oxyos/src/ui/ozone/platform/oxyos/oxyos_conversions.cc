// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_conversions.h"

#include <algorithm>
#include <cmath>

#include "base/strings/utf_string_conversions.h"
#include "third_party/skia/include/core/SkPixmap.h"
#include "third_party/skia/include/core/SkSamplingOptions.h"
#include "ui/base/cursor/mojom/cursor_type.mojom-shared.h"
#include "ui/events/event_constants.h"
#include "ui/events/event_utils.h"

namespace ui {

namespace {

constexpr uint32_t kButtonLeft = 0x110;
constexpr uint32_t kButtonRight = 0x111;
constexpr uint32_t kButtonMiddle = 0x112;
constexpr uint32_t kButtonSide = 0x113;
constexpr uint32_t kButtonExtra = 0x114;

uint32_t ScaledUp(int length, uint32_t scale_120) {
  const uint64_t scaled =
      static_cast<uint64_t>(std::max(length, 0)) * scale_120;
  return static_cast<uint32_t>((scaled + kOxyOSScaleUnit - 1) /
                               kOxyOSScaleUnit);
}

}

gfx::Size OxyOSBufferSize(const gfx::Size& logical, uint32_t scale_120) {
  return gfx::Size(ScaledUp(logical.width(), scale_120),
                   ScaledUp(logical.height(), scale_120));
}

float OxyOSScale(uint32_t scale_120) {
  return scale_120 ? static_cast<float>(scale_120) / kOxyOSScaleUnit : 1.0f;
}

gfx::Size OxyOSLogicalSize(const gfx::Size& pixels, float scale) {
  return gfx::Size(
      std::max(1, static_cast<int>(std::lround(pixels.width() / scale))),
      std::max(1, static_cast<int>(std::lround(pixels.height() / scale))));
}

gfx::PointF OxyOSPointerLocation(int32_t x_256, int32_t y_256, float scale) {
  return gfx::PointF(x_256 / 256.0f * scale, y_256 / 256.0f * scale);
}

std::optional<uint8_t> OxyOSPointerShape(mojom::CursorType type) {
  using enum mojom::CursorType;
  switch (type) {
    case kNull:
    case kPointer:
      return OXYOS_POINTER_ARROW;
    case kHand:
      return OXYOS_POINTER_HAND;
    case kIBeam:
      return OXYOS_POINTER_TEXT;
    case kWait:
      return OXYOS_POINTER_WAIT;
    case kHelp:
      return OXYOS_POINTER_HELP;
    case kCross:
      return OXYOS_POINTER_CROSSHAIR;
    case kMove:
    case kDndMove:
      return OXYOS_POINTER_MOVE;
    case kGrab:
      return OXYOS_POINTER_GRAB;
    case kGrabbing:
      return OXYOS_POINTER_GRABBING;
    case kNotAllowed:
    case kNoDrop:
    case kDndNone:
    case kEastWestNoResize:
    case kNorthSouthNoResize:
    case kNorthEastSouthWestNoResize:
    case kNorthWestSouthEastNoResize:
      return OXYOS_POINTER_NOT_ALLOWED;
    case kEastResize:
    case kWestResize:
    case kEastWestResize:
    case kColumnResize:
      return OXYOS_POINTER_RESIZE_HORIZONTAL;
    case kNorthResize:
    case kSouthResize:
    case kNorthSouthResize:
    case kRowResize:
      return OXYOS_POINTER_RESIZE_VERTICAL;
    case kNorthWestResize:
    case kSouthEastResize:
    case kNorthWestSouthEastResize:
      return OXYOS_POINTER_RESIZE_TOP_LEFT;
    case kNorthEastResize:
    case kSouthWestResize:
    case kNorthEastSouthWestResize:
      return OXYOS_POINTER_RESIZE_TOP_RIGHT;
    case kZoomIn:
      return OXYOS_POINTER_ZOOM_IN;
    case kZoomOut:
      return OXYOS_POINTER_ZOOM_OUT;
    case kProgress:
    case kCell:
    case kVerticalText:
    case kContextMenu:
    case kAlias:
    case kCopy:
    case kDndCopy:
    case kDndLink:
    case kMiddlePanning:
    case kMiddlePanningVertical:
    case kMiddlePanningHorizontal:
    case kEastPanning:
    case kNorthPanning:
    case kNorthEastPanning:
    case kNorthWestPanning:
    case kSouthPanning:
    case kSouthEastPanning:
    case kSouthWestPanning:
    case kWestPanning:
    case kNone:
    case kCustom:
      return std::nullopt;
  }
  return std::nullopt;
}

OxyOSPointerImage::OxyOSPointerImage() = default;
OxyOSPointerImage::OxyOSPointerImage(OxyOSPointerImage&&) = default;
OxyOSPointerImage& OxyOSPointerImage::operator=(OxyOSPointerImage&&) = default;
OxyOSPointerImage::~OxyOSPointerImage() = default;

std::optional<OxyOSPointerImage> OxyOSPointerImageOf(const SkBitmap& bitmap,
                                                     const gfx::Point& hotspot,
                                                     float scale) {
  if (bitmap.drawsNothing()) {
    return std::nullopt;
  }
  const int largest = std::max(bitmap.width(), bitmap.height());
  const float fit =
      largest > static_cast<int>(kOxyOSPointerImageMaxSide)
          ? static_cast<float>(kOxyOSPointerImageMaxSide) / largest
          : 1.0f;
  const SkImageInfo info =
      SkImageInfo::Make(std::max(1, static_cast<int>(bitmap.width() * fit)),
                        std::max(1, static_cast<int>(bitmap.height() * fit)),
                        kBGRA_8888_SkColorType, kPremul_SkAlphaType);
  OxyOSPointerImage image;
  image.width = static_cast<uint32_t>(info.width());
  image.height = static_cast<uint32_t>(info.height());
  image.pixels.resize(info.computeMinByteSize());
  SkPixmap destination(info, image.pixels.data(), info.minRowBytes());
  if (!bitmap.pixmap().scalePixels(destination,
                                   SkSamplingOptions(SkFilterMode::kLinear))) {
    return std::nullopt;
  }
  image.hotspot_x = std::min(
      static_cast<uint32_t>(std::max(0, hotspot.x()) * fit), image.width - 1);
  image.hotspot_y = std::min(
      static_cast<uint32_t>(std::max(0, hotspot.y()) * fit), image.height - 1);
  const float drawn_for = std::max(scale, 0.01f) * fit;
  image.scale_120 = std::clamp<uint32_t>(
      static_cast<uint32_t>(std::lround(drawn_for * kOxyOSScaleUnit)),
      kOxyOSScaleUnit, 4 * kOxyOSScaleUnit);
  return image;
}

OxyOSPointerImage OxyOSHiddenPointerImage() {
  OxyOSPointerImage image;
  image.width = 1;
  image.height = 1;
  image.pixels.assign(4, 0);
  return image;
}

base::TimeTicks OxyOSEventTime(uint64_t time_ns) {
  if (!time_ns) {
    return EventTimeForNow();
  }
  return base::TimeTicks() + base::Nanoseconds(static_cast<int64_t>(time_ns));
}

int OxyOSButtonFlag(uint32_t code) {
  switch (code) {
    case kButtonLeft:
      return EF_LEFT_MOUSE_BUTTON;
    case kButtonRight:
      return EF_RIGHT_MOUSE_BUTTON;
    case kButtonMiddle:
      return EF_MIDDLE_MOUSE_BUTTON;
    case kButtonSide:
      return EF_BACK_MOUSE_BUTTON;
    case kButtonExtra:
      return EF_FORWARD_MOUSE_BUTTON;
  }
  return 0;
}

OxyOSPositioner OxyOSAnchoredWithin(OxyOSPositioner positioner,
                                    const gfx::Size& parent) {
  const int64_t width = std::max(parent.width(), 1);
  const int64_t height = std::max(parent.height(), 1);
  auto clamp = [](int32_t& start, uint32_t& extent, int32_t& offset,
                  int64_t limit) {
    extent = static_cast<uint32_t>(std::min<int64_t>(extent, limit));
    const int64_t inside =
        std::clamp<int64_t>(start, 0, limit - static_cast<int64_t>(extent));
    offset = static_cast<int32_t>(offset + (start - inside));
    start = static_cast<int32_t>(inside);
  };
  clamp(positioner.anchor_x, positioner.anchor_width, positioner.offset_x,
        width);
  clamp(positioner.anchor_y, positioner.anchor_height, positioner.offset_y,
        height);
  return positioner;
}

OxyOSPositioner OxyOSPopupPositioner(const OwnedWindowAnchor& anchor,
                                     const gfx::Size& size) {
  OxyOSPositioner positioner{};
  positioner.anchor_x = anchor.anchor_rect.x();
  positioner.anchor_y = anchor.anchor_rect.y();
  positioner.anchor_width =
      static_cast<uint32_t>(std::max(anchor.anchor_rect.width(), 1));
  positioner.anchor_height =
      static_cast<uint32_t>(std::max(anchor.anchor_rect.height(), 1));
  positioner.width = static_cast<uint32_t>(std::max(size.width(), 1));
  positioner.height = static_cast<uint32_t>(std::max(size.height(), 1));
  positioner.anchor = static_cast<uint8_t>(anchor.anchor_position);
  positioner.gravity = static_cast<uint8_t>(anchor.anchor_gravity);
  positioner.adjust = static_cast<uint8_t>(
      static_cast<uint32_t>(anchor.constraint_adjustment) & 0x3f);
  return positioner;
}

static_assert(kOxyOSNoMenuParent == OXYOS_NO_MENU_PARENT);
static_assert(static_cast<uint8_t>(OxyOSMenuKind::kMenu) == OXYOS_MENU_MENU);
static_assert(static_cast<uint8_t>(OxyOSMenuKind::kItem) == OXYOS_MENU_ITEM);
static_assert(static_cast<uint8_t>(OxyOSMenuKind::kSubmenu) ==
              OXYOS_MENU_SUBMENU);
static_assert(static_cast<uint8_t>(OxyOSMenuKind::kSeparator) ==
              OXYOS_MENU_SEPARATOR);
static_assert(kOxyOSMenuDisabled == OXYOS_MENU_DISABLED);
static_assert(kOxyOSMenuCheckable == OXYOS_MENU_CHECKABLE);
static_assert(kOxyOSMenuChecked == OXYOS_MENU_CHECKED);

std::vector<OxyOSMenuItem> OxyOSMenuItemsOf(
    const std::vector<OxyOSMenuEntry>& entries) {
  std::vector<OxyOSMenuItem> items;
  items.reserve(entries.size());
  for (const OxyOSMenuEntry& entry : entries) {
    items.push_back(
        {.parent = entry.parent,
         .kind = static_cast<uint8_t>(entry.kind),
         .flags = entry.flags,
         .label = entry.label.empty() ? nullptr : entry.label.c_str(),
         .shortcut =
             entry.shortcut.empty() ? nullptr : entry.shortcut.c_str()});
  }
  return items;
}

std::string OxyOSTitle(std::u16string_view title, size_t limit) {
  std::string utf8 = base::UTF16ToUTF8(title);
  if (utf8.size() <= limit) {
    return utf8;
  }
  size_t end = limit;
  while (end > 0 && (static_cast<unsigned char>(utf8[end]) & 0xc0) == 0x80) {
    --end;
  }
  utf8.resize(end);
  return utf8;
}

}
