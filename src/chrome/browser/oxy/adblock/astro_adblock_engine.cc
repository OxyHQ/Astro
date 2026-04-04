// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/oxy/adblock/astro_adblock_engine.h"

#include <vector>

#include "base/files/file_util.h"
#include "base/logging.h"
#include "chrome/browser/oxy/adblock/astro_adblock_resource_type.h"
#include "chrome/browser/oxy/adblock/rs/src/lib.rs.h"
#include "net/base/registry_controlled_domains/registry_controlled_domain.h"
#include "third_party/rust/cxx/v1/cxx.h"

namespace oxy::adblock {

AstroAdBlockEngine::AstroAdBlockEngine()
    : engine_(new_engine()) {
  DETACH_FROM_SEQUENCE(sequence_checker_);
}

AstroAdBlockEngine::~AstroAdBlockEngine() {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
}

// static
bool AstroAdBlockEngine::InitializeDomainResolver() {
  return set_domain_resolver();
}

void AstroAdBlockEngine::AddFilterList(const std::string& rules) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  DCHECK(!is_ready_) << "Cannot add filter lists after Build()";
  pending_filter_lists_.push_back(rules);
}

void AstroAdBlockEngine::Build() {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  DCHECK(!is_ready_) << "Engine already built";

  auto filter_set = new_filter_set();

  for (const auto& rules : pending_filter_lists_) {
    // CXX maps Rust's &CxxVector<u8> to C++'s const std::vector<uint8_t>&.
    std::vector<uint8_t> rules_bytes(rules.begin(), rules.end());
    filter_set->add_filter_list(rules_bytes);
  }

  engine_ = engine_from_filter_set(std::move(filter_set));
  pending_filter_lists_.clear();
  is_ready_ = true;

  LOG(INFO) << "Astro ad block engine built successfully";
}

bool AstroAdBlockEngine::LoadFromCache(const base::FilePath& cache_path) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);

  std::string data;
  if (!base::ReadFileToString(cache_path, &data)) {
    return false;
  }

  std::vector<uint8_t> bytes(data.begin(), data.end());
  if (!engine_deserialize(*engine_, bytes)) {
    LOG(WARNING) << "Failed to deserialize ad block engine cache";
    return false;
  }

  is_ready_ = true;
  LOG(INFO) << "Astro ad block engine loaded from cache ("
            << data.size() << " bytes)";
  return true;
}

bool AstroAdBlockEngine::SaveToCache(const base::FilePath& cache_path) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  DCHECK(is_ready_);

  rust::Vec<uint8_t> serialized = engine_serialize(*engine_);
  if (serialized.empty()) {
    LOG(WARNING) << "Failed to serialize ad block engine";
    return false;
  }

  // Ensure parent directory exists.
  base::CreateDirectory(cache_path.DirName());

  std::string data(reinterpret_cast<const char*>(serialized.data()),
                   serialized.size());
  if (!base::WriteFile(cache_path, data)) {
    LOG(WARNING) << "Failed to write ad block engine cache";
    return false;
  }

  LOG(INFO) << "Astro ad block engine saved to cache ("
            << data.size() << " bytes)";
  return true;
}

bool AstroAdBlockEngine::ShouldBlock(
    const GURL& url,
    const GURL& source_url,
    network::mojom::RequestDestination destination) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);

  if (!is_ready_ || !url.is_valid()) {
    return false;
  }

  const std::string request_type = RequestDestinationToAdBlockType(destination);
  const std::string url_spec = url.spec();
  const std::string url_host = url.host();
  const std::string source_host = source_url.is_valid()
      ? source_url.host()
      : std::string();

  // Determine if this is a third-party request.
  const bool third_party =
      !source_host.empty() &&
      !net::registry_controlled_domains::SameDomainOrHost(
          url, source_url,
          net::registry_controlled_domains::INCLUDE_PRIVATE_REGISTRIES);

  BlockerResult result = engine_matches(
      *engine_, url_spec, url_host, source_host, request_type, third_party);

  // Block if matched and not an exception, or if marked important.
  return (result.matched && !result.has_exception) || result.important;
}

std::string AstroAdBlockEngine::GetCosmeticFiltersJson(const GURL& url) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);

  if (!is_ready_ || !url.is_valid()) {
    return "{}";
  }

  return std::string(engine_url_cosmetic_resources(*engine_, url.spec()));
}

bool AstroAdBlockEngine::IsReady() const {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  return is_ready_;
}

}  // namespace oxy::adblock
