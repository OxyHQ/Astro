// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_conversions.h"

#include <algorithm>
#include <cmath>

#include "base/strings/utf_string_conversions.h"
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

uint8_t OxyOSPointerShape(mojom::CursorType type) {
  using enum mojom::CursorType;
  switch (type) {
    case kHand:
      return OXYOS_POINTER_HAND;
    case kIBeam:
    case kVerticalText:
      return OXYOS_POINTER_TEXT;
    case kWait:
    case kProgress:
      return OXYOS_POINTER_WAIT;
    case kHelp:
      return OXYOS_POINTER_HELP;
    case kCross:
    case kCell:
      return OXYOS_POINTER_CROSSHAIR;
    case kMove:
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
    case kNull:
    case kPointer:
    case kContextMenu:
    case kAlias:
    case kCopy:
    case kNone:
    case kCustom:
    case kDndCopy:
    case kDndLink:
      return OXYOS_POINTER_ARROW;
  }
  return OXYOS_POINTER_ARROW;
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
