// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_screen.h"

#include <vector>

#include "testing/gtest/include/gtest/gtest.h"
#include "ui/display/display.h"
#include "ui/ozone/platform/oxyos/oxyos_vsync.h"

namespace ui {

TEST(OxyOSScreenTest, EachOutputIsADisplayOfItsSizeScaleRefreshAndWorkArea) {
  const std::vector<display::Display> displays = OxyOSDisplaysOf({
      {.id = 2,
       .size = gfx::Size(1280, 720),
       .scale_120 = 180,
       .refresh_mhz = 143998,
       .work_area = gfx::Rect(0, 28, 1280, 692)},
      {.id = 1,
       .size = gfx::Size(1920, 1200),
       .scale_120 = 120,
       .refresh_mhz = 60000,
       .primary = true},
  });
  ASSERT_EQ(displays.size(), 2u);
  EXPECT_EQ(displays[0].id(), 1);
  EXPECT_EQ(displays[0].bounds(), gfx::Rect(0, 0, 1920, 1200));
  EXPECT_EQ(displays[0].work_area(), displays[0].bounds());
  EXPECT_FLOAT_EQ(displays[0].device_scale_factor(), 1.0f);
  EXPECT_FLOAT_EQ(displays[0].display_frequency(), 60.0f);
  EXPECT_EQ(displays[1].id(), 2);
  EXPECT_EQ(displays[1].bounds(), gfx::Rect(1920, 0, 1280, 720));
  EXPECT_EQ(displays[1].work_area(), gfx::Rect(1920, 28, 1280, 692));
  EXPECT_FLOAT_EQ(displays[1].device_scale_factor(), 1.5f);
  EXPECT_NEAR(displays[1].display_frequency(), 144.0f, 0.01f);
}

TEST(OxyOSScreenTest, AnOutputsRefreshPacesFrames) {
  EXPECT_EQ(OxyOSRefreshInterval(60000), base::Microseconds(16667));
  EXPECT_EQ(OxyOSRefreshInterval(119998), base::Microseconds(8333));
  EXPECT_TRUE(OxyOSRefreshInterval(0).is_zero());
  auto refresh = base::MakeRefCounted<OxyOSRefresh>();
  OxyOSVSyncProvider provider(refresh);
  base::TimeTicks timebase;
  base::TimeDelta interval;
  EXPECT_FALSE(provider.GetVSyncParametersIfAvailable(&timebase, &interval));
  refresh->set_refresh_mhz(120000);
  ASSERT_TRUE(provider.GetVSyncParametersIfAvailable(&timebase, &interval));
  EXPECT_EQ(interval, base::Microseconds(8333));
}

}
