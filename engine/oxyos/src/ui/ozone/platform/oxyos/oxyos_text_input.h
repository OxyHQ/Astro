// Copyright 2026 Oxy. Apache-2.0.

#ifndef UI_OZONE_PLATFORM_OXYOS_OXYOS_TEXT_INPUT_H_
#define UI_OZONE_PLATFORM_OXYOS_OXYOS_TEXT_INPUT_H_

#include <cstdint>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include "oxyos_client.h"
#include "ui/base/ime/composition_text.h"
#include "ui/base/ime/linux/linux_input_method_context.h"
#include "ui/gfx/range/range.h"

namespace ui {

struct OxyOSFieldText {
  std::string text;
  uint32_t anchor = 0;
  uint32_t cursor = 0;

  friend bool operator==(const OxyOSFieldText&,
                         const OxyOSFieldText&) = default;
};

OxyOSFieldText OxyOSFieldTextFrom(const std::u16string& text,
                                  const gfx::Range& text_range,
                                  const gfx::Range& composition_range,
                                  const gfx::Range& selection_range);

struct OxyOSTextPurpose {
  uint8_t purpose = OXYOS_PURPOSE_NORMAL;
  uint32_t hints = 0;

  friend bool operator==(const OxyOSTextPurpose&,
                         const OxyOSTextPurpose&) = default;
};

OxyOSTextPurpose OxyOSTextPurposeOf(
    const LinuxInputMethodContext::TextInputClientAttributes& attributes);

struct OxyOSTextChange {
  OxyOSTextChange();
  OxyOSTextChange(const OxyOSTextChange&);
  OxyOSTextChange& operator=(const OxyOSTextChange&);
  ~OxyOSTextChange();

  size_t delete_before = 0;
  size_t delete_after = 0;
  std::u16string commit;
  std::optional<CompositionText> composition;
};

OxyOSFieldText OxyOSFieldTextAfter(const OxyOSFieldText& field,
                                   uint32_t delete_before,
                                   uint32_t delete_after,
                                   std::string_view commit);

struct OxyOSPreeditSpan {
  uint32_t begin = 0;
  uint32_t end = 0;
  uint8_t style = OXYOS_PREEDIT_COMPOSING;
};

OxyOSTextChange OxyOSTextChangeFrom(const OxyOSFieldText& field,
                                    uint32_t delete_before,
                                    uint32_t delete_after,
                                    std::string_view commit,
                                    std::string_view preedit,
                                    uint32_t cursor_begin,
                                    uint32_t cursor_end,
                                    const std::vector<OxyOSPreeditSpan>& spans);

}

#endif
