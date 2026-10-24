// Copyright 2026 Oxy. Apache-2.0.

#include "chrome/browser/astro/ac_window_keys.h"

#include <memory>
#include <optional>
#include <set>
#include <utility>

#include "base/memory/raw_ptr.h"
#include "base/no_destructor.h"
#include "base/scoped_observation.h"
#include "base/strings/string_number_conversions.h"
#include "chrome/browser/ui/browser_window/public/browser_window_interface.h"
#include "components/input/native_web_keyboard_event.h"
#include "content/public/browser/keyboard_event_processing_result.h"
#include "third_party/blink/public/common/input/web_input_event.h"
#include "ui/events/keycodes/dom/dom_code.h"
#include "ui/events/keycodes/dom/dom_key.h"
#include "ui/events/keycodes/dom/keycode_converter.h"

#if defined(USE_AURA)
#include "ui/aura/window.h"
#include "ui/aura/window_observer.h"
#include "ui/base/base_window.h"
#include "ui/events/event.h"
#include "ui/events/event_handler.h"
#endif

extern std::optional<content::KeyboardEventProcessingResult> (
    *g_astro_window_key)(BrowserWindowInterface* browser,
                         const input::NativeWebKeyboardEvent& event,
                         int command_id);

namespace astro {

namespace {

constexpr int kShift = 1;
constexpr int kControl = 2;
constexpr int kAlt = 4;
constexpr int kMeta = 8;

struct Shortcuts {
  bool received = false;
  std::set<std::string> active;
  std::set<std::string> owned;
};

Shortcuts& State() {
  static base::NoDestructor<Shortcuts> state;
  return *state;
}

int Modifiers(const input::NativeWebKeyboardEvent& event) {
  const int flags = event.GetModifiers();
  return (flags & blink::WebInputEvent::kShiftKey ? kShift : 0) |
         (flags & blink::WebInputEvent::kControlKey ? kControl : 0) |
         (flags & blink::WebInputEvent::kAltKey ? kAlt : 0) |
         (flags & blink::WebInputEvent::kMetaKey ? kMeta : 0);
}

base::DictValue Describe(const input::NativeWebKeyboardEvent& event,
                         const std::string& code,
                         int modifiers) {
  return base::DictValue()
      .Set("type", event.GetType() == blink::WebInputEvent::Type::kKeyUp
                       ? "keyup"
                       : "keydown")
      .Set("code", code)
      .Set("key", ui::KeycodeConverter::DomKeyToKeyString(
                      ui::DomKey(event.dom_key)))
      .Set("mods", modifiers);
}

std::optional<content::KeyboardEventProcessingResult> WindowKey(
    BrowserWindowInterface* browser,
    const input::NativeWebKeyboardEvent& event,
    int command_id) {
  Shortcuts& state = State();
  if (!state.received || event.skip_if_unhandled) {
    return std::nullopt;
  }
  const std::string code = ui::KeycodeConverter::DomCodeToCodeString(
      static_cast<ui::DomCode>(event.dom_code));
  const int modifiers = Modifiers(event);
  if (event.GetType() != blink::WebInputEvent::Type::kRawKeyDown) {
    return std::nullopt;
  }
  const std::string combo = code + "|" + base::NumberToString(modifiers);
  if (state.active.contains(combo)) {
    HostWindowKey(browser, "shortcut", Describe(event, code, modifiers));
    return content::KeyboardEventProcessingResult::HANDLED;
  }
  if (command_id != -1 && state.owned.contains(combo)) {
    return content::KeyboardEventProcessingResult::NOT_HANDLED;
  }
  return std::nullopt;
}

#if defined(USE_AURA)
class KeyCapture : public ui::EventHandler, public aura::WindowObserver {
 public:
  KeyCapture(BrowserWindowInterface* browser, aura::Window* window)
      : browser_(browser), window_(window) {
    window_->AddPreTargetHandler(this);
    observation_.Observe(window_);
  }

  ~KeyCapture() override { Stop(); }

  void OnKeyEvent(ui::KeyEvent* event) override {
    if (!event->is_char()) {
      const int flags = event->flags();
      HostWindowKey(
          browser_, "key",
          base::DictValue()
              .Set("type", event->type() == ui::EventType::kKeyReleased
                               ? "keyup"
                               : "keydown")
              .Set("code",
                   ui::KeycodeConverter::DomCodeToCodeString(event->code()))
              .Set("key", ui::KeycodeConverter::DomKeyToKeyString(
                              event->GetDomKey()))
              .Set("mods", (flags & ui::EF_SHIFT_DOWN ? kShift : 0) |
                               (flags & ui::EF_CONTROL_DOWN ? kControl : 0) |
                               (flags & ui::EF_ALT_DOWN ? kAlt : 0) |
                               (flags & ui::EF_COMMAND_DOWN ? kMeta : 0)));
    }
    event->StopPropagation();
  }

  void OnWindowDestroying(aura::Window* window) override { Stop(); }

 private:
  void Stop() {
    if (window_) {
      window_->RemovePreTargetHandler(this);
      observation_.Reset();
      window_ = nullptr;
    }
  }

  raw_ptr<BrowserWindowInterface> browser_;
  raw_ptr<aura::Window> window_;
  base::ScopedObservation<aura::Window, aura::WindowObserver> observation_{
      this};
};

std::unique_ptr<KeyCapture>& Capture() {
  static base::NoDestructor<std::unique_ptr<KeyCapture>> capture;
  return *capture;
}
#endif

}

void InstallWindowKeys() {
  g_astro_window_key = &WindowKey;
}

void SetWindowShortcuts(std::vector<std::string> active,
                        std::vector<std::string> owned) {
  Shortcuts& state = State();
  state.received = true;
  state.active = std::set<std::string>(std::make_move_iterator(active.begin()),
                                       std::make_move_iterator(active.end()));
  state.owned = std::set<std::string>(std::make_move_iterator(owned.begin()),
                                      std::make_move_iterator(owned.end()));
}

void SetWindowKeyCapture(BrowserWindowInterface* browser, bool capture) {
#if defined(USE_AURA)
  Capture().reset();
  if (capture && browser && browser->GetWindow()) {
    if (aura::Window* window = browser->GetWindow()->GetNativeWindow()) {
      Capture() = std::make_unique<KeyCapture>(browser, window);
    }
  }
#endif
}

}
