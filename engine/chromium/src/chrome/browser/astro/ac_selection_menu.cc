// Copyright 2026 Oxy. Apache-2.0.

#include "chrome/browser/astro/ac_selection_menu.h"

#include <string>
#include <vector>

#include "base/no_destructor.h"
#include "base/strings/string_util.h"
#include "base/strings/utf_string_conversions.h"
#include "chrome/browser/astro/ac_host.h"
#include "content/public/browser/web_contents.h"
#include "ui/events/event_constants.h"

extern std::vector<std::u16string> (*g_astro_selection_items)(
    content::WebContents* contents,
    const std::u16string& printable_selection);
extern void (*g_astro_selection_item_run)(content::WebContents* contents,
                                          size_t index,
                                          const std::u16string& selection,
                                          int event_flags);

namespace astro {

namespace {

constexpr size_t kMaxItems = 8;

struct Item {
  std::string id;
  std::u16string title;
};

std::vector<Item>& Items() {
  static base::NoDestructor<std::vector<Item>> items;
  return *items;
}

std::vector<std::u16string> SelectionItems(
    content::WebContents* contents,
    const std::u16string& printable_selection) {
  std::vector<std::u16string> titles;
  if (!HostShowsTab(contents)) {
    return titles;
  }
  for (const Item& item : Items()) {
    titles.push_back(base::ReplaceStringPlaceholders(
        item.title, printable_selection, nullptr));
  }
  return titles;
}

void RunSelectionItem(content::WebContents* contents,
                      size_t index,
                      const std::u16string& selection,
                      int event_flags) {
  if (index >= Items().size() || !HostShowsTab(contents)) {
    return;
  }
  HostTabEvent(
      contents, "command",
      base::DictValue()
          .Set("command", Items()[index].id)
          .Set("text", base::UTF16ToUTF8(selection))
          .Set("modifiers",
               base::DictValue()
                   .Set("metaKey", (event_flags & ui::EF_CONTROL_DOWN) != 0)
                   .Set("shiftKey", (event_flags & ui::EF_SHIFT_DOWN) != 0)
                   .Set("altKey", (event_flags & ui::EF_ALT_DOWN) != 0)));
}

}

void SetSelectionMenuItems(const base::ListValue& items) {
  std::vector<Item>& stored = Items();
  stored.clear();
  for (const base::Value& value : items) {
    const base::DictValue* item = value.GetIfDict();
    const std::string* id = item ? item->FindString("id") : nullptr;
    const std::string* title = item ? item->FindString("title") : nullptr;
    if (!id || !title || id->empty() || title->empty() ||
        stored.size() == kMaxItems) {
      continue;
    }
    stored.push_back({*id, base::UTF8ToUTF16(*title)});
  }
}

void InstallSelectionMenu() {
  g_astro_selection_items = &SelectionItems;
  g_astro_selection_item_run = &RunSelectionItem;
}

}
