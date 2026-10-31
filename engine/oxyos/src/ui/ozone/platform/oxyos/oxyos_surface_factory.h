// Copyright 2026 Oxy. Apache-2.0.

#ifndef UI_OZONE_PLATFORM_OXYOS_OXYOS_SURFACE_FACTORY_H_
#define UI_OZONE_PLATFORM_OXYOS_OXYOS_SURFACE_FACTORY_H_

#include <memory>
#include <optional>
#include <vector>

#include "base/memory/raw_ptr.h"
#include "ui/ozone/public/surface_factory_ozone.h"

namespace ui {

class OxyOSGLOzone;
class OxyOSGpu;

class OxyOSSurfaceFactory : public SurfaceFactoryOzone {
 public:
  explicit OxyOSSurfaceFactory(OxyOSGpu* gpu);
  OxyOSSurfaceFactory(const OxyOSSurfaceFactory&) = delete;
  OxyOSSurfaceFactory& operator=(const OxyOSSurfaceFactory&) = delete;
  ~OxyOSSurfaceFactory() override;

  std::vector<gl::GLImplementationParts> GetAllowedGLImplementations() override;
  GLOzone* GetGLOzone(const gl::GLImplementationParts& implementation) override;
  std::unique_ptr<SurfaceOzoneCanvas> CreateCanvasForWidget(
      gfx::AcceleratedWidget widget) override;
  scoped_refptr<gfx::NativePixmap> CreateNativePixmap(
      gfx::AcceleratedWidget widget,
      gpu::VulkanDeviceQueue* device_queue,
      gfx::Size size,
      viz::SharedImageFormat format,
      gfx::BufferUsage usage,
      std::optional<gfx::Size> framebuffer_size) override;
  bool CanCreateNativePixmapForFormat(viz::SharedImageFormat format) override;
  scoped_refptr<gfx::NativePixmap> CreateNativePixmapFromHandle(
      gfx::AcceleratedWidget widget,
      gfx::Size size,
      viz::SharedImageFormat format,
      gfx::NativePixmapHandle handle) override;

 private:
  const raw_ptr<OxyOSGpu> gpu_;
  std::unique_ptr<OxyOSGLOzone> egl_;
};

}

#endif
