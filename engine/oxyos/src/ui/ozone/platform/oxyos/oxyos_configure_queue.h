// Copyright 2026 Oxy. Apache-2.0.

#ifndef UI_OZONE_PLATFORM_OXYOS_OXYOS_CONFIGURE_QUEUE_H_
#define UI_OZONE_PLATFORM_OXYOS_OXYOS_CONFIGURE_QUEUE_H_

#include <cstdint>
#include <optional>

#include "base/containers/circular_deque.h"
#include "ui/gfx/geometry/size.h"

namespace ui {

class OxyOSConfigureQueue {
 public:
  struct Request {
    uint64_t serial;
    gfx::Size size_px;
    int64_t viz_seq;
  };

  OxyOSConfigureQueue();
  OxyOSConfigureQueue(const OxyOSConfigureQueue&) = delete;
  OxyOSConfigureQueue& operator=(const OxyOSConfigureQueue&) = delete;
  ~OxyOSConfigureQueue();

  void Push(const Request& request);

  std::optional<uint64_t> Latch(const gfx::Size& frame_size, int64_t frame_seq);

  const std::optional<Request>& latched() const { return latched_; }
  bool waiting() const { return !in_flight_.empty(); }
  void Clear();

 private:
  std::optional<Request> latched_;
  base::circular_deque<Request> in_flight_;
};

}

#endif
