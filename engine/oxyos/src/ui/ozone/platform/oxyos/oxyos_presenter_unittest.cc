// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_presenter.h"

#include <fcntl.h>
#include <unistd.h>

#include <optional>
#include <utility>

#include "base/files/scoped_file.h"
#include "base/time/time.h"
#include "testing/gtest/include/gtest/gtest.h"
#include "ui/gfx/gpu_fence_handle.h"
#include "ui/gfx/presentation_feedback.h"
#include "ui/ozone/platform/oxyos/oxyos_gpu.h"

namespace ui {

namespace {

gfx::GpuFenceHandle Fence() {
  gfx::GpuFenceHandle fence;
  fence.Adopt(base::ScopedFD(open("/dev/null", O_RDONLY | O_CLOEXEC)));
  return fence;
}

gfx::PresentationFeedback Shown(int64_t ms = 16) {
  return gfx::PresentationFeedback(base::TimeTicks() + base::Milliseconds(ms),
                                   base::Hertz(60), 0);
}

gfx::PresentationFeedback Discarded() {
  return gfx::PresentationFeedback::Failure();
}

}

TEST(OxyOSFrameLedgerTest, TheFirstFrameCompletesOnceShown) {
  OxyOSFrameLedger ledger;
  const uint64_t frame = ledger.Submitted(1);
  EXPECT_FALSE(ledger.TakeCompleted());
  EXPECT_TRUE(ledger.Presented(frame, Shown()));
  std::optional<OxyOSFrameLedger::Completed> done = ledger.TakeCompleted();
  ASSERT_TRUE(done);
  EXPECT_TRUE(done->release.is_null());
  EXPECT_EQ(done->feedback, Shown());
  EXPECT_EQ(ledger.pending(), 0u);
}

TEST(OxyOSFrameLedgerTest, AFrameCompletesOnlyOnceTheBufferBeforeIsReleased) {
  OxyOSFrameLedger ledger;
  ledger.Presented(ledger.Submitted(1), Shown());
  ASSERT_TRUE(ledger.TakeCompleted());
  ledger.Presented(ledger.Submitted(2), Shown());
  EXPECT_FALSE(ledger.TakeCompleted()) << "buffer 1 is still shown";
  gfx::GpuFenceHandle fence = Fence();
  const int fd = fence.Peek();
  ledger.Released(1, std::move(fence));
  std::optional<OxyOSFrameLedger::Completed> done = ledger.TakeCompleted();
  ASSERT_TRUE(done);
  EXPECT_EQ(done->release.Peek(), fd) << "the release fence of buffer 1";
}

TEST(OxyOSFrameLedgerTest, AFrameNotShownWaitsForTheBufferStillShown) {
  OxyOSFrameLedger ledger;
  ledger.Presented(ledger.Submitted(1), Shown());
  ASSERT_TRUE(ledger.TakeCompleted());
  ledger.Presented(ledger.Submitted(2), Discarded());
  ledger.Released(2, gfx::GpuFenceHandle());
  EXPECT_FALSE(ledger.TakeCompleted()) << "buffer 1 is shown, not 2";
  ledger.Presented(ledger.Submitted(3), Shown());
  EXPECT_FALSE(ledger.TakeCompleted());
  ledger.Released(1, gfx::GpuFenceHandle());
  std::optional<OxyOSFrameLedger::Completed> second = ledger.TakeCompleted();
  ASSERT_TRUE(second) << "frame 2, once 1 is released";
  EXPECT_EQ(second->feedback, Discarded());
  EXPECT_TRUE(ledger.TakeCompleted()) << "frame 3, as 2 was never shown";
  EXPECT_EQ(ledger.pending(), 0u);
}

TEST(OxyOSFrameLedgerTest, AReleaseBeforeABufferIsSubmittedAgainDoesNotCount) {
  OxyOSFrameLedger ledger;
  ledger.Presented(ledger.Submitted(1), Shown());
  ledger.TakeCompleted();
  ledger.Presented(ledger.Submitted(2), Shown());
  ledger.Released(1, gfx::GpuFenceHandle());
  ASSERT_TRUE(ledger.TakeCompleted());
  ledger.Presented(ledger.Submitted(1), Shown());
  ledger.Released(2, gfx::GpuFenceHandle());
  ASSERT_TRUE(ledger.TakeCompleted());
  ledger.Presented(ledger.Submitted(2), Shown());
  EXPECT_FALSE(ledger.TakeCompleted()) << "buffer 1's first release is stale";
}

TEST(OxyOSFrameLedgerTest, EachSubmissionIsItsOwnFrameEvenOnTheSameBuffer) {
  OxyOSFrameLedger ledger;
  const uint64_t first = ledger.Submitted(1);
  ledger.Presented(first, Shown());
  ledger.TakeCompleted();
  ledger.Released(1, gfx::GpuFenceHandle());
  const uint64_t again = ledger.Submitted(1);
  EXPECT_NE(first, again);
  EXPECT_FALSE(ledger.Presented(first, Shown())) << "the first is answered";
  EXPECT_TRUE(ledger.Presented(again, Shown()));
}

TEST(OxyOSFrameLedgerTest, AFrameIsAnsweredOnceAndOnlyIfSent) {
  OxyOSFrameLedger ledger;
  const uint64_t frame = ledger.Submitted(1);
  EXPECT_FALSE(ledger.Presented(frame + 1, Shown()));
  EXPECT_TRUE(ledger.Presented(frame, Shown()));
  EXPECT_FALSE(ledger.Presented(frame, Shown()));
}

TEST(OxyOSFrameLedgerTest, ADiscardAheadOfTheFramePresentingWaitsForIt) {
  OxyOSFrameLedger ledger;
  ledger.Presented(ledger.Submitted(1), Shown());
  ASSERT_TRUE(ledger.TakeCompleted());
  const uint64_t presenting = ledger.Submitted(2);
  const uint64_t queued = ledger.Submitted(3);
  EXPECT_TRUE(ledger.Presented(queued, Discarded()))
      << "a configure or a newer frame discards the queued one first";
  ledger.Released(3, gfx::GpuFenceHandle());
  EXPECT_FALSE(ledger.TakeCompleted()) << "the frame presenting goes first";
  EXPECT_TRUE(ledger.Presented(presenting, Shown(32)));
  ledger.Released(1, gfx::GpuFenceHandle());
  std::optional<OxyOSFrameLedger::Completed> shown = ledger.TakeCompleted();
  ASSERT_TRUE(shown);
  EXPECT_EQ(shown->feedback, Shown(32));
  ledger.Released(2, gfx::GpuFenceHandle());
  std::optional<OxyOSFrameLedger::Completed> discarded = ledger.TakeCompleted();
  ASSERT_TRUE(discarded);
  EXPECT_EQ(discarded->feedback, Discarded());
  EXPECT_EQ(ledger.pending(), 0u);
}

TEST(OxyOSFrameLedgerTest, AResizeRefusesNewBuffersWhileOldFramesAreAwaited) {
  OxyOSFrameLedger ledger;
  ledger.Presented(ledger.Submitted(1), Shown());
  ASSERT_TRUE(ledger.TakeCompleted());
  const uint64_t old_size = ledger.Submitted(2);
  const uint64_t new_size = ledger.Submitted(3);
  EXPECT_TRUE(ledger.Presented(new_size, Discarded()))
      << "the host answers a frame no configure fits at once";
  ledger.Released(3, gfx::GpuFenceHandle());
  const uint64_t answered = ledger.Submitted(4);
  EXPECT_TRUE(ledger.Presented(old_size, Shown()));
  EXPECT_TRUE(ledger.Presented(answered, Shown()));
  ledger.Released(1, gfx::GpuFenceHandle());
  ledger.Released(2, gfx::GpuFenceHandle());
  for (int frame = 0; frame < 3; ++frame) {
    EXPECT_TRUE(ledger.TakeCompleted()) << frame;
  }
  EXPECT_EQ(ledger.pending(), 0u);
  EXPECT_TRUE(ledger.InFlight(4));
  EXPECT_FALSE(ledger.InFlight(1));
  EXPECT_FALSE(ledger.InFlight(2));
}

TEST(OxyOSFrameLedgerTest, ABufferShownOrAwaitedIsInFlight) {
  OxyOSFrameLedger ledger;
  ledger.Presented(ledger.Submitted(1), Shown());
  ledger.TakeCompleted();
  EXPECT_TRUE(ledger.InFlight(1));
  ledger.Submitted(2);
  EXPECT_TRUE(ledger.InFlight(1));
  EXPECT_TRUE(ledger.InFlight(2));
  EXPECT_FALSE(ledger.InFlight(3));
}

TEST(OxyOSGpuTest, TheTableGivesAFormatsModifiersBestFirstOnce) {
  const std::vector<OxyOSGpuTableEntry> table = {
      {0x34325241, 0x0100000000000002},
      {0x34325258, 0},
      {0x34325241, 0},
      {0x34325241, 0x0100000000000002}};
  EXPECT_EQ(OxyOSModifiersFor(table, 0x34325241),
            (std::vector<uint64_t>{0x0100000000000002, 0}));
  EXPECT_TRUE(OxyOSModifiersFor(table, 0x3231564e).empty());
}

TEST(OxyOSGpuTest, OnlyModifiersTheGPURendersIntoAreKeptInTheTablesOrder) {
  const std::vector<uint64_t> offered = {0x0100000000000008, 0x0100000000000002,
                                         0};
  EXPECT_EQ(OxyOSRenderable(offered, std::nullopt), offered);
  EXPECT_EQ(
      OxyOSRenderable(offered, std::vector<uint64_t>{0, 0x0100000000000002}),
      (std::vector<uint64_t>{0x0100000000000002, 0}));
  EXPECT_TRUE(OxyOSRenderable(offered, std::vector<uint64_t>{}).empty());
}

TEST(OxyOSGpuTest, TheVulkanDriversLoadedAreTheRenderNodesOwn) {
  EXPECT_EQ(OxyOSVulkanDriversFor("i915"), "*intel*");
  EXPECT_EQ(OxyOSVulkanDriversFor("xe"), "*intel*");
  EXPECT_EQ(OxyOSVulkanDriversFor("amdgpu"), "*radeon*");
  EXPECT_EQ(OxyOSVulkanDriversFor("nouveau"), "*nouveau*");
  EXPECT_EQ(OxyOSVulkanDriversFor("virtio_gpu"), "*virtio*");
  EXPECT_EQ(OxyOSVulkanDriversFor("nvidia-drm"), std::nullopt);
}

}
