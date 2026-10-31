// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_keyboard.h"

#include <utility>

#include "base/i18n/char_iterator.h"
#include "base/strings/utf_string_conversions.h"
#include "ui/events/event_constants.h"
#include "ui/events/keycodes/dom/keycode_converter.h"
#include "ui/events/keycodes/keyboard_code_conversion.h"
#include "ui/events/ozone/layout/keyboard_layout_engine.h"

namespace ui {

namespace {

int ModifierFlag(DomCode code) {
  switch (code) {
    case DomCode::SHIFT_LEFT:
    case DomCode::SHIFT_RIGHT:
      return EF_SHIFT_DOWN;
    case DomCode::CONTROL_LEFT:
    case DomCode::CONTROL_RIGHT:
      return EF_CONTROL_DOWN;
    case DomCode::ALT_LEFT:
    case DomCode::ALT_RIGHT:
      return EF_ALT_DOWN;
    case DomCode::META_LEFT:
    case DomCode::META_RIGHT:
      return EF_COMMAND_DOWN;
    default:
      return EF_NONE;
  }
}

std::vector<int32_t> CodePoints(std::u16string_view text) {
  std::vector<int32_t> points;
  for (base::i18n::UTF16CharIterator it(text); !it.end(); it.Advance()) {
    points.push_back(it.get());
  }
  return points;
}

}

OxyOSKeyboard::Typed::Typed(KeyEvent key, std::u16string text)
    : key(std::move(key)), text(std::move(text)) {}
OxyOSKeyboard::Typed::Typed(Typed&&) = default;
OxyOSKeyboard::Typed& OxyOSKeyboard::Typed::operator=(Typed&&) = default;
OxyOSKeyboard::Typed::~Typed() = default;

OxyOSKeyboard::OxyOSKeyboard() = default;
OxyOSKeyboard::~OxyOSKeyboard() = default;

int OxyOSKeyboard::modifiers() const {
  int flags = caps_lock_ ? EF_CAPS_LOCK_ON : EF_NONE;
  for (const auto& [code, held] : held_) {
    flags |= ModifierFlag(code);
  }
  return flags;
}

int OxyOSKeyboard::ModifiersWith(DomCode code, bool pressed) const {
  int flags = caps_lock_ ? EF_CAPS_LOCK_ON : EF_NONE;
  for (const auto& [held_code, held] : held_) {
    if (held_code != code) {
      flags |= ModifierFlag(held_code);
    }
  }
  if (pressed) {
    flags |= ModifierFlag(code);
  }
  return flags;
}

bool OxyOSKeyboard::LookUp(DomCode code,
                           int flags,
                           DomKey* key,
                           KeyboardCode* key_code) const {
  return layout_engine_ && layout_engine_->Lookup(code, flags, key, key_code) &&
         *key != DomKey::NONE && *key != DomKey::UNIDENTIFIED;
}

OxyOSKeyboard::Typed OxyOSKeyboard::OnKey(uint32_t evdev_code,
                                          bool pressed,
                                          std::string_view typed,
                                          base::TimeTicks time) {
  const DomCode code =
      KeycodeConverter::EvdevCodeToDomCode(static_cast<int>(evdev_code));
  int flags = ModifiersWith(code, pressed);
  auto previous = held_.find(code);

  if (!pressed) {
    Held held = previous != held_.end()
                    ? previous->second
                    : Held{DomKey::UNIDENTIFIED,
                           DomCodeToUsLayoutKeyboardCode(code), false};
    if (previous != held_.end()) {
      held_.erase(previous);
    }
    if (held.alt_graph) {
      flags = (flags & ~EF_ALT_DOWN) | EF_ALTGR_DOWN;
    }
    return Typed(KeyEvent(EventType::kKeyReleased, held.key_code, code, flags,
                          held.key, time),
                 std::u16string());
  }

  const bool repeat = previous != held_.end();
  const std::u16string text = base::UTF8ToUTF16(typed);
  const std::vector<int32_t> points = CodePoints(text);
  DomKey key = DomKey::UNIDENTIFIED;
  KeyboardCode key_code = DomCodeToUsLayoutKeyboardCode(code);
  DomKey layout_key = DomKey::UNIDENTIFIED;
  KeyboardCode layout_key_code = VKEY_UNKNOWN;
  const bool looked_up = LookUp(code, flags, &layout_key, &layout_key_code);
  if (looked_up && layout_key_code != VKEY_UNKNOWN) {
    key_code = layout_key_code;
  }
  std::u16string left;
  bool alt_graph = false;
  if (points.size() == 1) {
    key = DomKey::FromCharacter(points[0]);
    alt_graph = held_.contains(DomCode::ALT_RIGHT) &&
                !held_.contains(DomCode::ALT_LEFT);
  } else if (points.size() > 1) {
    left = text;
  } else if (!DomCodeToNonPrintableDomKey(code, &key, &key_code)) {
    key = DomKey::UNIDENTIFIED;
    const bool shortcut =
        flags & (EF_CONTROL_DOWN | EF_ALT_DOWN | EF_COMMAND_DOWN);
    DomKey us_key;
    KeyboardCode us_key_code;
    if (looked_up && (shortcut || !layout_key.IsCharacter())) {
      key = layout_key;
    } else if (shortcut &&
               DomCodeToUsLayoutDomKey(code, flags, &us_key, &us_key_code)) {
      key = us_key;
      key_code = us_key_code;
    }
  }
  if (alt_graph) {
    flags = (flags & ~EF_ALT_DOWN) | EF_ALTGR_DOWN;
  }
  held_.insert_or_assign(code, Held{key, key_code, alt_graph});
  return Typed(KeyEvent(EventType::kKeyPressed, key_code, code,
                        flags | (repeat ? EF_IS_REPEAT : EF_NONE), key, time),
               std::move(left));
}

std::vector<KeyEvent> OxyOSKeyboard::CharactersOf(std::string_view text,
                                                  base::TimeTicks time) const {
  std::vector<KeyEvent> characters;
  const int flags = modifiers() & ~(EF_CONTROL_DOWN | EF_ALT_DOWN |
                                    EF_ALTGR_DOWN | EF_COMMAND_DOWN);
  for (int32_t point : CodePoints(base::UTF8ToUTF16(text))) {
    characters.emplace_back(EventType::kKeyPressed, VKEY_UNKNOWN, DomCode::NONE,
                            flags, DomKey::FromCharacter(point), time, true);
  }
  return characters;
}

}
