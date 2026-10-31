// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_conversions.h"

#include "testing/gtest/include/gtest/gtest.h"
#include "ui/base/cursor/mojom/cursor_type.mojom-shared.h"
#include "ui/events/event_constants.h"

namespace ui {

TEST(OxyOSConversionsTest, BuffersAreTheLogicalSizeScaledUp) {
  EXPECT_EQ(OxyOSBufferSize(gfx::Size(800, 600), 120), gfx::Size(800, 600));
  EXPECT_EQ(OxyOSBufferSize(gfx::Size(1001, 601), 150), gfx::Size(1252, 752));
  EXPECT_EQ(OxyOSBufferSize(gfx::Size(1280, 800), 180), gfx::Size(1920, 1200));
  EXPECT_EQ(OxyOSScale(150), 1.25f);
  EXPECT_EQ(OxyOSScale(0), 1.0f);
  EXPECT_EQ(OxyOSLogicalSize(gfx::Size(1920, 1200), 1.5f),
            gfx::Size(1280, 800));
}

TEST(OxyOSConversionsTest, PointerPositionsAreInWindowPixels) {
  EXPECT_EQ(OxyOSPointerLocation(256 * 10 + 128, 256 * 4, 1.0f),
            gfx::PointF(10.5f, 4.0f));
  EXPECT_EQ(OxyOSPointerLocation(256 * 10, 256 * 4, 1.5f),
            gfx::PointF(15.0f, 6.0f));
}

TEST(OxyOSConversionsTest, ButtonsAreLinuxInputCodes) {
  EXPECT_EQ(OxyOSButtonFlag(272), EF_LEFT_MOUSE_BUTTON);
  EXPECT_EQ(OxyOSButtonFlag(273), EF_RIGHT_MOUSE_BUTTON);
  EXPECT_EQ(OxyOSButtonFlag(274), EF_MIDDLE_MOUSE_BUTTON);
  EXPECT_EQ(OxyOSButtonFlag(275), EF_BACK_MOUSE_BUTTON);
  EXPECT_EQ(OxyOSButtonFlag(276), EF_FORWARD_MOUSE_BUTTON);
  EXPECT_EQ(OxyOSButtonFlag(330), 0);
}

TEST(OxyOSConversionsTest, CursorsBecomeTheCompositorsPointerShapes) {
  EXPECT_EQ(OxyOSPointerShape(mojom::CursorType::kPointer),
            OXYOS_POINTER_ARROW);
  EXPECT_EQ(OxyOSPointerShape(mojom::CursorType::kHand), OXYOS_POINTER_HAND);
  EXPECT_EQ(OxyOSPointerShape(mojom::CursorType::kIBeam), OXYOS_POINTER_TEXT);
  EXPECT_EQ(OxyOSPointerShape(mojom::CursorType::kEastWestResize),
            OXYOS_POINTER_RESIZE_HORIZONTAL);
  EXPECT_EQ(OxyOSPointerShape(mojom::CursorType::kRowResize),
            OXYOS_POINTER_RESIZE_VERTICAL);
  EXPECT_EQ(OxyOSPointerShape(mojom::CursorType::kSouthEastResize),
            OXYOS_POINTER_RESIZE_TOP_LEFT);
  EXPECT_EQ(OxyOSPointerShape(mojom::CursorType::kSouthWestResize),
            OXYOS_POINTER_RESIZE_TOP_RIGHT);
  EXPECT_EQ(OxyOSPointerShape(mojom::CursorType::kGrabbing),
            OXYOS_POINTER_GRABBING);
  EXPECT_EQ(OxyOSPointerShape(mojom::CursorType::kNoDrop),
            OXYOS_POINTER_NOT_ALLOWED);
  EXPECT_EQ(OxyOSPointerShape(mojom::CursorType::kProgress),
            OXYOS_POINTER_WAIT);
}

TEST(OxyOSConversionsTest, AnOwnedWindowsAnchorIsThePopupsPositioner) {
  OwnedWindowAnchor anchor;
  anchor.anchor_rect = gfx::Rect(10, 20, 0, 30);
  anchor.anchor_position = OwnedWindowAnchorPosition::kBottomLeft;
  anchor.anchor_gravity = OwnedWindowAnchorGravity::kBottomRight;
  anchor.constraint_adjustment =
      OwnedWindowConstraintAdjustment::kAdjustmentSlideX |
      OwnedWindowConstraintAdjustment::kAdjustmentFlipY |
      OwnedWindowConstraintAdjustment::kAdjustmentRezizeY;
  const OxyOSPositioner positioner =
      OxyOSPopupPositioner(anchor, gfx::Size(200, 100));
  EXPECT_EQ(positioner.anchor_x, 10);
  EXPECT_EQ(positioner.anchor_y, 20);
  EXPECT_EQ(positioner.anchor_width, 1u);
  EXPECT_EQ(positioner.anchor_height, 30u);
  EXPECT_EQ(positioner.width, 200u);
  EXPECT_EQ(positioner.height, 100u);
  EXPECT_EQ(positioner.anchor, 6);
  EXPECT_EQ(positioner.gravity, 8);
  EXPECT_EQ(positioner.adjust, 1 | 8 | 32);
}

TEST(OxyOSConversionsTest, ATitleIsCutAtACharacter) {
  EXPECT_EQ(OxyOSTitle(u"Astro", 256), "Astro");
  EXPECT_EQ(OxyOSTitle(u"café", 4), "caf");
  EXPECT_EQ(OxyOSTitle(u"café", 5), "caf\xc3\xa9");
}

TEST(OxyOSConversionsTest, AnInputEventIsTimedByItsDevice) {
  EXPECT_EQ(OxyOSEventTime(1'500'000'123),
            base::TimeTicks() + base::Nanoseconds(1'500'000'123));
  const base::TimeTicks before = base::TimeTicks::Now();
  EXPECT_GE(OxyOSEventTime(0), before);
}

}
