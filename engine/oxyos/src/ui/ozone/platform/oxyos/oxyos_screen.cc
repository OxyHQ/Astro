// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_screen.h"

#include "ui/display/display.h"
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

OxyOSScreen::OxyOSScreen(OxyOSConnection* connection)
    : connection_(connection) {
  displays_.AddDisplay(MakeDisplay(kUnconfiguredSize, 1.0f),
                       display::DisplayList::Type::PRIMARY);
  connection_->set_screen(this);
}

OxyOSScreen::~OxyOSScreen() {
  connection_->set_screen(nullptr);
}

float OxyOSScreen::scale() const {
  return GetPrimaryDisplay().device_scale_factor();
}

void OxyOSScreen::OnToplevelConfigured(const gfx::Size& logical, float scale) {
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
  return GetPrimaryDisplay();
}

display::Display OxyOSScreen::GetDisplayMatching(
    const gfx::Rect& match_rect) const {
  return GetPrimaryDisplay();
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
