// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_surface_host.h"

#include <sys/stat.h>

#include <algorithm>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include "base/command_line.h"
#include "base/files/file_enumerator.h"
#include "base/files/file_path.h"
#include "base/files/scoped_file.h"
#include "base/functional/bind.h"
#include "base/logging.h"
#include "base/memory/platform_shared_memory_region.h"
#include "base/memory/unsafe_shared_memory_region.h"
#include "base/numerics/checked_math.h"
#include "base/numerics/safe_conversions.h"
#include "mojo/public/cpp/bindings/message.h"
#include "mojo/public/cpp/bindings/remote.h"
#include "oxyos_client.h"
#include "ui/gfx/gpu_fence_handle.h"
#include "ui/gfx/native_pixmap_handle.h"
#include "ui/ozone/platform/oxyos/oxyos_connection.h"
#include "ui/ozone/platform/oxyos/oxyos_window.h"
#include "ui/ozone/public/ozone_switches.h"

namespace ui {

namespace {

constexpr int kMaxBufferSide = 16384;
constexpr size_t kMaxGpuFormats = 256;
constexpr size_t kMaxPlanes = 4;

base::FilePath RenderNodePath(uint64_t device) {
  if (!device) {
    return base::FilePath();
  }
  base::FileEnumerator nodes(
      base::FilePath("/dev/dri"), false,
      base::FileEnumerator::FILES | base::FileEnumerator::SHOW_SYM_LINKS,
      "renderD*");
  for (base::FilePath node = nodes.Next(); !node.empty(); node = nodes.Next()) {
    struct stat info;
    if (stat(node.value().c_str(), &info) == 0 && S_ISCHR(info.st_mode) &&
        info.st_rdev == static_cast<dev_t>(device)) {
      return node;
    }
  }
  return base::FilePath();
}

gfx::GpuFenceHandle FenceOf(int fd) {
  gfx::GpuFenceHandle fence;
  if (fd >= 0) {
    fence.Adopt(base::ScopedFD(fd));
  }
  return fence;
}

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
      Forget(buffer);
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

  void AttachDmabuf(uint32_t id,
                    gfx::NativePixmapHandle pixmap,
                    uint32_t format,
                    const gfx::Size& size) override {
    if (buffers_.contains(id) || size.IsEmpty() ||
        size.width() > kMaxBufferSide || size.height() > kMaxBufferSide ||
        pixmap.planes.empty() || pixmap.planes.size() > kMaxPlanes) {
      mojo::ReportBadMessage("OxyOS GPU buffer of an invalid size");
      return;
    }
    std::vector<OxyOSDmabufPlane> planes;
    for (const gfx::NativePixmapPlane& plane : pixmap.planes) {
      if (!plane.fd.is_valid() ||
          !base::IsValueInRangeForNumericType<uint32_t>(plane.offset)) {
        mojo::ReportBadMessage("OxyOS GPU buffer plane without memory");
        return;
      }
      planes.push_back(
          {plane.fd.get(), static_cast<uint32_t>(plane.offset), plane.stride});
    }
    const int64_t attached = oxyos_client_attach_dmabuf(
        connection_->client(), format, pixmap.modifier, size.width(),
        size.height(), planes.data(), planes.size());
    if (attached < 0) {
      LOG(ERROR) << "OxyOS refused a GPU buffer: " << oxyos_last_error();
      return;
    }
    const int64_t timeline =
        oxyos_client_create_timeline(connection_->client());
    if (timeline < 0) {
      LOG(ERROR) << "OxyOS gave no timeline: " << oxyos_last_error();
      oxyos_client_detach_buffer(connection_->client(),
                                 static_cast<uint64_t>(attached));
      return;
    }
    const uint64_t buffer = static_cast<uint64_t>(attached);
    buffers_[id] = Attached{buffer, size, static_cast<uint32_t>(timeline)};
    connection_->WatchRelease(
        buffer, base::BindRepeating(&Surface::OnReleased,
                                    weak_factory_.GetWeakPtr(), id));
  }

  void Refresh(uint32_t refresh_mhz) { client_->OnRefresh(refresh_mhz); }

  base::WeakPtr<Surface> GetWeakPtr() { return weak_factory_.GetWeakPtr(); }

  void DetachBuffer(uint32_t id) override {
    auto it = buffers_.find(id);
    if (it == buffers_.end()) {
      return;
    }
    Forget(it->second);
    buffers_.erase(it);
  }

  void Present(uint32_t id,
               const std::vector<gfx::Rect>& damage,
               int64_t viz_seq,
               gfx::GpuFenceHandle acquire) override {
    auto it = buffers_.find(id);
    OxyOSWindow* window = connection_->GetWindow(widget_);
    std::optional<int64_t> sequence;
    if (it != buffers_.end() && window && !it->second.failed) {
      Attached& buffer = it->second;
      std::optional<OxyOSSync> sync;
      if (buffer.timeline) {
        sync = OxyOSSync{};
        if (!acquire.is_null() && oxyos_client_timeline_import_sync_file(
                                      connection_->client(), buffer.timeline,
                                      buffer.point + 1, acquire.Peek()) == 0) {
          sync->acquire_timeline = buffer.timeline;
          sync->acquire_point = ++buffer.point;
        }
        sync->release_timeline = buffer.timeline;
        sync->release_point = ++buffer.point;
      }
      sequence = window->SubmitFrame(buffer.attached, buffer.size, damage,
                                     viz_seq, sync ? &*sync : nullptr);
      if (sequence && sync) {
        buffer.release_point = sync->release_point;
      }
    }
    VLOG(1) << "OxyOS GPU frame of buffer " << id << " submitted "
            << sequence.has_value();
    if (!sequence) {
      client_->OnPresented(id, false);
      client_->OnBufferReleased(id, std::move(acquire));
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
    uint32_t timeline = 0;
    uint64_t point = 0;
    uint64_t release_point = 0;
    bool failed = false;
  };

  void OnFeedback(uint32_t id, bool shown) { client_->OnPresented(id, shown); }

  void OnReleased(uint32_t id, bool failed) {
    auto it = buffers_.find(id);
    if (failed) {
      if (it != buffers_.end()) {
        it->second.failed = true;
      }
      client_->OnBufferFailed(id);
      return;
    }
    gfx::GpuFenceHandle release;
    if (it != buffers_.end() && it->second.release_point) {
      release = FenceOf(oxyos_client_timeline_export_sync_file(
          connection_->client(), it->second.timeline,
          it->second.release_point));
    }
    client_->OnBufferReleased(id, std::move(release));
  }

  void Forget(const Attached& buffer) {
    connection_->ForgetRelease(buffer.attached);
    oxyos_client_detach_buffer(connection_->client(), buffer.attached);
    if (buffer.timeline) {
      oxyos_client_destroy_timeline(connection_->client(), buffer.timeline);
    }
  }

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
  refreshers_.clear();
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
  OnGpuTable();
}

void OxyOSSurfaceHost::OnGpuTable() {
  NameRenderNode();
  if (!gpu_) {
    return;
  }
  uint64_t device = 0;
  std::vector<ozone::mojom::OxyOSGpuFormatPtr> table;
  if (oxyos_client_gpu_device(connection_->client(), &device) == 1) {
    std::vector<OxyOSGpuFormat> formats(kMaxGpuFormats);
    const int64_t count = oxyos_client_gpu_formats(
        connection_->client(), formats.data(), formats.size());
    for (int64_t i = 0; i < std::min<int64_t>(count, kMaxGpuFormats); ++i) {
      table.push_back(ozone::mojom::OxyOSGpuFormat::New(formats[i].format,
                                                        formats[i].modifier));
    }
  }
  gpu_->SetGpuTable(device, std::move(table));
}

void OxyOSSurfaceHost::NameRenderNode() {
  uint64_t device = 0;
  base::CommandLine* command_line = base::CommandLine::ForCurrentProcess();
  if (command_line->HasSwitch(switches::kRenderNodeOverride) ||
      oxyos_client_gpu_device(connection_->client(), &device) != 1) {
    return;
  }
  const base::FilePath path = RenderNodePath(device);
  if (!path.empty()) {
    command_line->AppendSwitchPath(switches::kRenderNodeOverride, path);
  }
}

void OxyOSSurfaceHost::CreateSurface(
    gfx::AcceleratedWidget widget,
    mojo::PendingReceiver<ozone::mojom::OxyOSSurface> surface,
    mojo::PendingRemote<ozone::mojom::OxyOSSurfaceClient> client) {
  OxyOSWindow* window = connection_->GetWindow(widget);
  if (!window) {
    return;
  }
  auto created =
      std::make_unique<Surface>(connection_, widget, std::move(client));
  base::RepeatingCallback<void(uint32_t)> refresh =
      base::BindRepeating(&Surface::Refresh, created->GetWeakPtr());
  surfaces_.Add(std::move(created), std::move(surface));
  if (window->refresh_mhz()) {
    refresh.Run(window->refresh_mhz());
  }
  refreshers_[widget] = std::move(refresh);
}

void OxyOSSurfaceHost::OnRefresh(gfx::AcceleratedWidget widget,
                                 uint32_t refresh_mhz) {
  auto it = refreshers_.find(widget);
  if (it != refreshers_.end()) {
    it->second.Run(refresh_mhz);
  }
}

}
