// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_cursor_factory.h"

#include "ui/base/cursor/mojom/cursor_type.mojom-shared.h"
#include "ui/base/cursor/platform_cursor.h"
#include "ui/ozone/platform/oxyos/oxyos_conversions.h"

namespace ui {

OxyOSCursorFactory::OxyOSCursorFactory() = default;
OxyOSCursorFactory::~OxyOSCursorFactory() = default;

scoped_refptr<PlatformCursor> OxyOSCursorFactory::GetDefaultCursor(
    mojom::CursorType type) {
  if (type != mojom::CursorType::kNone && !OxyOSPointerShape(type)) {
    return nullptr;
  }
  return BitmapCursorFactory::GetDefaultCursor(type);
}

}
