// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/oxy/adblock/astro_adblock_service.h"

#include "base/base_paths.h"
#include "base/files/file_enumerator.h"
#include "base/files/file_util.h"
#include "base/logging.h"
#include "base/path_service.h"
#include "chrome/browser/oxy/adblock/astro_adblock_engine.h"
#include "chrome/browser/oxy/adblock/astro_adblock_filter_list_updater.h"
#include "components/prefs/pref_service.h"
#include "components/prefs/scoped_user_pref_update.h"

namespace oxy::adblock {

namespace {

constexpr char kEngineCacheFileName[] = "engine_cache.bin";
constexpr char kAdBlockDataDir[] = "AstroAdBlock";
constexpr char kEasyListFileName[] = "easylist.txt";
constexpr char kEasyPrivacyFileName[] = "easyprivacy.txt";

}  // namespace

AstroAdBlockService::AstroAdBlockService(
    PrefService* prefs,
    const base::FilePath& profile_path,
    scoped_refptr<network::SharedURLLoaderFactory> url_loader_factory)
    : prefs_(prefs),
      profile_path_(profile_path),
      engine_(std::make_unique<AstroAdBlockEngine>()) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);

  // Domain resolver is a global one-time initialization.
  [[maybe_unused]] static bool resolver_initialized =
      AstroAdBlockEngine::InitializeDomainResolver();
  DCHECK(resolver_initialized);

  if (IsEnabled()) {
    InitializeEngine();

    // Start the filter list updater for periodic downloads.
    if (url_loader_factory) {
      updater_ = std::make_unique<AstroAdBlockFilterListUpdater>(
          this, std::move(url_loader_factory), profile_path_);
      updater_->Start();
    }
  }
}

AstroAdBlockService::~AstroAdBlockService() {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
}

bool AstroAdBlockService::IsEnabled() const {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  return prefs_ && prefs_->GetBoolean(kAdBlockEnabled);
}

bool AstroAdBlockService::IsEnabledForSite(const GURL& site_url) const {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);

  if (!IsEnabled()) {
    return false;
  }

  if (!site_url.is_valid() || !site_url.has_host()) {
    return true;  // Default to enabled for invalid URLs.
  }

  const auto& overrides = prefs_->GetDict(kAdBlockSiteOverrides);
  const auto* value = overrides.Find(site_url.host());
  if (value && value->is_bool()) {
    return value->GetBool();
  }

  return true;  // Enabled by default.
}

bool AstroAdBlockService::ShouldBlockRequest(
    const GURL& request_url,
    const GURL& tab_url,
    network::mojom::RequestDestination destination) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);

  if (!IsEnabledForSite(tab_url)) {
    return false;
  }

  if (!engine_ || !engine_->IsReady()) {
    return false;
  }

  // Never block main document navigations — ad blocking applies to
  // sub-resources only.
  if (destination == network::mojom::RequestDestination::kDocument) {
    return false;
  }

  return engine_->ShouldBlock(request_url, tab_url, destination);
}

std::string AstroAdBlockService::GetCosmeticFiltersJson(const GURL& url) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);

  if (!engine_ || !engine_->IsReady()) {
    return "{}";
  }

  return engine_->GetCosmeticFiltersJson(url);
}

void AstroAdBlockService::SetSiteOverride(const GURL& site_url,
                                          bool enabled) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);

  if (!site_url.is_valid() || !site_url.has_host()) {
    return;
  }

  ScopedDictPrefUpdate update(prefs_, kAdBlockSiteOverrides);
  if (enabled) {
    // Remove override to revert to default (enabled).
    update->Remove(site_url.host());
  } else {
    update->Set(site_url.host(), false);
  }
}

void AstroAdBlockService::ReloadFilterLists(const base::FilePath& lists_dir) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);

  auto new_engine = std::make_unique<AstroAdBlockEngine>();

  // Load all .txt filter list files from the directory.
  base::FileEnumerator enumerator(lists_dir, /*recursive=*/false,
                                  base::FileEnumerator::FILES,
                                  FILE_PATH_LITERAL("*.txt"));
  int list_count = 0;
  for (base::FilePath path = enumerator.Next(); !path.empty();
       path = enumerator.Next()) {
    std::string content;
    if (base::ReadFileToString(path, &content) && !content.empty()) {
      new_engine->AddFilterList(content);
      list_count++;
      LOG(INFO) << "Loaded updated filter list: " << path.BaseName();
    }
  }

  if (list_count == 0) {
    LOG(WARNING) << "No filter lists found in " << lists_dir;
    return;
  }

  new_engine->Build();

  if (new_engine->IsReady()) {
    engine_ = std::move(new_engine);
    engine_->SaveToCache(GetEngineCachePath());
    LOG(INFO) << "Ad block engine reloaded with " << list_count
              << " updated filter lists";
  }
}

void AstroAdBlockService::Shutdown() {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  updater_.reset();
  engine_.reset();
  prefs_ = nullptr;
}

void AstroAdBlockService::InitializeEngine() {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);

  // Try fast path: load from serialized cache.
  const base::FilePath cache_path = GetEngineCachePath();
  if (base::PathExists(cache_path) && engine_->LoadFromCache(cache_path)) {
    return;
  }

  // Slow path: parse filter lists from text and build engine.
  LoadFilterListsAndBuild();

  // Cache the built engine for next startup.
  if (engine_->IsReady()) {
    engine_->SaveToCache(cache_path);
  }
}

void AstroAdBlockService::LoadFilterListsAndBuild() {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);

  const base::FilePath resources_path = GetFilterListResourcesPath();

  // Load EasyList.
  const base::FilePath easylist_path =
      resources_path.AppendASCII(kEasyListFileName);
  std::string easylist_content;
  if (base::ReadFileToString(easylist_path, &easylist_content)) {
    engine_->AddFilterList(easylist_content);
    LOG(INFO) << "Loaded EasyList (" << easylist_content.size() << " bytes)";
  } else {
    LOG(WARNING) << "Failed to load EasyList from " << easylist_path;
  }

  // Load EasyPrivacy.
  const base::FilePath easyprivacy_path =
      resources_path.AppendASCII(kEasyPrivacyFileName);
  std::string easyprivacy_content;
  if (base::ReadFileToString(easyprivacy_path, &easyprivacy_content)) {
    engine_->AddFilterList(easyprivacy_content);
    LOG(INFO) << "Loaded EasyPrivacy (" << easyprivacy_content.size()
              << " bytes)";
  } else {
    LOG(WARNING) << "Failed to load EasyPrivacy from " << easyprivacy_path;
  }

  engine_->Build();
}

base::FilePath AstroAdBlockService::GetEngineCachePath() const {
  return profile_path_.AppendASCII(kAdBlockDataDir)
      .AppendASCII(kEngineCacheFileName);
}

base::FilePath AstroAdBlockService::GetFilterListResourcesPath() const {
  // Filter lists are bundled alongside the browser binary.
  base::FilePath exe_dir;
  base::PathService::Get(base::DIR_EXE, &exe_dir);
  return exe_dir.AppendASCII("adblock_resources");
}

}  // namespace oxy::adblock
