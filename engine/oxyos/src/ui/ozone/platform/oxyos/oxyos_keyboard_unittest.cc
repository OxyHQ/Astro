// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_keyboard.h"

#include "testing/gtest/include/gtest/gtest.h"
#include "ui/events/event_constants.h"
#include "ui/events/keycodes/dom/dom_code.h"
#include "ui/events/keycodes/keyboard_codes.h"

namespace ui {

namespace {

constexpr uint32_t kKeyA = 30;
constexpr uint32_t kKeyE = 18;
constexpr uint32_t kKeyQuote = 40;
constexpr uint32_t kKeyEnter = 28;
constexpr uint32_t kKeyBackspace = 14;
constexpr uint32_t kKeyLeftShift = 42;
constexpr uint32_t kKeyLeftControl = 29;
constexpr uint32_t kKeyRightAlt = 100;
constexpr uint32_t kKeyT = 20;

}

TEST(OxyOSKeyboardTest, AKeyCarriesWhatTheLayoutTyped) {
  OxyOSKeyboard keyboard;
  auto typed = keyboard.OnKey(kKeyA, true, "q", base::TimeTicks());
  EXPECT_EQ(typed.key.type(), EventType::kKeyPressed);
  EXPECT_EQ(typed.key.code(), DomCode::US_A);
  EXPECT_EQ(typed.key.GetDomKey(), DomKey::FromCharacter('q'));
  EXPECT_EQ(typed.key.GetCharacter(), u'q');
  EXPECT_TRUE(typed.text.empty());
  auto released = keyboard.OnKey(kKeyA, false, "", base::TimeTicks());
  EXPECT_EQ(released.key.type(), EventType::kKeyReleased);
  EXPECT_EQ(released.key.GetDomKey(), DomKey::FromCharacter('q'));
}

TEST(OxyOSKeyboardTest, ShiftIsAModifierOfTheKeysPressedWithIt) {
  OxyOSKeyboard keyboard;
  auto shift = keyboard.OnKey(kKeyLeftShift, true, "", base::TimeTicks());
  EXPECT_EQ(shift.key.GetDomKey(), DomKey::SHIFT);
  EXPECT_TRUE(shift.key.flags() & EF_SHIFT_DOWN);
  auto a = keyboard.OnKey(kKeyA, true, "A", base::TimeTicks());
  EXPECT_TRUE(a.key.flags() & EF_SHIFT_DOWN);
  EXPECT_EQ(a.key.GetDomKey(), DomKey::FromCharacter('A'));
  keyboard.OnKey(kKeyA, false, "", base::TimeTicks());
  auto up = keyboard.OnKey(kKeyLeftShift, false, "", base::TimeTicks());
  EXPECT_FALSE(up.key.flags() & EF_SHIFT_DOWN);
  EXPECT_EQ(keyboard.modifiers(), EF_NONE);
}

TEST(OxyOSKeyboardTest, EditingKeysAreKeysNotText) {
  OxyOSKeyboard keyboard;
  auto enter = keyboard.OnKey(kKeyEnter, true, "", base::TimeTicks());
  EXPECT_EQ(enter.key.GetDomKey(), DomKey::ENTER);
  EXPECT_EQ(enter.key.key_code(), VKEY_RETURN);
  auto backspace = keyboard.OnKey(kKeyBackspace, true, "", base::TimeTicks());
  EXPECT_EQ(backspace.key.GetDomKey(), DomKey::BACKSPACE);
}

TEST(OxyOSKeyboardTest, AShortcutWithoutTextIsTheKeysPosition) {
  OxyOSKeyboard keyboard;
  keyboard.OnKey(kKeyLeftControl, true, "", base::TimeTicks());
  auto t = keyboard.OnKey(kKeyT, true, "", base::TimeTicks());
  EXPECT_TRUE(t.key.flags() & EF_CONTROL_DOWN);
  EXPECT_EQ(t.key.key_code(), VKEY_T);
  EXPECT_EQ(t.key.GetDomKey(), DomKey::FromCharacter('t'));
}

TEST(OxyOSKeyboardTest, AKeyThatTypedNothingTypesNothing) {
  OxyOSKeyboard keyboard;
  auto dead = keyboard.OnKey(kKeyQuote, true, "", base::TimeTicks());
  EXPECT_EQ(dead.key.GetDomKey(), DomKey::UNIDENTIFIED);
  EXPECT_EQ(dead.key.GetCharacter(), 0);
  keyboard.OnKey(kKeyQuote, false, "", base::TimeTicks());
  auto composed = keyboard.OnKey(kKeyE, true, "\xc3\xa9", base::TimeTicks());
  EXPECT_EQ(composed.key.GetDomKey(), DomKey::FromCharacter(0xe9));
}

TEST(OxyOSKeyboardTest, RightAltTypingACharacterIsAltGraph) {
  OxyOSKeyboard keyboard;
  keyboard.OnKey(kKeyRightAlt, true, "", base::TimeTicks());
  auto euro = keyboard.OnKey(kKeyE, true, "\xe2\x82\xac", base::TimeTicks());
  EXPECT_FALSE(euro.key.flags() & EF_ALT_DOWN);
  EXPECT_TRUE(euro.key.flags() & EF_ALTGR_DOWN);
  EXPECT_EQ(euro.key.GetCharacter(), u'€');
  auto up = keyboard.OnKey(kKeyE, false, "", base::TimeTicks());
  EXPECT_TRUE(up.key.flags() & EF_ALTGR_DOWN);
}

TEST(OxyOSKeyboardTest, AHeldKeyPressedAgainIsARepeat) {
  OxyOSKeyboard keyboard;
  keyboard.OnKey(kKeyA, true, "a", base::TimeTicks());
  auto again = keyboard.OnKey(kKeyA, true, "a", base::TimeTicks());
  EXPECT_TRUE(again.key.flags() & EF_IS_REPEAT);
}

TEST(OxyOSKeyboardTest, TextOfSeveralCharactersIsTypedAfterTheKey) {
  OxyOSKeyboard keyboard;
  auto typed = keyboard.OnKey(kKeyA, true, "ab", base::TimeTicks());
  EXPECT_EQ(typed.key.GetCharacter(), 0);
  EXPECT_EQ(typed.text, u"ab");
  auto characters = keyboard.CharactersOf("ab", base::TimeTicks());
  ASSERT_EQ(characters.size(), 2u);
  EXPECT_TRUE(characters[0].is_char());
  EXPECT_EQ(characters[1].GetCharacter(), u'b');
}

TEST(OxyOSKeyboardTest, CapsLockIsAFlag) {
  OxyOSKeyboard keyboard;
  keyboard.SetCapsLock(true);
  auto a = keyboard.OnKey(kKeyA, true, "A", base::TimeTicks());
  EXPECT_TRUE(a.key.flags() & EF_CAPS_LOCK_ON);
}

}
