// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/client_native_pixmap_factory_oxyos.h"

#include "ui/gfx/linux/client_native_pixmap_factory_dmabuf.h"

namespace ui {

gfx::ClientNativePixmapFactory* CreateClientNativePixmapFactoryOxyos() {
  return gfx::CreateClientNativePixmapFactoryDmabuf();
}

}
