// Copyright 2026 Oxy. Apache-2.0.

#include "chrome/browser/astro/ac_window_title.h"

#include "chrome/browser/ui/webui_browser/webui_browser_window.h"
#include "content/public/browser/web_contents.h"
#include "content/public/browser/web_contents_observer.h"
#include "content/public/browser/web_contents_user_data.h"

namespace astro {

namespace {

class PageTitle : public content::WebContentsUserData<PageTitle>,
                  public content::WebContentsObserver {
 public:
  PageTitle(const PageTitle&) = delete;
  PageTitle& operator=(const PageTitle&) = delete;
  ~PageTitle() override = default;

 private:
  friend class content::WebContentsUserData<PageTitle>;

  explicit PageTitle(content::WebContents* page)
      : content::WebContentsUserData<PageTitle>(*page),
        content::WebContentsObserver(page) {}

  void TitleWasSet(content::NavigationEntry* entry) override {
    if (WebUIBrowserWindow* window =
            WebUIBrowserWindow::FromWebShellWebContents(web_contents())) {
      window->UpdateTitleBar();
    }
  }

  WEB_CONTENTS_USER_DATA_KEY_DECL();
};

WEB_CONTENTS_USER_DATA_KEY_IMPL(PageTitle);

}

void FollowPageTitle(content::WebContents* page) {
  if (page && WebUIBrowserWindow::FromWebShellWebContents(page)) {
    PageTitle::CreateForWebContents(page);
  }
}

}
