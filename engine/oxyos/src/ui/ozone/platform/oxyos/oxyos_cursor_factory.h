// Copyright 2026 Oxy. Apache-2.0.

#ifndef UI_OZONE_PLATFORM_OXYOS_OXYOS_CURSOR_FACTORY_H_
#define UI_OZONE_PLATFORM_OXYOS_OXYOS_CURSOR_FACTORY_H_

#include "ui/ozone/common/bitmap_cursor_factory.h"

namespace ui {

class OxyOSCursorFactory : public BitmapCursorFactory {
 public:
  OxyOSCursorFactory();
  OxyOSCursorFactory(const OxyOSCursorFactory&) = delete;
  OxyOSCursorFactory& operator=(const OxyOSCursorFactory&) = delete;
  ~OxyOSCursorFactory() override;

  scoped_refptr<PlatformCursor> GetDefaultCursor(
      mojom::CursorType type) override;
};

}

#endif
