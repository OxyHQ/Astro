// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_surface_factory.h"

#include <utility>

#include "ui/gfx/geometry/rect.h"
#include "ui/gfx/linux/drm_util_linux.h"
#include "ui/gfx/linux/native_pixmap_dmabuf.h"
#include "ui/gl/gl_implementation.h"
#include "ui/ozone/platform/oxyos/oxyos_canvas_surface.h"
#include "ui/ozone/platform/oxyos/oxyos_gl_ozone.h"
#include "ui/ozone/platform/oxyos/oxyos_gpu.h"
#include "ui/ozone/public/surface_ozone_canvas.h"

namespace ui {

OxyOSSurfaceFactory::OxyOSSurfaceFactory(OxyOSGpu* gpu)
    : gpu_(gpu), egl_(gpu ? std::make_unique<OxyOSGLOzone>(gpu) : nullptr) {}

OxyOSSurfaceFactory::~OxyOSSurfaceFactory() = default;

std::vector<gl::GLImplementationParts>
OxyOSSurfaceFactory::GetAllowedGLImplementations() {
  std::vector<gl::GLImplementationParts> implementations;
  if (egl_) {
    implementations.emplace_back(gl::ANGLEImplementation::kOpenGL);
    implementations.emplace_back(gl::ANGLEImplementation::kOpenGLES);
    implementations.emplace_back(gl::ANGLEImplementation::kVulkan);
    implementations.emplace_back(gl::ANGLEImplementation::kSwiftShader);
    implementations.emplace_back(gl::kGLImplementationEGLGLES2);
  }
  return implementations;
}

GLOzone* OxyOSSurfaceFactory::GetGLOzone(
    const gl::GLImplementationParts& implementation) {
  switch (implementation.gl) {
    case gl::kGLImplementationEGLGLES2:
    case gl::kGLImplementationEGLANGLE:
      return egl_.get();
    default:
      return nullptr;
  }
}

std::unique_ptr<SurfaceOzoneCanvas> OxyOSSurfaceFactory::CreateCanvasForWidget(
    gfx::AcceleratedWidget widget) {
  return std::make_unique<OxyOSCanvasSurface>(gpu_, widget);
}

scoped_refptr<gfx::NativePixmap> OxyOSSurfaceFactory::CreateNativePixmap(
    gfx::AcceleratedWidget widget,
    gpu::VulkanDeviceQueue* device_queue,
    gfx::Size size,
    viz::SharedImageFormat format,
    gfx::BufferUsage usage,
    std::optional<gfx::Size> framebuffer_size) {
  if (!gpu_ || (framebuffer_size &&
                !gfx::Rect(size).Contains(gfx::Rect(*framebuffer_size)))) {
    return nullptr;
  }
  return gpu_->Allocate(size, format, usage);
}

bool OxyOSSurfaceFactory::CanCreateNativePixmapForFormat(
    viz::SharedImageFormat format) {
  return gpu_ &&
         gpu_->CanAllocate(GetFourCCFormatFromSharedImageFormat(format));
}

scoped_refptr<gfx::NativePixmap>
OxyOSSurfaceFactory::CreateNativePixmapFromHandle(
    gfx::AcceleratedWidget widget,
    gfx::Size size,
    viz::SharedImageFormat format,
    gfx::NativePixmapHandle handle) {
  auto pixmap = base::MakeRefCounted<gfx::NativePixmapDmaBuf>(
      size, format, std::move(handle));
  return pixmap->AreDmaBufFdsValid() ? pixmap : nullptr;
}

}
