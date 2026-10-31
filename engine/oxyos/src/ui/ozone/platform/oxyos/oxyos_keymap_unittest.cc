// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_keymap.h"

#include "testing/gtest/include/gtest/gtest.h"
#include "ui/events/event_constants.h"
#include "ui/events/keycodes/dom/dom_code.h"
#include "ui/events/keycodes/dom/dom_key.h"
#include "ui/events/keycodes/keyboard_codes.h"
#include "ui/events/ozone/layout/xkb/xkb_evdev_codes.h"
#include "ui/events/ozone/layout/xkb/xkb_keyboard_layout_engine.h"
#include "ui/ozone/platform/oxyos/oxyos_keyboard.h"

namespace ui {

TEST(OxyOSKeymapTest, NoLayoutIsNoKeymap) {
  EXPECT_FALSE(OxyOSKeymapFromNames(""));
  EXPECT_FALSE(OxyOSKeymapFromNames("\t\t"));
}

TEST(OxyOSKeymapTest, TheSessionsLayoutGivesAKeyItsMeaningWhenItTypesNothing) {
  const std::optional<std::string> keymap = OxyOSKeymapFromNames("fr\t\t");
  ASSERT_TRUE(keymap);
  XkbEvdevCodes codes;
  XkbKeyboardLayoutEngine engine(codes);
  ASSERT_TRUE(
      engine.SetCurrentLayoutFromBuffer(keymap->data(), keymap->size()));
  OxyOSKeyboard keyboard;
  keyboard.set_layout_engine(&engine);
  keyboard.OnKey(29, true, "", base::TimeTicks());
  auto undo = keyboard.OnKey(17, true, "", base::TimeTicks());
  EXPECT_EQ(undo.key.code(), DomCode::US_W);
  EXPECT_EQ(undo.key.GetDomKey(), DomKey::FromCharacter('z'));
  EXPECT_EQ(undo.key.key_code(), VKEY_Z);
  EXPECT_TRUE(undo.key.flags() & EF_CONTROL_DOWN);
  keyboard.OnKey(17, false, "", base::TimeTicks());
  keyboard.OnKey(29, false, "", base::TimeTicks());
  auto q = keyboard.OnKey(30, true, "q", base::TimeTicks());
  EXPECT_EQ(q.key.GetDomKey(), DomKey::FromCharacter('q'));
  EXPECT_EQ(q.key.key_code(), VKEY_Q);
}

TEST(OxyOSKeymapTest, ADeadKeyIsADeadKey) {
  const std::optional<std::string> keymap = OxyOSKeymapFromNames("es\t\t");
  ASSERT_TRUE(keymap);
  XkbEvdevCodes codes;
  XkbKeyboardLayoutEngine engine(codes);
  ASSERT_TRUE(
      engine.SetCurrentLayoutFromBuffer(keymap->data(), keymap->size()));
  OxyOSKeyboard keyboard;
  keyboard.set_layout_engine(&engine);
  auto accent = keyboard.OnKey(40, true, "", base::TimeTicks());
  EXPECT_TRUE(accent.key.GetDomKey().IsDeadKey());
  EXPECT_EQ(accent.key.GetCharacter(), 0);
}

TEST(OxyOSKeymapTest, WithoutALayoutAShortcutIsTheUsPosition) {
  XkbEvdevCodes codes;
  XkbKeyboardLayoutEngine engine(codes);
  OxyOSKeyboard keyboard;
  keyboard.set_layout_engine(&engine);
  keyboard.OnKey(29, true, "", base::TimeTicks());
  auto shortcut = keyboard.OnKey(17, true, "", base::TimeTicks());
  EXPECT_EQ(shortcut.key.GetDomKey(), DomKey::FromCharacter('w'));
  EXPECT_EQ(shortcut.key.key_code(), VKEY_W);
}

}
