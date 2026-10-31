// Copyright 2026 Oxy. Apache-2.0.

#ifndef UI_OZONE_PLATFORM_OXYOS_OXYOS_PRESENTER_H_
#define UI_OZONE_PLATFORM_OXYOS_OXYOS_PRESENTER_H_

#include <cstdint>
#include <memory>
#include <optional>
#include <string>
#include <vector>

#include "base/containers/circular_deque.h"
#include "base/containers/flat_map.h"
#include "base/memory/raw_ptr.h"
#include "base/memory/scoped_refptr.h"
#include "base/time/time.h"
#include "mojo/public/cpp/bindings/receiver.h"
#include "mojo/public/cpp/bindings/remote.h"
#include "ui/gfx/gpu_fence_handle.h"
#include "ui/gfx/native_pixmap.h"
#include "ui/gfx/native_ui_types.h"
#include "ui/gl/presenter.h"
#include "ui/ozone/platform/oxyos/mojom/oxyos_surfaces.mojom.h"

namespace ui {

class OxyOSGpu;

class OxyOSFrameLedger {
 public:
  OxyOSFrameLedger();
  OxyOSFrameLedger(const OxyOSFrameLedger&) = delete;
  OxyOSFrameLedger& operator=(const OxyOSFrameLedger&) = delete;
  ~OxyOSFrameLedger();

  void Submitted(uint32_t buffer);
  bool Presented(uint32_t buffer);
  void Released(uint32_t buffer, gfx::GpuFenceHandle fence);
  std::optional<gfx::GpuFenceHandle> TakeCompleted();
  bool InFlight(uint32_t buffer) const;
  size_t pending() const { return frames_.size(); }

 private:
  struct Frame {
    uint32_t buffer = 0;
    uint32_t previous = 0;
    bool presented = false;
  };

  base::circular_deque<Frame> frames_;
  base::flat_map<uint32_t, gfx::GpuFenceHandle> released_;
  uint32_t last_submitted_ = 0;
};

class OxyOSPresenter : public gl::Presenter,
                       public ozone::mojom::OxyOSSurfaceClient {
 public:
  OxyOSPresenter(OxyOSGpu* gpu, gfx::AcceleratedWidget widget);
  OxyOSPresenter(const OxyOSPresenter&) = delete;
  OxyOSPresenter& operator=(const OxyOSPresenter&) = delete;

  bool SupportsPlaneGpuFences() const override;
  bool Resize(const gfx::Size& size,
              float scale_factor,
              const gfx::ColorSpace& color_space,
              bool has_alpha) override;
  bool ScheduleOverlayPlane(
      gl::OverlayImage image,
      std::unique_ptr<gfx::GpuFence> gpu_fence,
      const gfx::OverlayPlaneData& overlay_plane_data) override;
  void Present(SwapCompletionCallback completion_callback,
               PresentationCallback presentation_callback,
               gfx::FrameData data) override;
  void SetRelyOnImplicitSync() override;

  void OnPresented(uint32_t buffer, bool shown) override;
  void OnBufferReleased(uint32_t buffer, gfx::GpuFenceHandle release) override;
  void OnBufferFailed(uint32_t buffer) override;
  void OnRefresh(uint32_t refresh_mhz) override;

 private:
  ~OxyOSPresenter() override;

  struct Buffer {
    uint32_t id;
    scoped_refptr<gfx::NativePixmap> pixmap;
  };
  struct Scheduled {
    scoped_refptr<gfx::NativePixmap> pixmap;
    std::unique_ptr<gfx::GpuFence> fence;
    gfx::Rect damage;
  };

  uint32_t BufferFor(const scoped_refptr<gfx::NativePixmap>& pixmap);
  void ForgetUnused();
  void Complete();
  void OnHostGone();

  mojo::Remote<ozone::mojom::OxyOSSurface> surface_;
  mojo::Receiver<ozone::mojom::OxyOSSurfaceClient> receiver_{this};
  std::vector<Buffer> buffers_;
  uint32_t next_id_ = 0;
  std::optional<Scheduled> scheduled_;
  bool schedule_failed_ = false;
  bool implicit_sync_ = false;
  bool buffers_refused_ = false;
  bool announced_ = false;
  std::string renderer_;
  std::string last_buffer_;
  OxyOSFrameLedger ledger_;
  base::circular_deque<SwapCompletionCallback> completions_;
  base::circular_deque<PresentationCallback> presentations_;
  base::TimeDelta interval_ = base::Hertz(60);
};

}

#endif
