// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_ADBLOCK_ASTRO_ADBLOCK_FILTER_LIST_UPDATER_H_
#define CHROME_BROWSER_OXY_ADBLOCK_ASTRO_ADBLOCK_FILTER_LIST_UPDATER_H_

#include <memory>
#include <string>
#include <vector>

#include "base/files/file_path.h"
#include "base/memory/raw_ptr.h"
#include "base/memory/scoped_refptr.h"
#include "base/memory/weak_ptr.h"
#include "base/sequence_checker.h"
#include "base/timer/timer.h"
#include "url/gurl.h"

namespace network {
class SharedURLLoaderFactory;
class SimpleURLLoader;
}  // namespace network

namespace oxy::adblock {

class AstroAdBlockService;

// Handles periodic downloading and updating of filter lists.
// Runs daily update checks using If-Modified-Since to minimize bandwidth.
// Downloaded lists are stored in the profile directory and the engine
// is reloaded when updates are available.
class AstroAdBlockFilterListUpdater {
 public:
  AstroAdBlockFilterListUpdater(
      AstroAdBlockService* service,
      scoped_refptr<network::SharedURLLoaderFactory> url_loader_factory,
      const base::FilePath& profile_path);
  ~AstroAdBlockFilterListUpdater();

  AstroAdBlockFilterListUpdater(const AstroAdBlockFilterListUpdater&) = delete;
  AstroAdBlockFilterListUpdater& operator=(
      const AstroAdBlockFilterListUpdater&) = delete;

  // Starts the periodic update timer.
  void Start();

  // Triggers an immediate update check.
  void CheckForUpdatesNow();

  // Returns the directory where downloaded filter lists are stored.
  base::FilePath GetFilterListsDir() const;

 private:
  // Represents a single in-progress download.
  struct PendingDownload {
    std::string list_id;
    GURL url;
    base::FilePath output_path;
    std::unique_ptr<network::SimpleURLLoader> loader;
  };

  // Called by the update timer.
  void OnUpdateTimer();

  // Starts downloading a single filter list.
  void DownloadFilterList(const std::string& id, const GURL& url);

  // Called when a filter list download completes.
  void OnFilterListDownloaded(const std::string& list_id,
                              const base::FilePath& output_path,
                              std::optional<std::string> response_body);

  // Reloads the engine with all available filter lists.
  void ReloadEngine();

  raw_ptr<AstroAdBlockService> service_;
  scoped_refptr<network::SharedURLLoaderFactory> url_loader_factory_;
  base::FilePath profile_path_;

  // Active downloads.
  std::vector<std::unique_ptr<PendingDownload>> pending_downloads_;

  // Tracks how many downloads are in-flight for batched reload.
  int downloads_in_progress_ = 0;
  bool needs_engine_reload_ = false;

  // 24-hour update timer.
  base::RepeatingTimer update_timer_;

  SEQUENCE_CHECKER(sequence_checker_);
  base::WeakPtrFactory<AstroAdBlockFilterListUpdater> weak_factory_{this};
};

}  // namespace oxy::adblock

#endif  // CHROME_BROWSER_OXY_ADBLOCK_ASTRO_ADBLOCK_FILTER_LIST_UPDATER_H_
