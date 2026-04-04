// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_ADBLOCK_ASTRO_ADBLOCK_ENGINE_H_
#define CHROME_BROWSER_OXY_ADBLOCK_ASTRO_ADBLOCK_ENGINE_H_

#include <string>

#include "base/files/file_path.h"
#include "base/sequence_checker.h"
#include "services/network/public/mojom/fetch_api.mojom-forward.h"
#include "third_party/rust/cxx/v1/cxx.h"
#include "url/gurl.h"

namespace oxy::adblock {

struct BlockerResult;
class Engine;

// C++ wrapper around the Rust adblock engine. Manages filter list loading,
// request matching, serialization/deserialization for engine caching, and
// cosmetic filter queries.
//
// All methods must be called on the same sequence (enforced by sequence
// checker). The engine is NOT thread-safe — callers must serialize access.
class AstroAdBlockEngine {
 public:
  AstroAdBlockEngine();
  ~AstroAdBlockEngine();

  AstroAdBlockEngine(const AstroAdBlockEngine&) = delete;
  AstroAdBlockEngine& operator=(const AstroAdBlockEngine&) = delete;

  // Initializes the domain resolver. Must be called once before any matching.
  static bool InitializeDomainResolver();

  // Loads a filter list (EasyList format text) into the engine.
  // Can be called multiple times to add multiple lists before finalizing.
  void AddFilterList(const std::string& rules);

  // Finalizes all added filter lists and builds the engine.
  // Must be called after all AddFilterList() calls and before matching.
  void Build();

  // Loads a previously serialized engine from disk (fast startup path).
  // Returns true on success.
  bool LoadFromCache(const base::FilePath& cache_path);

  // Serializes the engine to disk for fast subsequent startups.
  // Returns true on success.
  bool SaveToCache(const base::FilePath& cache_path);

  // Returns true if the request should be blocked.
  bool ShouldBlock(const GURL& url,
                   const GURL& source_url,
                   network::mojom::RequestDestination destination);

  // Returns JSON-encoded cosmetic filter data for a page URL.
  std::string GetCosmeticFiltersJson(const GURL& url);

  // Returns true if the engine has been built or deserialized.
  bool IsReady() const;

 private:
  rust::Box<Engine> engine_ GUARDED_BY_CONTEXT(sequence_checker_);
  bool is_ready_ GUARDED_BY_CONTEXT(sequence_checker_) = false;

  // Accumulated filter list text, consumed by Build().
  std::vector<std::string> pending_filter_lists_
      GUARDED_BY_CONTEXT(sequence_checker_);

  SEQUENCE_CHECKER(sequence_checker_);
};

}  // namespace oxy::adblock

#endif  // CHROME_BROWSER_OXY_ADBLOCK_ASTRO_ADBLOCK_ENGINE_H_
