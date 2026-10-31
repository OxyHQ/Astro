// Copyright 2026 Oxy. Apache-2.0.

#ifndef UI_OZONE_PLATFORM_OXYOS_OXYOS_KEYMAP_H_
#define UI_OZONE_PLATFORM_OXYOS_OXYOS_KEYMAP_H_

#include <optional>
#include <string>
#include <string_view>

namespace ui {

std::optional<std::string> OxyOSKeymapFromNames(std::string_view names);

}

#endif
