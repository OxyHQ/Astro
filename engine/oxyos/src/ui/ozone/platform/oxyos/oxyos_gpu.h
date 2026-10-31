// Copyright 2026 Oxy. Apache-2.0.

#ifndef UI_OZONE_PLATFORM_OXYOS_OXYOS_GPU_H_
#define UI_OZONE_PLATFORM_OXYOS_OXYOS_GPU_H_

#include "mojo/public/cpp/bindings/pending_receiver.h"
#include "mojo/public/cpp/bindings/pending_remote.h"
#include "mojo/public/cpp/bindings/receiver_set.h"
#include "mojo/public/cpp/bindings/shared_remote.h"
#include "ui/ozone/platform/oxyos/mojom/oxyos_surfaces.mojom.h"

namespace mojo {
class BinderMap;
}

namespace ui {

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

 private:
  void Bind(mojo::PendingReceiver<ozone::mojom::OxyOSGpu> receiver);

  mojo::ReceiverSet<ozone::mojom::OxyOSGpu> receivers_;
  mojo::SharedRemote<ozone::mojom::OxyOSSurfaceHost> host_;
  mojo::PendingReceiver<ozone::mojom::OxyOSSurfaceHost> unbound_host_;
};

}

#endif
