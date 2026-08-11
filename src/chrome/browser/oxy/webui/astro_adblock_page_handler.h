// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_WEBUI_ASTRO_ADBLOCK_PAGE_HANDLER_H_
#define CHROME_BROWSER_OXY_WEBUI_ASTRO_ADBLOCK_PAGE_HANDLER_H_

#include <string>
#include <vector>

#include "base/memory/raw_ptr.h"
#include "chrome/browser/oxy/webui/astro_adblock.mojom.h"
#include "components/prefs/pref_change_registrar.h"
#include "mojo/public/cpp/bindings/pending_receiver.h"
#include "mojo/public/cpp/bindings/pending_remote.h"
#include "mojo/public/cpp/bindings/receiver.h"
#include "mojo/public/cpp/bindings/remote.h"

class Profile;

namespace astro {

// The browser side of astro_adblock.mojom, for one ad blocker page.
//
// Owned by AstroAdBlockUI, which the WebContents outlives, so the profile
// pointer is held for the handler's whole life.
//
// Every read here goes to the PROFILE'S PREFS rather than to a copy: the four
// values this page shows are all preferences, and the observers below are what
// make a count that climbed in another tab, or an exception the toolbar bubble
// removed, arrive here without the page asking again.
class AstroAdBlockPageHandler : public adblock::mojom::PageHandler {
 public:
  AstroAdBlockPageHandler(
      Profile* profile,
      mojo::PendingRemote<adblock::mojom::Page> page,
      mojo::PendingReceiver<adblock::mojom::PageHandler> receiver);
  ~AstroAdBlockPageHandler() override;

  AstroAdBlockPageHandler(const AstroAdBlockPageHandler&) = delete;
  AstroAdBlockPageHandler& operator=(const AstroAdBlockPageHandler&) = delete;

  // The most custom-rule text the browser will store.
  //
  // A bound rather than none, for the same reason the new tab page bounds its
  // note: this is a profile preference a page can write, so without one a page
  // can make the preference store grow without limit. 64 KiB is generous
  // against what it is for — EasyList's own syntax, by hand — and small against
  // a pref file.
  static constexpr size_t kMaxCustomRulesLength = 64 * 1024;

 private:
  // adblock::mojom::PageHandler:
  void GetState(GetStateCallback callback) override;
  void SetEnabled(bool enabled) override;
  void RemoveSiteException(const std::string& host,
                           RemoveSiteExceptionCallback callback) override;
  void SetCustomRules(const std::string& rules,
                      SetCustomRulesCallback callback) override;

  // The hosts whose override says "off", from the site-overrides dict. Shared
  // by GetState and by the pref observer so the two cannot disagree.
  std::vector<std::string> DisabledSites() const;

  void OnEnabledChanged();
  void OnBlockedCountChanged();
  void OnSiteOverridesChanged();
  void OnCustomRulesChanged();

  const raw_ptr<Profile> profile_;
  PrefChangeRegistrar pref_registrar_;

  mojo::Remote<adblock::mojom::Page> page_;
  mojo::Receiver<adblock::mojom::PageHandler> receiver_;
};

}  // namespace astro

#endif  // CHROME_BROWSER_OXY_WEBUI_ASTRO_ADBLOCK_PAGE_HANDLER_H_
