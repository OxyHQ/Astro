// Copyright 2026 Oxy. Apache-2.0.

#ifndef UI_OZONE_PLATFORM_OXYOS_OXYOS_CONNECTION_H_
#define UI_OZONE_PLATFORM_OXYOS_OXYOS_CONNECTION_H_

#include <cstdint>
#include <memory>
#include <string_view>

#include "base/containers/flat_map.h"
#include "base/containers/flat_set.h"
#include "base/functional/callback.h"
#include "base/memory/raw_ptr.h"
#include "base/message_loop/message_pump_for_ui.h"
#include "oxyos_client.h"
#include "ui/events/platform/platform_event_source.h"
#include "ui/gfx/geometry/point_f.h"
#include "ui/gfx/geometry/vector2d_f.h"
#include "ui/gfx/native_ui_types.h"
#include "ui/ozone/platform/oxyos/oxyos_clipboard.h"
#include "ui/ozone/platform/oxyos/oxyos_drag.h"
#include "ui/ozone/platform/oxyos/oxyos_keyboard.h"
#include "ui/ozone/platform/oxyos/oxyos_screen.h"
#include "ui/platform_window/wm/wm_drag_handler.h"

namespace ui {

class Event;
class OxyOSInputMethodContext;
class OxyOSSurfaceHost;
class OxyOSWindow;

class OxyOSConnection : public PlatformEventSource,
                        public base::MessagePumpForUI::FdWatcher,
                        public OxyOSClipboard::Transport {
 public:
  using FeedbackCallback = base::OnceCallback<void(bool shown)>;
  using KeyboardLayoutCallback =
      base::RepeatingCallback<void(const std::string& names)>;

  static std::unique_ptr<OxyOSConnection> Connect();

  explicit OxyOSConnection(OxyOSClient* client);
  OxyOSConnection(const OxyOSConnection&) = delete;
  OxyOSConnection& operator=(const OxyOSConnection&) = delete;
  ~OxyOSConnection() override;

  OxyOSClient* client() const { return client_; }
  OxyOSClipboard* clipboard() { return &clipboard_; }

  void StartProcessingEvents(base::OnceClosure shutdown);

  uint32_t NextSurfaceId() { return ++last_surface_id_; }
  void AddWindow(OxyOSWindow* window);
  void RemoveWindow(OxyOSWindow* window);
  void OnSurfaceDestroyed(OxyOSWindow* window);
  OxyOSWindow* GetWindow(gfx::AcceleratedWidget widget) const;
  OxyOSWindow* pointer_window() const;
  OxyOSWindow* pressed_window() const;

  void set_screen(OxyOSScreen* screen) { screen_ = screen; }
  OxyOSScreen* screen() const { return screen_; }
  void set_surface_host(OxyOSSurfaceHost* host) { surface_host_ = host; }
  const std::vector<OxyOSOutput>& outputs() const { return outputs_; }

  uint64_t last_press_serial() const { return last_press_serial_; }
  const gfx::PointF& pointer_location() const { return pointer_location_; }

  void AddInputMethodContext(OxyOSInputMethodContext* context);
  void RemoveInputMethodContext(OxyOSInputMethodContext* context);
  void set_keyboard_layout_callback(KeyboardLayoutCallback callback) {
    keyboard_layout_changed_ = std::move(callback);
  }
  void set_keyboard_layout_engine(const KeyboardLayoutEngine* engine) {
    keyboard_.set_layout_engine(engine);
  }

  bool RunDrag(OxyOSWindow* source,
               const OSExchangeData& data,
               int operations,
               base::OnceClosure started,
               WmDragHandler::DragFinishedCallback finished,
               WmDragHandler::LocationDelegate* location);
  void CancelDrag();

  void SetCaptureWindow(OxyOSWindow* window);
  void ReleasePressedButtons(OxyOSWindow* window);

  void ExpectFeedback(OxyOSWindow* window,
                      int64_t sequence,
                      FeedbackCallback callback);
  using BufferCallback = base::RepeatingCallback<void(bool failed)>;
  void WatchRelease(uint64_t buffer, BufferCallback released);
  void ForgetRelease(uint64_t buffer);

 private:
  void Copy(const std::vector<std::pair<std::string, PlatformClipboard::Data>>&
                contents) override;
  void ClearClipboard() override;
  base::ScopedFD Paste(uint32_t selection,
                       const std::string& mime_type) override;

  void OnFileCanReadWithoutBlocking(int fd) override;
  void OnFileCanWriteWithoutBlocking(int fd) override;

  void HandleEvent(const OxyOSEvent& event);
  void HandlePointer(const OxyOSEvent& event, OxyOSWindow* window);
  void HandleScroll(const OxyOSEvent& event, OxyOSWindow* window);
  void HandleKey(const OxyOSEvent& event, OxyOSWindow* window);
  void HandleText(std::string_view text, OxyOSWindow* window);
  void HandleFeedback(const OxyOSEvent& event);
  void HandleTextInput(const OxyOSEvent& event);
  void HandleOutput(const OxyOSEvent& event);
  void OutputsChanged();
  void HandleKeyboardLayout(const OxyOSEvent& event);
  void DispatchTo(OxyOSWindow* window, Event* event);
  void DragMotion(OxyOSWindow* window, const gfx::PointF& location);
  void EndDrag(mojom::DragOperation operation, bool cancelled);
  void OnCompositorGone();

  const raw_ptr<OxyOSClient> client_;
  base::MessagePumpForUI::FdWatchController controller_{FROM_HERE};
  base::OnceClosure shutdown_;
  uint32_t last_surface_id_ = 0;
  base::flat_map<uint32_t, raw_ptr<OxyOSWindow>> windows_;
  raw_ptr<OxyOSScreen> screen_ = nullptr;
  raw_ptr<OxyOSSurfaceHost> surface_host_ = nullptr;
  std::vector<OxyOSOutput> outputs_;

  OxyOSKeyboard keyboard_;
  OxyOSClipboard clipboard_{this};
  base::flat_set<raw_ptr<OxyOSInputMethodContext>> input_method_contexts_;
  std::string keyboard_layout_;
  KeyboardLayoutCallback keyboard_layout_changed_;
  uint32_t pointer_surface_ = 0;
  gfx::PointF pointer_location_;
  gfx::Vector2dF scrolled_;
  int buttons_ = 0;
  uint64_t last_press_serial_ = 0;
  uint32_t pressed_surface_ = 0;
  raw_ptr<OxyOSWindow> capture_window_ = nullptr;

  std::unique_ptr<OxyOSDrag> drag_;
  uint32_t drag_surface_ = 0;
  WmDragHandler::DragFinishedCallback drag_finished_;
  base::OnceClosure drag_quit_;
  bool drag_cancelled_ = false;

  struct Expected {
    uint32_t surface;
    FeedbackCallback callback;
  };
  base::flat_map<int64_t, Expected> feedback_;
  base::flat_map<uint64_t, BufferCallback> releases_;
};

}

#endif
