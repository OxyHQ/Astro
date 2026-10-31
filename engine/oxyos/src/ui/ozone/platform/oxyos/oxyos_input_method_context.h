// Copyright 2026 Oxy. Apache-2.0.

#ifndef UI_OZONE_PLATFORM_OXYOS_OXYOS_INPUT_METHOD_CONTEXT_H_
#define UI_OZONE_PLATFORM_OXYOS_OXYOS_INPUT_METHOD_CONTEXT_H_

#include <cstdint>
#include <optional>
#include <string>

#include "base/memory/raw_ptr.h"
#include "oxyos_client.h"
#include "ui/base/ime/linux/linux_input_method_context.h"
#include "ui/gfx/geometry/rect.h"
#include "ui/ozone/platform/oxyos/oxyos_text_input.h"

namespace ui {

class OxyOSConnection;

class OxyOSInputMethodContext : public LinuxInputMethodContext {
 public:
  OxyOSInputMethodContext(OxyOSConnection* connection,
                          LinuxInputMethodContextDelegate* delegate);
  OxyOSInputMethodContext(const OxyOSInputMethodContext&) = delete;
  OxyOSInputMethodContext& operator=(const OxyOSInputMethodContext&) = delete;
  ~OxyOSInputMethodContext() override;

  uint32_t surface() const;
  void OnTransaction(const OxyOSTextTransaction& transaction);

  bool DispatchKeyEvent(const KeyEvent& key_event) override;
  bool IsPeekKeyEvent(const KeyEvent& key_event) override;
  void SetCursorLocation(const gfx::Rect& rect) override;
  void SetSurroundingText(const std::u16string& text,
                          const gfx::Range& text_range,
                          const gfx::Range& composition_range,
                          const gfx::Range& selection_range) override;
  void Reset() override;
  void UpdateFocus(bool has_client,
                   TextInputType old_type,
                   const TextInputClientAttributes& new_client_attributes,
                   TextInputClient::FocusReason reason) override;
  VirtualKeyboardController* GetVirtualKeyboardController() override;

 private:
  void Send(bool new_field);
  void Disable();

  const raw_ptr<OxyOSConnection> connection_;
  const raw_ptr<LinuxInputMethodContextDelegate> delegate_;
  bool enabled_ = false;
  bool composing_ = false;
  OxyOSTextPurpose purpose_;
  OxyOSFieldText field_;
  std::optional<gfx::Rect> caret_;
  uint32_t commit_serial_ = 0;
};

}

#endif
