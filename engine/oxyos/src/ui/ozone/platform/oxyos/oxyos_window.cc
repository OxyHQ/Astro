// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_window.h"

#include <utility>

#include "base/functional/bind.h"
#include "base/logging.h"
#include "ui/base/cursor/cursor.h"
#include "ui/base/cursor/mojom/cursor_type.mojom-shared.h"
#include "ui/base/hit_test.h"
#include "ui/events/event.h"
#include "ui/events/ozone/events_ozone.h"
#include "ui/events/platform/platform_event_source.h"
#include "ui/gfx/geometry/point_conversions.h"
#include "ui/gfx/geometry/rect_conversions.h"
#include "ui/gfx/geometry/size_conversions.h"
#include "ui/ozone/common/bitmap_cursor.h"
#include "ui/ozone/platform/oxyos/oxyos_connection.h"
#include "ui/ozone/platform/oxyos/oxyos_conversions.h"
#include "ui/ozone/platform/oxyos/oxyos_screen.h"

namespace ui {

namespace {

constexpr size_t kTitleBytes = 256;
constexpr size_t kAppIdBytes = 128;

}

OxyOSWindow::OxyOSWindow(PlatformWindowDelegate* delegate,
                         OxyOSConnection* connection,
                         const PlatformWindowInitProperties& properties)
    : delegate_(delegate),
      connection_(connection),
      type_(properties.type),
      parent_widget_(properties.parent_widget),
      accepts_events_(properties.accept_events &&
                      properties.type != PlatformWindowType::kTooltip),
      app_id_(properties.wayland_app_id),
      surface_(connection->NextSurfaceId()) {
  const float scale =
      connection_->screen() ? connection_->screen()->scale() : 1.0f;
  state_.window_scale = scale;
  state_.size_px = properties.bounds.size();
  state_.bounds_dip =
      gfx::ScaleToEnclosingRect(properties.bounds, 1.0f / scale);
  state_.window_state = PlatformWindowState::kNormal;
  if (is_toplevel()) {
    state_.bounds_dip.set_origin(gfx::Point());
  }
  SetWmMoveResizeHandler(this, this);
}

OxyOSWindow::~OxyOSWindow() {
  DestroySurface();
  connection_->RemoveWindow(this);
  if (auto* source = PlatformEventSource::GetInstance()) {
    source->RemovePlatformEventDispatcher(this);
  }
}

void OxyOSWindow::Initialize() {
  if (is_toplevel()) {
    SetOxyOSMenuBar(this, this);
    SetWmDragHandler(this, this);
  }
  connection_->AddWindow(this);
  PlatformEventSource::GetInstance()->AddPlatformEventDispatcher(this);
  delegate_->OnAcceleratedWidgetAvailable(surface_);
}

OxyOSWindow* OxyOSWindow::parent() const {
  if (parent_widget_) {
    return connection_->GetWindow(parent_widget_);
  }
  return type_ == PlatformWindowType::kDrag ? connection_->pressed_window()
                                            : nullptr;
}

OxyOSWindow* OxyOSWindow::root() {
  OxyOSWindow* window = this;
  while (OxyOSWindow* next = window->parent()) {
    window = next;
  }
  return window;
}

OxyOSPositioner OxyOSWindow::Positioner() const {
  OxyOSWindow* owner = parent();
  const gfx::Point origin =
      owner ? owner->GetBoundsInDIP().origin() : gfx::Point();
  OwnedWindowAnchor anchor;
  if (auto owned = delegate_->GetOwnedWindowAnchorAndRectInDIP()) {
    anchor = *owned;
  } else {
    anchor.anchor_rect = gfx::Rect(state_.bounds_dip.origin(), gfx::Size(1, 1));
    anchor.anchor_position = OwnedWindowAnchorPosition::kTopLeft;
    anchor.anchor_gravity = OwnedWindowAnchorGravity::kBottomRight;
    anchor.constraint_adjustment =
        OwnedWindowConstraintAdjustment::kAdjustmentSlideX |
        OwnedWindowConstraintAdjustment::kAdjustmentSlideY;
  }
  anchor.anchor_rect.Offset(-origin.x(), -origin.y());
  const OxyOSPositioner positioner =
      OxyOSPopupPositioner(anchor, state_.bounds_dip.size());
  return owner ? OxyOSAnchoredWithin(positioner, owner->GetBoundsInDIP().size())
               : positioner;
}

void OxyOSWindow::CreateSurface() {
  OxyOSClient* client = connection_->client();
  if (is_toplevel()) {
    const gfx::Size size = state_.bounds_dip.size();
    if (oxyos_client_create_toplevel(client, surface_, size.width(),
                                     size.height()) != 0) {
      LOG(ERROR) << "OxyOS refused a window: " << oxyos_last_error();
      return;
    }
    created_ = true;
    if (!app_id_.empty()) {
      const std::string id = app_id_.substr(0, kAppIdBytes);
      oxyos_client_name_window(client, surface_, 1, id.data(), id.size());
    }
    SendTitle();
    SendSizeLimits();
    SendMenus();
  } else {
    OxyOSWindow* owner = parent();
    if (!owner || !owner->shown()) {
      LOG(ERROR) << "OxyOS popup without a shown parent";
      return;
    }
    const OxyOSPositioner positioner = Positioner();
    if (oxyos_client_create_popup(client, surface_, owner->surface(),
                                  &positioner) != 0) {
      LOG(ERROR) << "OxyOS refused a popup: " << oxyos_last_error();
      return;
    }
    created_ = true;
    if (!accepts_events_) {
      oxyos_client_set_input_region(client, surface_, 0, 0, 0, 0);
    }
    if (type_ == PlatformWindowType::kMenu) {
      oxyos_client_grab_popup(client, surface_,
                              connection_->last_press_serial());
    }
  }
  SendCursor();
}

void OxyOSWindow::DestroySurface() {
  if (!created_) {
    return;
  }
  created_ = false;
  oxyos_client_destroy_surface(connection_->client(), surface_);
  configures_.Clear();
  submitted_size_.reset();
  unsubmitted_damage_.clear();
  connection_->OnSurfaceDestroyed(this);
}

void OxyOSWindow::ApplyState(const PlatformWindowDelegate::State& next,
                             std::optional<uint64_t> serial) {
  const PlatformWindowDelegate::State old = state_;
  state_ = next;
  auto weak = weak_factory_.GetWeakPtr();
  const int64_t viz_seq = delegate_->OnStateUpdate(old, next);
  if (!weak || !serial) {
    return;
  }
  configures_.Push(
      {.serial = *serial, .size_px = next.size_px, .viz_seq = viz_seq});
  if (viz_seq == -1) {
    delegate_->OnDamageRect(gfx::Rect(next.size_px));
  }
}

void OxyOSWindow::OnConfigure(const OxyOSEvent& event) {
  if (!created_) {
    return;
  }
  const gfx::Size logical(static_cast<int>(event.width),
                          static_cast<int>(event.height));
  PlatformWindowDelegate::State next = state_;
  next.window_scale = OxyOSScale(event.scale_120);
  next.size_px = OxyOSBufferSize(logical, event.scale_120);
  if (is_toplevel()) {
    next.bounds_dip = gfx::Rect(ToplevelOrigin(), logical);
    configured_window_state_ = (event.flag & OXYOS_CONFIGURE_FULLSCREEN)
                                   ? PlatformWindowState::kFullScreen
                               : (event.flag & OXYOS_CONFIGURE_MAXIMIZED)
                                   ? PlatformWindowState::kMaximized
                                   : PlatformWindowState::kNormal;
    next.window_state =
        minimized_ ? PlatformWindowState::kMinimized : configured_window_state_;
    if (OxyOSScreen* screen = connection_->screen()) {
      screen->OnToplevelConfigured(logical, next.window_scale);
    }
  } else {
    OxyOSWindow* owner = parent();
    const gfx::Point origin =
        owner ? owner->GetBoundsInDIP().origin() : gfx::Point();
    next.bounds_dip = gfx::Rect(origin.x() + event.x, origin.y() + event.y,
                                logical.width(), logical.height());
  }
  ApplyState(next, event.serial);
}

void OxyOSWindow::OnActivated(bool active) {
  if (active && minimized_) {
    minimized_ = false;
    PlatformWindowDelegate::State next = state_;
    next.window_state = configured_window_state_;
    ApplyState(next, std::nullopt);
  }
  delegate_->OnActivationChanged(active);
}

void OxyOSWindow::OnPopupDone() {
  DestroySurface();
  delegate_->OnCloseRequest();
}

void OxyOSWindow::OnCompositorCloseRequest() {
  delegate_->OnCloseRequest();
}

bool OxyOSWindow::SetMenus(std::vector<OxyOSMenuEntry> entries,
                           Activated activated) {
  if (!is_toplevel()) {
    return false;
  }
  menus_ = std::move(entries);
  menu_activated_ = std::move(activated);
  SendMenus();
  return true;
}

void OxyOSWindow::SendMenus() {
  if (!created_ || !is_toplevel()) {
    return;
  }
  const std::vector<OxyOSMenuItem> items = OxyOSMenuItemsOf(menus_);
  ++menus_serial_;
  if (oxyos_client_set_menus(connection_->client(), surface_, menus_serial_,
                             items.data(), items.size()) != 0) {
    LOG(ERROR) << "OxyOS refused the window's menus: " << oxyos_last_error();
  }
}

void OxyOSWindow::OnMenuItemActivated(uint32_t menus, uint32_t index) {
  if (menus == menus_serial_ && index < menus_.size() && menu_activated_) {
    menu_activated_.Run(index);
  }
}

gfx::Point OxyOSWindow::ToplevelOrigin() const {
  OxyOSScreen* screen = connection_->screen();
  return screen ? screen->OriginOf(output_) : gfx::Point();
}

void OxyOSWindow::OnOutput(uint32_t output) {
  output_ = output;
  OnOutputPlaced();
}

void OxyOSWindow::OnOutputPlaced() {
  if (!is_toplevel() || !created_) {
    return;
  }
  const gfx::Point origin = ToplevelOrigin();
  if (state_.bounds_dip.origin() == origin) {
    return;
  }
  PlatformWindowDelegate::State next = state_;
  next.bounds_dip.set_origin(origin);
  ApplyState(next, std::nullopt);
}

void OxyOSWindow::OnRefresh(uint32_t refresh_mhz) {
  refresh_mhz_ = refresh_mhz;
}

void OxyOSWindow::OnLostCapture() {
  if (has_capture_) {
    has_capture_ = false;
    delegate_->OnLostCapture();
  }
}

std::optional<int64_t> OxyOSWindow::SubmitFrame(
    uint64_t buffer,
    const gfx::Size& size,
    const std::vector<gfx::Rect>& damage,
    int64_t viz_seq,
    const OxyOSSync* sync) {
  if (!created_) {
    return std::nullopt;
  }
  const std::optional<uint64_t> serial = configures_.Latch(size, viz_seq);
  if (!serial) {
    unsubmitted_damage_.insert(unsubmitted_damage_.end(), damage.begin(),
                               damage.end());
    return std::nullopt;
  }
  std::vector<OxyOSRect> rects;
  auto add = [&rects](const gfx::Rect& rect) {
    if (!rect.IsEmpty()) {
      rects.push_back({rect.x(), rect.y(), static_cast<uint32_t>(rect.width()),
                       static_cast<uint32_t>(rect.height())});
    }
  };
  if (submitted_size_ == size) {
    for (const gfx::Rect& rect : unsubmitted_damage_) {
      add(rect);
    }
    for (const gfx::Rect& rect : damage) {
      add(rect);
    }
  }
  const int64_t sequence = oxyos_client_submit_buffer_synced(
      connection_->client(), surface_, buffer, *serial, rects.data(),
      rects.size(), sync);
  if (sequence < 0) {
    LOG(ERROR) << "OxyOS refused a frame: " << oxyos_last_error();
    return std::nullopt;
  }
  submitted_size_ = size;
  unsubmitted_damage_.clear();
  return sequence;
}

void OxyOSWindow::Show(bool inactive) {
  if (!created_) {
    CreateSurface();
  }
}

void OxyOSWindow::Hide() {
  ReleaseCapture();
  DestroySurface();
}

void OxyOSWindow::Close() {
  Hide();
  delegate_->OnClosed();
}

bool OxyOSWindow::IsVisible() const {
  return created_;
}

void OxyOSWindow::PrepareForShutdown() {}

void OxyOSWindow::SetBoundsInPixels(const gfx::Rect& bounds) {
  SetBoundsInDIP(gfx::ScaleToEnclosingRect(bounds, 1.0f / scale()));
}

gfx::Rect OxyOSWindow::GetBoundsInPixels() const {
  return gfx::Rect(
      gfx::ScaleToRoundedPoint(state_.bounds_dip.origin(), scale()),
      state_.size_px);
}

void OxyOSWindow::SetBoundsInDIP(const gfx::Rect& bounds) {
  if (is_toplevel() && created_) {
    return;
  }
  PlatformWindowDelegate::State next = state_;
  next.bounds_dip = bounds;
  if (is_toplevel()) {
    next.bounds_dip.set_origin(ToplevelOrigin());
  }
  next.size_px = gfx::ScaleToCeiledSize(bounds.size(), scale());
  if (next == state_) {
    return;
  }
  ApplyState(next, std::nullopt);
  if (!is_toplevel() && created_) {
    const OxyOSPositioner positioner = Positioner();
    oxyos_client_reposition(connection_->client(), surface_, &positioner);
  }
}

gfx::Rect OxyOSWindow::GetBoundsInDIP() const {
  return state_.bounds_dip;
}

void OxyOSWindow::SetTitle(const std::u16string& title) {
  title_ = title;
  SendTitle();
}

void OxyOSWindow::SendTitle() {
  if (!created_ || !is_toplevel()) {
    return;
  }
  const std::string title = OxyOSTitle(title_, kTitleBytes);
  oxyos_client_name_window(connection_->client(), surface_, 0, title.data(),
                           title.size());
}

void OxyOSWindow::SendSizeLimits() {
  if (!created_ || !is_toplevel()) {
    return;
  }
  const gfx::Size minimum =
      delegate_->GetMinimumSizeForWindow().value_or(gfx::Size());
  const gfx::Size maximum =
      delegate_->GetMaximumSizeForWindow().value_or(gfx::Size());
  oxyos_client_set_size_limits(connection_->client(), surface_, minimum.width(),
                               minimum.height(), maximum.width(),
                               maximum.height());
}

void OxyOSWindow::SetCapture() {
  if (!has_capture_) {
    has_capture_ = true;
    connection_->SetCaptureWindow(this);
  }
}

void OxyOSWindow::ReleaseCapture() {
  if (has_capture_) {
    connection_->SetCaptureWindow(nullptr);
  }
}

bool OxyOSWindow::HasCapture() const {
  return has_capture_;
}

void OxyOSWindow::SetFullscreen(bool fullscreen, int64_t target_display_id) {
  if (created_ && is_toplevel()) {
    oxyos_client_set_fullscreen(connection_->client(), surface_, fullscreen);
  }
}

void OxyOSWindow::Maximize() {
  if (created_ && is_toplevel()) {
    oxyos_client_set_maximized(connection_->client(), surface_, true);
  }
}

void OxyOSWindow::Minimize() {
  if (!created_ || !is_toplevel() || minimized_) {
    return;
  }
  oxyos_client_minimize(connection_->client(), surface_);
  minimized_ = true;
  PlatformWindowDelegate::State next = state_;
  next.window_state = PlatformWindowState::kMinimized;
  ApplyState(next, std::nullopt);
}

void OxyOSWindow::Restore() {
  if (!created_ || !is_toplevel()) {
    return;
  }
  if (configured_window_state_ == PlatformWindowState::kFullScreen) {
    oxyos_client_set_fullscreen(connection_->client(), surface_, false);
  } else if (configured_window_state_ == PlatformWindowState::kMaximized) {
    oxyos_client_set_maximized(connection_->client(), surface_, false);
  }
}

PlatformWindowState OxyOSWindow::GetPlatformWindowState() const {
  return state_.window_state;
}

void OxyOSWindow::Activate() {}

void OxyOSWindow::Deactivate() {}

void OxyOSWindow::SetUseNativeFrame(bool use_native_frame) {}

bool OxyOSWindow::ShouldUseNativeFrame() const {
  return true;
}

void OxyOSWindow::SetCursor(scoped_refptr<PlatformCursor> cursor) {
  scoped_refptr<BitmapCursor> bitmap =
      BitmapCursor::FromPlatformCursor(std::move(cursor));
  if (bitmap == cursor_) {
    return;
  }
  cursor_ = std::move(bitmap);
  if (created_) {
    SendCursor();
  }
}

void OxyOSWindow::SendCursor() {
  OxyOSClient* client = connection_->client();
  if (!cursor_) {
    oxyos_client_set_pointer_shape(client, surface_, OXYOS_POINTER_ARROW);
    return;
  }
  std::optional<OxyOSPointerImage> image;
  if (!cursor_->bitmaps().empty()) {
    image = OxyOSPointerImageOf(cursor_->bitmaps().front(), cursor_->hotspot(),
                                cursor_->cursor_image_scale_factor());
  } else if (cursor_->type() == mojom::CursorType::kNone) {
    image = OxyOSHiddenPointerImage();
  }
  if (image && oxyos_client_protocol_version(client) >=
                   kOxyOSPointerImageProtocolVersion) {
    if (oxyos_client_set_pointer_image(
            client, surface_, image->width, image->height, image->width * 4,
            image->pixels.data(), image->hotspot_x, image->hotspot_y,
            image->scale_120) == 0) {
      return;
    }
    LOG(ERROR) << "OxyOS refused a pointer image: " << oxyos_last_error();
  }
  oxyos_client_set_pointer_shape(
      client, surface_,
      OxyOSPointerShape(cursor_->type()).value_or(OXYOS_POINTER_ARROW));
}

void OxyOSWindow::MoveCursorTo(const gfx::Point& location) {}

void OxyOSWindow::ConfineCursorToBounds(const gfx::Rect& bounds) {}

void OxyOSWindow::SetRestoredBoundsInDIP(const gfx::Rect& bounds) {
  restored_bounds_dip_ = bounds;
}

gfx::Rect OxyOSWindow::GetRestoredBoundsInDIP() const {
  return restored_bounds_dip_;
}

void OxyOSWindow::SetWindowIcons(const gfx::ImageSkia& window_icon,
                                 const gfx::ImageSkia& app_icon) {}

void OxyOSWindow::SizeConstraintsChanged() {
  SendSizeLimits();
}

bool OxyOSWindow::CanDispatchEvent(const PlatformEvent& event) {
  return CanAcceptEvent(*event);
}

uint32_t OxyOSWindow::DispatchEvent(const PlatformEvent& event) {
  DispatchEventFromNativeUiEvent(
      event, base::BindOnce(&PlatformWindowDelegate::DispatchEvent,
                            base::Unretained(delegate_.get())));
  return POST_DISPATCH_STOP_PROPAGATION;
}

bool OxyOSWindow::CanAcceptEvent(const Event& event) {
  return event.target() == this;
}

EventTarget* OxyOSWindow::GetParentTarget() {
  return nullptr;
}

std::unique_ptr<EventTargetIterator> OxyOSWindow::GetChildIterator() const {
  return nullptr;
}

EventTargeter* OxyOSWindow::GetEventTargeter() {
  return nullptr;
}

void OxyOSWindow::DispatchHostWindowDragMovement(
    int hittest,
    const gfx::Point& pointer_location_in_px) {
  if (hittest != HTCAPTION || !created_ || !is_toplevel()) {
    return;
  }
  if (oxyos_client_begin_move(connection_->client(), surface_,
                              connection_->last_press_serial()) != 0) {
    return;
  }
  connection_->ReleasePressedButtons(this);
}

bool OxyOSWindow::StartDrag(const OSExchangeData& data,
                            int operations,
                            mojom::DragEventSource source,
                            gfx::NativeCursor cursor,
                            bool can_grab_pointer,
                            base::OnceClosure drag_started_callback,
                            DragFinishedCallback drag_finished_callback,
                            LocationDelegate* location_delegate) {
  return connection_->RunDrag(
      this, data, operations, std::move(drag_started_callback),
      std::move(drag_finished_callback), location_delegate);
}

void OxyOSWindow::CancelDrag() {
  connection_->CancelDrag();
}

void OxyOSWindow::UpdateDragImage(const gfx::ImageSkia& image,
                                  const gfx::Vector2d& offset) {}

}
