// Copyright 2026 Oxy. Astro product module.

#include "astro/browser/astro_browser_main_extra_parts.h"

#include <memory>

#include "astro/browser/ui/color/astro_color_mixer.h"
#include "astro/browser/webui/astro_web_ui_configs.h"
#include "base/functional/bind.h"
#include "ui/color/color_provider_manager.h"
#include "base/logging.h"
#include "chrome/browser/chrome_browser_main_extra_parts.h"

namespace astro {
namespace {

// Astro's browser-process lifecycle hook.
//
// Everything Astro attaches to Chromium's startup hangs off this object.
// Growing Astro must never mean growing the Chromium delta, so a new surface
// gets a new callback override here rather than a new call site in a
// Chromium-owned file.
class AstroBrowserMainExtraParts : public ChromeBrowserMainExtraParts {
 public:
  AstroBrowserMainExtraParts() = default;
  ~AstroBrowserMainExtraParts() override = default;

  AstroBrowserMainExtraParts(const AstroBrowserMainExtraParts&) = delete;
  AstroBrowserMainExtraParts& operator=(const AstroBrowserMainExtraParts&) =
      delete;

  // Exists to be measured rather than inferred. A symbol present in an object
  // file proves the module compiled; it does not prove Chromium ever
  // constructs the object or calls into it. Those are different claims, and
  // only the second one means the integration works.
  //
  // PostEarlyInitialization is the first parts callback that runs on every
  // platform, so its absence from a startup log is a real failure rather than
  // a platform quirk.
  void PostEarlyInitialization() override {
    LOG(INFO) << "astro: AstroBrowserMainExtraParts installed";
  }

  // Astro's WebUI registration point.
  //
  // WHY PreBrowserStart AND NOT SOMETHING EARLIER. Registration must land
  // after Chromium has registered its own configs, because both populate the
  // one process-wide content::WebUIConfigMap and it CHECKs on a duplicate
  // origin. Measured against the locked Chromium revision, inside
  // ChromeBrowserMainParts::PreMainMessageLoopRunImpl:
  //
  //   chrome/browser/chrome_browser_main.cc:1790  PreProfileInit()
  //   chrome/browser/chrome_browser_main.cc:1833  RegisterChromeWebUIConfigs()
  //   chrome/browser/chrome_browser_main.cc:1834  RegisterChromeUntrustedWebUIConfigs()
  //   chrome/browser/chrome_browser_main.cc:1857  CallPostProfileInit(...)
  //   chrome/browser/chrome_browser_main.cc:1950  PreBrowserStart()
  //   chrome/browser/chrome_browser_main.cc:1978  browser_creator_->Start(...)
  //
  // so PreProfileInit is too early (the extra-parts fan-out for it is at
  // :1440-1447, ahead of :1833) and PreBrowserStart is late enough. It is also
  // before :1978, which is where the first tab is opened — nothing can
  // navigate to astro://test/ before this has run.
  //
  // WHY NOT PostProfileInit, which is the other callback that runs after
  // :1833. Because it runs ONCE PER PROFILE, not once: ProfileInitManager
  // observes the ProfileManager and calls CallPostProfileInit for every
  // existing and future profile (:656-699, dispatching at :1490-1506). The
  // WebUIConfigMap is process-wide and CHECKs on a duplicate origin, so
  // registering there would run fine on a single-profile start and crash the
  // browser the moment a second profile is created. That is a bug that hides
  // in exactly the configuration most people develop in.
  //
  // The `is_initial_profile` flag would paper over it. It should not be used
  // to: this registration has nothing to do with profiles, and a
  // profile-shaped callback guarded by "but only the first one" is a comment
  // that will be deleted by someone who reads it as redundant.
  void PreBrowserStart() override {
    RegisterAstroWebUIConfigs();

    // Astro's palette for the native UI, appended AFTER Chromium's own mixers
    // so it wins. ToolkitInitialized() adds the components and chrome mixers
    // and runs earlier than this hook; a mixer appended before them would be
    // overwritten and the browser would look untouched with nothing saying
    // why.
    ui::ColorProviderManager::Get().AppendColorProviderInitializer(
        base::BindRepeating(&AddAstroColorMixers));
    RegisterAstroUntrustedWebUIConfigs();
  }
};

}  // namespace

std::unique_ptr<ChromeBrowserMainExtraParts> CreateExtraParts() {
  return std::make_unique<AstroBrowserMainExtraParts>();
}

}  // namespace astro
