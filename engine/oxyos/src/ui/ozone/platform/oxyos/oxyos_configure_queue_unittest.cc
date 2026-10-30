// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_configure_queue.h"

#include "testing/gtest/include/gtest/gtest.h"

namespace ui {

TEST(OxyOSConfigureQueueTest, NoFrameIsShownBeforeTheFirstConfigure) {
  OxyOSConfigureQueue queue;
  EXPECT_EQ(queue.Latch(gfx::Size(800, 600), 1), std::nullopt);
}

TEST(OxyOSConfigureQueueTest, AFrameAnswersTheConfigureItWasDrawnFor) {
  OxyOSConfigureQueue queue;
  queue.Push({.serial = 4, .size_px = gfx::Size(800, 600), .viz_seq = 2});
  EXPECT_EQ(queue.Latch(gfx::Size(800, 600), 1), std::nullopt);
  EXPECT_TRUE(queue.waiting());
  EXPECT_EQ(queue.Latch(gfx::Size(800, 600), 2), 4u);
  EXPECT_FALSE(queue.waiting());
  EXPECT_EQ(queue.Latch(gfx::Size(800, 600), 3), 4u);
}

TEST(OxyOSConfigureQueueTest, AFrameOfTheOldSizeDuringAResizeIsNotShown) {
  OxyOSConfigureQueue queue;
  queue.Push({.serial = 1, .size_px = gfx::Size(800, 600), .viz_seq = 1});
  ASSERT_EQ(queue.Latch(gfx::Size(800, 600), 1), 1u);
  queue.Push({.serial = 2, .size_px = gfx::Size(900, 600), .viz_seq = 2});
  EXPECT_EQ(queue.Latch(gfx::Size(800, 600), 1), 1u);
  EXPECT_EQ(queue.Latch(gfx::Size(800, 600), 2), std::nullopt);
  EXPECT_TRUE(queue.waiting());
  EXPECT_EQ(queue.Latch(gfx::Size(900, 600), 2), 2u);
  EXPECT_FALSE(queue.waiting());
}

TEST(OxyOSConfigureQueueTest,
     AConfigureThatDrawsNothingNewIsAnsweredByTheNextFrame) {
  OxyOSConfigureQueue queue;
  queue.Push({.serial = 1, .size_px = gfx::Size(800, 600), .viz_seq = 3});
  queue.Push({.serial = 2, .size_px = gfx::Size(800, 600), .viz_seq = -1});
  EXPECT_EQ(queue.Latch(gfx::Size(800, 600), 3), 2u);
  EXPECT_FALSE(queue.waiting());
}

TEST(OxyOSConfigureQueueTest, TheNewestConfigureAFrameSatisfiesIsAnswered) {
  OxyOSConfigureQueue queue;
  queue.Push({.serial = 1, .size_px = gfx::Size(800, 600), .viz_seq = 1});
  queue.Push({.serial = 2, .size_px = gfx::Size(820, 600), .viz_seq = 2});
  queue.Push({.serial = 3, .size_px = gfx::Size(840, 600), .viz_seq = 3});
  EXPECT_EQ(queue.Latch(gfx::Size(840, 600), 3), 3u);
  EXPECT_FALSE(queue.waiting());
  ASSERT_TRUE(queue.latched());
  EXPECT_EQ(queue.latched()->serial, 3u);
}

TEST(OxyOSConfigureQueueTest,
     AFrameWithoutASequenceAnswersEveryConfigureBeforeIt) {
  OxyOSConfigureQueue queue;
  queue.Push({.serial = 1, .size_px = gfx::Size(800, 600), .viz_seq = 7});
  queue.Push({.serial = 2, .size_px = gfx::Size(800, 600), .viz_seq = 9});
  EXPECT_EQ(queue.Latch(gfx::Size(800, 600), -1), 2u);
}

TEST(OxyOSConfigureQueueTest, ClearForgetsEverything) {
  OxyOSConfigureQueue queue;
  queue.Push({.serial = 1, .size_px = gfx::Size(800, 600), .viz_seq = 1});
  ASSERT_EQ(queue.Latch(gfx::Size(800, 600), 1), 1u);
  queue.Clear();
  EXPECT_EQ(queue.Latch(gfx::Size(800, 600), 2), std::nullopt);
}

}
