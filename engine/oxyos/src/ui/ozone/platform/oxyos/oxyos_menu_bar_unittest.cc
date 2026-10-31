// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_menu_bar.h"

#include <utility>
#include <vector>

#include "testing/gtest/include/gtest/gtest.h"
#include "ui/ozone/platform/oxyos/oxyos_conversions.h"
#include "ui/platform_window/stub/stub_window.h"

namespace ui {

namespace {

class RecordingMenuBar : public OxyOSMenuBar {
 public:
  bool SetMenus(std::vector<OxyOSMenuEntry> entries,
                Activated activated) override {
    menus = std::move(entries);
    activated.Run(static_cast<uint32_t>(menus.size() - 1));
    return true;
  }
  std::vector<OxyOSMenuEntry> menus;
};

}

TEST(OxyOSMenuBarTest, AWindowOffersItsMenuBarToTheBrowser) {
  StubWindow window(gfx::Rect(0, 0, 100, 100));
  EXPECT_EQ(GetOxyOSMenuBar(window), nullptr);
  RecordingMenuBar menu_bar;
  OxyOSMenuBar::SetOxyOSMenuBar(&window, &menu_bar);
  ASSERT_EQ(GetOxyOSMenuBar(window), &menu_bar);
  uint32_t chosen = 0;
  EXPECT_TRUE(GetOxyOSMenuBar(window)->SetMenus(
      {{.kind = OxyOSMenuKind::kMenu, .label = "File"},
       {.parent = 0, .label = "New Tab", .shortcut = "Mod+T"}},
      base::BindRepeating([](uint32_t* out, uint32_t index) { *out = index; },
                          &chosen)));
  EXPECT_EQ(menu_bar.menus.size(), 2u);
  EXPECT_EQ(chosen, 1u);
}

TEST(OxyOSMenuBarTest, EntriesAreTheProtocolsItemsWithNoTextLeftOut) {
  const std::vector<OxyOSMenuEntry> entries = {
      {.kind = OxyOSMenuKind::kMenu, .label = "Edit"},
      {.parent = 0,
       .flags = kOxyOSMenuDisabled,
       .label = "Undo",
       .shortcut = "Mod+Z"},
      {.parent = 0, .kind = OxyOSMenuKind::kSeparator},
      {.parent = 0,
       .flags = kOxyOSMenuCheckable | kOxyOSMenuChecked,
       .label = "Show Full URL"},
  };
  const std::vector<OxyOSMenuItem> items = OxyOSMenuItemsOf(entries);
  ASSERT_EQ(items.size(), 4u);
  EXPECT_EQ(items[0].parent, OXYOS_NO_MENU_PARENT);
  EXPECT_EQ(items[0].kind, OXYOS_MENU_MENU);
  EXPECT_STREQ(items[0].label, "Edit");
  EXPECT_EQ(items[0].shortcut, nullptr);
  EXPECT_EQ(items[1].flags, OXYOS_MENU_DISABLED);
  EXPECT_STREQ(items[1].shortcut, "Mod+Z");
  EXPECT_EQ(items[2].kind, OXYOS_MENU_SEPARATOR);
  EXPECT_EQ(items[2].label, nullptr);
  EXPECT_EQ(items[3].flags, OXYOS_MENU_CHECKABLE | OXYOS_MENU_CHECKED);
}

}
