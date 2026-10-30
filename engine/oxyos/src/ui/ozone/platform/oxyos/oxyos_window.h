// Copyright 2026 Oxy. Apache-2.0.

#ifndef UI_OZONE_PLATFORM_OXYOS_OXYOS_WINDOW_H_
#define UI_OZONE_PLATFORM_OXYOS_OXYOS_WINDOW_H_

#include <cstdint>
#include <memory>
#include <optional>
#include <string>
#include <vector>

#include "base/memory/raw_ptr.h"
#include "base/memory/weak_ptr.h"
#include "oxyos_client.h"
#include "ui/events/event_target.h"
#include "ui/events/platform/platform_event_dispatcher.h"
#include "ui/gfx/geometry/rect.h"
#include "ui/ozone/platform/oxyos/oxyos_configure_queue.h"
#include "ui/platform_window/platform_window.h"
#include "ui/platform_window/platform_window_delegate.h"
#include "ui/platform_window/platform_window_init_properties.h"
#include "ui/platform_window/wm/wm_move_resize_handler.h"

namespace ui {

class OxyOSConnection;

class OxyOSWindow : public PlatformWindow,
                    public PlatformEventDispatcher,
                    public EventTarget,
                    public WmMoveResizeHandler {
 public:
  OxyOSWindow(PlatformWindowDelegate* delegate,
              OxyOSConnection* connection,
              const PlatformWindowInitProperties& properties);
  OxyOSWindow(const OxyOSWindow&) = delete;
  OxyOSWindow& operator=(const OxyOSWindow&) = delete;
  ~OxyOSWindow() override;

  void Initialize();

  uint32_t surface() const { return surface_; }
  float scale() const { return state_.window_scale; }
  bool is_toplevel() const { return type_ == PlatformWindowType::kWindow; }
  bool shown() const { return created_; }
  PlatformWindowDelegate* delegate() const { return delegate_; }
  OxyOSWindow* parent() const;
  OxyOSWindow* root();
  base::WeakPtr<OxyOSWindow> GetWeakPtr() { return weak_factory_.GetWeakPtr(); }

  void OnConfigure(const OxyOSEvent& event);
  void OnActivated(bool active);
  void OnPopupDone();
  void OnCompositorCloseRequest();
  void OnLostCapture();

  std::optional<int64_t> SubmitFrame(uint64_t buffer,
                                     const gfx::Size& size,
                                     const std::vector<gfx::Rect>& damage,
                                     int64_t viz_seq);

  void Show(bool inactive) override;
  void Hide() override;
  void Close() override;
  bool IsVisible() const override;
  void PrepareForShutdown() override;
  void SetBoundsInPixels(const gfx::Rect& bounds) override;
  gfx::Rect GetBoundsInPixels() const override;
  void SetBoundsInDIP(const gfx::Rect& bounds) override;
  gfx::Rect GetBoundsInDIP() const override;
  void SetTitle(const std::u16string& title) override;
  void SetCapture() override;
  void ReleaseCapture() override;
  bool HasCapture() const override;
  void SetFullscreen(bool fullscreen, int64_t target_display_id) override;
  void Maximize() override;
  void Minimize() override;
  void Restore() override;
  PlatformWindowState GetPlatformWindowState() const override;
  void Activate() override;
  void Deactivate() override;
  void SetUseNativeFrame(bool use_native_frame) override;
  bool ShouldUseNativeFrame() const override;
  void SetCursor(scoped_refptr<PlatformCursor> cursor) override;
  void MoveCursorTo(const gfx::Point& location) override;
  void ConfineCursorToBounds(const gfx::Rect& bounds) override;
  void SetRestoredBoundsInDIP(const gfx::Rect& bounds) override;
  gfx::Rect GetRestoredBoundsInDIP() const override;
  void SetWindowIcons(const gfx::ImageSkia& window_icon,
                      const gfx::ImageSkia& app_icon) override;
  void SizeConstraintsChanged() override;

  bool CanDispatchEvent(const PlatformEvent& event) override;
  uint32_t DispatchEvent(const PlatformEvent& event) override;

  bool CanAcceptEvent(const Event& event) override;
  EventTarget* GetParentTarget() override;
  std::unique_ptr<EventTargetIterator> GetChildIterator() const override;
  EventTargeter* GetEventTargeter() override;

  void DispatchHostWindowDragMovement(
      int hittest,
      const gfx::Point& pointer_location_in_px) override;

 private:
  void CreateSurface();
  void DestroySurface();
  void ApplyState(const PlatformWindowDelegate::State& next,
                  std::optional<uint64_t> serial);
  OxyOSPositioner Positioner() const;
  void SendTitle();
  void SendSizeLimits();

  const raw_ptr<PlatformWindowDelegate> delegate_;
  const raw_ptr<OxyOSConnection> connection_;
  const PlatformWindowType type_;
  const gfx::AcceleratedWidget parent_widget_;
  const bool accepts_events_;
  const std::string app_id_;
  const uint32_t surface_;

  PlatformWindowDelegate::State state_;
  PlatformWindowState configured_window_state_ = PlatformWindowState::kNormal;
  OxyOSConfigureQueue configures_;
  gfx::Rect restored_bounds_dip_;
  std::u16string title_;
  uint8_t pointer_shape_ = OXYOS_POINTER_ARROW;
  std::optional<gfx::Size> submitted_size_;
  std::vector<gfx::Rect> unsubmitted_damage_;
  bool created_ = false;
  bool minimized_ = false;
  bool has_capture_ = false;

  base::WeakPtrFactory<OxyOSWindow> weak_factory_{this};
};

}

#endif
