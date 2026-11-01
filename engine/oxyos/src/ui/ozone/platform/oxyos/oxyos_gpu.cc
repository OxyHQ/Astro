// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_gpu.h"

#include <fcntl.h>
#include <linux/dma-heap.h>
#include <sys/ioctl.h>
#include <sys/stat.h>
#include <sys/sysmacros.h>
#include <unistd.h>

#include <algorithm>
#include <utility>

#include "base/command_line.h"
#include "base/environment.h"
#include "base/files/file_path.h"
#include "base/files/file_util.h"
#include "base/functional/bind.h"
#include "base/logging.h"
#include "base/numerics/checked_math.h"
#include "base/posix/eintr_wrapper.h"
#include "base/strings/cstring_view.h"
#include "base/strings/strcat.h"
#include "base/strings/stringprintf.h"
#include "base/task/thread_pool.h"
#include "base/time/time.h"
#include "components/viz/common/resources/shared_image_format.h"
#include "mojo/public/cpp/bindings/binder_map.h"
#include "ui/gfx/linux/drm_util_linux.h"
#include "ui/gfx/linux/gbm_buffer.h"
#include "ui/gfx/linux/gbm_defines.h"
#include "ui/gfx/linux/gbm_device.h"
#include "ui/gfx/linux/gbm_wrapper.h"
#include "ui/gfx/linux/native_pixmap_dmabuf.h"
#include "ui/gfx/native_pixmap_handle.h"
#include "ui/ozone/public/ozone_switches.h"

namespace ui {

namespace {

constexpr base::TimeDelta kTableWait = base::Seconds(10);
constexpr uint64_t kLinear = 0;
constexpr uint32_t kLinearStrideAlignment = 256;
constexpr char kLinearHeap[] = "/dev/dma_heap/system";
constexpr char kVulkanDriversSelect[] = "VK_LOADER_DRIVERS_SELECT";
constexpr base::cstring_view kVulkanDriverChoices[] = {
    "VK_DRIVER_FILES", "VK_ICD_FILENAMES", "VK_ADD_DRIVER_FILES",
    "VK_LOADER_DRIVERS_DISABLE"};
constexpr std::string_view kSoftwareVulkanDrivers = "*swiftshader*";
constexpr std::string_view kNoHardwareVulkanDrivers = "*lvp*";

std::string DrmDriverOf(uint64_t device) {
  base::FilePath driver;
  if (!device ||
      !base::ReadSymbolicLink(
          base::FilePath(base::StringPrintf("/sys/dev/char/%u:%u/device/driver",
                                            major(device), minor(device))),
          &driver)) {
    return std::string();
  }
  return driver.BaseName().value();
}

void LoadOnlyTheVulkanDriversOf(uint64_t device) {
  std::unique_ptr<base::Environment> environment = base::Environment::Create();
  for (base::cstring_view choice : kVulkanDriverChoices) {
    environment->UnSetVar(choice);
  }
  const std::string drivers = OxyOSVulkanDriversFor(DrmDriverOf(device));
  environment->SetVar(kVulkanDriversSelect, drivers);
  VLOG(1) << "OxyOS loads only the Vulkan drivers " << drivers;
}

scoped_refptr<gfx::NativePixmap> AllocateLinear(const gfx::Size& size,
                                                viz::SharedImageFormat format) {
  base::CheckedNumeric<uint32_t> stride = size.width();
  stride *= 4;
  stride += kLinearStrideAlignment - 1;
  stride /= kLinearStrideAlignment;
  stride *= kLinearStrideAlignment;
  base::CheckedNumeric<uint64_t> length = stride.Cast<uint64_t>();
  length *= size.height();
  if (!stride.IsValid() || !length.IsValid()) {
    return nullptr;
  }
  base::ScopedFD heap(HANDLE_EINTR(open(kLinearHeap, O_RDONLY | O_CLOEXEC)));
  if (!heap.is_valid()) {
    PLOG(ERROR) << "No DMA-BUF heap for a linear GPU buffer";
    return nullptr;
  }
  dma_heap_allocation_data allocation = {};
  allocation.len = length.ValueOrDie();
  allocation.fd_flags = O_RDWR | O_CLOEXEC;
  if (HANDLE_EINTR(ioctl(heap.get(), DMA_HEAP_IOCTL_ALLOC, &allocation)) < 0) {
    PLOG(ERROR) << "The DMA-BUF heap refused a linear GPU buffer";
    return nullptr;
  }
  gfx::NativePixmapHandle handle;
  handle.modifier = kLinear;
  handle.planes.emplace_back(stride.ValueOrDie(), 0, allocation.len,
                             base::ScopedFD(allocation.fd));
  return base::MakeRefCounted<gfx::NativePixmapDmaBuf>(size, format,
                                                       std::move(handle));
}

}  // namespace

std::vector<OxyOSGpuTableEntry> OxyOSLinearOnly(
    std::vector<OxyOSGpuTableEntry> table) {
  std::erase_if(table, [](const OxyOSGpuTableEntry& entry) {
    return entry.modifier != kLinear;
  });
  return table;
}

base::ScopedFD OxyOSOpenRenderNode(const base::FilePath& node) {
  if (node.empty()) {
    return base::ScopedFD();
  }
  base::ScopedFD fd(
      HANDLE_EINTR(open(node.value().c_str(), O_RDWR | O_CLOEXEC)));
  struct stat info;
  if (!fd.is_valid() || fstat(fd.get(), &info) != 0 || !S_ISCHR(info.st_mode)) {
    return base::ScopedFD();
  }
  return fd;
}

std::string OxyOSVulkanDriversFor(std::string_view drm_driver) {
  static constexpr std::pair<std::string_view, std::string_view> kDrivers[] = {
      {"i915", "*intel*"},
      {"xe", "*intel*"},
      {"amdgpu", "*radeon*"},
      {"nouveau", "*nouveau*"},
      {"virtio_gpu", "*virtio*,*gfxstream*"},
      {"msm", "*freedreno*"},
      {"panfrost", "*panfrost*"},
      {"panthor", "*panfrost*"},
      {"v3d", "*broadcom*"},
      {"asahi", "*asahi*"},
      {"nvidia", "*nvidia*"},
  };
  std::string_view hardware = kNoHardwareVulkanDrivers;
  for (const auto& [driver, icds] : kDrivers) {
    if (driver == drm_driver) {
      hardware = icds;
    }
  }
  return base::StrCat({hardware, ",", kSoftwareVulkanDrivers});
}

std::vector<uint64_t> OxyOSRenderable(
    const std::vector<uint64_t>& offered,
    const std::optional<std::vector<uint64_t>>& renderable) {
  if (!renderable) {
    return offered;
  }
  std::vector<uint64_t> kept;
  for (uint64_t modifier : offered) {
    if (std::ranges::contains(*renderable, modifier)) {
      kept.push_back(modifier);
    }
  }
  return kept;
}

std::vector<uint64_t> OxyOSModifiersFor(
    const std::vector<OxyOSGpuTableEntry>& table,
    uint32_t format) {
  std::vector<uint64_t> modifiers;
  for (const OxyOSGpuTableEntry& entry : table) {
    if (entry.format == format &&
        !std::ranges::contains(modifiers, entry.modifier)) {
      modifiers.push_back(entry.modifier);
    }
  }
  return modifiers;
}

OxyOSGpu::OxyOSGpu()
    : unbound_host_(host_.BindNewPipeAndPassReceiver()),
      table_ready_(base::WaitableEvent::ResetPolicy::MANUAL,
                   base::WaitableEvent::InitialState::NOT_SIGNALED) {
  render_node_ = OxyOSOpenRenderNode(
      base::CommandLine::ForCurrentProcess()->GetSwitchValuePath(
          switches::kRenderNodeOverride));
  struct stat node;
  if (render_node_.is_valid() && fstat(render_node_.get(), &node) == 0) {
    render_device_ = node.st_rdev;
    gbm_ = CreateGbmDevice(render_node_.get());
  }
  LoadOnlyTheVulkanDriversOf(render_device_);
  LOG_IF(ERROR, !gbm_) << "No GBM device for OxyOS's GPU buffers";
  supports_native_pixmaps_ = gbm_ || access(kLinearHeap, R_OK) == 0;
  VLOG(1) << "OxyOS GPU buffers on render node " << render_device_;
}

OxyOSGpu::~OxyOSGpu() = default;

void OxyOSGpu::AddInterfaces(mojo::BinderMap* binders) {
  binders->Add<ozone::mojom::OxyOSGpu>(
      base::BindRepeating(&OxyOSGpu::Bind, base::Unretained(this)),
      base::ThreadPool::CreateSequencedTaskRunner({}));
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

void OxyOSGpu::SetGpuTable(
    uint64_t device,
    std::vector<ozone::mojom::OxyOSGpuFormatPtr> formats) {
  std::vector<OxyOSGpuTableEntry> table;
  for (const auto& format : formats) {
    table.push_back({format->format, format->modifier});
  }
  {
    base::AutoLock hold(lock_);
    same_device_ = device && device == render_device_;
    table_ =
        same_device_ ? std::move(table) : OxyOSLinearOnly(std::move(table));
    VLOG(1) << "OxyOS GPU table of device " << device << ": " << table_.size()
            << " formats and modifiers, same device " << same_device_;
  }
  table_ready_.Signal();
}

bool OxyOSGpu::WaitForTable() {
  if (table_ready_.IsSignaled()) {
    return true;
  }
  if (!table_ready_.TimedWait(kTableWait)) {
    LOG(ERROR) << "OxyOS never told the GPU process its buffer table";
    return false;
  }
  return true;
}

void OxyOSGpu::SetRenderableModifiers(RenderableModifiers renderable) {
  base::AutoLock hold(lock_);
  if (renderable_) {
    return;
  }
  renderable_ = std::move(renderable);
  rendered_.clear();
}

std::vector<uint64_t> OxyOSGpu::CandidatesFor(uint32_t fourcc) {
  auto it = rendered_.find(fourcc);
  if (it == rendered_.end()) {
    it = rendered_
             .emplace(fourcc,
                      renderable_ ? renderable_.Run(fourcc) : std::nullopt)
             .first;
  }
  std::vector<uint64_t> kept =
      OxyOSRenderable(OxyOSModifiersFor(table_, fourcc), it->second);
  std::erase_if(kept, [this, fourcc](uint64_t modifier) {
    return rejected_.contains({fourcc, modifier});
  });
  return kept;
}

bool OxyOSGpu::CanAllocate(uint32_t fourcc) {
  if (!WaitForTable()) {
    return false;
  }
  base::AutoLock hold(lock_);
  const std::vector<uint64_t> modifiers = CandidatesFor(fourcc);
  const bool gbm = gbm_ && gbm_->CanCreateBufferForFormat(fourcc);
  const bool linear = std::ranges::contains(modifiers, kLinear) &&
                      access(kLinearHeap, R_OK) == 0;
  VLOG(1) << "OxyOS GPU buffers of format " << fourcc << ": "
          << modifiers.size() << " modifiers, GBM " << gbm << ", linear heap "
          << linear;
  return !modifiers.empty() && (gbm || linear);
}

scoped_refptr<gfx::NativePixmap> OxyOSGpu::Allocate(
    const gfx::Size& size,
    viz::SharedImageFormat format,
    gfx::BufferUsage usage) {
  if (size.IsEmpty() || !WaitForTable()) {
    return nullptr;
  }
  const uint32_t fourcc = GetFourCCFormatFromSharedImageFormat(format);
  base::AutoLock hold(lock_);
  const std::vector<uint64_t> modifiers = CandidatesFor(fourcc);
  if (modifiers.empty()) {
    return nullptr;
  }
  if (gbm_ && gbm_->CanCreateBufferForFormat(fourcc)) {
    uint32_t flags = GBM_BO_USE_RENDERING | GBM_BO_USE_TEXTURING;
    if (usage == gfx::BufferUsage::SCANOUT) {
      flags |= GBM_BO_USE_SCANOUT;
    }
    std::vector<uint64_t> candidates = modifiers;
    while (!candidates.empty()) {
      std::unique_ptr<GbmBuffer> buffer =
          gbm_->CreateBufferWithModifiers(fourcc, size, flags, candidates);
      if (!buffer) {
        break;
      }
      const uint64_t modifier = buffer->GetFormatModifier();
      if (buffer->GetNumPlanes() <= format.NumberOfPlanes()) {
        VLOG(1) << "OxyOS GPU buffer " << size.ToString() << " modifier "
                << modifier;
        return base::MakeRefCounted<gfx::NativePixmapDmaBuf>(
            size, format, buffer->ExportHandle());
      }
      VLOG(1) << "OxyOS leaves out modifier " << modifier << ": "
              << buffer->GetNumPlanes() << " memory planes";
      rejected_.insert({fourcc, modifier});
      std::erase(candidates, modifier);
    }
    if (!std::ranges::contains(modifiers, kLinear)) {
      LOG(ERROR) << "GBM allocated no buffer the compositor imports";
      return nullptr;
    }
  }
  if (!std::ranges::contains(modifiers, kLinear)) {
    return nullptr;
  }
  VLOG(1) << "OxyOS linear GPU buffer " << size.ToString();
  return AllocateLinear(size, format);
}

}  // namespace ui
