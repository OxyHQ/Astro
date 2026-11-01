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
#include "base/task/sequenced_task_runner.h"
#include "base/task/thread_pool.h"
#include "third_party/skia/include/core/SkBitmap.h"
#include "third_party/skia/include/core/SkCanvas.h"
#include "third_party/skia/include/core/SkImage.h"
#include "ui/base/dragdrop/drag_drop_types.h"
#include "ui/base/dragdrop/os_exchange_data.h"
#include "ui/base/dragdrop/os_exchange_data_provider.h"
#include "ui/gfx/image/image_skia_rep.h"
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

constexpr uint16_t kOxyOSDragProtocol = 10;
constexpr base::TimeDelta kDropReadDeadline = base::Seconds(5);
constexpr base::TimeDelta kDropAnswerInterval = base::Milliseconds(16);
constexpr int kDropAnswerTries = 30;

mojom::DragOperation DragOperationOf(uint8_t action) {
  switch (action) {
    case OXYOS_DRAG_COPY:
      return mojom::DragOperation::kCopy;
    case OXYOS_DRAG_MOVE:
      return mojom::DragOperation::kMove;
    case OXYOS_DRAG_LINK:
      return mojom::DragOperation::kLink;
    default:
      return mojom::DragOperation::kNone;
  }
}

std::map<std::string, std::string> ReadDrop(
    std::vector<std::pair<std::string, base::ScopedFD>> pipes) {
  std::map<std::string, std::string> received;
  for (auto& [type, fd] : pipes) {
    std::optional<std::vector<uint8_t>> bytes =
        OxyOSReadPipe(std::move(fd), kDropReadDeadline);
    if (bytes) {
      received[type] = std::string(bytes->begin(), bytes->end());
    }
  }
  return received;
}

}

OxyOSConnection::OfferedDrag::OfferedDrag() = default;
OxyOSConnection::OfferedDrag::~OfferedDrag() = default;

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
  if (incoming_drag_ && incoming_drag_->surface == window->surface()) {
    incoming_drag_.reset();
  }
  if (pointer_surface_ == window->surface()) {
    pointer_surface_ = 0;
    buttons_ = 0;
  }
  file_chooser_.ForgetSurface(window->surface());
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

bool OxyOSConnection::CompositorDrags() const {
  return oxyos_client_protocol_version(client_) >= kOxyOSDragProtocol;
}

bool OxyOSConnection::RunDrag(OxyOSWindow* source,
                              const OSExchangeData& data,
                              int operations,
                              base::OnceClosure started,
                              WmDragHandler::DragFinishedCallback finished,
                              WmDragHandler::LocationDelegate* location) {
  if (CompositorDrags()) {
    return RunCompositorDrag(source, data, operations, std::move(started),
                             std::move(finished), location);
  }
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
  if (offered_drag_ && !offered_drag_->ended) {
    if (offered_drag_->drag) {
      oxyos_client_cancel_drag(client_, offered_drag_->drag);
    } else {
      EndOfferedDrag(mojom::DragOperation::kNone, true);
    }
    return;
  }
  CancelWindowDrag();
}

void OxyOSConnection::CancelWindowDrag() {
  if (!drag_) {
    return;
  }
  drag_->Leave();
  EndDrag(mojom::DragOperation::kNone, true);
}

bool OxyOSConnection::RunCompositorDrag(
    OxyOSWindow* source,
    const OSExchangeData& data,
    int operations,
    base::OnceClosure started,
    WmDragHandler::DragFinishedCallback finished,
    WmDragHandler::LocationDelegate* location) {
  if (offered_drag_) {
    return false;
  }
  OxyOSWindow* root = source->root();
  offered_drag_ = std::make_unique<OfferedDrag>();
  offered_drag_->data =
      std::make_unique<OSExchangeData>(data.provider().Clone());
  offered_drag_->image = data.provider().GetDragImage();
  offered_drag_->finished = std::move(finished);
  offered_drag_->location = location;
  std::move(started).Run();
  const uint32_t surface = root->surface();
  std::optional<OxyOSDragFileContents> file = OxyOSDragFileContentsOf(data);
  if (file) {
    base::ThreadPool::PostTaskAndReplyWithResult(
        FROM_HERE, {base::MayBlock(), base::TaskPriority::USER_BLOCKING},
        base::BindOnce(&OxyOSWriteDragFile, std::move(*file)),
        base::BindOnce(&OxyOSConnection::OfferDrag,
                       weak_factory_.GetWeakPtr(), surface, operations));
  } else {
    OfferDrag(surface, operations, std::nullopt);
  }
  bool cancelled = false;
  if (offered_drag_ && !offered_drag_->ended) {
    base::RunLoop loop(base::RunLoop::Type::kNestableTasksAllowed);
    offered_drag_->quit = loop.QuitClosure();
    loop.Run();
  }
  if (offered_drag_) {
    cancelled = offered_drag_->cancelled;
    offered_drag_.reset();
  }
  return !cancelled;
}

void OxyOSConnection::OfferDrag(uint32_t surface,
                                int operations,
                                std::optional<OxyOSWrittenDragFile> written) {
  if (!offered_drag_ || offered_drag_->ended) {
    return;
  }
  const OxyOSDragContents contents =
      OxyOSDragContentsOf(*offered_drag_->data, written);
  const uint8_t actions = OxyOSDragActionsOf(operations);
  if (contents.empty() || actions == 0) {
    EndOfferedDrag(mojom::DragOperation::kNone, true);
    return;
  }
  OxyOSWindow* window = GetWindow(surface);
  const gfx::ImageSkia& image = offered_drag_->image;
  if (window && !image.isNull() && !image.size().IsEmpty()) {
    const gfx::Vector2d offset =
        offered_drag_->data->provider().GetDragImageOffset();
    offered_drag_->icon = NextSurfaceId();
    if (oxyos_client_create_drag_icon(
            client_, offered_drag_->icon,
            static_cast<uint32_t>(image.width()),
            static_cast<uint32_t>(image.height()), offset.x(),
            offset.y()) != 0) {
      offered_drag_->icon = 0;
    }
  }
  std::vector<OxyOSDragEntry> entries;
  entries.reserve(contents.size());
  for (const auto& [type, bytes] : contents) {
    entries.push_back(
        {.mime = type.data(),
         .mime_length = type.size(),
         .data = reinterpret_cast<const uint8_t*>(bytes.data()),
         .length = bytes.size()});
  }
  const int64_t drag =
      oxyos_client_start_drag(client_, surface, offered_drag_->icon,
                              last_press_serial_, actions, entries.data(),
                              entries.size());
  if (drag <= 0) {
    LOG(ERROR) << "OxyOS refused a drag: " << oxyos_last_error();
    EndOfferedDrag(mojom::DragOperation::kNone, true);
    return;
  }
  offered_drag_->drag = static_cast<uint32_t>(drag);
}

void OxyOSConnection::PresentDragIcon(const OxyOSEvent& configure) {
  if (!offered_drag_ || offered_drag_->icon != configure.surface) {
    return;
  }
  const float scale = configure.scale_120 / 120.0f;
  const int width = static_cast<int>(
      (static_cast<uint64_t>(configure.width) * configure.scale_120 + 119) /
      120);
  const int height = static_cast<int>(
      (static_cast<uint64_t>(configure.height) * configure.scale_120 + 119) /
      120);
  if (width <= 0 || height <= 0) {
    return;
  }
  const gfx::ImageSkiaRep& rep =
      offered_drag_->image.GetRepresentation(scale);
  SkBitmap bitmap;
  if (!bitmap.tryAllocN32Pixels(width, height, false)) {
    return;
  }
  bitmap.eraseColor(SK_ColorTRANSPARENT);
  SkCanvas canvas(bitmap);
  canvas.drawImageRect(SkImages::RasterFromBitmap(rep.GetBitmap()),
                       SkRect::MakeIWH(width, height),
                       SkSamplingOptions(SkFilterMode::kLinear));
  oxyos_client_present(client_, configure.surface, configure.serial,
                       static_cast<uint32_t>(width),
                       static_cast<uint32_t>(height), OXYOS_FORMAT_ARGB8888,
                       static_cast<const uint8_t*>(bitmap.getPixels()),
                       bitmap.computeByteSize());
}

void OxyOSConnection::EndOfferedDrag(mojom::DragOperation operation,
                                     bool cancelled) {
  if (!offered_drag_ || offered_drag_->ended) {
    return;
  }
  offered_drag_->ended = true;
  offered_drag_->cancelled = cancelled;
  if (offered_drag_->icon) {
    oxyos_client_destroy_surface(client_, offered_drag_->icon);
    offered_drag_->icon = 0;
  }
  WmDragHandler::DragFinishedCallback finished =
      std::move(offered_drag_->finished);
  base::OnceClosure quit = std::move(offered_drag_->quit);
  if (finished) {
    std::move(finished).Run(operation);
  }
  if (quit) {
    std::move(quit).Run();
  }
}

void OxyOSConnection::HandleOfferedDrag(const OxyOSEvent& event) {
  if (!offered_drag_ || offered_drag_->ended ||
      offered_drag_->drag != event.code) {
    return;
  }
  const uint8_t action = static_cast<uint8_t>(event.detail);
  switch (event.kind) {
    case OXYOS_EVENT_DRAG_SOURCE_ACTION:
      if (offered_drag_->location) {
        offered_drag_->location->OnDragOperationChanged(
            DragOperationOf(action));
      }
      break;
    case OXYOS_EVENT_DRAG_DROPPED:
      if (offered_drag_->icon) {
        oxyos_client_destroy_surface(client_, offered_drag_->icon);
        offered_drag_->icon = 0;
      }
      break;
    case OXYOS_EVENT_DRAG_FINISHED:
      EndOfferedDrag(DragOperationOf(action), false);
      break;
    case OXYOS_EVENT_DRAG_CANCELLED:
      EndOfferedDrag(mojom::DragOperation::kNone, true);
      break;
    default:
      break;
  }
}

WmDropHandler* OxyOSConnection::IncomingDropHandler(
    gfx::PointF* location_dip) const {
  OxyOSWindow* window = GetWindow(incoming_drag_->surface);
  if (!window) {
    return nullptr;
  }
  OxyOSWindow* root = window->root();
  const gfx::PointF location = OxyOSPointerLocation(
      incoming_drag_->x, incoming_drag_->y, window->scale());
  gfx::Vector2dF offset;
  if (window != root) {
    offset = gfx::Vector2dF(window->GetBoundsInPixels().origin() -
                            root->GetBoundsInPixels().origin());
  }
  *location_dip = gfx::ScalePoint(location + offset, 1.0f / root->scale());
  return GetWmDropHandler(*root);
}

void OxyOSConnection::HandleIncomingDrag(const OxyOSEvent& event) {
  switch (event.kind) {
    case OXYOS_EVENT_DRAG_ENTER:
      LeaveIncomingDrag();
      incoming_drag_ = IncomingDrag{
          .offer = event.code,
          .serial = event.serial,
          .surface = event.surface,
          .operations = OxyOSDragOperationsOf(static_cast<uint8_t>(event.detail)),
          .expected = event.width,
          .x = event.x,
          .y = event.y,
          .modifiers = keyboard_.modifiers()};
      if (incoming_drag_->expected == 0) {
        EnterIncomingDrag();
      }
      break;
    case OXYOS_EVENT_DRAG_OFFER_TYPE:
      if (incoming_drag_ && incoming_drag_->offer == event.code &&
          incoming_drag_->types.size() < incoming_drag_->expected) {
        incoming_drag_->types.emplace_back(TextOf(event));
        if (incoming_drag_->types.size() == incoming_drag_->expected) {
          EnterIncomingDrag();
        }
      }
      break;
    case OXYOS_EVENT_DRAG_MOTION:
      if (incoming_drag_ && incoming_drag_->offer == event.code) {
        incoming_drag_->x = event.x;
        incoming_drag_->y = event.y;
        incoming_drag_->modifiers = keyboard_.modifiers();
        MoveIncomingDrag();
      }
      break;
    case OXYOS_EVENT_DRAG_LEAVE:
      if (incoming_drag_ && incoming_drag_->offer == event.code) {
        LeaveIncomingDrag();
      }
      break;
    case OXYOS_EVENT_DRAG_DROP:
      if (incoming_drag_ && incoming_drag_->offer == event.code) {
        incoming_drag_->x = event.x;
        incoming_drag_->y = event.y;
        DropIncomingDrag(event);
      }
      break;
    default:
      break;
  }
}

void OxyOSConnection::EnterIncomingDrag() {
  gfx::PointF location;
  WmDropHandler* handler = IncomingDropHandler(&location);
  if (!handler) {
    return;
  }
  incoming_drag_->entered = true;
  handler->OnDragEnter(location, incoming_drag_->operations,
                       incoming_drag_->modifiers);
  handler->OnDragDataAvailable(
      offered_drag_ && !offered_drag_->ended
          ? std::make_unique<OSExchangeData>(
                offered_drag_->data->provider().Clone())
          : OxyOSDragPlaceholder(incoming_drag_->types));
  MoveIncomingDrag();
}

void OxyOSConnection::MoveIncomingDrag() {
  if (!incoming_drag_->entered) {
    return;
  }
  gfx::PointF location;
  WmDropHandler* handler = IncomingDropHandler(&location);
  if (!handler) {
    return;
  }
  const int accepted =
      handler->OnDragMotion(location, incoming_drag_->operations,
                            incoming_drag_->modifiers) &
      incoming_drag_->operations;
  const std::optional<std::string> mime =
      accepted ? OxyOSDragTypeToAccept(incoming_drag_->types) : std::nullopt;
  const std::string type = mime.value_or(std::string());
  const uint8_t actions = mime ? OxyOSDragActionsOf(accepted) : 0;
  const uint8_t preferred = mime ? OxyOSPreferredDragAction(accepted) : 0;
  if (incoming_drag_->answered && incoming_drag_->mime == type &&
      incoming_drag_->actions == actions &&
      incoming_drag_->preferred == preferred) {
    return;
  }
  incoming_drag_->answered = true;
  incoming_drag_->mime = type;
  incoming_drag_->actions = actions;
  incoming_drag_->preferred = preferred;
  oxyos_client_accept_drag(client_, incoming_drag_->offer,
                           incoming_drag_->serial,
                           type.empty() ? nullptr : type.data(), type.size(),
                           actions, preferred);
}

void OxyOSConnection::LeaveIncomingDrag() {
  if (!incoming_drag_) {
    return;
  }
  if (incoming_drag_->entered) {
    gfx::PointF location;
    if (WmDropHandler* handler = IncomingDropHandler(&location)) {
      handler->OnDragLeave();
    }
  }
  incoming_drag_.reset();
}

void OxyOSConnection::DropIncomingDrag(const OxyOSEvent& event) {
  const uint32_t offer = incoming_drag_->offer;
  const uint32_t surface = incoming_drag_->surface;
  if (offered_drag_ && !offered_drag_->ended) {
    gfx::PointF location;
    if (WmDropHandler* handler = IncomingDropHandler(&location)) {
      handler->OnDragDataAvailable(std::make_unique<OSExchangeData>(
          offered_drag_->data->provider().Clone()));
      handler->OnDragDrop(incoming_drag_->modifiers);
      handler->OnDragLeave();
    }
    incoming_drag_.reset();
    oxyos_client_finish_drop(client_, offer);
    return;
  }
  std::vector<std::pair<std::string, base::ScopedFD>> pipes;
  for (const std::string& type :
       OxyOSDropTypesToReceive(incoming_drag_->types)) {
    const int fd =
        oxyos_client_receive_drop(client_, offer, type.data(), type.size());
    if (fd >= 0) {
      pipes.emplace_back(type, base::ScopedFD(fd));
    }
  }
  base::ThreadPool::PostTaskAndReplyWithResult(
      FROM_HERE, {base::MayBlock(), base::TaskPriority::USER_BLOCKING},
      base::BindOnce(&ReadDrop, std::move(pipes)),
      base::BindOnce(&OxyOSConnection::OnDropRead, weak_factory_.GetWeakPtr(),
                     offer, surface));
}

void OxyOSConnection::OnDropRead(uint32_t offer,
                                 uint32_t surface,
                                 std::map<std::string, std::string> received) {
  if (incoming_drag_ && incoming_drag_->offer == offer &&
      incoming_drag_->surface == surface) {
    gfx::PointF location;
    if (WmDropHandler* handler = IncomingDropHandler(&location)) {
      const int operations = incoming_drag_->operations;
      const int modifiers = incoming_drag_->modifiers;
      handler->OnDragLeave();
      handler->OnDragEnter(location, operations, modifiers);
      handler->OnDragDataAvailable(OxyOSDropData(received));
      handler->OnDragMotion(location, operations, modifiers);
      base::SequencedTaskRunner::GetCurrentDefault()->PostDelayedTask(
          FROM_HERE,
          base::BindOnce(&OxyOSConnection::DropWhenAnswered,
                         weak_factory_.GetWeakPtr(), offer, surface,
                         kDropAnswerTries),
          kDropAnswerInterval);
      return;
    }
    incoming_drag_.reset();
  }
  oxyos_client_finish_drop(client_, offer);
}

void OxyOSConnection::DropWhenAnswered(uint32_t offer,
                                       uint32_t surface,
                                       int tries) {
  if (!incoming_drag_ || incoming_drag_->offer != offer ||
      incoming_drag_->surface != surface) {
    oxyos_client_finish_drop(client_, offer);
    return;
  }
  gfx::PointF location;
  WmDropHandler* handler = IncomingDropHandler(&location);
  if (!handler) {
    incoming_drag_.reset();
    oxyos_client_finish_drop(client_, offer);
    return;
  }
  const int accepted = handler->OnDragMotion(
      location, incoming_drag_->operations, incoming_drag_->modifiers);
  if (accepted == DragDropTypes::DRAG_NONE && tries > 0) {
    base::SequencedTaskRunner::GetCurrentDefault()->PostDelayedTask(
        FROM_HERE,
        base::BindOnce(&OxyOSConnection::DropWhenAnswered,
                       weak_factory_.GetWeakPtr(), offer, surface, tries - 1),
        kDropAnswerInterval);
    return;
  }
  handler->OnDragDrop(incoming_drag_->modifiers);
  handler->OnDragLeave();
  incoming_drag_.reset();
  oxyos_client_finish_drop(client_, offer);
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

uint16_t OxyOSConnection::FileChooserProtocolVersion() {
  return oxyos_client_protocol_version(client_);
}

std::optional<uint32_t> OxyOSConnection::ChooseFiles(
    uint32_t serial,
    gfx::AcceleratedWidget window,
    const std::string& request) {
  OxyOSWindow* owner = GetWindow(window);
  if (!owner) {
    owner = pressed_window();
  }
  OxyOSWindow* toplevel = owner ? owner->root() : nullptr;
  if (!toplevel || !toplevel->is_toplevel() || !toplevel->shown()) {
    LOG(ERROR) << "No shown OxyOS window to choose files for";
    return std::nullopt;
  }
  const uint32_t surface = toplevel->surface();
  if (oxyos_client_choose_files(client_, serial, surface, last_press_serial_,
                                request.c_str()) != 0) {
    LOG(ERROR) << "OxyOS refused to choose files: " << oxyos_last_error();
    return std::nullopt;
  }
  return surface;
}

void OxyOSConnection::CancelChooseFiles(uint32_t serial) {
  oxyos_client_cancel_choose_files(client_, serial);
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
      } else {
        PresentDragIcon(event);
      }
      break;
    case OXYOS_EVENT_DRAG_ENTER:
    case OXYOS_EVENT_DRAG_OFFER_TYPE:
    case OXYOS_EVENT_DRAG_MOTION:
    case OXYOS_EVENT_DRAG_LEAVE:
    case OXYOS_EVENT_DRAG_DROP:
      HandleIncomingDrag(event);
      break;
    case OXYOS_EVENT_DRAG_SOURCE_ACTION:
    case OXYOS_EVENT_DRAG_DROPPED:
    case OXYOS_EVENT_DRAG_FINISHED:
    case OXYOS_EVENT_DRAG_CANCELLED:
      HandleOfferedDrag(event);
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
    case OXYOS_EVENT_FILES_CHOSEN:
      file_chooser_.OnChunk(event.code, static_cast<uint16_t>(event.detail),
                            event.flag, TextOf(event));
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
      CancelWindowDrag();
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
      CancelWindowDrag();
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
