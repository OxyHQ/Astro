// Copyright 2026 Oxy. Apache-2.0.

#ifndef UI_OZONE_PLATFORM_OXYOS_OXYOS_KEYBOARD_H_
#define UI_OZONE_PLATFORM_OXYOS_OXYOS_KEYBOARD_H_

#include <cstdint>
#include <string>
#include <string_view>
#include <vector>

#include "base/containers/flat_map.h"
#include "base/time/time.h"
#include "ui/events/event.h"
#include "ui/events/keycodes/dom/dom_code.h"
#include "ui/events/keycodes/dom/dom_key.h"

namespace ui {

class OxyOSKeyboard {
 public:
  struct Typed {
    Typed(KeyEvent key, std::u16string text);
    Typed(Typed&&);
    Typed& operator=(Typed&&);
    ~Typed();

    KeyEvent key;
    std::u16string text;
  };

  OxyOSKeyboard();
  OxyOSKeyboard(const OxyOSKeyboard&) = delete;
  OxyOSKeyboard& operator=(const OxyOSKeyboard&) = delete;
  ~OxyOSKeyboard();

  Typed OnKey(uint32_t evdev_code,
              bool pressed,
              std::string_view typed,
              base::TimeTicks time);

  std::vector<KeyEvent> CharactersOf(std::string_view text,
                                     base::TimeTicks time) const;

  void SetCapsLock(bool on) { caps_lock_ = on; }
  void ReleaseAll() { held_.clear(); }
  int modifiers() const;

 private:
  struct Held {
    DomKey key;
    KeyboardCode key_code;
    bool alt_graph;
  };

  int ModifiersWith(DomCode code, bool pressed) const;

  base::flat_map<DomCode, Held> held_;
  bool caps_lock_ = false;
};

}

#endif
