// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/oxy/adblock/astro_adblock_filter_list_updater.h"

#include "base/files/file_util.h"
#include "base/i18n/time_formatting.h"
#include "base/logging.h"
#include "base/task/thread_pool.h"
#include "chrome/browser/oxy/adblock/astro_adblock_filter_list_catalog.h"
#include "chrome/browser/oxy/adblock/astro_adblock_service.h"
#include "net/base/load_flags.h"
#include "net/traffic_annotation/network_traffic_annotation.h"
#include "services/network/public/cpp/resource_request.h"
#include "services/network/public/cpp/shared_url_loader_factory.h"
#include "services/network/public/cpp/simple_url_loader.h"

namespace oxy::adblock {

namespace {

// Check for updates every 24 hours.
constexpr base::TimeDelta kUpdateInterval = base::Hours(24);

// Initial delay before first update check (5 minutes after startup).
constexpr base::TimeDelta kInitialDelay = base::Minutes(5);

// Maximum filter list file size (10 MB).
constexpr size_t kMaxFilterListSize = 10 * 1024 * 1024;

constexpr char kFilterListsSubdir[] = "filterlists";

constexpr net::NetworkTrafficAnnotationTag kTrafficAnnotation =
    net::DefineNetworkTrafficAnnotation("astro_adblock_filter_list_update", R"(
    semantics {
      sender: "Astro Ad Blocker"
      description:
        "Downloads updated ad blocking filter lists (EasyList, EasyPrivacy) "
        "to keep the browser's built-in ad blocker effective against new ads "
        "and trackers."
      trigger:
        "Periodically (every 24 hours) when the browser is running, or "
        "manually from the ad blocker settings page."
      data: "HTTP request with If-Modified-Since header for conditional fetch."
      destination: OTHER
      internal {
        contacts { email: "browser@oxy.so" }
      }
      user_data {
        type: NONE
      }
      last_reviewed: "2026-04-04"
    }
    policy {
      cookies_allowed: NO
      setting:
        "Users can disable the ad blocker entirely from "
        "astro://adblock settings."
      policy_exception_justification:
        "Not yet controlled by enterprise policy."
    })");

}  // namespace

AstroAdBlockFilterListUpdater::AstroAdBlockFilterListUpdater(
    AstroAdBlockService* service,
    scoped_refptr<network::SharedURLLoaderFactory> url_loader_factory,
    const base::FilePath& profile_path)
    : service_(service),
      url_loader_factory_(std::move(url_loader_factory)),
      profile_path_(profile_path) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
}

AstroAdBlockFilterListUpdater::~AstroAdBlockFilterListUpdater() {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
}

void AstroAdBlockFilterListUpdater::Start() {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);

  // Ensure the filter lists directory exists.
  base::CreateDirectory(GetFilterListsDir());

  // Schedule the first update check after a short delay to avoid
  // impacting browser startup performance.
  update_timer_.Start(FROM_HERE, kUpdateInterval,
                      base::BindRepeating(
                          &AstroAdBlockFilterListUpdater::OnUpdateTimer,
                          weak_factory_.GetWeakPtr()));

  // Also schedule an initial check with a delay.
  base::SequencedTaskRunner::GetCurrentDefault()->PostDelayedTask(
      FROM_HERE,
      base::BindOnce(&AstroAdBlockFilterListUpdater::CheckForUpdatesNow,
                      weak_factory_.GetWeakPtr()),
      kInitialDelay);
}

void AstroAdBlockFilterListUpdater::CheckForUpdatesNow() {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);

  if (!url_loader_factory_) {
    LOG(WARNING) << "No URL loader factory available for filter list updates";
    return;
  }

  LOG(INFO) << "Checking for ad block filter list updates...";

  auto default_lists = GetDefaultFilterLists();
  needs_engine_reload_ = false;

  for (const auto& entry : default_lists) {
    DownloadFilterList(entry.id, entry.url);
  }
}

base::FilePath AstroAdBlockFilterListUpdater::GetFilterListsDir() const {
  return profile_path_.AppendASCII("AstroAdBlock")
      .AppendASCII(kFilterListsSubdir);
}

void AstroAdBlockFilterListUpdater::OnUpdateTimer() {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  CheckForUpdatesNow();
}

void AstroAdBlockFilterListUpdater::DownloadFilterList(const std::string& id,
                                                       const GURL& url) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);

  auto request = std::make_unique<network::ResourceRequest>();
  request->url = url;
  request->method = "GET";
  request->credentials_mode = network::mojom::CredentialsMode::kOmit;
  request->load_flags =
      net::LOAD_DO_NOT_SAVE_COOKIES | net::LOAD_DO_NOT_SEND_COOKIES;

  // Use If-Modified-Since if we have a cached version.
  base::FilePath output_path =
      GetFilterListsDir().AppendASCII(id + ".txt");
  if (base::PathExists(output_path)) {
    base::File::Info file_info;
    if (base::GetFileInfo(output_path, &file_info)) {
      request->headers.SetHeader(
          "If-Modified-Since",
          base::TimeFormatHTTP(file_info.last_modified));
    }
  }

  auto loader = network::SimpleURLLoader::Create(std::move(request),
                                                  kTrafficAnnotation);
  loader->SetRetryOptions(
      1, network::SimpleURLLoader::RETRY_ON_NETWORK_CHANGE);

  auto* loader_ptr = loader.get();
  downloads_in_progress_++;

  loader_ptr->DownloadToString(
      url_loader_factory_.get(),
      base::BindOnce(&AstroAdBlockFilterListUpdater::OnFilterListDownloaded,
                      weak_factory_.GetWeakPtr(), id, output_path),
      kMaxFilterListSize);

  auto pending = std::make_unique<PendingDownload>();
  pending->list_id = id;
  pending->url = url;
  pending->output_path = output_path;
  pending->loader = std::move(loader);
  pending_downloads_.push_back(std::move(pending));
}

void AstroAdBlockFilterListUpdater::OnFilterListDownloaded(
    const std::string& list_id,
    const base::FilePath& output_path,
    std::optional<std::string> response_body) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);

  downloads_in_progress_--;

  // Remove the pending download entry.
  std::erase_if(pending_downloads_,
                [&list_id](const auto& pd) {
                  return pd->list_id == list_id;
                });

  if (response_body.has_value() && !response_body->empty()) {
    // Write the updated list to disk.
    if (base::WriteFile(output_path, *response_body)) {
      LOG(INFO) << "Updated filter list: " << list_id << " ("
                << response_body->size() << " bytes)";
      needs_engine_reload_ = true;
    } else {
      LOG(WARNING) << "Failed to write filter list " << list_id;
    }
  } else if (!response_body.has_value()) {
    // A 304 Not Modified response results in no body, which is expected.
    // Network errors also result in no body.
    VLOG(1) << "No update for filter list: " << list_id
            << " (not modified or network error)";
  }

  // When all downloads complete, reload the engine if any lists were updated.
  if (downloads_in_progress_ == 0 && needs_engine_reload_) {
    ReloadEngine();
    needs_engine_reload_ = false;
  }
}

void AstroAdBlockFilterListUpdater::ReloadEngine() {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);

  LOG(INFO) << "Reloading ad block engine with updated filter lists...";

  if (service_) {
    service_->ReloadFilterLists(GetFilterListsDir());
  }
}

}  // namespace oxy::adblock
