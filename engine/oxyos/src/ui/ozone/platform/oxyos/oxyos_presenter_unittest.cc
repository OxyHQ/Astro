// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_presenter.h"

#include <fcntl.h>
#include <unistd.h>

#include <algorithm>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include "base/containers/circular_deque.h"
#include "base/files/scoped_file.h"
#include "base/strings/string_number_conversions.h"
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
  const uint64_t frame = ledger.Submit(1, true).frame;
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
  ledger.Presented(ledger.Submit(1, true).frame, Shown());
  ASSERT_TRUE(ledger.TakeCompleted());
  ledger.Presented(ledger.Submit(2, true).frame, Shown());
  EXPECT_FALSE(ledger.TakeCompleted()) << "buffer 1 is still shown";
  gfx::GpuFenceHandle fence = Fence();
  const int fd = fence.Peek();
  ledger.Released(1, std::move(fence));
  std::optional<OxyOSFrameLedger::Completed> done = ledger.TakeCompleted();
  ASSERT_TRUE(done);
  EXPECT_EQ(done->release.Peek(), fd) << "the release fence of buffer 1";
}

TEST(OxyOSFrameLedgerTest, AFrameNotShownCompletesSkippedOnceItsBufferIsBack) {
  OxyOSFrameLedger ledger;
  ledger.Presented(ledger.Submit(1, true).frame, Shown());
  ASSERT_TRUE(ledger.TakeCompleted());
  ledger.Presented(ledger.Submit(2, true).frame, Discarded());
  EXPECT_FALSE(ledger.TakeCompleted()) << "OxyOS has not let go of buffer 2";
  gfx::GpuFenceHandle fence = Fence();
  const int fd = fence.Peek();
  ledger.Released(2, std::move(fence));
  std::optional<OxyOSFrameLedger::Completed> skipped = ledger.TakeCompleted();
  ASSERT_TRUE(skipped) << "buffer 1 stays on screen; viz keeps it displayed";
  EXPECT_FALSE(skipped->shown);
  EXPECT_EQ(skipped->release.Peek(), fd) << "viz takes buffer 2 back";
  ledger.Presented(ledger.Submit(3, true).frame, Shown());
  EXPECT_FALSE(ledger.TakeCompleted()) << "buffer 1, still shown, goes back";
  ledger.Released(1, gfx::GpuFenceHandle());
  std::optional<OxyOSFrameLedger::Completed> shown = ledger.TakeCompleted();
  ASSERT_TRUE(shown);
  EXPECT_TRUE(shown->shown);
  EXPECT_EQ(ledger.pending(), 0u);
}

TEST(OxyOSFrameLedgerTest, AReleaseBeforeABufferIsSubmittedAgainDoesNotCount) {
  OxyOSFrameLedger ledger;
  ledger.Presented(ledger.Submit(1, true).frame, Shown());
  ledger.TakeCompleted();
  ledger.Presented(ledger.Submit(2, true).frame, Shown());
  ledger.Released(1, gfx::GpuFenceHandle());
  ASSERT_TRUE(ledger.TakeCompleted());
  ledger.Presented(ledger.Submit(1, true).frame, Shown());
  ledger.Released(2, gfx::GpuFenceHandle());
  ASSERT_TRUE(ledger.TakeCompleted());
  ledger.Presented(ledger.Submit(2, true).frame, Shown());
  EXPECT_FALSE(ledger.TakeCompleted()) << "buffer 1's first release is stale";
}

TEST(OxyOSFrameLedgerTest, EachSubmissionIsItsOwnFrameEvenOnTheSameBuffer) {
  OxyOSFrameLedger ledger;
  const uint64_t first = ledger.Submit(1, true).frame;
  ledger.Presented(first, Shown());
  ledger.TakeCompleted();
  ledger.Released(1, gfx::GpuFenceHandle());
  const uint64_t again = ledger.Submit(1, true).frame;
  EXPECT_NE(first, again);
  EXPECT_FALSE(ledger.Presented(first, Shown())) << "the first is answered";
  EXPECT_TRUE(ledger.Presented(again, Shown()));
}

TEST(OxyOSFrameLedgerTest, AFrameIsAnsweredOnceAndOnlyIfSent) {
  OxyOSFrameLedger ledger;
  const uint64_t frame = ledger.Submit(1, true).frame;
  EXPECT_FALSE(ledger.Presented(frame + 1, Shown()));
  EXPECT_TRUE(ledger.Presented(frame, Shown()));
  EXPECT_FALSE(ledger.Presented(frame, Shown()));
}

TEST(OxyOSFrameLedgerTest, ADiscardAheadOfTheFramePresentingWaitsForIt) {
  OxyOSFrameLedger ledger;
  ledger.Presented(ledger.Submit(1, true).frame, Shown());
  ASSERT_TRUE(ledger.TakeCompleted());
  const uint64_t presenting = ledger.Submit(2, true).frame;
  const uint64_t queued = ledger.Submit(3, true).frame;
  EXPECT_TRUE(ledger.Presented(queued, Discarded()))
      << "a configure or a newer frame discards the queued one first";
  ledger.Released(3, gfx::GpuFenceHandle());
  EXPECT_FALSE(ledger.TakeCompleted()) << "the frame presenting goes first";
  EXPECT_TRUE(ledger.Presented(presenting, Shown(32)));
  ledger.Released(1, gfx::GpuFenceHandle());
  std::optional<OxyOSFrameLedger::Completed> shown = ledger.TakeCompleted();
  ASSERT_TRUE(shown);
  EXPECT_TRUE(shown->shown);
  EXPECT_EQ(shown->feedback, Shown(32));
  ledger.Released(2, gfx::GpuFenceHandle());
  std::optional<OxyOSFrameLedger::Completed> discarded = ledger.TakeCompleted();
  ASSERT_TRUE(discarded);
  EXPECT_FALSE(discarded->shown);
  EXPECT_TRUE(discarded->feedback.failed());
  EXPECT_EQ(ledger.pending(), 0u);
}

TEST(OxyOSFrameLedgerTest, AResizeRefusesNewBuffersWhileOldFramesAreAwaited) {
  OxyOSFrameLedger ledger;
  ledger.Presented(ledger.Submit(1, true).frame, Shown());
  ASSERT_TRUE(ledger.TakeCompleted());
  const uint64_t old_size = ledger.Submit(2, true).frame;
  const uint64_t new_size = ledger.Submit(3, true).frame;
  EXPECT_TRUE(ledger.Presented(new_size, Discarded()))
      << "the host answers a frame no configure fits at once";
  ledger.Released(3, gfx::GpuFenceHandle());
  const uint64_t answered = ledger.Submit(4, true).frame;
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
  ledger.Presented(ledger.Submit(1, true).frame, Shown());
  ledger.TakeCompleted();
  EXPECT_TRUE(ledger.InFlight(1));
  ledger.Submit(2, true);
  EXPECT_TRUE(ledger.InFlight(1));
  EXPECT_TRUE(ledger.InFlight(2));
  EXPECT_FALSE(ledger.InFlight(3));
}

TEST(OxyOSFrameLedgerTest, AnEmptySwapIsNeverSentAgainAndIsSkipped) {
  OxyOSFrameLedger ledger;
  ledger.Presented(ledger.Submit(1, true).frame, Shown());
  ASSERT_TRUE(ledger.TakeCompleted());
  const uint64_t sent = ledger.Submit(2, true).frame;
  const OxyOSFrameLedger::Submission again = ledger.Submit(2, false);
  EXPECT_EQ(again.route, OxyOSFrameLedger::Route::kRepeat)
      << "OxyOS holds buffer 2 and refuses it a second time";
  EXPECT_FALSE(ledger.Presented(again.frame, Shown()))
      << "no answer comes from the wire for a frame never sent";
  EXPECT_TRUE(ledger.Presented(sent, Shown(32)));
  ledger.Released(1, gfx::GpuFenceHandle());
  ASSERT_TRUE(ledger.TakeCompleted());
  std::optional<OxyOSFrameLedger::Completed> repeat = ledger.TakeCompleted();
  ASSERT_TRUE(repeat) << "a skipped swap gives viz nothing back to wait for";
  EXPECT_FALSE(repeat->shown);
  EXPECT_TRUE(repeat->release.is_null());
  EXPECT_TRUE(ledger.Held(2));
  ledger.Presented(ledger.Submit(3, true).frame, Shown(48));
  EXPECT_FALSE(ledger.TakeCompleted()) << "buffer 2 is still on screen";
  ledger.Released(2, gfx::GpuFenceHandle());
  EXPECT_TRUE(ledger.TakeCompleted());
}

TEST(OxyOSFrameLedgerTest, EmptySwapsInARowNeverWaitForTheScreen) {
  OxyOSFrameLedger ledger;
  ledger.Presented(ledger.Submit(1, true).frame, Shown());
  ASSERT_TRUE(ledger.TakeCompleted());
  for (int swap = 0; swap < 4; ++swap) {
    ASSERT_EQ(ledger.Submit(1, false).route, OxyOSFrameLedger::Route::kRepeat);
    ASSERT_EQ(ledger.Submit(1, false).route, OxyOSFrameLedger::Route::kRepeat);
    EXPECT_TRUE(ledger.TakeCompleted()) << swap;
    EXPECT_TRUE(ledger.TakeCompleted()) << swap;
  }
  EXPECT_EQ(ledger.pending(), 0u);
}

TEST(OxyOSFrameLedgerTest, AnEmptySwapOfABufferAlreadyLetGoIsNotSent) {
  OxyOSFrameLedger ledger;
  ledger.Presented(ledger.Submit(1, true).frame, Shown());
  ASSERT_TRUE(ledger.TakeCompleted());
  ledger.Presented(ledger.Submit(2, true).frame, Discarded());
  ledger.Released(2, gfx::GpuFenceHandle());
  ASSERT_TRUE(ledger.TakeCompleted());
  EXPECT_EQ(ledger.Submit(2, false).route, OxyOSFrameLedger::Route::kRepeat)
      << "viz took buffer 2 back and may draw into it: OxyOS must not hold it";
  EXPECT_EQ(ledger.Submit(2, true).route, OxyOSFrameLedger::Route::kSend)
      << "drawn into again, it is a new frame";
}

TEST(OxyOSFrameLedgerTest, AnotherBufferStillHeldIsRefusedHere) {
  OxyOSFrameLedger ledger;
  ledger.Submit(1, true);
  ledger.Submit(2, true);
  EXPECT_EQ(ledger.Submit(1, true).route, OxyOSFrameLedger::Route::kRefuse)
      << "OxyOS would close the connection for it";
  EXPECT_EQ(ledger.pending(), 2u);
}

namespace {

class Rng {
 public:
  explicit Rng(uint32_t seed) : state_(seed * 2654435761u + 1) {}
  uint32_t Next(uint32_t bound) {
    state_ = state_ * 1664525u + 1013904223u;
    return (state_ >> 8) % bound;
  }

 private:
  uint32_t state_;
};

struct WireFrame {
  uint64_t frame = 0;
  uint32_t buffer = 0;
};

class FakeCompositor {
 public:
  enum class Kind { kAnswer, kRelease };
  struct Event {
    Kind kind;
    uint64_t frame = 0;
    bool shown = false;
    uint32_t buffer = 0;
  };

  bool Holds(uint32_t buffer) const {
    auto has = [buffer](const std::optional<WireFrame>& slot) {
      return slot && slot->buffer == buffer;
    };
    return has(displayed_) || has(presenting_) || has(queued_) ||
           std::ranges::count(deferred_, buffer) > 0;
  }

  bool Submit(uint64_t frame, uint32_t buffer) {
    if (Holds(buffer)) {
      return false;
    }
    if (queued_) {
      Discard(*queued_);
    }
    queued_ = WireFrame{frame, buffer};
    return true;
  }

  void RefuseAtHost(uint64_t frame, uint32_t buffer) {
    events_.push_back({Kind::kAnswer, frame, false});
    events_.push_back({Kind::kRelease, 0, false, buffer});
  }

  void Configure() {
    if (queued_) {
      Discard(*queued_);
      queued_.reset();
    }
  }

  void BeginPresent() {
    if (!presenting_ && queued_) {
      presenting_ = queued_;
      queued_.reset();
    }
  }

  void CompletePresent() {
    if (!presenting_) {
      return;
    }
    events_.push_back({Kind::kAnswer, presenting_->frame, true});
    if (displayed_) {
      events_.push_back({Kind::kRelease, 0, false, displayed_->buffer});
    }
    displayed_ = presenting_;
    presenting_.reset();
    for (uint32_t buffer : deferred_) {
      events_.push_back({Kind::kRelease, 0, false, buffer});
    }
    deferred_.clear();
  }

  base::circular_deque<Event>& events() { return events_; }

 private:
  void Discard(const WireFrame& frame) {
    events_.push_back({Kind::kAnswer, frame.frame, false});
    if (presenting_) {
      deferred_.push_back(frame.buffer);
    } else {
      events_.push_back({Kind::kRelease, 0, false, frame.buffer});
    }
  }

  std::optional<WireFrame> displayed_;
  std::optional<WireFrame> presenting_;
  std::optional<WireFrame> queued_;
  std::vector<uint32_t> deferred_;
  base::circular_deque<Event> events_;
};

class VizAgainstOxyOS {
 public:
  explicit VizAgainstOxyOS(uint32_t seed) : rng_(seed) {
    for (uint32_t buffer = 1; buffer <= 3; ++buffer) {
      available_.push_back(buffer);
    }
  }

  void Step() {
    switch (rng_.Next(9)) {
      case 0:
      case 1:
        Draw();
        break;
      case 2:
        EmptySwap();
        break;
      case 3:
        compositor_.BeginPresent();
        break;
      case 4:
        compositor_.CompletePresent();
        break;
      case 5:
        if (rng_.Next(4) == 0) {
          compositor_.Configure();
        }
        break;
      default:
        Deliver();
        break;
    }
  }

  void Drain() {
    for (int round = 0; round < 64 && !in_flight_.empty(); ++round) {
      compositor_.BeginPresent();
      compositor_.CompletePresent();
      while (!compositor_.events().empty()) {
        Deliver();
      }
    }
  }

  size_t in_flight() const { return in_flight_.size(); }
  std::string failure() const { return failure_; }

 private:
  void Draw() {
    if (in_flight_.size() >= 2 || available_.empty()) {
      return;
    }
    const uint32_t buffer = available_.front();
    available_.pop_front();
    if (compositor_.Holds(buffer)) {
      Fail("viz drew into a buffer the compositor still reads: " +
           base::NumberToString(buffer));
    }
    in_flight_.push_back(buffer);
    last_swapped_ = buffer;
    Present(buffer, true);
  }

  void EmptySwap() {
    if (in_flight_.size() >= 2 || !last_swapped_) {
      return;
    }
    in_flight_.push_back(0);
    Present(last_swapped_, false);
  }

  void Present(uint32_t buffer, bool damaged) {
    const OxyOSFrameLedger::Submission submission =
        ledger_.Submit(buffer, damaged);
    switch (submission.route) {
      case OxyOSFrameLedger::Route::kRefuse:
        Fail("the ledger refused buffer " + base::NumberToString(buffer));
        return;
      case OxyOSFrameLedger::Route::kRepeat:
        Complete();
        return;
      case OxyOSFrameLedger::Route::kSend:
        if (rng_.Next(8) == 0) {
          compositor_.RefuseAtHost(submission.frame, buffer);
        } else if (!compositor_.Submit(submission.frame, buffer)) {
          Fail("OxyOS refused buffer " + base::NumberToString(buffer) +
               ": it still holds it");
        }
        return;
    }
  }

  void Deliver() {
    if (compositor_.events().empty()) {
      return;
    }
    const FakeCompositor::Event event = compositor_.events().front();
    compositor_.events().pop_front();
    if (event.kind == FakeCompositor::Kind::kAnswer) {
      if (!ledger_.Presented(event.frame,
                             event.shown ? Shown() : Discarded())) {
        Fail("an answer was taken as a frame never sent");
      }
    } else {
      ledger_.Released(event.buffer, gfx::GpuFenceHandle());
    }
    Complete();
  }

  void Complete() {
    while (std::optional<OxyOSFrameLedger::Completed> done =
               ledger_.TakeCompleted()) {
      if (in_flight_.empty()) {
        Fail("a swap completed that viz never made");
        return;
      }
      const uint32_t buffer = in_flight_.front();
      in_flight_.pop_front();
      if (!done->shown) {
        if (buffer) {
          available_.push_back(buffer);
        }
        continue;
      }
      if (displayed_) {
        available_.push_back(displayed_);
      }
      displayed_ = buffer;
    }
  }

  void Fail(const std::string& why) {
    if (failure_.empty()) {
      failure_ = why;
    }
  }

  Rng rng_;
  OxyOSFrameLedger ledger_;
  FakeCompositor compositor_;
  base::circular_deque<uint32_t> available_;
  base::circular_deque<uint32_t> in_flight_;
  uint32_t displayed_ = 0;
  uint32_t last_swapped_ = 0;
  std::string failure_;
};

}

TEST(OxyOSFrameLedgerTest, VizEmptySwapsAndDiscardsKeepOxyOSWireRules) {
  for (uint32_t seed = 0; seed < 500; ++seed) {
    VizAgainstOxyOS run(seed);
    for (int step = 0; step < 600; ++step) {
      run.Step();
    }
    run.Drain();
    ASSERT_EQ(run.failure(), "") << "seed " << seed;
    ASSERT_EQ(run.in_flight(), 0u) << "seed " << seed << ": swaps stuck";
  }
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
