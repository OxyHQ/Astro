// Copyright 2026 Oxy. Apache-2.0.

#ifndef UI_OZONE_PLATFORM_OXYOS_OXYOS_MENU_BAR_H_
#define UI_OZONE_PLATFORM_OXYOS_OXYOS_MENU_BAR_H_

#include <cstdint>
#include <string>
#include <vector>

#include "base/functional/callback.h"

namespace ui {

class PlatformWindow;

inline constexpr uint32_t kOxyOSNoMenuParent = 0xFFFFFFFF;

enum class OxyOSMenuKind : uint8_t {
  kMenu = 1,
  kItem = 2,
  kSubmenu = 3,
  kSeparator = 4,
};

inline constexpr uint8_t kOxyOSMenuDisabled = 1;
inline constexpr uint8_t kOxyOSMenuCheckable = 2;
inline constexpr uint8_t kOxyOSMenuChecked = 4;

struct OxyOSMenuEntry {
  uint32_t parent = kOxyOSNoMenuParent;
  OxyOSMenuKind kind = OxyOSMenuKind::kItem;
  uint8_t flags = 0;
  std::string label;
  std::string shortcut;
};

class OxyOSMenuBar {
 public:
  using Activated = base::RepeatingCallback<void(uint32_t index)>;

  virtual bool SetMenus(std::vector<OxyOSMenuEntry> entries,
                        Activated activated) = 0;

  static void SetOxyOSMenuBar(PlatformWindow* window, OxyOSMenuBar* menu_bar);

 protected:
  virtual ~OxyOSMenuBar();
};

OxyOSMenuBar* GetOxyOSMenuBar(const PlatformWindow& window);

}

#endif
