// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_configure_queue.h"

#include <limits>

namespace ui {

OxyOSConfigureQueue::OxyOSConfigureQueue() = default;
OxyOSConfigureQueue::~OxyOSConfigureQueue() = default;

void OxyOSConfigureQueue::Push(const Request& request) {
  in_flight_.push_back(request);
}

std::optional<uint64_t> OxyOSConfigureQueue::Latch(const gfx::Size& frame_size,
                                                   int64_t frame_seq) {
  const int64_t seq =
      frame_seq == -1 ? std::numeric_limits<int64_t>::max() : frame_seq;
  std::optional<size_t> answered;
  for (size_t i = 0; i < in_flight_.size(); ++i) {
    const Request& request = in_flight_[i];
    if (request.viz_seq != -1 && request.viz_seq > seq) {
      break;
    }
    answered = i;
  }
  const Request* candidate =
      answered ? &in_flight_[*answered] : (latched_ ? &*latched_ : nullptr);
  if (!candidate || candidate->size_px != frame_size) {
    return std::nullopt;
  }
  latched_ = *candidate;
  if (answered) {
    in_flight_.erase(in_flight_.begin(), in_flight_.begin() + *answered + 1);
  }
  return latched_->serial;
}

void OxyOSConfigureQueue::Clear() {
  latched_.reset();
  in_flight_.clear();
}

}
