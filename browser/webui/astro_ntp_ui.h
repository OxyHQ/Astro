// Copyright 2026 Oxy. Astro product module.

#ifndef ASTRO_BROWSER_WEBUI_ASTRO_NTP_UI_H_
#define ASTRO_BROWSER_WEBUI_ASTRO_NTP_UI_H_

#include <string_view>

#include "content/public/browser/web_ui_controller.h"
#include "content/public/browser/webui_config.h"
#include "url/gurl.h"

namespace astro {

// Astro's new tab page.
//
// A page Astro genuinely owns: upstream's is Google's, and what ungoogled
// leaves behind is a minimal third-party stand-in. So unlike settings, there is
// nothing here worth preserving from upstream -- this replaces it outright.
//
// Built with Bloom on react-native-web, the same components and the same design
// layer as the rest of Oxy, so a control here behaves as it does in Mention or
// the console rather than being a browser-shaped imitation of one.
class AstroNtpUI : public content::WebUIController {
 public:
  // The URL, not just the WebUI, because the data source has to be registered
  // under the host that was actually navigated to. Astro serves this one page
  // on both of Chromium's new tab hosts (see AstroNtpUIConfig), and a data
  // source registered under the other one's name serves nothing.
  //
  // content's DefaultWebUIConfig supports exactly this two-argument shape.
  AstroNtpUI(content::WebUI* web_ui, const GURL& url);
  AstroNtpUI(const AstroNtpUI&) = delete;
  AstroNtpUI& operator=(const AstroNtpUI&) = delete;
  ~AstroNtpUI() override;
};

// Registered twice, once per host.
//
// Chromium picks between two new tab pages: its own, and a "third party" one
// for when the default search engine is not Google (search.cc,
// NewTabURLDetails::ForProfile). In Astro the search engine is never Google, so
// every new tab lands on the third-party host -- which ungoogled leaves as a
// near-empty page carrying a single icon. That is what a new tab showed.
//
// Astro's new tab page is neither Google's nor a stand-in for one, so the
// distinction has nothing to select between here: both hosts serve it. Done
// with content's public config API rather than by patching the branch in
// search.cc, so upstream's logic is untouched and still readable as upstream's.
class AstroNtpUIConfig : public content::DefaultWebUIConfig<AstroNtpUI> {
 public:
  explicit AstroNtpUIConfig(std::string_view host);
};

}  // namespace astro

#endif  // ASTRO_BROWSER_WEBUI_ASTRO_NTP_UI_H_
