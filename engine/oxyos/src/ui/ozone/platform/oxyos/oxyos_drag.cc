// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_drag.h"

#include <memory>

#include "ui/base/dragdrop/drag_drop_types.h"
#include "ui/base/dragdrop/os_exchange_data.h"
#include "ui/gfx/geometry/rect_f.h"
#include "ui/platform_window/wm/wm_drop_handler.h"

namespace ui {

OxyOSDrag::OxyOSDrag(WmDropHandler* target,
                     const OSExchangeData& data,
                     int operations,
                     WmDragHandler::LocationDelegate* location,
                     const gfx::SizeF& bounds_dip)
    : target_(target),
      data_(data),
      operations_(operations),
      location_(location),
      bounds_dip_(bounds_dip) {}

OxyOSDrag::~OxyOSDrag() = default;

void OxyOSDrag::Motion(const gfx::PointF& point_dip,
                       const gfx::Point& screen_px,
                       int modifiers) {
  if (location_) {
    location_->OnDragLocationChanged(screen_px);
  }
  if (!target_ || !gfx::RectF(bounds_dip_).Contains(point_dip)) {
    Leave();
    return;
  }
  if (!entered_) {
    entered_ = true;
    target_->OnDragEnter(point_dip, operations_, modifiers);
    target_->OnDragDataAvailable(
        std::make_unique<OSExchangeData>(data_->provider().Clone()));
  }
  SetOperation(PreferredDragOperation(
      target_->OnDragMotion(point_dip, operations_, modifiers) & operations_));
}

void OxyOSDrag::Leave() {
  if (entered_) {
    entered_ = false;
    target_->OnDragLeave();
  }
  SetOperation(mojom::DragOperation::kNone);
}

mojom::DragOperation OxyOSDrag::Drop(int modifiers) {
  const mojom::DragOperation dropped = operation_;
  if (!entered_ || dropped == mojom::DragOperation::kNone) {
    Leave();
    return mojom::DragOperation::kNone;
  }
  entered_ = false;
  target_->OnDragDrop(modifiers);
  target_->OnDragLeave();
  return dropped;
}

void OxyOSDrag::SetOperation(mojom::DragOperation operation) {
  if (operation == operation_) {
    return;
  }
  operation_ = operation;
  if (location_) {
    location_->OnDragOperationChanged(operation);
  }
}

}
