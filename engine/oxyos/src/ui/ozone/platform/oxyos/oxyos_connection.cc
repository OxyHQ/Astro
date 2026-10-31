// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_connection.h"

#include <algorithm>
#include <cstring>
#include <utility>
#include <vector>

#include "base/environment.h"
#include "base/logging.h"
#include "base/run_loop.h"
#include "base/strings/utf_string_conversions.h"
#include "base/task/current_thread.h"
#include "ui/events/event.h"
#include "ui/events/event_constants.h"
#include "ui/events/event_utils.h"
#include "ui/events/keycodes/keyboard_codes.h"
#include "ui/gfx/geometry/point_conversions.h"
#include "ui/gfx/geometry/vector2d_conversions.h"
#include "ui/ozone/platform/oxyos/oxyos_conversions.h"
#include "ui/ozone/platform/oxyos/oxyos_input_method_context.h"
#include "ui/ozone/platform/oxyos/oxyos_surface_host.h"
#include "ui/ozone/platform/oxyos/oxyos_window.h"
#include "ui/platform_window/wm/wm_drop_handler.h"

namespace ui {

namespace {

constexpr char kSocketVariable[] = "OXYOS_COMPOSITOR_SOCKET";

std::string_view TextOf(const OxyOSEvent& event) {
  return std::string_view(event.text, strnlen(event.text, sizeof(event.text)));
}

}

std::unique_ptr<OxyOSConnection> OxyOSConnection::Connect() {
  const std::optional<std::string> socket =
      base::Environment::Create()->GetVar(kSocketVariable);
  if (!socket || socket->empty()) {
    LOG(ERROR) << "No OxyOS compositor: " << kSocketVariable << " is not set";
    return nullptr;
  }
  OxyOSClient* client = oxyos_client_connect(socket->c_str());
  if (!client) {
    LOG(ERROR) << "Could not connect to the OxyOS compositor at " << *socket
               << ": " << oxyos_last_error();
    return nullptr;
  }
  if (oxyos_client_set_key_text(client, true) != 0) {
    LOG(ERROR) << "The OxyOS compositor refused key text: "
               << oxyos_last_error();
    oxyos_client_close(client);
    return nullptr;
  }
  return std::make_unique<OxyOSConnection>(client);
}

OxyOSConnection::OxyOSConnection(OxyOSClient* client) : client_(client) {}

OxyOSConnection::~OxyOSConnection() {
  controller_.StopWatchingFileDescriptor();
  oxyos_client_close(client_);
}

void OxyOSConnection::StartProcessingEvents(base::OnceClosure shutdown) {
  shutdown_ = std::move(shutdown);
  base::CurrentUIThread::Get()->WatchFileDescriptor(
      oxyos_client_fd(client_), true, base::MessagePumpForUI::WATCH_READ,
      &controller_, this);
  OnFileCanReadWithoutBlocking(oxyos_client_fd(client_));
}

void OxyOSConnection::AddWindow(OxyOSWindow* window) {
  windows_[window->surface()] = window;
}

void OxyOSConnection::RemoveWindow(OxyOSWindow* window) {
  if (drag_ && drag_surface_ == window->surface()) {
    drag_.reset();
    EndDrag(mojom::DragOperation::kNone, true);
  }
  OnSurfaceDestroyed(window);
  windows_.erase(window->surface());
}

void OxyOSConnection::OnSurfaceDestroyed(OxyOSWindow* window) {
  if (capture_window_ == window) {
    capture_window_ = nullptr;
  }
  if (pointer_surface_ == window->surface()) {
    pointer_surface_ = 0;
    buttons_ = 0;
  }
  std::vector<FeedbackCallback> unanswered;
  for (auto it = feedback_.begin(); it != feedback_.end();) {
    if (it->second.surface == window->surface()) {
      unanswered.push_back(std::move(it->second.callback));
      it = feedback_.erase(it);
    } else {
      ++it;
    }
  }
  for (auto& callback : unanswered) {
    std::move(callback).Run(false);
  }
}

OxyOSWindow* OxyOSConnection::GetWindow(gfx::AcceleratedWidget widget) const {
  auto it = windows_.find(widget);
  return it == windows_.end() ? nullptr : it->second.get();
}

OxyOSWindow* OxyOSConnection::pointer_window() const {
  return GetWindow(pointer_surface_);
}

OxyOSWindow* OxyOSConnection::pressed_window() const {
  return GetWindow(pressed_surface_);
}

bool OxyOSConnection::RunDrag(OxyOSWindow* source,
                              const OSExchangeData& data,
                              int operations,
                              base::OnceClosure started,
                              WmDragHandler::DragFinishedCallback finished,
                              WmDragHandler::LocationDelegate* location) {
  if (drag_) {
    return false;
  }
  OxyOSWindow* root = source->root();
  VLOG(1) << "OxyOS drag from window " << root->surface() << ", operations "
          << operations;
  drag_ = std::make_unique<OxyOSDrag>(
      GetWmDropHandler(*root), data, operations, location,
      gfx::SizeF(root->GetBoundsInDIP().size()));
  drag_surface_ = root->surface();
  drag_finished_ = std::move(finished);
  drag_cancelled_ = false;
  std::move(started).Run();
  if (drag_) {
    OxyOSWindow* window = pointer_window();
    DragMotion(window ? window : root, pointer_location_);
  }
  if (drag_) {
    base::RunLoop loop(base::RunLoop::Type::kNestableTasksAllowed);
    drag_quit_ = loop.QuitClosure();
    loop.Run();
  }
  return !drag_cancelled_;
}

void OxyOSConnection::CancelDrag() {
  if (!drag_) {
    return;
  }
  drag_->Leave();
  EndDrag(mojom::DragOperation::kNone, true);
}

void OxyOSConnection::DragMotion(OxyOSWindow* window,
                                 const gfx::PointF& location) {
  OxyOSWindow* root = GetWindow(drag_surface_);
  if (!drag_ || !root) {
    return;
  }
  gfx::Vector2dF offset;
  if (window->root() == root) {
    offset = gfx::Vector2dF(window->GetBoundsInPixels().origin() -
                            root->GetBoundsInPixels().origin());
  }
  const gfx::PointF local = location + offset;
  drag_->Motion(gfx::ScalePoint(local, 1.0f / root->scale()),
                root->GetBoundsInPixels().origin() +
                    gfx::ToFlooredVector2d(local.OffsetFromOrigin()),
                keyboard_.modifiers());
}

void OxyOSConnection::EndDrag(mojom::DragOperation operation, bool cancelled) {
  VLOG(1) << "OxyOS drag ends with operation " << operation << ", cancelled "
          << cancelled;
  drag_.reset();
  drag_surface_ = 0;
  drag_cancelled_ = cancelled;
  WmDragHandler::DragFinishedCallback finished = std::move(drag_finished_);
  base::OnceClosure quit = std::move(drag_quit_);
  if (finished) {
    std::move(finished).Run(operation);
  }
  if (quit) {
    std::move(quit).Run();
  }
}

void OxyOSConnection::AddInputMethodContext(OxyOSInputMethodContext* context) {
  input_method_contexts_.insert(context);
}

void OxyOSConnection::RemoveInputMethodContext(
    OxyOSInputMethodContext* context) {
  input_method_contexts_.erase(context);
}

void OxyOSConnection::SetCaptureWindow(OxyOSWindow* window) {
  OxyOSWindow* previous = capture_window_;
  capture_window_ = window;
  if (previous && previous != window) {
    previous->OnLostCapture();
  }
}

void OxyOSConnection::ReleasePressedButtons(OxyOSWindow* window) {
  for (int flag :
       {EF_LEFT_MOUSE_BUTTON, EF_MIDDLE_MOUSE_BUTTON, EF_RIGHT_MOUSE_BUTTON,
        EF_BACK_MOUSE_BUTTON, EF_FORWARD_MOUSE_BUTTON}) {
    if (!(buttons_ & flag)) {
      continue;
    }
    const int flags = buttons_ | keyboard_.modifiers();
    buttons_ &= ~flag;
    MouseEvent release(EventType::kMouseReleased, pointer_location_,
                       pointer_location_, EventTimeForNow(), flags, flag);
    DispatchTo(window, &release);
  }
}

void OxyOSConnection::ExpectFeedback(OxyOSWindow* window,
                                     int64_t sequence,
                                     FeedbackCallback callback) {
  feedback_[sequence] = Expected{window->surface(), std::move(callback)};
}

void OxyOSConnection::WatchRelease(uint64_t buffer, BufferCallback released) {
  releases_[buffer] = std::move(released);
}

void OxyOSConnection::ForgetRelease(uint64_t buffer) {
  releases_.erase(buffer);
}

void OxyOSConnection::Copy(
    const std::vector<std::pair<std::string, PlatformClipboard::Data>>&
        contents) {
  std::vector<OxyOSClipboardEntry> entries;
  entries.reserve(contents.size());
  for (const auto& [type, data] : contents) {
    entries.push_back({.mime = type.data(),
                       .mime_length = type.size(),
                       .data = data ? data->data() : nullptr,
                       .length = data ? data->size() : 0});
  }
  if (oxyos_client_copy(client_, last_press_serial_, entries.data(),
                        entries.size()) != 0) {
    LOG(ERROR) << "OxyOS refused a copy: " << oxyos_last_error();
  }
}

void OxyOSConnection::ClearClipboard() {
  oxyos_client_clear_clipboard(client_, last_press_serial_);
}

base::ScopedFD OxyOSConnection::Paste(uint32_t selection,
                                      const std::string& mime_type) {
  const int fd = oxyos_client_paste(client_, selection, mime_type.data(),
                                    mime_type.size(), last_press_serial_);
  return base::ScopedFD(fd >= 0 ? fd : -1);
}

void OxyOSConnection::OnFileCanReadWithoutBlocking(int fd) {
  OxyOSEvent event;
  for (;;) {
    switch (oxyos_client_poll(client_, &event)) {
      case OXYOS_POLL_EVENT:
        HandleEvent(event);
        break;
      case OXYOS_POLL_EMPTY:
        return;
      default:
        OnCompositorGone();
        return;
    }
  }
}

void OxyOSConnection::OnFileCanWriteWithoutBlocking(int fd) {}

void OxyOSConnection::OnCompositorGone() {
  LOG(ERROR) << "The OxyOS compositor closed the connection: "
             << oxyos_last_error();
  controller_.StopWatchingFileDescriptor();
  if (shutdown_) {
    std::move(shutdown_).Run();
  }
}

void OxyOSConnection::HandleEvent(const OxyOSEvent& event) {
  OxyOSWindow* window = GetWindow(event.surface);
  switch (event.kind) {
    case OXYOS_EVENT_CONFIGURE:
      if (window) {
        window->OnConfigure(event);
      }
      break;
    case OXYOS_EVENT_ACTIVATED:
      if (window) {
        window->OnActivated(event.flag);
      }
      break;
    case OXYOS_EVENT_POPUP_DONE:
      if (window) {
        window->OnPopupDone();
      }
      break;
    case OXYOS_EVENT_CLOSE_REQUESTED:
      if (window) {
        window->OnCompositorCloseRequest();
      }
      break;
    case OXYOS_EVENT_POINTER:
      if (window) {
        HandlePointer(event, window);
      }
      break;
    case OXYOS_EVENT_SCROLL:
      if (window) {
        HandleScroll(event, window);
      }
      break;
    case OXYOS_EVENT_KEY:
      if (window) {
        HandleKey(event, window);
      }
      break;
    case OXYOS_EVENT_TEXT:
      if (window) {
        HandleText(TextOf(event), window);
      }
      break;
    case OXYOS_EVENT_FOCUS:
      if (!event.flag) {
        keyboard_.ReleaseAll();
      }
      break;
    case OXYOS_EVENT_CAPS_LOCK:
      keyboard_.SetCapsLock(event.flag);
      break;
    case OXYOS_EVENT_FEEDBACK:
      HandleFeedback(event);
      break;
    case OXYOS_EVENT_APPLICATION_OUTPUT:
    case OXYOS_EVENT_APPLICATION_OUTPUT_WORK_AREA:
    case OXYOS_EVENT_APPLICATION_OUTPUT_REMOVED:
      HandleOutput(event);
      break;
    case OXYOS_EVENT_SURFACE_OUTPUT:
      if (window) {
        window->OnOutput(event.code);
      }
      break;
    case OXYOS_EVENT_REFRESH:
      if (window) {
        window->OnRefresh(event.detail);
      }
      if (surface_host_) {
        surface_host_->OnRefresh(event.surface, event.detail);
      }
      break;
    case OXYOS_EVENT_MENU_ITEM_ACTIVATED:
      last_press_serial_ = event.serial;
      if (window) {
        window->OnMenuItemActivated(event.code, event.detail);
      }
      break;
    case OXYOS_EVENT_TEXT_INPUT:
      HandleTextInput(event);
      break;
    case OXYOS_EVENT_KEYBOARD_LAYOUT:
      HandleKeyboardLayout(event);
      break;
    case OXYOS_EVENT_CLIPBOARD_TYPES:
      clipboard_.OnTypes(static_cast<uint32_t>(event.serial), event.detail);
      break;
    case OXYOS_EVENT_CLIPBOARD_TYPE:
      clipboard_.OnType(static_cast<uint32_t>(event.serial),
                        std::string(TextOf(event)));
      break;
    case OXYOS_EVENT_CLIPBOARD_EMPTY:
      clipboard_.OnEmpty();
      break;
    case OXYOS_EVENT_GPU_DEVICE:
      if (surface_host_) {
        surface_host_->OnGpuTable();
      }
      break;
    case OXYOS_EVENT_RELEASED:
    case OXYOS_EVENT_BUFFER_FAILED: {
      auto it = releases_.find(event.serial);
      if (it != releases_.end()) {
        it->second.Run(event.kind == OXYOS_EVENT_BUFFER_FAILED);
      }
      break;
    }
    default:
      break;
  }
}

void OxyOSConnection::HandlePointer(const OxyOSEvent& event,
                                    OxyOSWindow* window) {
  const gfx::PointF location =
      OxyOSPointerLocation(event.x, event.y, window->scale());
  const int modifiers = keyboard_.modifiers();
  const base::TimeTicks time = OxyOSEventTime(event.time_ns);
  switch (event.detail) {
    case OXYOS_POINTER_ENTER: {
      pointer_surface_ = window->surface();
      pointer_location_ = location;
      if (drag_) {
        DragMotion(window, location);
        break;
      }
      MouseEvent enter(EventType::kMouseEntered, location, location, time,
                       buttons_ | modifiers, 0);
      DispatchTo(window, &enter);
      break;
    }
    case OXYOS_POINTER_LEAVE: {
      if (drag_) {
        drag_->Leave();
        break;
      }
      MouseEvent exit(EventType::kMouseExited, pointer_location_,
                      pointer_location_, time, buttons_ | modifiers, 0);
      DispatchTo(window, &exit);
      if (pointer_surface_ == window->surface()) {
        pointer_surface_ = 0;
      }
      break;
    }
    case OXYOS_POINTER_MOTION: {
      pointer_surface_ = window->surface();
      pointer_location_ = location;
      if (drag_) {
        DragMotion(window, location);
        break;
      }
      MouseEvent motion(EventType::kMouseMoved, location, location, time,
                        buttons_ | modifiers, 0);
      DispatchTo(window, &motion);
      break;
    }
    case OXYOS_POINTER_PRESS: {
      const int flag = OxyOSButtonFlag(event.code);
      if (!flag || drag_) {
        break;
      }
      last_press_serial_ = event.serial;
      pressed_surface_ = window->root()->surface();
      pointer_location_ = location;
      buttons_ |= flag;
      MouseEvent press(EventType::kMousePressed, location, location, time,
                       buttons_ | modifiers, flag);
      press.InitializeNative();
      DispatchTo(window, &press);
      break;
    }
    case OXYOS_POINTER_RELEASE: {
      const int flag = OxyOSButtonFlag(event.code);
      if (!flag) {
        break;
      }
      pointer_location_ = location;
      if (drag_) {
        DragMotion(window, location);
        if (drag_) {
          EndDrag(drag_->Drop(modifiers), false);
        }
      }
      const int flags = buttons_ | modifiers | flag;
      buttons_ &= ~flag;
      MouseEvent release(EventType::kMouseReleased, location, location, time,
                         flags, flag);
      release.InitializeNative();
      DispatchTo(window, &release);
      break;
    }
    case OXYOS_POINTER_CANCEL:
      CancelDrag();
      buttons_ = 0;
      if (capture_window_) {
        SetCaptureWindow(nullptr);
      }
      window->delegate()->OnLostCapture();
      break;
    default:
      break;
  }
}

void OxyOSConnection::HandleScroll(const OxyOSEvent& event,
                                   OxyOSWindow* window) {
  scrolled_ += gfx::Vector2dF(-event.x / 256.0f, -event.y / 256.0f);
  const gfx::Vector2d offset = gfx::ToRoundedVector2d(scrolled_);
  scrolled_ -= gfx::Vector2dF(offset);
  if (event.flag) {
    scrolled_ = gfx::Vector2dF();
  }
  if (offset.IsZero()) {
    return;
  }
  const base::TimeTicks time = OxyOSEventTime(event.time_ns);
  MouseWheelEvent wheel(
      offset, pointer_location_, pointer_location_, time,
      buttons_ | keyboard_.modifiers() | EF_PRECISION_SCROLLING_DELTA, 0);
  DispatchTo(window, &wheel);
}

void OxyOSConnection::HandleKey(const OxyOSEvent& event, OxyOSWindow* window) {
  if (event.flag) {
    last_press_serial_ = event.serial;
  }
  const base::TimeTicks time = OxyOSEventTime(event.time_ns);
  OxyOSKeyboard::Typed typed =
      keyboard_.OnKey(event.code, event.flag, TextOf(event), time);
  if (drag_) {
    if (event.flag && typed.key.key_code() == VKEY_ESCAPE) {
      CancelDrag();
    } else if (OxyOSWindow* pointer = pointer_window()) {
      DragMotion(pointer, pointer_location_);
    }
    return;
  }
  auto weak = window->GetWeakPtr();
  DispatchTo(window, &typed.key);
  if (!typed.text.empty() && weak) {
    for (KeyEvent& character :
         keyboard_.CharactersOf(base::UTF16ToUTF8(typed.text), time)) {
      DispatchTo(window, &character);
    }
  }
}

void OxyOSConnection::HandleText(std::string_view text, OxyOSWindow* window) {
  for (KeyEvent& character : keyboard_.CharactersOf(text, EventTimeForNow())) {
    DispatchTo(window, &character);
  }
}

void OxyOSConnection::HandleOutput(const OxyOSEvent& event) {
  auto it = std::ranges::find(outputs_, event.code, &OxyOSOutput::id);
  switch (event.kind) {
    case OXYOS_EVENT_APPLICATION_OUTPUT: {
      OxyOSOutput output;
      if (it != outputs_.end()) {
        output = *it;
      }
      output.id = event.code;
      output.size = gfx::Size(static_cast<int>(event.width),
                              static_cast<int>(event.height));
      output.scale_120 = event.scale_120 ? event.scale_120 : 120;
      output.refresh_mhz = event.detail;
      output.primary = event.flag;
      if (output.primary) {
        for (OxyOSOutput& other : outputs_) {
          other.primary = false;
        }
      }
      if (it != outputs_.end()) {
        *it = output;
      } else {
        outputs_.push_back(output);
      }
      break;
    }
    case OXYOS_EVENT_APPLICATION_OUTPUT_WORK_AREA:
      if (it == outputs_.end()) {
        return;
      }
      it->work_area = gfx::Rect(event.x, event.y, static_cast<int>(event.width),
                                static_cast<int>(event.height));
      break;
    case OXYOS_EVENT_APPLICATION_OUTPUT_REMOVED:
      if (it == outputs_.end()) {
        return;
      }
      outputs_.erase(it);
      break;
  }
  OutputsChanged();
}

void OxyOSConnection::OutputsChanged() {
  if (screen_) {
    screen_->OnOutputsChanged(outputs_);
  }
  std::vector<base::WeakPtr<OxyOSWindow>> windows;
  for (const auto& [surface, window] : windows_) {
    windows.push_back(window->GetWeakPtr());
  }
  for (const base::WeakPtr<OxyOSWindow>& window : windows) {
    if (window) {
      window->OnOutputPlaced();
    }
  }
}

void OxyOSConnection::HandleTextInput(const OxyOSEvent& event) {
  OxyOSTextTransaction transaction{};
  if (oxyos_client_text_transaction(client_, &transaction) != 1) {
    return;
  }
  if (transaction.commit_length > 0) {
    last_press_serial_ = transaction.serial;
  }
  OxyOSWindow* window = GetWindow(transaction.surface);
  const uint32_t root = window ? window->root()->surface() : 0;
  for (OxyOSInputMethodContext* context : input_method_contexts_) {
    if (context->surface() == transaction.surface ||
        context->surface() == root) {
      context->OnTransaction(transaction);
      return;
    }
  }
}

void OxyOSConnection::HandleKeyboardLayout(const OxyOSEvent& event) {
  if (event.detail == 0) {
    keyboard_layout_.clear();
  }
  keyboard_layout_.append(TextOf(event));
  if (event.flag && keyboard_layout_changed_) {
    keyboard_layout_changed_.Run(keyboard_layout_);
  }
}

void OxyOSConnection::HandleFeedback(const OxyOSEvent& event) {
  auto it = feedback_.find(static_cast<int64_t>(event.serial));
  if (it == feedback_.end()) {
    return;
  }
  FeedbackCallback callback = std::move(it->second.callback);
  feedback_.erase(it);
  std::move(callback).Run(event.detail == OXYOS_OUTCOME_PRESENTED);
}

void OxyOSConnection::DispatchTo(OxyOSWindow* window, Event* event) {
  if (event->IsLocatedEvent() && capture_window_ && capture_window_ != window &&
      capture_window_->root() == window->root()) {
    const gfx::Vector2d offset = window->GetBoundsInPixels().origin() -
                                 capture_window_->GetBoundsInPixels().origin();
    LocatedEvent* located = event->AsLocatedEvent();
    located->set_location_f(located->location_f() + gfx::Vector2dF(offset));
    located->set_root_location_f(located->root_location_f() +
                                 gfx::Vector2dF(offset));
    window = capture_window_;
  }
  Event::DispatcherApi(event).set_target(window);
  PlatformEventSource::DispatchEvent(event);
}

}
