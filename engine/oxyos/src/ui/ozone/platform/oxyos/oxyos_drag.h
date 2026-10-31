// Copyright 2026 Oxy. Apache-2.0.

#ifndef UI_OZONE_PLATFORM_OXYOS_OXYOS_DRAG_H_
#define UI_OZONE_PLATFORM_OXYOS_OXYOS_DRAG_H_

#include "base/memory/raw_ptr.h"
#include "base/memory/raw_ref.h"
#include "ui/base/dragdrop/mojom/drag_drop_types.mojom-shared.h"
#include "ui/gfx/geometry/point.h"
#include "ui/gfx/geometry/point_f.h"
#include "ui/gfx/geometry/size_f.h"
#include "ui/platform_window/wm/wm_drag_handler.h"

namespace ui {

class OSExchangeData;
class WmDropHandler;

class OxyOSDrag {
 public:
  OxyOSDrag(WmDropHandler* target,
            const OSExchangeData& data,
            int operations,
            WmDragHandler::LocationDelegate* location,
            const gfx::SizeF& bounds_dip);
  OxyOSDrag(const OxyOSDrag&) = delete;
  OxyOSDrag& operator=(const OxyOSDrag&) = delete;
  ~OxyOSDrag();

  void Motion(const gfx::PointF& point_dip,
              const gfx::Point& screen_px,
              int modifiers);
  void Leave();
  mojom::DragOperation Drop(int modifiers);

  bool entered() const { return entered_; }
  mojom::DragOperation operation() const { return operation_; }

 private:
  void SetOperation(mojom::DragOperation operation);

  const raw_ptr<WmDropHandler> target_;
  const raw_ref<const OSExchangeData> data_;
  const int operations_;
  const raw_ptr<WmDragHandler::LocationDelegate> location_;
  const gfx::SizeF bounds_dip_;
  bool entered_ = false;
  mojom::DragOperation operation_ = mojom::DragOperation::kNone;
};

}

#endif
