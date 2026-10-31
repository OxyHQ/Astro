// Copyright 2026 Oxy. Apache-2.0.

#ifndef UI_OZONE_PLATFORM_OXYOS_OXYOS_GPU_H_
#define UI_OZONE_PLATFORM_OXYOS_OXYOS_GPU_H_

#include <cstdint>
#include <memory>
#include <vector>

#include "base/files/file_path.h"
#include "base/files/scoped_file.h"
#include "base/memory/scoped_refptr.h"
#include "base/synchronization/lock.h"
#include "base/synchronization/waitable_event.h"
#include "base/thread_annotations.h"
#include "mojo/public/cpp/bindings/pending_receiver.h"
#include "mojo/public/cpp/bindings/pending_remote.h"
#include "mojo/public/cpp/bindings/receiver_set.h"
#include "mojo/public/cpp/bindings/shared_remote.h"
#include "ui/gfx/buffer_types.h"
#include "ui/gfx/geometry/size.h"
#include "ui/gfx/native_pixmap.h"
#include "ui/ozone/platform/oxyos/mojom/oxyos_surfaces.mojom.h"

namespace mojo {
class BinderMap;
}

namespace viz {
class SharedImageFormat;
}

namespace ui {

class GbmDevice;

struct OxyOSGpuTableEntry {
  uint32_t format = 0;
  uint64_t modifier = 0;
};

std::vector<OxyOSGpuTableEntry> OxyOSLinearOnly(
    std::vector<OxyOSGpuTableEntry> table);

base::ScopedFD OxyOSOpenRenderNode(const base::FilePath& preferred);

std::vector<uint64_t> OxyOSModifiersFor(
    const std::vector<OxyOSGpuTableEntry>& table,
    uint32_t format);

class OxyOSGpu : public ozone::mojom::OxyOSGpu {
 public:
  OxyOSGpu();
  OxyOSGpu(const OxyOSGpu&) = delete;
  OxyOSGpu& operator=(const OxyOSGpu&) = delete;
  ~OxyOSGpu() override;

  void AddInterfaces(mojo::BinderMap* binders);

  const mojo::SharedRemote<ozone::mojom::OxyOSSurfaceHost>& host() const {
    return host_;
  }

  void Initialize(
      mojo::PendingRemote<ozone::mojom::OxyOSSurfaceHost> host) override;
  void SetGpuTable(
      uint64_t device,
      std::vector<ozone::mojom::OxyOSGpuFormatPtr> formats) override;

  bool WaitForTable();
  bool supports_native_pixmaps() const { return supports_native_pixmaps_; }
  int render_node() const { return render_node_.get(); }
  bool CanAllocate(uint32_t fourcc);
  scoped_refptr<gfx::NativePixmap> Allocate(const gfx::Size& size,
                                            viz::SharedImageFormat format,
                                            gfx::BufferUsage usage);

 private:
  void Bind(mojo::PendingReceiver<ozone::mojom::OxyOSGpu> receiver);

  mojo::ReceiverSet<ozone::mojom::OxyOSGpu> receivers_;
  mojo::SharedRemote<ozone::mojom::OxyOSSurfaceHost> host_;
  mojo::PendingReceiver<ozone::mojom::OxyOSSurfaceHost> unbound_host_;
  base::WaitableEvent table_ready_;

  base::ScopedFD render_node_;
  uint64_t render_device_ = 0;
  std::unique_ptr<GbmDevice> gbm_;
  bool supports_native_pixmaps_ = false;

  mutable base::Lock lock_;
  std::vector<OxyOSGpuTableEntry> table_ GUARDED_BY(lock_);
  bool same_device_ GUARDED_BY(lock_) = false;
};

}

#endif
