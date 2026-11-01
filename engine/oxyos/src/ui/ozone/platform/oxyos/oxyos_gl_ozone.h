// Copyright 2026 Oxy. Apache-2.0.

#ifndef UI_OZONE_PLATFORM_OXYOS_OXYOS_GL_OZONE_H_
#define UI_OZONE_PLATFORM_OXYOS_OXYOS_GL_OZONE_H_

#include <cstddef>
#include <cstdint>
#include <memory>
#include <optional>
#include <vector>

#include "base/memory/raw_ptr.h"
#include "ui/gl/gl_display.h"
#include "ui/ozone/common/gl_ozone_egl.h"
#include "ui/ozone/public/platform_gl_egl_utility.h"

namespace ui {

class OxyOSGpu;

struct OxyOSEGLDevice {
  std::optional<uint64_t> render_node;
  bool software = false;
};

std::optional<size_t> OxyOSChooseEGLDevice(
    const std::vector<OxyOSEGLDevice>& devices,
    uint64_t render_device);

class OxyOSGLEGLUtility : public PlatformGLEGLUtility {
 public:
  OxyOSGLEGLUtility();
  OxyOSGLEGLUtility(const OxyOSGLEGLUtility&) = delete;
  OxyOSGLEGLUtility& operator=(const OxyOSGLEGLUtility&) = delete;
  ~OxyOSGLEGLUtility() override;

  void GetAdditionalEGLAttributes(
      EGLenum platform_type,
      std::vector<EGLAttrib>* display_attributes) override;
  void ChooseEGLAlphaAndBufferSize(EGLint* alpha_size,
                                   EGLint* buffer_size) override;
};

class OxyOSGLOzone : public GLOzoneEGL {
 public:
  explicit OxyOSGLOzone(OxyOSGpu* gpu);
  OxyOSGLOzone(const OxyOSGLOzone&) = delete;
  OxyOSGLOzone& operator=(const OxyOSGLOzone&) = delete;
  ~OxyOSGLOzone() override;

  bool CanImportNativePixmap(viz::SharedImageFormat format) override;
  std::unique_ptr<NativePixmapGLBinding> ImportNativePixmap(
      scoped_refptr<gfx::NativePixmap> pixmap,
      viz::SharedImageFormat plane_format,
      std::optional<int> plane_index,
      gfx::Size plane_size,
      const gfx::ColorSpace& color_space,
      GLenum target,
      GLuint texture_id) override;
  scoped_refptr<gl::GLSurface> CreateViewGLSurface(
      gl::GLDisplay* display,
      gfx::AcceleratedWidget window) override;
  scoped_refptr<gl::Presenter> CreateSurfacelessViewGLSurface(
      gl::GLDisplay* display,
      gfx::AcceleratedWidget window) override;
  scoped_refptr<gl::GLSurface> CreateOffscreenGLSurface(
      gl::GLDisplay* display,
      const gfx::Size& size) override;

 protected:
  gl::EGLDisplayPlatform GetNativeDisplay() override;
  bool LoadGLES2Bindings(const gl::GLImplementationParts& impl) override;

 private:
  const raw_ptr<OxyOSGpu> gpu_;
  gl::EGLDisplayPlatform native_display_;
};

}

#endif
