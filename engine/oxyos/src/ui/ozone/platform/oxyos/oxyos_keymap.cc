// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_keymap.h"

#include <xkbcommon/xkbcommon.h>

#include <cstdlib>
#include <memory>
#include <vector>

#include "base/memory/free_deleter.h"
#include "base/strings/string_split.h"
#include "ui/events/keycodes/scoped_xkb.h"

namespace ui {

std::optional<std::string> OxyOSKeymapFromNames(std::string_view names) {
  const std::vector<std::string> parts = base::SplitString(
      names, "\t", base::KEEP_WHITESPACE, base::SPLIT_WANT_ALL);
  if (parts.empty() || parts[0].empty()) {
    return std::nullopt;
  }
  auto part = [&parts](size_t index) -> const char* {
    return index < parts.size() && !parts[index].empty() ? parts[index].c_str()
                                                         : nullptr;
  };
  std::unique_ptr<xkb_context, XkbContextDeleter> context(
      xkb_context_new(XKB_CONTEXT_NO_FLAGS));
  if (!context) {
    return std::nullopt;
  }
  const xkb_rule_names rule_names = {
      .rules = nullptr,
      .model = nullptr,
      .layout = part(0),
      .variant = part(1),
      .options = part(2),
  };
  std::unique_ptr<xkb_keymap, XkbKeymapDeleter> keymap(
      xkb_keymap_new_from_names(context.get(), &rule_names,
                                XKB_KEYMAP_COMPILE_NO_FLAGS));
  if (!keymap) {
    return std::nullopt;
  }
  std::unique_ptr<char, base::FreeDeleter> text(
      xkb_keymap_get_as_string(keymap.get(), XKB_KEYMAP_FORMAT_TEXT_V1));
  if (!text) {
    return std::nullopt;
  }
  return std::string(text.get());
}

}
