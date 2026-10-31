// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_screen.h"

#include <algorithm>

#include "ui/display/display.h"
#include "ui/display/display_finder.h"
#include "ui/gfx/geometry/point_conversions.h"
#include "ui/gfx/geometry/rect_conversions.h"
#include "ui/gfx/geometry/vector2d_conversions.h"
#include "ui/ozone/platform/oxyos/oxyos_connection.h"
#include "ui/ozone/platform/oxyos/oxyos_window.h"

namespace ui {

namespace {

constexpr int64_t kDisplayId = 1;
constexpr gfx::Size kUnconfiguredSize(1280, 800);

display::Display MakeDisplay(const gfx::Size& logical, float scale) {
  display::Display display(kDisplayId, gfx::Rect(logical));
  display.set_device_scale_factor(scale);
  return display;
}

}

std::vector<display::Display> OxyOSDisplaysOf(
    const std::vector<OxyOSOutput>& outputs) {
  std::vector<OxyOSOutput> sorted = outputs;
  std::ranges::sort(sorted, {}, &OxyOSOutput::id);
  std::vector<display::Display> displays;
  int x = 0;
  for (const OxyOSOutput& output : sorted) {
    display::Display display(output.id,
                             gfx::Rect(gfx::Point(x, 0), output.size));
    display.set_device_scale_factor(output.scale_120 / 120.0f);
    display.set_display_frequency(output.refresh_mhz / 1000.0f);
    if (output.work_area) {
      display.set_work_area(*output.work_area + gfx::Vector2d(x, 0));
    }
    displays.push_back(display);
    x += output.size.width();
  }
  return displays;
}

OxyOSScreen::OxyOSScreen(OxyOSConnection* connection)
    : connection_(connection) {
  displays_.AddDisplay(MakeDisplay(kUnconfiguredSize, 1.0f),
                       display::DisplayList::Type::PRIMARY);
  connection_->set_screen(this);
  if (!connection_->outputs().empty()) {
    OnOutputsChanged(connection_->outputs());
  }
}

OxyOSScreen::~OxyOSScreen() {
  connection_->set_screen(nullptr);
}

float OxyOSScreen::scale() const {
  return GetPrimaryDisplay().device_scale_factor();
}

void OxyOSScreen::OnOutputsChanged(const std::vector<OxyOSOutput>& outputs) {
  if (outputs.empty()) {
    return;
  }
  const std::vector<display::Display> now = OxyOSDisplaysOf(outputs);
  auto primary_of = [&outputs](int64_t id) {
    return std::ranges::any_of(outputs, [id](const OxyOSOutput& output) {
      return output.id == id && output.primary;
    });
  };
  const bool any_primary = std::ranges::any_of(outputs, &OxyOSOutput::primary);
  for (const display::Display& display : now) {
    const auto type = primary_of(display.id()) ||
                              (!any_primary && display.id() == now.front().id())
                          ? display::DisplayList::Type::PRIMARY
                          : display::DisplayList::Type::NOT_PRIMARY;
    displays_.AddOrUpdateDisplay(display, type);
  }
  std::vector<int64_t> gone;
  for (const display::Display& display : displays_.displays()) {
    if (std::ranges::none_of(now, [&display](const display::Display& kept) {
          return kept.id() == display.id();
        })) {
      gone.push_back(display.id());
    }
  }
  for (int64_t id : gone) {
    displays_.RemoveDisplay(id);
  }
  told_outputs_ = true;
}

gfx::Point OxyOSScreen::OriginOf(uint32_t output) const {
  if (!told_outputs_ || !output) {
    return gfx::Point();
  }
  auto it = displays_.FindDisplayById(output);
  return it == displays_.displays().end() ? gfx::Point()
                                          : it->bounds().origin();
}

void OxyOSScreen::OnToplevelConfigured(const gfx::Size& logical, float scale) {
  if (told_outputs_) {
    return;
  }
  const display::Display current = GetPrimaryDisplay();
  if (current.bounds().size() == logical &&
      current.device_scale_factor() == scale) {
    return;
  }
  displays_.UpdateDisplay(MakeDisplay(logical, scale));
}

const std::vector<display::Display>& OxyOSScreen::GetAllDisplays() const {
  return displays_.displays();
}

display::Display OxyOSScreen::GetPrimaryDisplay() const {
  return *displays_.GetPrimaryDisplayIterator();
}

display::Display OxyOSScreen::GetDisplayForAcceleratedWidget(
    gfx::AcceleratedWidget widget) const {
  OxyOSWindow* window = connection_->GetWindow(widget);
  if (told_outputs_ && window) {
    auto it = displays_.FindDisplayById(window->root()->output());
    if (it != displays_.displays().end()) {
      return *it;
    }
  }
  return GetPrimaryDisplay();
}

gfx::Point OxyOSScreen::GetCursorScreenPoint() const {
  OxyOSWindow* window = connection_->pointer_window();
  if (!window) {
    return gfx::Point();
  }
  const gfx::PointF local = connection_->pointer_location();
  const gfx::Rect bounds = window->GetBoundsInDIP();
  return bounds.origin() +
         gfx::ToFlooredVector2d(gfx::Vector2dF(local.x() / window->scale(),
                                               local.y() / window->scale()));
}

bool OxyOSScreen::IsAcceleratedWidgetUnderCursor(
    gfx::AcceleratedWidget widget) const {
  OxyOSWindow* window = connection_->pointer_window();
  return window && window->surface() == widget;
}

gfx::AcceleratedWidget OxyOSScreen::GetAcceleratedWidgetAtScreenPoint(
    const gfx::Point& point_in_dip) const {
  OxyOSWindow* window = connection_->pointer_window();
  return window ? window->root()->surface() : gfx::kNullAcceleratedWidget;
}

gfx::AcceleratedWidget OxyOSScreen::GetLocalProcessWidgetAtPoint(
    const gfx::Point& point_in_dip,
    const std::set<gfx::AcceleratedWidget>& ignore) const {
  const gfx::AcceleratedWidget widget =
      GetAcceleratedWidgetAtScreenPoint(point_in_dip);
  return ignore.contains(widget) ? gfx::kNullAcceleratedWidget : widget;
}

display::Display OxyOSScreen::GetDisplayNearestPoint(
    const gfx::Point& point_in_dip) const {
  const display::Display* display =
      display::FindDisplayNearestPoint(displays_.displays(), point_in_dip);
  return display ? *display : GetPrimaryDisplay();
}

display::Display OxyOSScreen::GetDisplayMatching(
    const gfx::Rect& match_rect) const {
  const display::Display* display = display::FindDisplayWithBiggestIntersection(
      displays_.displays(), match_rect);
  return display ? *display : GetPrimaryDisplay();
}

void OxyOSScreen::AddObserver(display::DisplayObserver* observer) {
  displays_.AddObserver(observer);
}

void OxyOSScreen::RemoveObserver(display::DisplayObserver* observer) {
  displays_.RemoveObserver(observer);
}

std::optional<float> OxyOSScreen::GetPreferredScaleFactorForAcceleratedWidget(
    gfx::AcceleratedWidget widget) const {
  OxyOSWindow* window = connection_->GetWindow(widget);
  return window ? std::optional<float>(window->scale()) : std::nullopt;
}

}
