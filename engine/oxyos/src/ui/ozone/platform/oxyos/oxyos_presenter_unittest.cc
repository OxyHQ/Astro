// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_presenter.h"

#include <fcntl.h>
#include <unistd.h>

#include <optional>
#include <utility>

#include "base/files/scoped_file.h"
#include "testing/gtest/include/gtest/gtest.h"
#include "ui/gfx/gpu_fence_handle.h"
#include "ui/ozone/platform/oxyos/oxyos_gpu.h"

namespace ui {

namespace {

gfx::GpuFenceHandle Fence() {
  gfx::GpuFenceHandle fence;
  fence.Adopt(base::ScopedFD(open("/dev/null", O_RDONLY | O_CLOEXEC)));
  return fence;
}

}

TEST(OxyOSFrameLedgerTest, TheFirstFrameCompletesOnceShown) {
  OxyOSFrameLedger ledger;
  ledger.Submitted(1);
  EXPECT_FALSE(ledger.TakeCompleted());
  EXPECT_TRUE(ledger.Presented(1));
  std::optional<gfx::GpuFenceHandle> done = ledger.TakeCompleted();
  ASSERT_TRUE(done);
  EXPECT_TRUE(done->is_null());
  EXPECT_EQ(ledger.pending(), 0u);
}

TEST(OxyOSFrameLedgerTest, AFrameCompletesOnlyOnceTheBufferBeforeIsReleased) {
  OxyOSFrameLedger ledger;
  ledger.Submitted(1);
  ledger.Presented(1);
  ASSERT_TRUE(ledger.TakeCompleted());
  ledger.Submitted(2);
  ledger.Presented(2);
  EXPECT_FALSE(ledger.TakeCompleted()) << "buffer 1 is still shown";
  gfx::GpuFenceHandle fence = Fence();
  const int fd = fence.Peek();
  ledger.Released(1, std::move(fence));
  std::optional<gfx::GpuFenceHandle> done = ledger.TakeCompleted();
  ASSERT_TRUE(done);
  EXPECT_EQ(done->Peek(), fd) << "the release fence of buffer 1";
}

TEST(OxyOSFrameLedgerTest, AFrameNotShownWaitsForTheBufferStillShown) {
  OxyOSFrameLedger ledger;
  ledger.Submitted(1);
  ledger.Presented(1);
  ASSERT_TRUE(ledger.TakeCompleted());
  ledger.Submitted(2);
  ledger.Presented(2);
  ledger.Released(2, gfx::GpuFenceHandle());
  EXPECT_FALSE(ledger.TakeCompleted()) << "buffer 1 is shown, not 2";
  ledger.Submitted(3);
  ledger.Presented(3);
  EXPECT_FALSE(ledger.TakeCompleted());
  ledger.Released(1, gfx::GpuFenceHandle());
  EXPECT_TRUE(ledger.TakeCompleted()) << "frame 2, once 1 is released";
  EXPECT_TRUE(ledger.TakeCompleted()) << "frame 3, as 2 was never shown";
  EXPECT_EQ(ledger.pending(), 0u);
}

TEST(OxyOSFrameLedgerTest, AReleaseBeforeABufferIsSubmittedAgainDoesNotCount) {
  OxyOSFrameLedger ledger;
  ledger.Submitted(1);
  ledger.Presented(1);
  ledger.TakeCompleted();
  ledger.Submitted(2);
  ledger.Presented(2);
  ledger.Released(1, gfx::GpuFenceHandle());
  ASSERT_TRUE(ledger.TakeCompleted());
  ledger.Submitted(1);
  ledger.Presented(1);
  ledger.Released(2, gfx::GpuFenceHandle());
  ASSERT_TRUE(ledger.TakeCompleted());
  ledger.Submitted(2);
  ledger.Presented(2);
  EXPECT_FALSE(ledger.TakeCompleted()) << "buffer 1's first release is stale";
}

TEST(OxyOSFrameLedgerTest, OnlyAPresentationOfTheNextFrameIsTaken) {
  OxyOSFrameLedger ledger;
  ledger.Submitted(1);
  ledger.Submitted(2);
  EXPECT_FALSE(ledger.Presented(2));
  EXPECT_TRUE(ledger.Presented(1));
  EXPECT_TRUE(ledger.Presented(2));
  EXPECT_FALSE(ledger.Presented(3));
}

TEST(OxyOSFrameLedgerTest, ABufferShownOrAwaitedIsInFlight) {
  OxyOSFrameLedger ledger;
  ledger.Submitted(1);
  ledger.Presented(1);
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

}
