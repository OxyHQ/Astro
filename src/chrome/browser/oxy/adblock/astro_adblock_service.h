// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_ADBLOCK_ASTRO_ADBLOCK_SERVICE_H_
#define CHROME_BROWSER_OXY_ADBLOCK_ASTRO_ADBLOCK_SERVICE_H_

#include <memory>
#include <string>

#include "base/files/file_path.h"
#include "base/memory/raw_ptr.h"
#include "base/memory/scoped_refptr.h"
#include "base/memory/weak_ptr.h"
#include "base/sequence_checker.h"
#include "components/keyed_service/core/keyed_service.h"
#include "services/network/public/mojom/fetch_api.mojom-forward.h"
#include "url/gurl.h"

class PrefService;

namespace network {
class SharedURLLoaderFactory;
}

namespace oxy::adblock {

class AstroAdBlockEngine;
class AstroAdBlockFilterListUpdater;

// Pref keys for ad block configuration.
inline constexpr char kAdBlockEnabled[] = "oxy.adblock.enabled";
inline constexpr char kAdBlockSiteOverrides[] = "oxy.adblock.site_overrides";
inline constexpr char kAdBlockCustomRules[] = "oxy.adblock.custom_rules";

// Per-profile service that manages the ad block engine.
// Loads filter lists on startup, caches the compiled engine,
// and provides the blocking decision API used by the URL throttle.
class AstroAdBlockService : public KeyedService {
 public:
  AstroAdBlockService(
      PrefService* prefs,
      const base::FilePath& profile_path,
      scoped_refptr<network::SharedURLLoaderFactory> url_loader_factory);
  ~AstroAdBlockService() override;

  AstroAdBlockService(const AstroAdBlockService&) = delete;
  AstroAdBlockService& operator=(const AstroAdBlockService&) = delete;

  // Returns true if ad blocking is globally enabled.
  bool IsEnabled() const;

  // Returns true if ad blocking is enabled for the given site.
  bool IsEnabledForSite(const GURL& site_url) const;

  // Returns true if the given request should be blocked.
  // This is the main entry point called by the URLLoaderThrottle.
  bool ShouldBlockRequest(const GURL& request_url,
                          const GURL& tab_url,
                          network::mojom::RequestDestination destination);

  // Returns cosmetic filter JSON for a page URL.
  std::string GetCosmeticFiltersJson(const GURL& url);

  // Toggles ad blocking for a specific site.
  void SetSiteOverride(const GURL& site_url, bool enabled);

  // Rebuilds the engine from filter lists in the given directory.
  // Called by the updater after downloading new lists.
  void ReloadFilterLists(const base::FilePath& lists_dir);

 private:
  // KeyedService:
  void Shutdown() override;

  // Initializes the engine: tries cache first, falls back to parsing lists.
  void InitializeEngine();

  // Loads bundled filter lists and builds the engine.
  void LoadFilterListsAndBuild();

  // Returns the path to the engine cache file.
  base::FilePath GetEngineCachePath() const;

  // Returns the path to the bundled filter list resources directory.
  base::FilePath GetFilterListResourcesPath() const;

  raw_ptr<PrefService> prefs_;
  base::FilePath profile_path_;
  std::unique_ptr<AstroAdBlockEngine> engine_;
  std::unique_ptr<AstroAdBlockFilterListUpdater> updater_;

  SEQUENCE_CHECKER(sequence_checker_);
  base::WeakPtrFactory<AstroAdBlockService> weak_factory_{this};
};

}  // namespace oxy::adblock

#endif  // CHROME_BROWSER_OXY_ADBLOCK_ASTRO_ADBLOCK_SERVICE_H_
