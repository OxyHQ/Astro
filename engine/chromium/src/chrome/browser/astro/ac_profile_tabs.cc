// Copyright 2026 Oxy. Apache-2.0.

#include "chrome/browser/astro/ac_profile_tabs.h"

#include <map>
#include <memory>
#include <utility>

#include "base/base64.h"
#include "base/callback_list.h"
#include "base/files/file_path.h"
#include "base/memory/raw_ptr.h"
#include "base/memory/ref_counted_memory.h"
#include "base/no_destructor.h"
#include "base/scoped_observation.h"
#include "base/strings/string_util.h"
#include "chrome/browser/browser_process.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/profiles/profile_manager.h"
#include "chrome/browser/ui/browser_tabstrip.h"
#include "chrome/browser/ui/browser_window/public/browser_window_interface.h"
#include "chrome/browser/ui/browser_window/public/create_browser_window.h"
#include "chrome/browser/ui/tabs/tab_strip_model.h"
#include "chrome/browser/ui/tabs/tab_strip_model_observer.h"
#include "components/favicon/content/content_favicon_driver.h"
#include "components/favicon/core/favicon_driver_observer.h"
#include "components/guest_contents/browser/guest_contents_handle.h"
#include "components/tabs/public/tab_interface.h"
#include "content/public/browser/navigation_controller.h"
#include "content/public/browser/web_contents.h"
#include "content/public/browser/web_contents_observer.h"
#include "ui/base/page_transition_types.h"
#include "ui/gfx/image/image.h"
#include "url/gurl.h"

namespace astro {
namespace {

constexpr char kDefaultDir[] = "Default";
constexpr char kProfileDirPrefix[] = "Profile ";

bool ValidName(const std::string& name) {
  if (name.empty() || name.size() > 64) {
    return false;
  }
  for (char c : name) {
    if (!base::IsAsciiAlphaNumeric(c) && c != '-' && c != '_') {
      return false;
    }
  }
  return true;
}

class TrackedTab;
class HostBrowser;

int g_next_tab_id = 1;

std::map<int, std::unique_ptr<TrackedTab>>& Tabs() {
  static base::NoDestructor<std::map<int, std::unique_ptr<TrackedTab>>> tabs;
  return *tabs;
}

std::map<base::FilePath, std::unique_ptr<HostBrowser>>& Hosts() {
  static base::NoDestructor<std::map<base::FilePath, std::unique_ptr<HostBrowser>>>
      hosts;
  return *hosts;
}

TrackedTab* TabFor(content::WebContents* contents);

class TrackedTab : public content::WebContentsObserver,
                   public favicon::FaviconDriverObserver {
 public:
  TrackedTab(int id,
             ProfileTabsClient* client,
             content::WebContents* contents,
             BrowserWindowInterface* host)
      : content::WebContentsObserver(contents),
        id_(id),
        client_(client),
        host_(host) {
    if (auto* driver =
            favicon::ContentFaviconDriver::FromWebContents(contents)) {
      favicon_observation_.Observe(driver);
    }
  }

  int id() const { return id_; }
  ProfileTabsClient* client() const { return client_; }
  BrowserWindowInterface* host() const { return host_; }

  base::DictValue State() {
    content::WebContents* contents = web_contents();
    if (!contents) {
      return base::DictValue();
    }
    content::NavigationController& controller = contents->GetController();
    return base::DictValue()
        .Set("url", contents->GetVisibleURL().spec())
        .Set("title", contents->GetTitle())
        .Set("loading", contents->IsLoading())
        .Set("canGoBack", controller.CanGoBack())
        .Set("canGoForward", controller.CanGoForward())
        .Set("favicon", favicon_);
  }

  void Report() { client_->OnProfileTabChanged(id_, State()); }

  void DidFinishNavigation(content::NavigationHandle*) override { Report(); }
  void TitleWasSet(content::NavigationEntry*) override { Report(); }
  void DidStartLoading() override { Report(); }
  void DidStopLoading() override { Report(); }

  void OnFaviconUpdated(favicon::FaviconDriver*,
                        NotificationIconType icon_type,
                        const GURL&,
                        bool,
                        const gfx::Image& image) override {
    if (icon_type != NON_TOUCH_16_DIP || image.IsEmpty()) {
      return;
    }
    scoped_refptr<base::RefCountedMemory> png = image.As1xPNGBytes();
    if (!png || !png->size()) {
      return;
    }
    favicon_ = "data:image/png;base64," + base::Base64Encode(*png);
    Report();
  }

 private:
  const int id_;
  raw_ptr<ProfileTabsClient> client_;
  raw_ptr<BrowserWindowInterface> host_;
  std::string favicon_;
  base::ScopedObservation<favicon::FaviconDriver,
                          favicon::FaviconDriverObserver>
      favicon_observation_{this};
};

TrackedTab* TabFor(content::WebContents* contents) {
  for (auto& [id, tab] : Tabs()) {
    if (tab->web_contents() == contents) {
      return tab.get();
    }
  }
  return nullptr;
}

std::optional<int> Track(ProfileTabsClient* client,
                         content::WebContents* contents,
                         BrowserWindowInterface* host) {
  if (!contents) {
    return std::nullopt;
  }
  guest_contents::GuestContentsHandle::CreateForWebContents(contents);
  const int id = g_next_tab_id++;
  Tabs()[id] = std::make_unique<TrackedTab>(id, client, contents, host);
  return id;
}

class HostBrowser : public TabStripModelObserver {
 public:
  explicit HostBrowser(BrowserWindowInterface* browser) : browser_(browser) {
    browser->GetTabStripModel()->AddObserver(this);
    closed_ = browser->RegisterBrowserDidClose(base::BindRepeating(
        &HostBrowser::Closed, base::Unretained(this)));
  }

  ~HostBrowser() override {
    if (browser_) {
      browser_->GetTabStripModel()->RemoveObserver(this);
    }
  }

  BrowserWindowInterface* browser() const { return browser_; }

  std::optional<int> Open(ProfileTabsClient* client, const GURL& url) {
    opening_ = true;
    content::WebContents* contents =
        chrome::AddAndReturnTabAt(browser_, url, -1, false);
    opening_ = false;
    return Track(client, contents, browser_);
  }

  void OnTabStripModelChanged(TabStripModel* model,
                              const TabStripModelChange& change,
                              const TabStripSelectionChange&) override {
    if (change.type() == TabStripModelChange::kInserted && !opening_) {
      for (const auto& inserted : change.GetInsert()->contents) {
        if (TabFor(inserted.contents)) {
          continue;
        }
        TrackedTab* opener = nullptr;
        if (tabs::TabInterface* opener_tab =
                model->GetOpenerOfTabAt(inserted.index)) {
          opener = TabFor(opener_tab->GetContents());
        }
        if (!opener) {
          for (auto& [id, tab] : Tabs()) {
            if (tab->host() == browser_) {
              opener = tab.get();
              break;
            }
          }
        }
        if (!opener) {
          continue;
        }
        std::optional<int> id = Track(opener->client(), inserted.contents, browser_);
        if (id) {
          opener->client()->OnProfileTabOpened(*id, opener->id(),
                                               Tabs()[*id]->State());
        }
      }
    }
    if (change.type() == TabStripModelChange::kRemoved) {
      for (const auto& removed : change.GetRemove()->contents) {
        TrackedTab* tab =
            removed.tab ? TabFor(removed.tab->GetContents()) : nullptr;
        if (!tab) {
          continue;
        }
        const int id = tab->id();
        ProfileTabsClient* client = tab->client();
        Tabs().erase(id);
        client->OnProfileTabClosed(id);
      }
    }
  }

 private:
  void Closed(BrowserWindowInterface*) {
    browser_->GetTabStripModel()->RemoveObserver(this);
    for (auto it = Tabs().begin(); it != Tabs().end();) {
      if (it->second->host() == browser_) {
        ProfileTabsClient* client = it->second->client();
        const int id = it->first;
        it = Tabs().erase(it);
        client->OnProfileTabClosed(id);
      } else {
        ++it;
      }
    }
    browser_ = nullptr;
    for (auto it = Hosts().begin(); it != Hosts().end(); ++it) {
      if (it->second.get() == this) {
        Hosts().erase(it);
        return;
      }
    }
  }

  raw_ptr<BrowserWindowInterface> browser_;
  base::CallbackListSubscription closed_;
  bool opening_ = false;
};

HostBrowser* HostFor(Profile* profile) {
  auto found = Hosts().find(profile->GetPath());
  if (found != Hosts().end() && found->second->browser()) {
    return found->second.get();
  }
  BrowserWindowCreateParams params(*profile, false);
  params.omit_from_session_restore = true;
  BrowserWindowInterface* browser = CreateBrowserWindow(std::move(params));
  if (!browser) {
    return nullptr;
  }
  auto host = std::make_unique<HostBrowser>(browser);
  HostBrowser* raw = host.get();
  Hosts()[profile->GetPath()] = std::move(host);
  return raw;
}

TrackedTab* OwnedTab(ProfileTabsClient* client, int tab_id) {
  auto found = Tabs().find(tab_id);
  return found != Tabs().end() && found->second->client() == client
             ? found->second.get()
             : nullptr;
}

}

std::optional<base::FilePath> ProfilePathForName(const std::string& name) {
  ProfileManager* manager = g_browser_process->profile_manager();
  if (!manager) {
    return std::nullopt;
  }
  if (name.empty()) {
    return manager->user_data_dir().AppendASCII(kDefaultDir);
  }
  if (!ValidName(name)) {
    return std::nullopt;
  }
  return manager->user_data_dir().AppendASCII(kProfileDirPrefix + name);
}

std::string ProfileNameForPath(const base::FilePath& path) {
  const std::string base = path.BaseName().AsUTF8Unsafe();
  return base::StartsWith(base, kProfileDirPrefix)
             ? base.substr(sizeof(kProfileDirPrefix) - 1)
             : std::string();
}

void WithProfile(const std::string& name,
                 base::OnceCallback<void(Profile*)> done) {
  std::optional<base::FilePath> path = ProfilePathForName(name);
  if (!path) {
    std::move(done).Run(nullptr);
    return;
  }
  g_browser_process->profile_manager()->CreateProfileAsync(*path,
                                                           std::move(done));
}

void OpenProfileTab(ProfileTabsClient* client,
                    const std::string& profile_name,
                    const GURL& url,
                    base::OnceCallback<void(std::optional<int>)> done) {
  if (profile_name.empty()) {
    std::move(done).Run(std::nullopt);
    return;
  }
  WithProfile(profile_name,
              base::BindOnce(
                  [](ProfileTabsClient* client, GURL url,
                     base::OnceCallback<void(std::optional<int>)> done,
                     Profile* profile) {
                    HostBrowser* host = profile ? HostFor(profile) : nullptr;
                    std::move(done).Run(host ? host->Open(client, url)
                                             : std::nullopt);
                  },
                  client, url.is_valid() ? url : GURL("about:blank"),
                  std::move(done)));
}

std::optional<std::string> GuestIdForProfileTab(ProfileTabsClient* client,
                                                int tab_id) {
  TrackedTab* tab = OwnedTab(client, tab_id);
  if (!tab || !tab->web_contents()) {
    return std::nullopt;
  }
  auto* handle = guest_contents::GuestContentsHandle::FromWebContents(
      tab->web_contents());
  return handle ? std::optional<std::string>(handle->id().ToString())
                : std::nullopt;
}

void ProfileTabCommand(ProfileTabsClient* client,
                       int tab_id,
                       const std::string& command,
                       const std::string& arg) {
  TrackedTab* tab = OwnedTab(client, tab_id);
  if (!tab || !tab->web_contents()) {
    return;
  }
  content::WebContents* contents = tab->web_contents();
  content::NavigationController& controller = contents->GetController();
  if (command == "navigate") {
    GURL url(arg);
    if (url.is_valid()) {
      controller.LoadURL(url, content::Referrer(), ui::PAGE_TRANSITION_TYPED,
                         std::string());
    }
  } else if (command == "back" && controller.CanGoBack()) {
    controller.GoBack();
  } else if (command == "forward" && controller.CanGoForward()) {
    controller.GoForward();
  } else if (command == "reload") {
    controller.Reload(content::ReloadType::NORMAL, true);
  } else if (command == "stop") {
    contents->Stop();
  } else if (command == "activate" || command == "close") {
    TabStripModel* model = tab->host()->GetTabStripModel();
    const int index = model->GetIndexOfWebContents(contents);
    if (index == TabStripModel::kNoTab) {
      return;
    }
    if (command == "activate") {
      model->ActivateTabAt(index);
    } else {
      model->CloseWebContentsAt(index, TabCloseTypes::CLOSE_USER_GESTURE);
    }
  } else if (command == "report") {
    tab->Report();
  }
}

void ForgetProfileTabsClient(ProfileTabsClient* client) {
  std::vector<std::pair<BrowserWindowInterface*, content::WebContents*>> owned;
  for (auto it = Tabs().begin(); it != Tabs().end();) {
    if (it->second->client() == client) {
      if (it->second->web_contents()) {
        owned.emplace_back(it->second->host(), it->second->web_contents());
      }
      it = Tabs().erase(it);
    } else {
      ++it;
    }
  }
  for (auto [host, contents] : owned) {
    TabStripModel* model = host->GetTabStripModel();
    const int index = model->GetIndexOfWebContents(contents);
    if (index != TabStripModel::kNoTab) {
      model->CloseWebContentsAt(index, TabCloseTypes::CLOSE_NONE);
    }
  }
}

}
