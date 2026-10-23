#ifndef ASTRO_CORE_AC_PAGE_CHANNEL_H_
#define ASTRO_CORE_AC_PAGE_CHANNEL_H_

#include <memory>
#include <optional>
#include <string>

#include "base/functional/callback.h"
#include "content/public/browser/render_frame_host_receiver_set.h"
#include "content/public/browser/web_contents_observer.h"
#include "content/public/browser/web_contents_user_data.h"
#include "content/public/browser/global_routing_id.h"
#include "mojo/public/cpp/bindings/associated_remote.h"
#include "mojo/public/cpp/bindings/pending_associated_receiver.h"
#include "url/gurl.h"
#include "astro/core/mojom/astrocore.mojom.h"

namespace blink {
class AssociatedInterfaceRegistry;
}

namespace content {
class NavigationThrottleRegistry;
class RenderFrameHost;
class RenderProcessHost;
class WebContents;
}

namespace astrocore {

void SetPageScript(const std::string& script);
const std::string& GetPageScript();
void SendPageScript(content::RenderProcessHost* host);

void RegisterPageChannelBinders(content::RenderFrameHost& render_frame_host,
                                blink::AssociatedInterfaceRegistry& registry);
void AddAppSchemeThrottle(content::NavigationThrottleRegistry& registry);
bool IsAppURL(const GURL& url);
bool IsWebUIURL(const GURL& url);
void ReportAppURLRequest(content::WebContents* contents,
                         const GURL& url,
                         bool user_gesture);

class PageChannel : public content::WebContentsObserver,
                    public content::WebContentsUserData<PageChannel>,
                    public mojom::ACPageHost {
 public:
  ~PageChannel() override;

  static PageChannel* GetOrCreate(content::WebContents* contents);

  void Bind(content::RenderFrameHost* frame,
            mojo::PendingAssociatedReceiver<mojom::ACPageHost> receiver);

  void CallPage(const std::string& kind, const std::string& json);
  void CallFrame(const std::string& frame_id,
                 const std::string& kind,
                 const std::string& json);
  void Execute(const std::string& code, bool user_gesture = false);
  void ExecuteInFrame(const std::string& frame_id, const std::string& code);
  void Evaluate(const std::string& code,
                bool user_gesture,
                base::OnceCallback<void(const std::optional<std::string>&)> callback);

  static std::string FrameId(content::RenderFrameHost* frame);

  void SetPageColor(const std::string& color);
  const std::string& page_color() const { return page_color_; }

  void Post(const std::string& kind, const std::string& json) override;

  void PrimaryPageChanged(content::Page& page) override;
  void ReadyToCommitNavigation(content::NavigationHandle* navigation) override;
  void RenderFrameCreated(content::RenderFrameHost* frame) override;

 private:
  friend class content::WebContentsUserData<PageChannel>;
  explicit PageChannel(content::WebContents* contents);

  mojom::ACPage* MainPage();
  content::RenderFrameHost* FindFrame(const std::string& frame_id);

  content::RenderFrameHostReceiverSet<mojom::ACPageHost> receivers_;
  mojo::AssociatedRemote<mojom::ACPage> main_page_;
  content::GlobalRenderFrameHostId main_page_frame_;
  std::string page_color_;
  WEB_CONTENTS_USER_DATA_KEY_DECL();
};

}

#endif
