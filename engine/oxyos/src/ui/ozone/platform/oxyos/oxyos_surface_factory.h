// Copyright 2026 Oxy. Apache-2.0.

#ifndef UI_OZONE_PLATFORM_OXYOS_OXYOS_SURFACE_FACTORY_H_
#define UI_OZONE_PLATFORM_OXYOS_OXYOS_SURFACE_FACTORY_H_

#include <memory>

#include "base/memory/raw_ptr.h"
#include "ui/ozone/public/surface_factory_ozone.h"

namespace ui {

class OxyOSGpu;

class OxyOSSurfaceFactory : public SurfaceFactoryOzone {
 public:
  explicit OxyOSSurfaceFactory(OxyOSGpu* gpu);
  OxyOSSurfaceFactory(const OxyOSSurfaceFactory&) = delete;
  OxyOSSurfaceFactory& operator=(const OxyOSSurfaceFactory&) = delete;
  ~OxyOSSurfaceFactory() override;

  std::unique_ptr<SurfaceOzoneCanvas> CreateCanvasForWidget(
      gfx::AcceleratedWidget widget) override;

 private:
  const raw_ptr<OxyOSGpu> gpu_;
};

}

#endif
