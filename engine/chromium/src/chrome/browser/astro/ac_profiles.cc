// Copyright 2026 Oxy. Apache-2.0.

#include "chrome/browser/astro/ac_profiles.h"

#include <optional>
#include <utility>

#include "base/files/file_path.h"
#include "base/files/file_util.h"
#include "base/functional/bind.h"
#include "base/functional/callback_helpers.h"
#include "base/task/thread_pool.h"
#include "base/time/time.h"
#include "chrome/browser/astro/ac_profile_tabs.h"
#include "chrome/browser/browser_process.h"
#include "chrome/browser/profiles/delete_profile_helper.h"
#include "chrome/browser/profiles/nuke_profile_directory_utils.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/profiles/profile_attributes_storage.h"
#include "chrome/browser/profiles/profile_destroyer.h"
#include "chrome/browser/profiles/profile_manager.h"
#include "chrome/browser/profiles/profile_metrics.h"
#include "chrome/browser/ui/browser_window/public/browser_window_interface.h"
#include "chrome/browser/ui/browser_window/public/desktop_browser_window_capabilities.h"
#include "chrome/browser/ui/browser_window/public/global_browser_collection.h"
#include "content/public/browser/browser_task_traits.h"
#include "content/public/browser/browser_thread.h"

namespace astro {
namespace {

base::Value Remaining(const char* what = nullptr) {
  base::ListValue list;
  if (what) {
    list.Append(what);
  }
  return base::Value(std::move(list));
}

constexpr base::TaskTraits kDiskTraits = {
    base::MayBlock(), base::TaskPriority::BEST_EFFORT,
    base::TaskShutdownBehavior::SKIP_ON_SHUTDOWN};

void RemoveDirectoryOnceUnloaded(const base::FilePath& dir) {
  if (!IsProfileDirectoryMarkedForDeletion(dir) ||
      g_browser_process->profile_manager()->GetProfileByPath(dir)) {
    return;
  }
  base::ThreadPool::PostTask(
      FROM_HERE, kDiskTraits,
      base::BindOnce(base::IgnoreResult(&base::DeletePathRecursively), dir));
}

bool HasOpenBrowser(Profile* profile) {
  bool open = false;
  GlobalBrowserCollection::GetInstance()->ForEach(
      [&](BrowserWindowInterface* browser) {
        open |= browser->GetProfile() == profile &&
                !browser->capabilities()->IsAttemptingToCloseBrowser();
        return !open;
      });
  return open;
}

}

void ReleaseProfile(const std::string& name) {
  const size_t at = name.find('@');
  ProfileManager* manager = g_browser_process->profile_manager();
  if (at == std::string::npos || !manager) {
    return;
  }
  std::optional<base::FilePath> path = ProfilePathForName(name.substr(at + 1));
  Profile* original = path ? manager->GetProfileByPath(*path) : nullptr;
  if (!original || !original->HasPrimaryOTRProfile()) {
    return;
  }
  Profile* off_the_record = original->GetPrimaryOTRProfile(false);
  CloseUnusedProfileTabHost(off_the_record);
  if (!HasOpenBrowser(off_the_record)) {
    ProfileDestroyer::DestroyOTRProfileWhenAppropriate(off_the_record);
  }
}

void DeleteProfileData(const std::string& name,
                       base::OnceCallback<void(base::Value)> done) {
  if (name.find('@') != std::string::npos) {
    return std::move(done).Run(Remaining());
  }
  ProfileManager* manager = g_browser_process->profile_manager();
  std::optional<base::FilePath> path =
      name.empty() ? std::nullopt : ProfilePathForName(name);
  if (!manager || !path ||
      *path == manager->user_data_dir().Append(
                   ProfileManager::GetInitialProfileDir())) {
    return std::move(done).Run(Remaining("data"));
  }
  Profile* loaded = manager->GetProfileByPath(*path);
  if (!loaded && !manager->GetProfileAttributesStorage()
                      .GetProfileAttributesWithPath(*path)) {
    base::ThreadPool::PostTaskAndReplyWithResult(
        FROM_HERE, kDiskTraits,
        base::BindOnce(
            [](const base::FilePath& dir) {
              base::DeletePathRecursively(dir);
              return !base::PathExists(dir);
            },
            *path),
        base::BindOnce(
            [](base::OnceCallback<void(base::Value)> done, bool removed) {
              std::move(done).Run(Remaining(removed ? nullptr : "files"));
            },
            std::move(done)));
    return;
  }
  manager->GetDeleteProfileHelper().MaybeScheduleProfileForDeletion(
      *path, base::DoNothing(), ProfileMetrics::DELETE_PROFILE_SETTINGS);
  if (Profile* still_loaded = manager->GetProfileByPath(*path)) {
    manager->ClearFirstBrowserWindowKeepAlive(still_loaded);
  }
  for (const base::TimeDelta delay : {base::Seconds(2), base::Seconds(10)}) {
    content::GetUIThreadTaskRunner({})->PostDelayedTask(
        FROM_HERE, base::BindOnce(&RemoveDirectoryOnceUnloaded, *path), delay);
  }
  std::move(done).Run(Remaining());
}

}
