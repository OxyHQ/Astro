// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_connection.h"

#include <cstring>
#include <utility>
#include <vector>

#include "base/environment.h"
#include "base/logging.h"
#include "base/strings/utf_string_conversions.h"
#include "base/task/current_thread.h"
#include "ui/events/event.h"
#include "ui/events/event_constants.h"
#include "ui/events/event_utils.h"
#include "ui/gfx/geometry/vector2d_conversions.h"
#include "ui/ozone/platform/oxyos/oxyos_conversions.h"
#include "ui/ozone/platform/oxyos/oxyos_window.h"

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

void OxyOSConnection::WatchRelease(uint64_t buffer,
                                   base::RepeatingClosure released) {
  releases_[buffer] = std::move(released);
}

void OxyOSConnection::ForgetRelease(uint64_t buffer) {
  releases_.erase(buffer);
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
    case OXYOS_EVENT_RELEASED: {
      auto it = releases_.find(event.serial);
      if (it != releases_.end()) {
        it->second.Run();
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
  switch (event.detail) {
    case OXYOS_POINTER_ENTER: {
      pointer_surface_ = window->surface();
      pointer_location_ = location;
      MouseEvent enter(EventType::kMouseEntered, location, location,
                       EventTimeForNow(), buttons_ | modifiers, 0);
      DispatchTo(window, &enter);
      break;
    }
    case OXYOS_POINTER_LEAVE: {
      MouseEvent exit(EventType::kMouseExited, pointer_location_,
                      pointer_location_, EventTimeForNow(),
                      buttons_ | modifiers, 0);
      DispatchTo(window, &exit);
      if (pointer_surface_ == window->surface()) {
        pointer_surface_ = 0;
      }
      break;
    }
    case OXYOS_POINTER_MOTION: {
      pointer_surface_ = window->surface();
      pointer_location_ = location;
      MouseEvent motion(EventType::kMouseMoved, location, location,
                        EventTimeForNow(), buttons_ | modifiers, 0);
      DispatchTo(window, &motion);
      break;
    }
    case OXYOS_POINTER_PRESS: {
      const int flag = OxyOSButtonFlag(event.code);
      if (!flag) {
        break;
      }
      last_press_serial_ = event.serial;
      pointer_location_ = location;
      buttons_ |= flag;
      MouseEvent press(EventType::kMousePressed, location, location,
                       EventTimeForNow(), buttons_ | modifiers, flag);
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
      const int flags = buttons_ | modifiers | flag;
      buttons_ &= ~flag;
      MouseEvent release(EventType::kMouseReleased, location, location,
                         EventTimeForNow(), flags, flag);
      release.InitializeNative();
      DispatchTo(window, &release);
      break;
    }
    case OXYOS_POINTER_CANCEL:
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
  if (offset.IsZero()) {
    return;
  }
  MouseWheelEvent wheel(
      offset, pointer_location_, pointer_location_, EventTimeForNow(),
      buttons_ | keyboard_.modifiers() | EF_PRECISION_SCROLLING_DELTA, 0);
  DispatchTo(window, &wheel);
}

void OxyOSConnection::HandleKey(const OxyOSEvent& event, OxyOSWindow* window) {
  if (event.flag) {
    last_press_serial_ = event.serial;
  }
  OxyOSKeyboard::Typed typed =
      keyboard_.OnKey(event.code, event.flag, TextOf(event), EventTimeForNow());
  auto weak = window->GetWeakPtr();
  DispatchTo(window, &typed.key);
  if (!typed.text.empty() && weak) {
    for (KeyEvent& character : keyboard_.CharactersOf(
             base::UTF16ToUTF8(typed.text), EventTimeForNow())) {
      DispatchTo(window, &character);
    }
  }
}

void OxyOSConnection::HandleText(std::string_view text, OxyOSWindow* window) {
  for (KeyEvent& character : keyboard_.CharactersOf(text, EventTimeForNow())) {
    DispatchTo(window, &character);
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
