// Copyright 2026 Oxy. Apache-2.0.

#include "chrome/browser/astro/ac_menu_bar.h"

#include <string>
#include <utility>
#include <vector>

#include "base/functional/bind.h"
#include "base/functional/callback.h"
#include "chrome/browser/ui/webui_browser/webui_browser_window.h"
#include "content/public/browser/web_contents.h"
#include "ui/aura/window.h"
#include "ui/aura/window_tree_host_platform.h"
#include "ui/ozone/platform/oxyos/oxyos_menu_bar.h"
#include "ui/views/widget/widget.h"

namespace astro {

namespace {

constexpr size_t kMostEntries = 256;

ui::OxyOSMenuBar* MenuBarOf(content::WebContents* page) {
  WebUIBrowserWindow* window =
      page ? WebUIBrowserWindow::FromWebShellWebContents(page) : nullptr;
  views::Widget* widget = window ? window->widget() : nullptr;
  aura::Window* native = widget ? widget->GetNativeWindow() : nullptr;
  aura::WindowTreeHost* host = native ? native->GetHost() : nullptr;
  if (!host) {
    return nullptr;
  }
  ui::PlatformWindow* platform =
      static_cast<aura::WindowTreeHostPlatform*>(host)->platform_window();
  return platform ? ui::GetOxyOSMenuBar(*platform) : nullptr;
}

std::optional<ui::OxyOSMenuEntry> EntryOf(const base::Value& value,
                                          size_t index) {
  const base::DictValue* dict = value.GetIfDict();
  if (!dict) {
    return std::nullopt;
  }
  const std::optional<int> parent = dict->FindInt("parent");
  const std::optional<int> kind = dict->FindInt("kind");
  if (!parent || !kind || *kind < 1 || *kind > 4 ||
      (*parent >= 0 && static_cast<size_t>(*parent) >= index)) {
    return std::nullopt;
  }
  ui::OxyOSMenuEntry entry;
  entry.parent =
      *parent < 0 ? ui::kOxyOSNoMenuParent : static_cast<uint32_t>(*parent);
  entry.kind = static_cast<ui::OxyOSMenuKind>(*kind);
  if (dict->FindBool("disabled").value_or(false)) {
    entry.flags |= ui::kOxyOSMenuDisabled;
  }
  if (const std::optional<bool> checked = dict->FindBool("checked")) {
    entry.flags |= ui::kOxyOSMenuCheckable;
    if (*checked) {
      entry.flags |= ui::kOxyOSMenuChecked;
    }
  }
  if (const std::string* label = dict->FindString("label")) {
    entry.label = *label;
  }
  if (const std::string* shortcut = dict->FindString("shortcut")) {
    entry.shortcut = *shortcut;
  }
  return entry;
}

}

bool SetWindowMenuBar(content::WebContents* page,
                      const base::ListValue& entries,
                      base::RepeatingCallback<void(int index)> activated) {
  ui::OxyOSMenuBar* menu_bar = MenuBarOf(page);
  if (!menu_bar || entries.size() > kMostEntries) {
    return false;
  }
  std::vector<ui::OxyOSMenuEntry> menus;
  menus.reserve(entries.size());
  for (size_t i = 0; i < entries.size(); ++i) {
    std::optional<ui::OxyOSMenuEntry> entry = EntryOf(entries[i], i);
    if (!entry) {
      return false;
    }
    menus.push_back(std::move(*entry));
  }
  return menu_bar->SetMenus(
      std::move(menus),
      base::BindRepeating(
          [](base::RepeatingCallback<void(int)> activated, uint32_t index) {
            activated.Run(static_cast<int>(index));
          },
          std::move(activated)));
}

bool RunEditCommand(content::WebContents* page, const std::string& command) {
  if (!page) {
    return false;
  }
  if (command == "undo") {
    page->Undo();
  } else if (command == "redo") {
    page->Redo();
  } else if (command == "cut") {
    page->Cut();
  } else if (command == "copy") {
    page->Copy();
  } else if (command == "paste") {
    page->Paste();
  } else if (command == "pasteAndMatchStyle") {
    page->PasteAndMatchStyle();
  } else if (command == "delete") {
    page->Delete();
  } else if (command == "selectAll") {
    page->SelectAll();
  } else {
    return false;
  }
  return true;
}

}
