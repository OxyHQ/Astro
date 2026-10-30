// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_surface_factory.h"

#include "ui/ozone/platform/oxyos/oxyos_canvas_surface.h"
#include "ui/ozone/public/surface_ozone_canvas.h"

namespace ui {

OxyOSSurfaceFactory::OxyOSSurfaceFactory(OxyOSGpu* gpu) : gpu_(gpu) {}

OxyOSSurfaceFactory::~OxyOSSurfaceFactory() = default;

std::unique_ptr<SurfaceOzoneCanvas> OxyOSSurfaceFactory::CreateCanvasForWidget(
    gfx::AcceleratedWidget widget) {
  return std::make_unique<OxyOSCanvasSurface>(gpu_, widget);
}

}
