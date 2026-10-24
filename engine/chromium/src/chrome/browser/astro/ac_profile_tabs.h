// Copyright 2026 Oxy. Apache-2.0.

#ifndef CHROME_BROWSER_ASTRO_AC_PROFILE_TABS_H_
#define CHROME_BROWSER_ASTRO_AC_PROFILE_TABS_H_

#include <optional>
#include <string>

#include "base/functional/callback_forward.h"
#include "base/values.h"

class BrowserWindowInterface;
class GURL;
class Profile;

namespace content {
class WebContents;
}

namespace base {
class FilePath;
}

namespace astro {

class ProfileTabsClient {
 public:
  virtual void OnProfileTabChanged(int tab_id, base::DictValue state) = 0;
  virtual void OnProfileTabOpened(int tab_id,
                                  int opener_id,
                                  base::DictValue state) = 0;
  virtual void OnProfileTabClosed(int tab_id) = 0;

 protected:
  virtual ~ProfileTabsClient() = default;
};

base::Value ThemeColor(content::WebContents* contents);
std::optional<base::FilePath> ProfilePathForName(const std::string& name);
std::string ProfileNameForPath(const base::FilePath& path);
void WithProfile(const std::string& name,
                 base::OnceCallback<void(Profile*)> done);

void OpenProfileTab(ProfileTabsClient* client,
                    const std::string& profile_name,
                    const GURL& url,
                    base::OnceCallback<void(std::optional<int>)> done);
content::WebContents* ContentsForProfileTab(ProfileTabsClient* client,
                                            int tab_id);
std::optional<std::string> GuestIdForProfileTab(ProfileTabsClient* client,
                                                int tab_id);
bool MoveProfileTab(ProfileTabsClient* from,
                    ProfileTabsClient* to,
                    int tab_id);
void ProfileTabCommand(ProfileTabsClient* client,
                       int tab_id,
                       const std::string& command,
                       const std::string& arg);
void ForgetProfileTabsClient(ProfileTabsClient* client);
bool IsProfileTabHost(const BrowserWindowInterface* browser);
void CloseUnusedProfileTabHost(Profile* profile);

}

#endif
