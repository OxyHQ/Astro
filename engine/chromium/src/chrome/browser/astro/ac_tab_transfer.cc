// Copyright 2026 Oxy. Apache-2.0.

#include "chrome/browser/astro/ac_tab_transfer.h"

#include <map>
#include <memory>
#include <set>
#include <string_view>
#include <utility>

#include "base/memory/raw_ptr.h"
#include "base/no_destructor.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/utf_string_conversions.h"
#include "base/task/single_thread_task_runner.h"
#include "base/time/time.h"
#include "chrome/browser/astro/ac_profile_tabs.h"
#include "chrome/browser/ui/browser_tabstrip.h"
#include "chrome/browser/ui/browser_window/public/browser_window_interface.h"
#include "chrome/browser/ui/tabs/tab_enums.h"
#include "chrome/browser/ui/tabs/tab_model.h"
#include "chrome/browser/ui/tabs/tab_strip_model.h"
#include "components/guest_contents/browser/guest_contents_handle.h"
#include "components/tabs/public/tab_interface.h"
#include "content/public/browser/web_contents.h"
#include "url/gurl.h"
#include "url/url_constants.h"

namespace astro {
namespace {

constexpr char kProfileTabPrefix[] = "p:";
constexpr char kExtensionViewPrefix[] = "x:";
constexpr base::TimeDelta kHandOffWait = base::Milliseconds(1500);

struct Parked {
  std::string ref;
  tabs::TabHandle tab;
  int profile_tab = 0;
  raw_ptr<ProfileTabsClient> owner = nullptr;
  std::string to_window;
  bool orphan = false;
};

struct Live {
  raw_ptr<TabTransferPage> page;
  std::string ref;
};

struct Waiting {
  raw_ptr<TabTransferPage> page;
  base::OnceCallback<void(base::Value)> done;
  int generation = 0;
};

struct Transfers {
  std::map<std::string, Parked> parked;
  std::map<std::string, Live> live;
  std::map<std::string, Waiting> waiting;
  std::map<TabTransferPage*, std::string> windows;
  std::set<TabTransferPage*> pages;
  int generation = 0;
};

Transfers& State() {
  static base::NoDestructor<Transfers> state;
  return *state;
}

void Note(TabTransferPage* page) {
  State().pages.insert(page);
}

std::optional<int> ProfileTabId(std::string_view ref) {
  int id = 0;
  if (!ref.starts_with(kProfileTabPrefix) ||
      !base::StringToInt(ref.substr(sizeof(kProfileTabPrefix) - 1), &id) ||
      id <= 0) {
    return std::nullopt;
  }
  return id;
}

content::WebContents* ContentsOf(const Parked& parked) {
  if (parked.profile_tab) {
    return parked.owner
               ? ContentsForProfileTab(parked.owner, parked.profile_tab)
               : nullptr;
  }
  tabs::TabInterface* tab = parked.tab.Get();
  return tab ? tab->GetContents() : nullptr;
}

TabTransferPage* PageShowing(const std::string& window_id) {
  if (window_id.empty()) {
    return nullptr;
  }
  for (const auto& [page, shown] : State().windows) {
    if (shown == window_id) {
      return page;
    }
  }
  return nullptr;
}

bool MoveChromiumTab(tabs::TabInterface* tab, BrowserWindowInterface* to) {
  BrowserWindowInterface* from = tab->GetBrowserWindowInterface();
  if (!from || !to) {
    return false;
  }
  if (from == to) {
    return true;
  }
  if (from->GetProfile() != to->GetProfile() || to->IsDeleteScheduled()) {
    return false;
  }
  TabStripModel* source = from->GetTabStripModel();
  TabStripModel* target = to->GetTabStripModel();
  if (!source || !target || source->closing_all() || target->closing_all()) {
    return false;
  }
  const int index = source->GetIndexOfTab(tab);
  if (index == TabStripModel::kNoTab) {
    return false;
  }
  std::unique_ptr<tabs::TabModel> moved =
      source->DetachTabAtForInsertion(index);
  if (!moved) {
    return false;
  }
  target->InsertDetachedTabAt(target->count(), std::move(moved),
                              AddTabTypes::ADD_NONE);
  return true;
}

bool MoveParked(Parked& parked, TabTransferPage* to) {
  if (parked.profile_tab) {
    ProfileTabsClient* client = to->TransferClient();
    if (parked.owner == client) {
      return true;
    }
    if (!MoveProfileTab(parked.owner, client, parked.profile_tab)) {
      return false;
    }
    parked.owner = client;
    return true;
  }
  tabs::TabInterface* tab = parked.tab.Get();
  return tab && MoveChromiumTab(tab, to->TransferWindow());
}

bool MoveToKeeper(Parked& parked, BrowserWindowInterface* keeper) {
  tabs::TabInterface* tab = parked.tab.Get();
  if (!tab || !keeper || tab->GetBrowserWindowInterface() == keeper ||
      !MoveChromiumTab(tab, keeper)) {
    return false;
  }
  parked.orphan = false;
  return true;
}

void CloseParked(const Parked& parked) {
  if (parked.profile_tab) {
    if (parked.owner) {
      ProfileTabCommand(parked.owner, parked.profile_tab, "close",
                        std::string());
    }
    return;
  }
  tabs::TabInterface* tab = parked.tab.Get();
  BrowserWindowInterface* browser =
      tab ? tab->GetBrowserWindowInterface() : nullptr;
  TabStripModel* model = browser ? browser->GetTabStripModel() : nullptr;
  if (!model || model->closing_all()) {
    return;
  }
  const int index = model->GetIndexOfTab(tab);
  if (index != TabStripModel::kNoTab) {
    model->CloseWebContentsAt(index, TabCloseTypes::CLOSE_NONE);
  }
}

base::Value Complete(TabTransferPage* page, const std::string& key) {
  Transfers& state = State();
  auto found = state.parked.find(key);
  if (found == state.parked.end()) {
    return base::Value();
  }
  if (!ContentsOf(found->second)) {
    state.parked.erase(found);
    return base::Value();
  }
  if (!MoveParked(found->second, page)) {
    return base::Value();
  }
  Parked parked = std::move(found->second);
  state.parked.erase(found);
  content::WebContents* contents = ContentsOf(parked);
  if (!contents) {
    return base::Value();
  }
  if (auto* guest =
          guest_contents::GuestContentsHandle::FromWebContents(contents)) {
    guest->DetachFromOuterWebContents();
  }
  for (TabTransferPage* other : state.pages) {
    if (other != page) {
      other->TransferredAway(contents);
    }
  }
  state.live[key] = {page, parked.ref};
  return base::Value(
      base::DictValue()
          .Set("ref", parked.ref)
          .Set("url", contents->GetVisibleURL().spec())
          .Set("title", base::UTF16ToUTF8(contents->GetTitle())));
}

void AnswerWaiting(const std::string& key) {
  Transfers& state = State();
  auto found = state.waiting.find(key);
  if (found == state.waiting.end()) {
    return;
  }
  Waiting waiting = std::move(found->second);
  state.waiting.erase(found);
  std::move(waiting.done).Run(Complete(waiting.page, key));
}

void GiveUpWaiting(const std::string& key, int generation) {
  Transfers& state = State();
  auto found = state.waiting.find(key);
  if (found == state.waiting.end() || found->second.generation != generation) {
    return;
  }
  Waiting waiting = std::move(found->second);
  state.waiting.erase(found);
  std::move(waiting.done).Run(base::Value());
}

}

void NoteTransferWindow(TabTransferPage* page, const std::string& window_id) {
  Note(page);
  State().windows[page] = window_id;
}

void NoteLiveTab(TabTransferPage* page,
                 const std::string& key,
                 const std::string& ref) {
  Note(page);
  if (!key.empty() && !ref.empty()) {
    State().live[key] = {page, ref};
  }
}

void NoteTabGone(TabTransferPage* page, const std::string& key) {
  auto& live = State().live;
  auto found = live.find(key);
  if (found != live.end() && found->second.page == page) {
    live.erase(found);
  }
}

std::optional<std::string> ParkTab(TabTransferPage* page,
                                   const std::string& key,
                                   const std::string& ref,
                                   const std::string& to_window,
                                   bool keep_window) {
  Note(page);
  if (key.empty() || ref.starts_with(kExtensionViewPrefix)) {
    return std::nullopt;
  }
  content::WebContents* contents = page->TransferContents(ref);
  if (!contents) {
    return std::nullopt;
  }
  if (contents->WasDiscarded()) {
    contents->GetController().LoadIfNecessary();
  }
  Transfers& state = State();
  NoteTabGone(page, key);
  Parked parked{.ref = ref, .to_window = to_window};
  std::optional<std::string> spare;
  if (std::optional<int> profile_tab = ProfileTabId(ref)) {
    parked.profile_tab = *profile_tab;
    parked.owner = page->TransferClient();
  } else {
    tabs::TabInterface* tab =
        tabs::TabInterface::MaybeGetFromContents(contents);
    if (!tab) {
      return std::nullopt;
    }
    parked.tab = tab->GetHandle();
    parked.orphan = !keep_window;
    BrowserWindowInterface* window = page->TransferWindow();
    if (keep_window && window && tab->GetBrowserWindowInterface() == window &&
        window->GetTabStripModel()->count() == 1) {
      content::WebContents* blank = chrome::AddAndReturnTabAt(
          window, GURL(url::kAboutBlankURL), -1, false);
      tabs::TabInterface* blank_tab =
          blank ? tabs::TabInterface::MaybeGetFromContents(blank) : nullptr;
      if (blank_tab) {
        const size_t type = ref.find(':');
        spare = base::NumberToString(blank_tab->GetHandle().raw_value()) +
                (type == std::string::npos ? std::string() : ref.substr(type));
      }
    }
  }
  auto existing = state.parked.find(key);
  if (existing != state.parked.end() && existing->second.ref != ref) {
    CloseParked(existing->second);
  }
  state.parked[key] = std::move(parked);
  if (state.waiting.contains(key)) {
    AnswerWaiting(key);
  } else if (TabTransferPage* shown = PageShowing(to_window);
             shown && shown != page) {
    MoveParked(state.parked[key], shown);
  } else if (state.parked[key].orphan) {
    for (TabTransferPage* other : state.pages) {
      if (other != page &&
          MoveToKeeper(state.parked[key], other->TransferWindow())) {
        break;
      }
    }
  }
  return spare;
}

void TakeTab(TabTransferPage* page,
             const std::string& key,
             base::OnceCallback<void(base::Value)> done) {
  Note(page);
  Transfers& state = State();
  if (key.empty()) {
    std::move(done).Run(base::Value());
    return;
  }
  if (state.parked.contains(key)) {
    std::move(done).Run(Complete(page, key));
    return;
  }
  auto live = state.live.find(key);
  if (live == state.live.end() || live->second.page == page ||
      !live->second.page->TransferContents(live->second.ref)) {
    std::move(done).Run(base::Value());
    return;
  }
  auto earlier = state.waiting.find(key);
  if (earlier != state.waiting.end()) {
    base::OnceCallback<void(base::Value)> superseded =
        std::move(earlier->second.done);
    state.waiting.erase(earlier);
    std::move(superseded).Run(base::Value());
  }
  const int generation = ++state.generation;
  state.waiting[key] = {page, std::move(done), generation};
  base::SingleThreadTaskRunner::GetCurrentDefault()->PostDelayedTask(
      FROM_HERE, base::BindOnce(&GiveUpWaiting, key, generation), kHandOffWait);
}

void ReleaseTab(const std::string& key) {
  auto& parked = State().parked;
  auto found = parked.find(key);
  if (found == parked.end()) {
    return;
  }
  Parked released = std::move(found->second);
  parked.erase(found);
  CloseParked(released);
}

void KeepOrphanedTabs(BrowserWindowInterface* keeper) {
  for (auto& [key, parked] : State().parked) {
    if (parked.orphan) {
      MoveToKeeper(parked, keeper);
    }
  }
}

bool IsTabInTransit(const std::string& ref) {
  for (const auto& [key, parked] : State().parked) {
    if (parked.ref == ref) {
      return true;
    }
  }
  return false;
}

void ForgetTransferPage(TabTransferPage* page) {
  Transfers& state = State();
  state.pages.erase(page);
  state.windows.erase(page);
  std::erase_if(state.live, [page](const auto& entry) {
    return entry.second.page == page;
  });
  for (auto it = state.waiting.begin(); it != state.waiting.end();) {
    if (it->second.page == page) {
      it = state.waiting.erase(it);
    } else {
      ++it;
    }
  }
  ProfileTabsClient* client = page->TransferClient();
  for (auto it = state.parked.begin(); it != state.parked.end();) {
    Parked& parked = it->second;
    if (!parked.profile_tab || parked.owner != client) {
      ++it;
      continue;
    }
    TabTransferPage* keeper = PageShowing(parked.to_window);
    if (!keeper && !state.pages.empty()) {
      keeper = *state.pages.begin();
    }
    if (keeper && MoveParked(parked, keeper)) {
      ++it;
    } else {
      it = state.parked.erase(it);
    }
  }
}

}
