// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_canvas_surface.h"

#include <algorithm>
#include <utility>

#include "base/functional/bind.h"
#include "base/numerics/checked_math.h"
#include "base/process/memory.h"
#include "base/task/single_thread_task_runner.h"
#include "skia/ext/legacy_display_globals.h"
#include "third_party/skia/include/core/SkCanvas.h"
#include "third_party/skia/include/core/SkImageInfo.h"
#include "third_party/skia/include/core/SkSurface.h"
#include "ui/gfx/geometry/skia_conversions.h"
#include "ui/gfx/vsync_provider.h"
#include "ui/ozone/platform/oxyos/oxyos_gpu.h"

namespace ui {

namespace {

size_t StrideOf(const gfx::Size& size) {
  return (base::CheckedNumeric<size_t>(size.width()) * 4).ValueOrDie();
}

}

OxyOSCanvasSurface::Buffer::Buffer() = default;
OxyOSCanvasSurface::Buffer::~Buffer() = default;

OxyOSCanvasSurface::Unanswered::Unanswered(uint64_t frame,
                                           SwapBuffersCallback callback)
    : frame(frame), callback(std::move(callback)) {}
OxyOSCanvasSurface::Unanswered::Unanswered(Unanswered&&) = default;
OxyOSCanvasSurface::Unanswered& OxyOSCanvasSurface::Unanswered::operator=(
    Unanswered&&) = default;
OxyOSCanvasSurface::Unanswered::~Unanswered() = default;

OxyOSCanvasSurface::OxyOSCanvasSurface(OxyOSGpu* gpu,
                                       gfx::AcceleratedWidget widget)
    : widget_(widget) {
  gpu->host()->CreateSurface(widget_, surface_.BindNewPipeAndPassReceiver(),
                             receiver_.BindNewPipeAndPassRemote());
  surface_.set_disconnect_handler(
      base::BindOnce(&OxyOSCanvasSurface::OnHostGone, base::Unretained(this)));
}

OxyOSCanvasSurface::~OxyOSCanvasSurface() {
  DetachAll();
  OnHostGone();
}

OxyOSCanvasSurface::Buffer* OxyOSCanvasSurface::FreeBuffer() {
  for (const auto& buffer : buffers_) {
    if (!buffer->busy) {
      return buffer.get();
    }
  }
  const size_t stride = StrideOf(size_);
  const size_t bytes =
      (base::CheckedNumeric<size_t>(stride) * size_.height()).ValueOrDie();
  auto buffer = std::make_unique<Buffer>();
  buffer->id = ++next_buffer_id_;
  buffer->region = base::UnsafeSharedMemoryRegion::Create(bytes);
  if (!buffer->region.IsValid()) {
    base::TerminateBecauseOutOfMemory(bytes);
  }
  buffer->mapping = buffer->region.Map();
  if (!buffer->mapping.IsValid()) {
    base::TerminateBecauseOutOfMemory(bytes);
  }
  const SkSurfaceProps props = skia::LegacyDisplayGlobals::GetSkSurfaceProps();
  buffer->surface = SkSurfaces::WrapPixels(
      SkImageInfo::MakeN32Premul(size_.width(), size_.height()),
      buffer->mapping.memory(), stride, &props);
  CHECK(buffer->surface);
  buffer->dirty.setRect(gfx::RectToSkIRect(gfx::Rect(size_)));
  buffers_.push_back(std::move(buffer));
  return buffers_.back().get();
}

SkCanvas* OxyOSCanvasSurface::GetCanvas() {
  if (!drawing_) {
    drawing_ = FreeBuffer();
    drawing_->busy = true;
  }
  return drawing_->surface->getCanvas();
}

void OxyOSCanvasSurface::ResizeCanvas(const gfx::Size& viewport_size,
                                      float scale) {
  if (size_ == viewport_size) {
    return;
  }
  DetachAll();
  size_ = viewport_size;
}

void OxyOSCanvasSurface::DetachAll() {
  for (const auto& buffer : buffers_) {
    if (buffer->attached && surface_.is_bound()) {
      surface_->DetachBuffer(buffer->id);
    }
  }
  buffers_.clear();
  drawing_ = nullptr;
  previous_ = nullptr;
}

void OxyOSCanvasSurface::PresentCanvas(const gfx::Rect& damage) {
  damage_ = damage;
}

std::unique_ptr<gfx::VSyncProvider> OxyOSCanvasSurface::CreateVSyncProvider() {
  return std::make_unique<OxyOSVSyncProvider>(refresh_);
}

void OxyOSCanvasSurface::OnRefresh(uint32_t refresh_mhz) {
  refresh_->set_refresh_mhz(refresh_mhz);
}

bool OxyOSCanvasSurface::SupportsAsyncBufferSwap() const {
  return true;
}

void OxyOSCanvasSurface::CopyDirtyRegion(Buffer* to, Buffer* from) {
  const size_t stride = StrideOf(size_);
  auto* pixels = static_cast<uint8_t*>(to->mapping.memory());
  for (SkRegion::Iterator it(to->dirty); !it.done(); it.next()) {
    const SkIRect& rect = it.rect();
    from->surface->readPixels(
        SkImageInfo::MakeN32Premul(rect.width(), rect.height()),
        pixels + rect.y() * stride + rect.x() * 4, stride, rect.x(), rect.y());
  }
  to->dirty.setEmpty();
}

void OxyOSCanvasSurface::OnSwapBuffers(SwapBuffersCallback swap_ack_callback,
                                       gfx::FrameData data) {
  Buffer* frame = drawing_;
  drawing_ = nullptr;
  if (!frame || !surface_.is_bound()) {
    std::move(swap_ack_callback).Run(size_);
    if (frame) {
      frame->busy = false;
    }
    return;
  }
  frame->dirty.op(gfx::RectToSkIRect(damage_), SkRegion::kDifference_Op);
  if (previous_ && previous_ != frame) {
    CopyDirtyRegion(frame, previous_);
  }
  for (const auto& buffer : buffers_) {
    if (buffer.get() != frame) {
      buffer->dirty.op(gfx::RectToSkIRect(damage_), SkRegion::kUnion_Op);
    }
  }
  if (!frame->attached) {
    surface_->AttachBuffer(frame->id, frame->region.Duplicate(), size_);
    frame->attached = true;
  }
  unanswered_.emplace_back(++last_frame_, std::move(swap_ack_callback));
  surface_->Present(frame->id, last_frame_, {damage_}, data.seq,
                    gfx::GpuFenceHandle());
  previous_ = frame;
}

void OxyOSCanvasSurface::OnPresented(uint64_t frame, bool shown) {
  auto it = std::ranges::find(unanswered_, frame, &Unanswered::frame);
  if (it == unanswered_.end() || it->presented) {
    receiver_.ReportBadMessage("OxyOS presented a frame never sent");
    return;
  }
  it->presented = true;
  while (!unanswered_.empty() && unanswered_.front().presented) {
    SwapBuffersCallback callback = std::move(unanswered_.front().callback);
    unanswered_.pop_front();
    std::move(callback).Run(size_);
  }
}

void OxyOSCanvasSurface::OnBufferReleased(uint32_t buffer,
                                          gfx::GpuFenceHandle release) {
  for (const auto& entry : buffers_) {
    if (entry->id == buffer && entry.get() != drawing_) {
      entry->busy = false;
    }
  }
}

void OxyOSCanvasSurface::OnBufferFailed(uint32_t buffer) {}

void OxyOSCanvasSurface::OnHostGone() {
  surface_.reset();
  receiver_.reset();
  while (!unanswered_.empty()) {
    base::SingleThreadTaskRunner::GetCurrentDefault()->PostTask(
        FROM_HERE,
        base::BindOnce(std::move(unanswered_.front().callback), size_));
    unanswered_.pop_front();
  }
}

}
