// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_menu_bar.h"

#include "ui/base/class_property.h"
#include "ui/platform_window/platform_window.h"

DEFINE_UI_CLASS_PROPERTY_TYPE(ui::OxyOSMenuBar*)

namespace ui {

DEFINE_UI_CLASS_PROPERTY_KEY(OxyOSMenuBar*, kOxyOSMenuBarKey, nullptr)

OxyOSMenuBar::~OxyOSMenuBar() = default;

void OxyOSMenuBar::SetOxyOSMenuBar(PlatformWindow* window,
                                   OxyOSMenuBar* menu_bar) {
  window->SetProperty(kOxyOSMenuBarKey, menu_bar);
}

OxyOSMenuBar* GetOxyOSMenuBar(const PlatformWindow& window) {
  return window.GetProperty(kOxyOSMenuBarKey);
}

}
