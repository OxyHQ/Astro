// Copyright 2026 Oxy. Apache-2.0.

#ifndef CHROME_BROWSER_ASTRO_AC_TAB_BRIDGE_H_
#define CHROME_BROWSER_ASTRO_AC_TAB_BRIDGE_H_

#include <map>
#include <optional>
#include <memory>
#include <string>
#include <utility>
#include <vector>

#include "base/functional/callback.h"
#include "base/memory/raw_ptr.h"
#include "base/memory/weak_ptr.h"
#include "base/scoped_observation.h"
#include "base/values.h"
#include "build/build_config.h"
#include "chrome/browser/media/webrtc/media_stream_capture_indicator.h"
#include "components/blocked_content/popup_blocker_tab_helper.h"
#include "components/blocked_content/url_list_manager.h"
#include "components/find_in_page/find_result_observer.h"
#include "components/find_in_page/find_tab_helper.h"
#include "components/zoom/zoom_controller.h"
#include "components/zoom/zoom_observer.h"
#include "content/public/browser/devtools_agent_host.h"
#include "content/public/browser/devtools_agent_host_client.h"
#include "content/public/browser/web_contents_observer.h"
#include "url/gurl.h"

#if BUILDFLAG(IS_WIN)
namespace webshare {
class ShareOperation;
}
#endif

namespace astro {

base::DictValue SecurityInfo(content::WebContents* contents);
bool ShareThisTabInstead(content::WebContents* contents,
                         content::WebContents* capturer);
void SetPageScript(std::string script);

class TabBridge : public content::WebContentsObserver,
                  public zoom::ZoomObserver,
                  public find_in_page::FindResultObserver,
                  public blocked_content::UrlListManager::Observer,
                  public content::DevToolsAgentHostClient,
                  public MediaStreamCaptureIndicator::Observer {
 public:
  using Emit =
      base::RepeatingCallback<void(const std::string& kind,
                                   base::DictValue payload)>;

  TabBridge(content::WebContents* contents, Emit emit);
  ~TabBridge() override;

  base::DictValue Snapshot();
  void InstallPageScript();
  void Call(const std::string& method,
            const base::DictValue& args,
            base::OnceCallback<void(base::Value)> done);

  void DidFinishNavigation(content::NavigationHandle* handle) override;
  void DidChangeVisibleSecurityState() override;
  void DidStartLoading() override;
  void DidStopLoading() override;
  void TitleWasSet(content::NavigationEntry* entry) override;
  void PrimaryMainFrameRenderProcessGone(
      base::TerminationStatus status) override;
  void OnAudioStateChanged(bool audible) override;
  void DidUpdateAudioMutingState(bool muted) override;
  void DidChangeThemeColor() override;
  void DidToggleFullscreenModeForTab(bool entered_fullscreen,
                                     bool will_cause_resize) override;
  void WebContentsDestroyed() override;
  void WasDiscarded() override;
  void DidGetUserInteraction(const blink::WebInputEvent& event) override;
  void ResourceLoadComplete(
      content::RenderFrameHost* render_frame_host,
      const content::GlobalRequestID& request_id,
      const GURL& original_url,
      const blink::mojom::ResourceLoadInfo& resource_load_info) override;

  void NoteRuleMatched(bool block, const GURL& url);
  void SetUnresponsive(content::RenderWidgetHost* host,
                       base::RepeatingClosure restarter);
  bool SetResponsive(content::RenderWidgetHost* host);
  void AboutToBeDiscarded(content::WebContents* new_contents) override;
  void DispatchProtocolMessage(content::DevToolsAgentHost* agent_host,
                               base::span<const uint8_t> message) override;
  void AgentHostClosed(content::DevToolsAgentHost* agent_host) override;

  void OnZoomChanged(
      const zoom::ZoomController::ZoomChangedEventData& data) override;
  void OnZoomControllerDestroyed(zoom::ZoomController* controller) override;

  void OnFindResultAvailable(content::WebContents* contents) override;
  void OnFindTabHelperDestroyed(find_in_page::FindTabHelper* helper) override;

  void BlockedUrlAdded(int32_t popup_id, const GURL& url) override;

  void OnIsCapturingVideoChanged(content::WebContents* contents,
                                 bool capturing) override;
  void OnIsCapturingAudioChanged(content::WebContents* contents,
                                 bool capturing) override;
  void OnIsCapturingTabChanged(content::WebContents* contents,
                               bool capturing) override;
  void OnIsCapturingWindowChanged(content::WebContents* contents,
                                  bool capturing) override;
  void OnIsCapturingDisplayChanged(content::WebContents* contents,
                                   bool capturing) override;

 private:
  base::DictValue Media();
  base::DictValue MediaAccess();
  void MediaAccessChanged(content::WebContents* contents);
  bool StopCapture();
  void CapturePicture(double scale, base::OnceCallback<void(base::Value)> done);
  bool Share(const std::string& url, const std::string& title);
  void EmitNavigation();
  base::DictValue Zoom();
  void ObserveHelpers();
  void CheckSecurity();
  void Evaluate(const std::string& code,
                bool user_gesture,
                base::OnceCallback<void(base::Value)> done);
  bool EnsureAgent();
  void SendProtocol(const std::string& method, base::DictValue params);
  void PageScriptMessage(const base::DictValue& params);
  void BindPageScript();
  void NoteBlockedByClient(const GURL& blocked_url, const GURL& url);
  void NoteBlocked(const GURL& url);
  void ReportBlocked();
  void ResetBlocked();
  void ResolveUnresponsive(bool terminate);
  void CallPage(const std::string& kind,
                const std::string& json,
                std::optional<int> context);
  void Answer(int id, base::Value result);

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
  scoped_refptr<content::DevToolsAgentHost> agent_;
  scoped_refptr<MediaStreamCaptureIndicator> capture_indicator_;
  base::DictValue media_access_;
#if BUILDFLAG(IS_WIN)
  std::unique_ptr<webshare::ShareOperation> share_;
#endif
  int last_message_id_ = 0;
  bool page_script_installed_ = false;
  std::string page_binding_;
  int blocked_count_ = 0;
  int blocked_pending_ = 0;
  GURL blocked_last_url_;
  std::vector<GURL> rule_blocked_urls_;
  std::optional<std::pair<int, int>> unresponsive_;
  base::RepeatingClosure hang_monitor_restarter_;
  std::map<int, base::OnceCallback<void(base::Value)>> evaluations_;
  base::WeakPtrFactory<TabBridge> weak_factory_{this};
};

}

#endif
