// Copyright 2026 Oxy. Apache-2.0.

#ifndef UI_OZONE_PLATFORM_OXYOS_OXYOS_CANVAS_SURFACE_H_
#define UI_OZONE_PLATFORM_OXYOS_OXYOS_CANVAS_SURFACE_H_

#include <memory>
#include <optional>
#include <vector>

#include "base/containers/circular_deque.h"
#include "base/memory/raw_ptr.h"
#include "base/memory/scoped_refptr.h"
#include "base/memory/shared_memory_mapping.h"
#include "base/memory/unsafe_shared_memory_region.h"
#include "mojo/public/cpp/bindings/receiver.h"
#include "mojo/public/cpp/bindings/remote.h"
#include "third_party/skia/include/core/SkRefCnt.h"
#include "third_party/skia/include/core/SkRegion.h"
#include "ui/gfx/geometry/size.h"
#include "ui/gfx/gpu_fence_handle.h"
#include "ui/gfx/native_ui_types.h"
#include "ui/ozone/platform/oxyos/mojom/oxyos_surfaces.mojom.h"
#include "ui/ozone/platform/oxyos/oxyos_vsync.h"
#include "ui/ozone/public/surface_ozone_canvas.h"

class SkSurface;

namespace ui {

class OxyOSGpu;

class OxyOSCanvasSurface : public SurfaceOzoneCanvas,
                           public ozone::mojom::OxyOSSurfaceClient {
 public:
  OxyOSCanvasSurface(OxyOSGpu* gpu, gfx::AcceleratedWidget widget);
  OxyOSCanvasSurface(const OxyOSCanvasSurface&) = delete;
  OxyOSCanvasSurface& operator=(const OxyOSCanvasSurface&) = delete;
  ~OxyOSCanvasSurface() override;

  SkCanvas* GetCanvas() override;
  void ResizeCanvas(const gfx::Size& viewport_size, float scale) override;
  void PresentCanvas(const gfx::Rect& damage) override;
  std::unique_ptr<gfx::VSyncProvider> CreateVSyncProvider() override;
  bool SupportsAsyncBufferSwap() const override;
  void OnSwapBuffers(SwapBuffersCallback swap_ack_callback,
                     gfx::FrameData data) override;

  void OnPresented(uint32_t buffer, bool shown) override;
  void OnBufferReleased(uint32_t buffer, gfx::GpuFenceHandle release) override;
  void OnBufferFailed(uint32_t buffer) override;
  void OnRefresh(uint32_t refresh_mhz) override;

 private:
  struct Buffer {
    Buffer();
    ~Buffer();

    uint32_t id = 0;
    base::UnsafeSharedMemoryRegion region;
    base::WritableSharedMemoryMapping mapping;
    sk_sp<SkSurface> surface;
    SkRegion dirty;
    bool attached = false;
    bool busy = false;
  };

  Buffer* FreeBuffer();
  void CopyDirtyRegion(Buffer* to, Buffer* from);
  void DetachAll();
  void OnHostGone();

  const gfx::AcceleratedWidget widget_;
  mojo::Remote<ozone::mojom::OxyOSSurface> surface_;
  mojo::Receiver<ozone::mojom::OxyOSSurfaceClient> receiver_{this};
  gfx::Size size_;
  uint32_t next_buffer_id_ = 0;
  std::vector<std::unique_ptr<Buffer>> buffers_;
  raw_ptr<Buffer> drawing_ = nullptr;
  raw_ptr<Buffer> previous_ = nullptr;
  gfx::Rect damage_;
  base::circular_deque<SwapBuffersCallback> unanswered_;
  scoped_refptr<OxyOSRefresh> refresh_ = base::MakeRefCounted<OxyOSRefresh>();
};

}

#endif
