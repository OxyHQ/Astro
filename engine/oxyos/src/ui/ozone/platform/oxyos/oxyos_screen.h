// Copyright 2026 Oxy. Apache-2.0.

#ifndef UI_OZONE_PLATFORM_OXYOS_OXYOS_SCREEN_H_
#define UI_OZONE_PLATFORM_OXYOS_OXYOS_SCREEN_H_

#include <optional>
#include <set>
#include <vector>

#include "base/memory/raw_ptr.h"
#include "ui/display/display_list.h"
#include "ui/ozone/public/platform_screen.h"

namespace ui {

class OxyOSConnection;

class OxyOSScreen : public PlatformScreen {
 public:
  explicit OxyOSScreen(OxyOSConnection* connection);
  OxyOSScreen(const OxyOSScreen&) = delete;
  OxyOSScreen& operator=(const OxyOSScreen&) = delete;
  ~OxyOSScreen() override;

  float scale() const;
  void OnToplevelConfigured(const gfx::Size& logical, float scale);

  const std::vector<display::Display>& GetAllDisplays() const override;
  display::Display GetPrimaryDisplay() const override;
  display::Display GetDisplayForAcceleratedWidget(
      gfx::AcceleratedWidget widget) const override;
  gfx::Point GetCursorScreenPoint() const override;
  bool IsAcceleratedWidgetUnderCursor(
      gfx::AcceleratedWidget widget) const override;
  gfx::AcceleratedWidget GetAcceleratedWidgetAtScreenPoint(
      const gfx::Point& point_in_dip) const override;
  gfx::AcceleratedWidget GetLocalProcessWidgetAtPoint(
      const gfx::Point& point_in_dip,
      const std::set<gfx::AcceleratedWidget>& ignore) const override;
  display::Display GetDisplayNearestPoint(
      const gfx::Point& point_in_dip) const override;
  display::Display GetDisplayMatching(
      const gfx::Rect& match_rect) const override;
  void AddObserver(display::DisplayObserver* observer) override;
  void RemoveObserver(display::DisplayObserver* observer) override;
  std::optional<float> GetPreferredScaleFactorForAcceleratedWidget(
      gfx::AcceleratedWidget widget) const override;

 private:
  const raw_ptr<OxyOSConnection> connection_;
  display::DisplayList displays_;
};

}

#endif
