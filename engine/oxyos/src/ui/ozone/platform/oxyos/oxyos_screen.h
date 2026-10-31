// Copyright 2026 Oxy. Apache-2.0.

#ifndef UI_OZONE_PLATFORM_OXYOS_OXYOS_SCREEN_H_
#define UI_OZONE_PLATFORM_OXYOS_OXYOS_SCREEN_H_

#include <cstdint>
#include <optional>
#include <set>
#include <vector>

#include "base/memory/raw_ptr.h"
#include "ui/display/display_list.h"
#include "ui/gfx/geometry/rect.h"
#include "ui/gfx/geometry/size.h"
#include "ui/ozone/public/platform_screen.h"

namespace ui {

class OxyOSConnection;

struct OxyOSOutput {
  uint32_t id = 0;
  gfx::Size size;
  uint32_t scale_120 = 120;
  uint32_t refresh_mhz = 60000;
  bool primary = false;
  std::optional<gfx::Rect> work_area;

  friend bool operator==(const OxyOSOutput&, const OxyOSOutput&) = default;
};

std::vector<display::Display> OxyOSDisplaysOf(
    const std::vector<OxyOSOutput>& outputs);

class OxyOSScreen : public PlatformScreen {
 public:
  explicit OxyOSScreen(OxyOSConnection* connection);
  OxyOSScreen(const OxyOSScreen&) = delete;
  OxyOSScreen& operator=(const OxyOSScreen&) = delete;
  ~OxyOSScreen() override;

  float scale() const;
  void OnToplevelConfigured(const gfx::Size& logical, float scale);
  void OnOutputsChanged(const std::vector<OxyOSOutput>& outputs);
  gfx::Point OriginOf(uint32_t output) const;

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
  bool told_outputs_ = false;
};

}

#endif
