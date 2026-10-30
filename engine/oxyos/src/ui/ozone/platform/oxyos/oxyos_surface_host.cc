// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_surface_host.h"

#include <utility>

#include "base/functional/bind.h"
#include "base/logging.h"
#include "base/memory/platform_shared_memory_region.h"
#include "base/memory/unsafe_shared_memory_region.h"
#include "base/numerics/checked_math.h"
#include "mojo/public/cpp/bindings/message.h"
#include "mojo/public/cpp/bindings/remote.h"
#include "oxyos_client.h"
#include "ui/ozone/platform/oxyos/oxyos_connection.h"
#include "ui/ozone/platform/oxyos/oxyos_window.h"

namespace ui {

namespace {

constexpr int kMaxBufferSide = 16384;

class Surface : public ozone::mojom::OxyOSSurface {
 public:
  Surface(OxyOSConnection* connection,
          gfx::AcceleratedWidget widget,
          mojo::PendingRemote<ozone::mojom::OxyOSSurfaceClient> client)
      : connection_(connection), widget_(widget), client_(std::move(client)) {}
  Surface(const Surface&) = delete;
  Surface& operator=(const Surface&) = delete;

  ~Surface() override {
    for (const auto& [id, buffer] : buffers_) {
      connection_->ForgetRelease(buffer.attached);
      oxyos_client_detach_buffer(connection_->client(), buffer.attached);
    }
  }

  void AttachBuffer(uint32_t id,
                    base::UnsafeSharedMemoryRegion pixels,
                    const gfx::Size& size) override {
    if (buffers_.contains(id) || size.IsEmpty() ||
        size.width() > kMaxBufferSide || size.height() > kMaxBufferSide) {
      mojo::ReportBadMessage("OxyOS buffer of an invalid size");
      return;
    }
    const size_t stride =
        (base::CheckedNumeric<size_t>(size.width()) * 4).ValueOrDie();
    if (!pixels.IsValid() || pixels.GetSize() < stride * size.height()) {
      mojo::ReportBadMessage("OxyOS buffer smaller than its size");
      return;
    }
    base::subtle::PlatformSharedMemoryRegion region =
        base::UnsafeSharedMemoryRegion::TakeHandleForSerialization(
            std::move(pixels));
    const int64_t attached = oxyos_client_attach_buffer(
        connection_->client(), region.GetPlatformHandle().fd,
        OXYOS_FORMAT_ARGB8888, size.width(), size.height(),
        static_cast<uint32_t>(stride), 0);
    if (attached < 0) {
      LOG(ERROR) << "OxyOS refused a buffer: " << oxyos_last_error();
      return;
    }
    const uint64_t buffer = static_cast<uint64_t>(attached);
    buffers_[id] = Attached{buffer, size};
    connection_->WatchRelease(
        buffer, base::BindRepeating(&Surface::OnReleased,
                                    weak_factory_.GetWeakPtr(), id));
  }

  void DetachBuffer(uint32_t id) override {
    auto it = buffers_.find(id);
    if (it == buffers_.end()) {
      return;
    }
    connection_->ForgetRelease(it->second.attached);
    oxyos_client_detach_buffer(connection_->client(), it->second.attached);
    buffers_.erase(it);
  }

  void Present(uint32_t id,
               const std::vector<gfx::Rect>& damage,
               int64_t viz_seq) override {
    auto it = buffers_.find(id);
    OxyOSWindow* window = connection_->GetWindow(widget_);
    std::optional<int64_t> sequence;
    if (it != buffers_.end() && window) {
      sequence = window->SubmitFrame(it->second.attached, it->second.size,
                                     damage, viz_seq);
    }
    if (!sequence) {
      client_->OnPresented(id, false);
      client_->OnBufferReleased(id);
      return;
    }
    connection_->ExpectFeedback(
        window, *sequence,
        base::BindOnce(&Surface::OnFeedback, weak_factory_.GetWeakPtr(), id));
  }

 private:
  struct Attached {
    uint64_t attached;
    gfx::Size size;
  };

  void OnFeedback(uint32_t id, bool shown) { client_->OnPresented(id, shown); }

  void OnReleased(uint32_t id) { client_->OnBufferReleased(id); }

  const raw_ptr<OxyOSConnection> connection_;
  const gfx::AcceleratedWidget widget_;
  mojo::Remote<ozone::mojom::OxyOSSurfaceClient> client_;
  base::flat_map<uint32_t, Attached> buffers_;
  base::WeakPtrFactory<Surface> weak_factory_{this};
};

}

OxyOSSurfaceHost::OxyOSSurfaceHost(OxyOSConnection* connection)
    : connection_(connection) {}

OxyOSSurfaceHost::~OxyOSSurfaceHost() = default;

void OxyOSSurfaceHost::OnChannelDestroyed(int host_id) {
  if (host_id != host_id_) {
    return;
  }
  surfaces_.Clear();
  receivers_.Clear();
  gpu_.reset();
}

void OxyOSSurfaceHost::OnGpuServiceLaunched(
    int host_id,
    GpuHostBindInterfaceCallback binder,
    GpuHostTerminateCallback terminate_callback) {
  surfaces_.Clear();
  receivers_.Clear();
  gpu_.reset();
  host_id_ = host_id;
  binder.Run(ozone::mojom::OxyOSGpu::Name_,
             gpu_.BindNewPipeAndPassReceiver().PassPipe());
  mojo::PendingRemote<ozone::mojom::OxyOSSurfaceHost> host;
  receivers_.Add(this, host.InitWithNewPipeAndPassReceiver());
  gpu_->Initialize(std::move(host));
}

void OxyOSSurfaceHost::CreateSurface(
    gfx::AcceleratedWidget widget,
    mojo::PendingReceiver<ozone::mojom::OxyOSSurface> surface,
    mojo::PendingRemote<ozone::mojom::OxyOSSurfaceClient> client) {
  if (!connection_->GetWindow(widget)) {
    return;
  }
  surfaces_.Add(
      std::make_unique<Surface>(connection_, widget, std::move(client)),
      std::move(surface));
}

}
