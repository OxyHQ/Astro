// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/client_native_pixmap_factory_oxyos.h"

#include "ui/ozone/common/stub_client_native_pixmap_factory.h"

namespace ui {

gfx::ClientNativePixmapFactory* CreateClientNativePixmapFactoryOxyos() {
  return CreateStubClientNativePixmapFactory();
}

}
