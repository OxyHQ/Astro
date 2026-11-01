// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_gl_ozone.h"

#include <dlfcn.h>
#include <sys/stat.h>

#include <algorithm>
#include <initializer_list>
#include <optional>
#include <string_view>
#include <vector>

#include "base/functional/bind.h"
#include "base/logging.h"
#include "components/viz/common/resources/shared_image_format.h"
#include "ui/gfx/extension_set.h"
#include "ui/gfx/linux/drm_util_linux.h"
#include "ui/gl/gl_bindings.h"
#include "ui/gl/gl_display.h"
#include "ui/gl/gl_fence.h"
#include "ui/gl/gl_implementation.h"
#include "ui/gl/gl_surface_egl.h"
#include "ui/gl/presenter.h"
#include "ui/ozone/common/egl_util.h"
#include "ui/ozone/common/native_pixmap_egl_binding.h"
#include "ui/ozone/platform/oxyos/oxyos_gpu.h"
#include "ui/ozone/platform/oxyos/oxyos_presenter.h"

namespace ui {

namespace {

constexpr int kMaxEGLDevices = 64;
constexpr char kSystemEGL[] = "libEGL.so.1";

bool HasAnyExtension(const char* extensions,
                     std::initializer_list<std::string_view> names) {
  if (!extensions) {
    return false;
  }
  const gfx::ExtensionSet set = gfx::MakeExtensionSet(extensions);
  for (std::string_view name : names) {
    if (gfx::HasExtension(set, name)) {
      return true;
    }
  }
  return false;
}

EGLDeviceEXT SystemEGLDeviceFor(uint64_t render_device) {
  void* library = dlopen(kSystemEGL, RTLD_NOW);
  if (!library) {
    LOG(ERROR) << "OxyOS has no system EGL: " << dlerror();
    return EGL_NO_DEVICE_EXT;
  }
  auto get_proc_address = reinterpret_cast<PFNEGLGETPROCADDRESSPROC>(
      dlsym(library, "eglGetProcAddress"));
  auto query_string =
      reinterpret_cast<PFNEGLQUERYSTRINGPROC>(dlsym(library, "eglQueryString"));
  if (!get_proc_address || !query_string) {
    return EGL_NO_DEVICE_EXT;
  }
  const char* client_extensions = query_string(EGL_NO_DISPLAY, EGL_EXTENSIONS);
  if (!HasAnyExtension(client_extensions,
                       {"EGL_EXT_device_enumeration", "EGL_EXT_device_base"}) ||
      !HasAnyExtension(client_extensions,
                       {"EGL_EXT_device_query", "EGL_EXT_device_base"}) ||
      !HasAnyExtension(client_extensions, {"EGL_EXT_platform_device"})) {
    LOG(ERROR) << "OxyOS's system EGL cannot name its devices";
    return EGL_NO_DEVICE_EXT;
  }
  auto query_devices = reinterpret_cast<PFNEGLQUERYDEVICESEXTPROC>(
      get_proc_address("eglQueryDevicesEXT"));
  auto query_device_string = reinterpret_cast<PFNEGLQUERYDEVICESTRINGEXTPROC>(
      get_proc_address("eglQueryDeviceStringEXT"));
  std::vector<EGLDeviceEXT> handles(kMaxEGLDevices, EGL_NO_DEVICE_EXT);
  EGLint count = 0;
  if (!query_devices || !query_device_string ||
      !query_devices(kMaxEGLDevices, handles.data(), &count)) {
    return EGL_NO_DEVICE_EXT;
  }
  handles.resize(std::clamp<EGLint>(count, 0, kMaxEGLDevices));
  std::vector<OxyOSEGLDevice> devices;
  for (EGLDeviceEXT handle : handles) {
    const char* extensions = query_device_string(handle, EGL_EXTENSIONS);
    OxyOSEGLDevice device;
    device.software = HasAnyExtension(extensions, {"EGL_MESA_device_software"});
    struct stat node;
    if (HasAnyExtension(extensions, {"EGL_EXT_device_drm_render_node"})) {
      const char* path =
          query_device_string(handle, EGL_DRM_RENDER_NODE_FILE_EXT);
      if (path && stat(path, &node) == 0 && S_ISCHR(node.st_mode)) {
        device.render_node = node.st_rdev;
      }
    }
    devices.push_back(device);
  }
  const std::optional<size_t> chosen =
      OxyOSChooseEGLDevice(devices, render_device);
  LOG_IF(ERROR, !chosen) << "OxyOS's system EGL has no device for render node "
                         << render_device;
  return chosen ? handles[*chosen] : EGL_NO_DEVICE_EXT;
}

std::optional<std::vector<uint64_t>> RenderableModifiersOf(EGLDisplay display,
                                                           uint32_t fourcc) {
  EGLint count = 0;
  if (!eglQueryDmaBufModifiersEXT(display, static_cast<EGLint>(fourcc), 0,
                                  nullptr, nullptr, &count) ||
      count < 0) {
    return std::nullopt;
  }
  std::vector<EGLuint64KHR> modifiers(count);
  std::vector<EGLBoolean> external_only(count);
  if (count && !eglQueryDmaBufModifiersEXT(display, static_cast<EGLint>(fourcc),
                                           count, modifiers.data(),
                                           external_only.data(), &count)) {
    return std::nullopt;
  }
  std::vector<uint64_t> renderable;
  for (EGLint i = 0; i < count; ++i) {
    if (!external_only[i]) {
      renderable.push_back(modifiers[i]);
    }
  }
  VLOG(1) << "OxyOS GL renders format " << fourcc << " in " << renderable.size()
          << " of " << count << " modifiers";
  return renderable;
}

}

std::optional<size_t> OxyOSChooseEGLDevice(
    const std::vector<OxyOSEGLDevice>& devices,
    uint64_t render_device) {
  for (size_t i = 0; i < devices.size(); ++i) {
    const bool chosen =
        render_device
            ? !devices[i].software && devices[i].render_node == render_device
            : devices[i].software;
    if (chosen) {
      return i;
    }
  }
  return std::nullopt;
}

OxyOSGLEGLUtility::OxyOSGLEGLUtility() = default;

OxyOSGLEGLUtility::~OxyOSGLEGLUtility() = default;

void OxyOSGLEGLUtility::GetAdditionalEGLAttributes(
    EGLenum platform_type,
    std::vector<EGLAttrib>* display_attributes) {
  if (platform_type != EGL_PLATFORM_ANGLE_TYPE_OPENGL_ANGLE &&
      platform_type != EGL_PLATFORM_ANGLE_TYPE_OPENGLES_ANGLE) {
    return;
  }
  bool egl_device_type = false;
  for (size_t i = 0; i + 1 < display_attributes->size(); i += 2) {
    if ((*display_attributes)[i] == EGL_PLATFORM_ANGLE_DEVICE_TYPE_ANGLE) {
      if ((*display_attributes)[i + 1] !=
          EGL_PLATFORM_ANGLE_DEVICE_TYPE_EGL_ANGLE) {
        return;
      }
      egl_device_type = true;
    }
  }
  display_attributes->push_back(EGL_PLATFORM_ANGLE_NATIVE_PLATFORM_TYPE_ANGLE);
  display_attributes->push_back(EGL_PLATFORM_DEVICE_EXT);
  if (!egl_device_type) {
    display_attributes->push_back(EGL_PLATFORM_ANGLE_DEVICE_TYPE_ANGLE);
    display_attributes->push_back(EGL_PLATFORM_ANGLE_DEVICE_TYPE_EGL_ANGLE);
  }
}

void OxyOSGLEGLUtility::ChooseEGLAlphaAndBufferSize(EGLint* alpha_size,
                                                    EGLint* buffer_size) {}

OxyOSGLOzone::OxyOSGLOzone(OxyOSGpu* gpu) : gpu_(gpu) {}

OxyOSGLOzone::~OxyOSGLOzone() = default;

bool OxyOSGLOzone::CanImportNativePixmap(viz::SharedImageFormat format) {
  const bool import =
      gl::GLSurfaceEGL::GetGLDisplayEGL()->ext->b_EGL_EXT_image_dma_buf_import;
  VLOG(1) << "OxyOS imports DMA-BUFs into GL " << import << ", native fences "
          << gl::GLFence::IsGpuFenceSupported();
  return import && NativePixmapEGLBinding::IsSharedImageFormatSupported(format);
}

std::unique_ptr<NativePixmapGLBinding> OxyOSGLOzone::ImportNativePixmap(
    scoped_refptr<gfx::NativePixmap> pixmap,
    viz::SharedImageFormat plane_format,
    std::optional<int> plane_index,
    gfx::Size plane_size,
    const gfx::ColorSpace& color_space,
    GLenum target,
    GLuint texture_id) {
  return NativePixmapEGLBinding::Create(pixmap, plane_format, plane_index,
                                        plane_size, color_space, target,
                                        texture_id);
}

scoped_refptr<gl::GLSurface> OxyOSGLOzone::CreateViewGLSurface(
    gl::GLDisplay* display,
    gfx::AcceleratedWidget window) {
  return nullptr;
}

scoped_refptr<gl::Presenter> OxyOSGLOzone::CreateSurfacelessViewGLSurface(
    gl::GLDisplay* display,
    gfx::AcceleratedWidget window) {
  if (gl::IsSoftwareGLImplementation(gl::GetGLImplementationParts())) {
    return nullptr;
  }
  gl::GLDisplayEGL* egl = display->GetAs<gl::GLDisplayEGL>();
  if (egl->ext->b_EGL_EXT_image_dma_buf_import_modifiers) {
    gpu_->SetRenderableModifiers(
        base::BindRepeating(&RenderableModifiersOf, egl->GetDisplay()));
  }
  const char* missing = nullptr;
  if (!CanImportNativePixmap(viz::SinglePlaneFormat::kBGRA_8888)) {
    missing = "DMA-BUF import";
  } else if (gl::GetANGLEImplementation() == gl::ANGLEImplementation::kVulkan &&
             !gl::GLFence::IsGpuFenceSupported()) {
    missing = "native fences";
  } else if (!gpu_->CanAllocate(GetFourCCFormatFromSharedImageFormat(
                 viz::SinglePlaneFormat::kBGRA_8888))) {
    missing = "buffers the compositor imports";
  }
  if (missing) {
    LOG(WARNING) << "OxyOS composites in software: the GPU has no " << missing;
    return nullptr;
  }
  return base::MakeRefCounted<OxyOSPresenter>(gpu_, window);
}

scoped_refptr<gl::GLSurface> OxyOSGLOzone::CreateOffscreenGLSurface(
    gl::GLDisplay* display,
    const gfx::Size& size) {
  gl::GLDisplayEGL* egl = display->GetAs<gl::GLDisplayEGL>();
  if (egl->IsEGLSurfacelessContextSupported() && size.IsEmpty()) {
    return gl::InitializeGLSurface(new gl::SurfacelessEGL(egl, size));
  }
  return gl::InitializeGLSurface(new gl::PbufferGLSurfaceEGL(egl, size));
}

gl::EGLDisplayPlatform OxyOSGLOzone::GetNativeDisplay() {
  if (native_display_.Valid()) {
    return native_display_;
  }
  native_display_ =
      gl::EGLDisplayPlatform(reinterpret_cast<EGLNativeDisplayType>(
                                 SystemEGLDeviceFor(gpu_->render_device())),
                             EGL_PLATFORM_DEVICE_EXT);
  return native_display_;
}

bool OxyOSGLOzone::LoadGLES2Bindings(const gl::GLImplementationParts& impl) {
  return LoadDefaultEGLGLES2Bindings(impl);
}

}
