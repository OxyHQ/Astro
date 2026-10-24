// Copyright 2026 Oxy. Apache-2.0.

#ifndef CHROME_BROWSER_ASTRO_AC_TAB_TRANSFER_H_
#define CHROME_BROWSER_ASTRO_AC_TAB_TRANSFER_H_

#include <optional>
#include <string>

#include "base/functional/callback.h"
#include "base/values.h"

class BrowserWindowInterface;

namespace content {
class WebContents;
}

namespace astro {

class ProfileTabsClient;

class TabTransferPage {
 public:
  virtual BrowserWindowInterface* TransferWindow() = 0;
  virtual ProfileTabsClient* TransferClient() = 0;
  virtual content::WebContents* TransferContents(const std::string& ref) = 0;
  virtual void TransferredAway(content::WebContents* contents) = 0;

 protected:
  virtual ~TabTransferPage() = default;
};

void NoteTransferWindow(TabTransferPage* page, const std::string& window_id);
void NoteLiveTab(TabTransferPage* page,
                 const std::string& key,
                 const std::string& ref);
void NoteTabGone(TabTransferPage* page, const std::string& key);
std::optional<std::string> ParkTab(TabTransferPage* page,
                                   const std::string& key,
                                   const std::string& ref,
                                   const std::string& to_window,
                                   bool keep_window);
void TakeTab(TabTransferPage* page,
             const std::string& key,
             base::OnceCallback<void(base::Value)> done);
void ReleaseTab(const std::string& key);
void KeepOrphanedTabs(BrowserWindowInterface* keeper);
bool IsTabInTransit(const std::string& ref);
void ForgetTransferPage(TabTransferPage* page);

}

#endif
