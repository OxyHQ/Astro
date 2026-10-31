// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_presenter.h"

#include <algorithm>
#include <cinttypes>
#include <utility>

#include "base/functional/bind.h"
#include "base/logging.h"
#include "base/strings/stringprintf.h"
#include "ui/gfx/gpu_fence.h"
#include "ui/gfx/linux/drm_util_linux.h"
#include "ui/gfx/overlay_plane_data.h"
#include "ui/gfx/presentation_feedback.h"
#include "ui/gfx/swap_result.h"
#include "ui/gl/gl_bindings.h"
#include "ui/ozone/platform/oxyos/oxyos_gpu.h"

namespace ui {

OxyOSFrameLedger::OxyOSFrameLedger() = default;

OxyOSFrameLedger::~OxyOSFrameLedger() = default;

void OxyOSFrameLedger::Submitted(uint32_t buffer) {
  released_.erase(buffer);
  frames_.push_back({.buffer = buffer, .previous = last_submitted_});
  last_submitted_ = buffer;
}

bool OxyOSFrameLedger::Presented(uint32_t buffer) {
  auto it = std::ranges::find_if(
      frames_, [](const Frame& frame) { return !frame.presented; });
  if (it == frames_.end() || it->buffer != buffer) {
    return false;
  }
  it->presented = true;
  return true;
}

void OxyOSFrameLedger::Released(uint32_t buffer, gfx::GpuFenceHandle fence) {
  released_[buffer] = std::move(fence);
}

std::optional<gfx::GpuFenceHandle> OxyOSFrameLedger::TakeCompleted() {
  if (frames_.empty() || !frames_.front().presented) {
    return std::nullopt;
  }
  const Frame frame = frames_.front();
  gfx::GpuFenceHandle fence;
  if (frame.previous && frame.previous != frame.buffer) {
    auto it = released_.find(frame.previous);
    if (it == released_.end()) {
      return std::nullopt;
    }
    fence = std::move(it->second);
    released_.erase(it);
  }
  frames_.pop_front();
  return fence;
}

bool OxyOSFrameLedger::InFlight(uint32_t buffer) const {
  return buffer == last_submitted_ ||
         std::ranges::any_of(frames_, [buffer](const Frame& frame) {
           return frame.buffer == buffer || frame.previous == buffer;
         });
}

OxyOSPresenter::OxyOSPresenter(OxyOSGpu* gpu, gfx::AcceleratedWidget widget) {
  gpu->host()->CreateSurface(widget, surface_.BindNewPipeAndPassReceiver(),
                             receiver_.BindNewPipeAndPassRemote());
  receiver_.set_disconnect_handler(
      base::BindOnce(&OxyOSPresenter::OnHostGone, base::Unretained(this)));
}

OxyOSPresenter::~OxyOSPresenter() = default;

bool OxyOSPresenter::SupportsPlaneGpuFences() const {
  return true;
}

bool OxyOSPresenter::Resize(const gfx::Size& size,
                            float scale_factor,
                            const gfx::ColorSpace& color_space,
                            bool has_alpha) {
  return true;
}

bool OxyOSPresenter::ScheduleOverlayPlane(
    gl::OverlayImage image,
    std::unique_ptr<gfx::GpuFence> gpu_fence,
    const gfx::OverlayPlaneData& overlay_plane_data) {
  if (!image || overlay_plane_data.z_order != 0 || scheduled_) {
    schedule_failed_ = true;
    return false;
  }
  scheduled_ = Scheduled{std::move(image), std::move(gpu_fence),
                         overlay_plane_data.damage_rect};
  return true;
}

void OxyOSPresenter::Present(SwapCompletionCallback completion_callback,
                             PresentationCallback presentation_callback,
                             gfx::FrameData data) {
  std::optional<Scheduled> scheduled = std::move(scheduled_);
  scheduled_.reset();
  const bool failed = schedule_failed_;
  schedule_failed_ = false;
  if (!scheduled || failed || buffers_refused_ || !surface_.is_bound()) {
    std::move(completion_callback)
        .Run(gfx::SwapCompletionResult(gfx::SwapResult::SWAP_FAILED));
    std::move(presentation_callback).Run(gfx::PresentationFeedback::Failure());
    return;
  }
  const uint32_t id = BufferFor(scheduled->pixmap);
  gfx::GpuFenceHandle acquire;
  if (scheduled->fence) {
    acquire = scheduled->fence->GetGpuFenceHandle().Clone();
  } else if (implicit_sync_) {
    glFlush();
  }
  std::vector<gfx::Rect> damage;
  if (!scheduled->damage.IsEmpty()) {
    damage.push_back(scheduled->damage);
  }
  if (!announced_) {
    if (renderer_.empty()) {
      const GLubyte* renderer = glGetString(GL_RENDERER);
      renderer_ = renderer ? reinterpret_cast<const char*>(renderer) : "";
    }
    last_buffer_ = base::StringPrintf(
        "%s buffers, DRM format 0x%08x, modifier 0x%016" PRIx64,
        scheduled->pixmap->GetBufferSize().ToString().c_str(),
        GetFourCCFormatFromSharedImageFormat(
            scheduled->pixmap->GetSharedImageFormat()),
        scheduled->pixmap->GetFormatModifier());
  }
  ledger_.Submitted(id);
  completions_.push_back(std::move(completion_callback));
  presentations_.push_back(std::move(presentation_callback));
  surface_->Present(id, damage, data.seq, std::move(acquire));
  ForgetUnused();
}

void OxyOSPresenter::SetRelyOnImplicitSync() {
  implicit_sync_ = true;
}

void OxyOSPresenter::OnPresented(uint32_t buffer, bool shown) {
  if (!ledger_.Presented(buffer) || presentations_.empty()) {
    receiver_.ReportBadMessage("OxyOS presented a frame never sent");
    return;
  }
  if (shown && !announced_) {
    announced_ = true;
    LOG(INFO) << "OxyOS GPU path active: " << renderer_ << ", " << last_buffer_;
  }
  PresentationCallback presentation = std::move(presentations_.front());
  presentations_.pop_front();
  std::move(presentation)
      .Run(shown
               ? gfx::PresentationFeedback(base::TimeTicks::Now(), interval_, 0)
               : gfx::PresentationFeedback::Failure());
  Complete();
}

void OxyOSPresenter::OnBufferReleased(uint32_t buffer,
                                      gfx::GpuFenceHandle release) {
  ledger_.Released(buffer, std::move(release));
  Complete();
}

void OxyOSPresenter::OnBufferFailed(uint32_t buffer) {
  LOG(ERROR) << "OxyOS could not import a GPU buffer";
  buffers_refused_ = true;
}

void OxyOSPresenter::OnRefresh(uint32_t refresh_mhz) {
  if (refresh_mhz) {
    interval_ = base::Hertz(refresh_mhz / 1000.0);
  }
}

uint32_t OxyOSPresenter::BufferFor(
    const scoped_refptr<gfx::NativePixmap>& pixmap) {
  auto it = std::ranges::find(buffers_, pixmap, &Buffer::pixmap);
  if (it != buffers_.end()) {
    return it->id;
  }
  const uint32_t id = ++next_id_;
  buffers_.push_back({id, pixmap});
  surface_->AttachDmabuf(
      id, pixmap->ExportHandle(),
      static_cast<uint32_t>(
          GetFourCCFormatFromSharedImageFormat(pixmap->GetSharedImageFormat())),
      pixmap->GetBufferSize());
  return id;
}

void OxyOSPresenter::ForgetUnused() {
  std::erase_if(buffers_, [this](const Buffer& buffer) {
    if (!buffer.pixmap->HasOneRef() || ledger_.InFlight(buffer.id)) {
      return false;
    }
    surface_->DetachBuffer(buffer.id);
    return true;
  });
}

void OxyOSPresenter::Complete() {
  while (!completions_.empty()) {
    std::optional<gfx::GpuFenceHandle> release = ledger_.TakeCompleted();
    if (!release) {
      return;
    }
    SwapCompletionCallback completion = std::move(completions_.front());
    completions_.pop_front();
    std::move(completion)
        .Run(gfx::SwapCompletionResult(gfx::SwapResult::SWAP_ACK,
                                       std::move(*release)));
  }
}

void OxyOSPresenter::OnHostGone() {
  surface_.reset();
  while (!presentations_.empty()) {
    std::move(presentations_.front()).Run(gfx::PresentationFeedback::Failure());
    presentations_.pop_front();
  }
  while (!completions_.empty()) {
    std::move(completions_.front())
        .Run(gfx::SwapCompletionResult(gfx::SwapResult::SWAP_FAILED));
    completions_.pop_front();
  }
}

}
