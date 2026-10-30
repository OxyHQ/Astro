// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_gpu.h"

#include <utility>

#include "base/functional/bind.h"
#include "base/task/single_thread_task_runner.h"
#include "mojo/public/cpp/bindings/binder_map.h"

namespace ui {

OxyOSGpu::OxyOSGpu() : unbound_host_(host_.BindNewPipeAndPassReceiver()) {}

OxyOSGpu::~OxyOSGpu() = default;

void OxyOSGpu::AddInterfaces(mojo::BinderMap* binders) {
  binders->Add<ozone::mojom::OxyOSGpu>(
      base::BindRepeating(&OxyOSGpu::Bind, base::Unretained(this)),
      base::SingleThreadTaskRunner::GetCurrentDefault());
}

void OxyOSGpu::Bind(mojo::PendingReceiver<ozone::mojom::OxyOSGpu> receiver) {
  receivers_.Add(this, std::move(receiver));
}

void OxyOSGpu::Initialize(
    mojo::PendingRemote<ozone::mojom::OxyOSSurfaceHost> host) {
  if (!unbound_host_.is_valid()) {
    receivers_.ReportBadMessage("OxyOSGpu initialized twice");
    return;
  }
  mojo::FusePipes(std::move(unbound_host_), std::move(host));
}

}
