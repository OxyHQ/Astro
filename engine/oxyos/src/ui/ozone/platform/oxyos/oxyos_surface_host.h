// Copyright 2026 Oxy. Apache-2.0.

#ifndef UI_OZONE_PLATFORM_OXYOS_OXYOS_SURFACE_HOST_H_
#define UI_OZONE_PLATFORM_OXYOS_OXYOS_SURFACE_HOST_H_

#include <cstdint>
#include <memory>
#include <vector>

#include "base/containers/flat_map.h"
#include "base/functional/callback.h"
#include "base/memory/raw_ptr.h"
#include "base/memory/weak_ptr.h"
#include "mojo/public/cpp/bindings/receiver_set.h"
#include "mojo/public/cpp/bindings/remote.h"
#include "mojo/public/cpp/bindings/unique_receiver_set.h"
#include "ui/ozone/platform/oxyos/mojom/oxyos_surfaces.mojom.h"
#include "ui/ozone/public/gpu_platform_support_host.h"

namespace ui {

class OxyOSConnection;

class OxyOSSurfaceHost : public GpuPlatformSupportHost,
                         public ozone::mojom::OxyOSSurfaceHost {
 public:
  explicit OxyOSSurfaceHost(OxyOSConnection* connection);
  OxyOSSurfaceHost(const OxyOSSurfaceHost&) = delete;
  OxyOSSurfaceHost& operator=(const OxyOSSurfaceHost&) = delete;
  ~OxyOSSurfaceHost() override;

  void OnChannelDestroyed(int host_id) override;
  void OnGpuServiceLaunched(
      int host_id,
      GpuHostBindInterfaceCallback binder,
      GpuHostTerminateCallback terminate_callback) override;

  void CreateSurface(
      gfx::AcceleratedWidget widget,
      mojo::PendingReceiver<ozone::mojom::OxyOSSurface> surface,
      mojo::PendingRemote<ozone::mojom::OxyOSSurfaceClient> client) override;

  void OnRefresh(gfx::AcceleratedWidget widget, uint32_t refresh_mhz);

 private:
  const raw_ptr<OxyOSConnection> connection_;
  int host_id_ = -1;
  mojo::Remote<ozone::mojom::OxyOSGpu> gpu_;
  mojo::ReceiverSet<ozone::mojom::OxyOSSurfaceHost> receivers_;
  mojo::UniqueReceiverSet<ozone::mojom::OxyOSSurface> surfaces_;
  base::flat_map<gfx::AcceleratedWidget,
                 base::RepeatingCallback<void(uint32_t)>>
      refreshers_;
};

}

#endif
