// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_gl_ozone.h"

#include <sys/stat.h>

#include <optional>
#include <vector>

#include "base/functional/bind.h"
#include "base/logging.h"
#include "components/viz/common/resources/shared_image_format.h"
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

EGLDeviceEXT DeviceOf(int render_node) {
  struct stat node;
  if (render_node < 0 || fstat(render_node, &node) != 0 ||
      !gl::g_driver_egl.client_ext.b_EGL_EXT_device_query ||
      !gl::g_driver_egl.client_ext.b_EGL_EXT_device_enumeration) {
    return EGL_NO_DEVICE_EXT;
  }
  std::vector<EGLDeviceEXT> devices(kMaxEGLDevices, EGL_NO_DEVICE_EXT);
  EGLint count = 0;
  if (!eglQueryDevicesEXT(kMaxEGLDevices, devices.data(), &count)) {
    return EGL_NO_DEVICE_EXT;
  }
  for (EGLint i = 0; i < count; ++i) {
    const char* path =
        eglQueryDeviceStringEXT(devices[i], EGL_DRM_RENDER_NODE_FILE_EXT);
    struct stat candidate;
    if (path && stat(path, &candidate) == 0 &&
        candidate.st_rdev == node.st_rdev) {
      return devices[i];
    }
  }
  return EGL_NO_DEVICE_EXT;
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
  native_display_ = gl::EGLDisplayPlatform(EGL_DEFAULT_DISPLAY);
  if (gl::g_driver_egl.client_ext.b_EGL_MESA_platform_surfaceless) {
    native_display_ = gl::EGLDisplayPlatform(EGL_DEFAULT_DISPLAY,
                                             EGL_PLATFORM_SURFACELESS_MESA);
  }
  if (gl::g_driver_egl.client_ext.b_EGL_EXT_platform_device) {
    const EGLDeviceEXT device = DeviceOf(gpu_->render_node());
    if (device != EGL_NO_DEVICE_EXT) {
      native_display_ =
          gl::EGLDisplayPlatform(reinterpret_cast<EGLNativeDisplayType>(device),
                                 EGL_PLATFORM_DEVICE_EXT);
    }
  }
  return native_display_;
}

bool OxyOSGLOzone::LoadGLES2Bindings(const gl::GLImplementationParts& impl) {
  return LoadDefaultEGLGLES2Bindings(impl);
}

}
