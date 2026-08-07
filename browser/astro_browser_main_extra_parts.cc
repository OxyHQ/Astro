// Copyright 2026 Oxy. Astro product module.

#include "astro/browser/astro_browser_main_extra_parts.h"

#include <memory>

#include "base/logging.h"
#include "chrome/browser/chrome_browser_main_extra_parts.h"

namespace astro {
namespace {

// Astro's browser-process lifecycle hook.
//
// Deliberately empty at this stage. #7 exists to prove that a clean checkout
// compiles and links //astro through the declared hook — not to add product
// behaviour, which would make "does the integration work?" and "does the
// feature work?" fail together and be diagnosed as one problem.
//
// WebUI registration will attach here rather than by overwriting
// chrome/browser/ui/webui/chrome_web_ui_configs.cc. content::WebUIConfigMap is
// a public runtime embedder API and says so
// (content/public/browser/webui_config_map.h:29-32), and PostProfileInit runs
// after RegisterChromeWebUIConfigs() (chrome/browser/chrome_browser_main.cc:1830).
//
// That applies to `chrome://` and `chrome-untrusted://` only. A real `astro://`
// scheme is NOT reachable this way: WebUIConfigMap::AddWebUIConfig begins with
// CHECK_EQ(config->scheme(), kChromeUIScheme)
// (content/public/browser/webui_config_map.cc:73). Additional schemes need the
// content-layer integration owned by #11/#12, and that separation is
// deliberate — do not paper over it here.
class AstroBrowserMainExtraParts : public ChromeBrowserMainExtraParts {
 public:
  AstroBrowserMainExtraParts() = default;
  ~AstroBrowserMainExtraParts() override = default;

  AstroBrowserMainExtraParts(const AstroBrowserMainExtraParts&) = delete;
  AstroBrowserMainExtraParts& operator=(const AstroBrowserMainExtraParts&) =
      delete;

  // The ONLY behaviour #7 adds, and it exists to be measured rather than
  // inferred. A symbol present in an object file proves the module compiled;
  // it does not prove Chromium ever constructs the object or calls into it.
  // Those are different claims, and only the second one means the integration
  // works.
  //
  // PostEarlyInitialization is the first parts callback that runs on every
  // platform, so its absence from a startup log is a real failure rather than
  // a platform quirk.
  void PostEarlyInitialization() override {
    LOG(INFO) << "astro: AstroBrowserMainExtraParts installed";
  }
};

}  // namespace

std::unique_ptr<ChromeBrowserMainExtraParts> CreateExtraParts() {
  return std::make_unique<AstroBrowserMainExtraParts>();
}

}  // namespace astro
