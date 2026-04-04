// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_ADBLOCK_ASTRO_ADBLOCK_TAB_HELPER_H_
#define CHROME_BROWSER_OXY_ADBLOCK_ASTRO_ADBLOCK_TAB_HELPER_H_

#include <set>
#include <string>

#include "base/observer_list.h"
#include "content/public/browser/web_contents_observer.h"
#include "content/public/browser/web_contents_user_data.h"
#include "url/gurl.h"

namespace oxy::adblock {

// Per-tab helper that tracks ad blocking state for the current page:
// - Counts blocked requests for badge display
// - Injects cosmetic filter CSS on page load
// - Notifies observers (toolbar button) when state changes
class AstroAdBlockTabHelper
    : public content::WebContentsObserver,
      public content::WebContentsUserData<AstroAdBlockTabHelper> {
 public:
  class Observer : public base::CheckedObserver {
   public:
    // Called when the blocked resource count changes.
    virtual void OnBlockedCountChanged(int count) {}
    // Called when ad blocking enabled state changes for this tab.
    virtual void OnAdBlockEnabledChanged(bool enabled) {}
  };

  ~AstroAdBlockTabHelper() override;

  AstroAdBlockTabHelper(const AstroAdBlockTabHelper&) = delete;
  AstroAdBlockTabHelper& operator=(const AstroAdBlockTabHelper&) = delete;

  // Returns the total number of blocked resources on the current page.
  int GetTotalBlockedCount() const;

  // Returns the set of blocked ad URLs for the current page.
  const std::set<GURL>& GetBlockedAdsList() const;

  // Called by the URLLoaderThrottle when a request is blocked.
  void OnResourceBlocked(const GURL& blocked_url);

  // Observer management.
  void AddObserver(Observer* observer);
  void RemoveObserver(Observer* observer);

 private:
  friend class content::WebContentsUserData<AstroAdBlockTabHelper>;

  explicit AstroAdBlockTabHelper(content::WebContents* web_contents);

  // content::WebContentsObserver:
  void PrimaryPageChanged(content::Page& page) override;
  void DidFinishNavigation(
      content::NavigationHandle* navigation_handle) override;
  void WebContentsDestroyed() override;

  // Injects cosmetic filter CSS into the page.
  void InjectCosmeticFilters(const GURL& url);

  // Resets per-page state (blocked count, URL lists).
  void ResetPageState();

  // Notifies observers of blocked count change.
  void NotifyBlockedCountChanged();

  // Per-page blocked resources.
  std::set<GURL> blocked_ads_;
  int blocked_count_ = 0;

  base::ObserverList<Observer> observers_;

  WEB_CONTENTS_USER_DATA_KEY_DECL();
};

}  // namespace oxy::adblock

#endif  // CHROME_BROWSER_OXY_ADBLOCK_ASTRO_ADBLOCK_TAB_HELPER_H_
