// Copyright 2026 Oxy. Apache-2.0.

#ifndef CHROME_BROWSER_ASTRO_AC_TAB_BRIDGE_H_
#define CHROME_BROWSER_ASTRO_AC_TAB_BRIDGE_H_

#include <string>

#include "base/functional/callback.h"
#include "base/memory/raw_ptr.h"
#include "base/scoped_observation.h"
#include "base/values.h"
#include "components/blocked_content/popup_blocker_tab_helper.h"
#include "components/blocked_content/url_list_manager.h"
#include "components/find_in_page/find_result_observer.h"
#include "components/find_in_page/find_tab_helper.h"
#include "components/zoom/zoom_controller.h"
#include "components/zoom/zoom_observer.h"
#include "content/public/browser/web_contents_observer.h"

namespace astro {

base::DictValue SecurityInfo(content::WebContents* contents);

class TabBridge : public content::WebContentsObserver,
                  public zoom::ZoomObserver,
                  public find_in_page::FindResultObserver,
                  public blocked_content::UrlListManager::Observer {
 public:
  using Emit =
      base::RepeatingCallback<void(const std::string& kind,
                                   base::DictValue payload)>;

  TabBridge(content::WebContents* contents, Emit emit);
  ~TabBridge() override;

  base::DictValue Snapshot();
  void Call(const std::string& method,
            const base::DictValue& args,
            base::OnceCallback<void(base::Value)> done);

  void DidFinishNavigation(content::NavigationHandle* handle) override;
  void DidChangeVisibleSecurityState() override;
  void PrimaryMainFrameRenderProcessGone(
      base::TerminationStatus status) override;
  void OnAudioStateChanged(bool audible) override;
  void DidUpdateAudioMutingState(bool muted) override;
  void DidChangeThemeColor() override;
  void DidToggleFullscreenModeForTab(bool entered_fullscreen,
                                     bool will_cause_resize) override;
  void WebContentsDestroyed() override;

  void OnZoomChanged(
      const zoom::ZoomController::ZoomChangedEventData& data) override;
  void OnZoomControllerDestroyed(zoom::ZoomController* controller) override;

  void OnFindResultAvailable(content::WebContents* contents) override;
  void OnFindTabHelperDestroyed(find_in_page::FindTabHelper* helper) override;

  void BlockedUrlAdded(int32_t popup_id, const GURL& url) override;

 private:
  base::DictValue Media();
  base::DictValue Zoom();
  void ObserveHelpers();
  void CheckSecurity();

  Emit emit_;
  base::DictValue security_;
  base::ScopedObservation<zoom::ZoomController, zoom::ZoomObserver> zoom_{
      this};
  base::ScopedObservation<find_in_page::FindTabHelper,
                          find_in_page::FindResultObserver>
      find_{this};
  base::ScopedObservation<blocked_content::UrlListManager,
                          blocked_content::UrlListManager::Observer>
      popups_{this};
};

}

#endif
