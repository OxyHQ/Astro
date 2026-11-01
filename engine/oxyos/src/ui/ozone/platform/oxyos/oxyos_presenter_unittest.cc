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
#include "base/containers/flat_map.h"
#include "base/files/scoped_file.h"
#include "base/strings/string_number_conversions.h"
#include "base/time/time.h"
#include "testing/gtest/include/gtest/gtest.h"
#include "ui/gfx/gpu_fence_handle.h"
#include "ui/gfx/presentation_feedback.h"
#include "ui/gfx/swap_result.h"
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

TEST(OxyOSFrameLedgerTest, AFrameNotShownWaitsForTheBufferStillShown) {
  OxyOSFrameLedger ledger;
  ledger.Presented(ledger.Submit(1, true).frame, Shown());
  ASSERT_TRUE(ledger.TakeCompleted());
  ledger.Presented(ledger.Submit(2, true).frame, Discarded());
  ledger.Released(2, gfx::GpuFenceHandle());
  const uint64_t next = ledger.Submit(3, true).frame;
  EXPECT_FALSE(ledger.TakeCompleted())
      << "buffer 1 is shown, and frame 3 will take its place";
  ledger.Presented(next, Shown());
  gfx::GpuFenceHandle fence = Fence();
  const int fd = fence.Peek();
  ledger.Released(1, std::move(fence));
  std::optional<OxyOSFrameLedger::Completed> second = ledger.TakeCompleted();
  ASSERT_TRUE(second) << "frame 2, once 1 is released";
  EXPECT_EQ(second->result, gfx::SwapResult::SWAP_ACK);
  EXPECT_TRUE(second->feedback.failed());
  EXPECT_EQ(second->release.Peek(), fd);
  EXPECT_TRUE(ledger.TakeCompleted()) << "frame 3, as 2 was let go";
  EXPECT_EQ(ledger.pending(), 0u);
}

TEST(OxyOSFrameLedgerTest, AFrameNotShownWithNothingToFollowRecreatesBuffers) {
  OxyOSFrameLedger ledger;
  ledger.Presented(ledger.Submit(1, true).frame, Shown());
  ASSERT_TRUE(ledger.TakeCompleted());
  ledger.Presented(ledger.Submit(2, true).frame, Discarded());
  ledger.Released(2, gfx::GpuFenceHandle());
  std::optional<OxyOSFrameLedger::Completed> refused = ledger.TakeCompleted();
  ASSERT_TRUE(refused) << "waiting for buffer 1 would wait for ever";
  EXPECT_EQ(refused->result, gfx::SwapResult::SWAP_NAK_RECREATE_BUFFERS);
  EXPECT_TRUE(ledger.InFlight(1)) << "OxyOS still shows it";
  ledger.Released(1, Fence());
  EXPECT_FALSE(ledger.InFlight(1));
  ledger.Presented(ledger.Submit(7, true).frame, Shown());
  std::optional<OxyOSFrameLedger::Completed> fresh = ledger.TakeCompleted();
  ASSERT_TRUE(fresh) << "viz has no buffer displayed after recreating them";
  EXPECT_TRUE(fresh->release.is_null());
}

TEST(OxyOSFrameLedgerTest, TwoFramesRefusedInARowDoNotFreezeViz) {
  OxyOSFrameLedger ledger;
  ledger.Presented(ledger.Submit(1, true).frame, Shown());
  ASSERT_TRUE(ledger.TakeCompleted());
  for (uint32_t buffer : {2u, 3u}) {
    ledger.Presented(ledger.Submit(buffer, true).frame, Discarded());
    ledger.Released(buffer, gfx::GpuFenceHandle());
  }
  std::optional<OxyOSFrameLedger::Completed> first = ledger.TakeCompleted();
  ASSERT_TRUE(first) << "both pending swaps refused: nothing will replace 1";
  EXPECT_EQ(first->result, gfx::SwapResult::SWAP_NAK_RECREATE_BUFFERS);
  std::optional<OxyOSFrameLedger::Completed> second = ledger.TakeCompleted();
  ASSERT_TRUE(second);
  EXPECT_EQ(second->result, gfx::SwapResult::SWAP_ACK);
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
  EXPECT_EQ(shown->result, gfx::SwapResult::SWAP_ACK);
  EXPECT_EQ(shown->feedback, Shown(32));
  ledger.Released(2, gfx::GpuFenceHandle());
  std::optional<OxyOSFrameLedger::Completed> discarded = ledger.TakeCompleted();
  ASSERT_TRUE(discarded);
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
  EXPECT_EQ(repeat->result, gfx::SwapResult::SWAP_SKIPPED);
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

TEST(OxyOSFrameLedgerTest, AnEmptySwapOfAFrameLetGoShowsItAndKeepsItDisplayed) {
  OxyOSFrameLedger ledger;
  ledger.Presented(ledger.Submit(1, true).frame, Shown());
  ASSERT_TRUE(ledger.TakeCompleted());
  ledger.Presented(ledger.Submit(2, true).frame, Discarded());
  ledger.Released(2, gfx::GpuFenceHandle());
  const OxyOSFrameLedger::Submission again = ledger.Submit(2, false);
  ASSERT_EQ(again.route, OxyOSFrameLedger::Route::kSend)
      << "the latest frame never reached the screen; OxyOS may take it again";
  ledger.Presented(again.frame, Shown());
  ledger.Released(1, gfx::GpuFenceHandle());
  std::optional<OxyOSFrameLedger::Completed> discarded = ledger.TakeCompleted();
  ASSERT_TRUE(discarded);
  EXPECT_EQ(discarded->result, gfx::SwapResult::SWAP_ACK);
  std::optional<OxyOSFrameLedger::Completed> repeat = ledger.TakeCompleted();
  ASSERT_TRUE(repeat);
  EXPECT_EQ(repeat->result, gfx::SwapResult::SWAP_SKIPPED)
      << "viz keeps buffer 2 displayed, as OxyOS now does";
  ledger.Presented(ledger.Submit(3, true).frame, Shown());
  EXPECT_FALSE(ledger.TakeCompleted()) << "buffer 2 is on screen";
  ledger.Released(2, gfx::GpuFenceHandle());
  EXPECT_TRUE(ledger.TakeCompleted());
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
  explicit VizAgainstOxyOS(uint32_t seed) : rng_(seed) { Allocate(); }

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
  int recreated() const { return recreated_; }
  std::string failure() const { return failure_; }

 private:
  void Allocate() {
    for (int i = 0; i < 3; ++i) {
      available_.push_back(++next_buffer_);
    }
  }

  void Draw() {
    if (in_flight_.size() >= 2 || available_.empty()) {
      return;
    }
    const uint32_t buffer = available_.front();
    available_.pop_front();
    if (compositor_.Holds(buffer)) {
      Fail("viz drew into a buffer OxyOS still reads: " +
           base::NumberToString(buffer));
    }
    if (read_[buffer] > 0) {
      Fail("viz drew into a buffer its last frames still read: " +
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
    if (submission.route == OxyOSFrameLedger::Route::kRefuse) {
      Fail("the ledger refused buffer " + base::NumberToString(buffer));
      in_flight_.pop_back();
      return;
    }
    ++read_[buffer];
    scheduled_.push_back(buffer);
    if (submission.route == OxyOSFrameLedger::Route::kRepeat) {
      Complete();
      return;
    }
    if (rng_.Next(8) == 0) {
      compositor_.RefuseAtHost(submission.frame, buffer);
    } else if (!compositor_.Submit(submission.frame, buffer)) {
      Fail("OxyOS refused buffer " + base::NumberToString(buffer) +
           ": it still holds it");
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
      if (last_completed_) {
        --read_[last_completed_];
      }
      last_completed_ = scheduled_.front();
      scheduled_.pop_front();
      if (done->result == gfx::SwapResult::SWAP_NAK_RECREATE_BUFFERS) {
        ++recreated_;
        available_.clear();
        displayed_ = 0;
        last_swapped_ = 0;
        for (uint32_t& buffer : in_flight_) {
          buffer = 0;
        }
        Allocate();
      }
      const uint32_t buffer = in_flight_.front();
      in_flight_.pop_front();
      if (done->result == gfx::SwapResult::SWAP_SKIPPED) {
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
  base::circular_deque<uint32_t> scheduled_;
  base::flat_map<uint32_t, int> read_;
  uint32_t last_completed_ = 0;
  uint32_t displayed_ = 0;
  uint32_t last_swapped_ = 0;
  uint32_t next_buffer_ = 0;
  int recreated_ = 0;
  std::string failure_;
};

}

TEST(OxyOSFrameLedgerTest, VizEmptySwapsAndDiscardsKeepOxyOSWireRules) {
  int recreated = 0;
  for (uint32_t seed = 0; seed < 500; ++seed) {
    VizAgainstOxyOS run(seed);
    for (int step = 0; step < 600; ++step) {
      run.Step();
    }
    run.Drain();
    ASSERT_EQ(run.failure(), "") << "seed " << seed;
    ASSERT_EQ(run.in_flight(), 0u) << "seed " << seed << ": swaps stuck";
    recreated += run.recreated();
  }
  EXPECT_GT(recreated, 0) << "the runs never reached a stall";
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

}
