// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_ADBLOCK_ASTRO_ADBLOCK_FILTER_LIST_CATALOG_H_
#define CHROME_BROWSER_OXY_ADBLOCK_ASTRO_ADBLOCK_FILTER_LIST_CATALOG_H_

#include <string>
#include <vector>

#include "url/gurl.h"

namespace oxy::adblock {

// Describes a single filter list available for use.
struct FilterListEntry {
  // Unique identifier for this list.
  std::string id;

  // Human-readable name.
  std::string name;

  // Description of what the list blocks.
  std::string description;

  // URL to download the list from.
  GURL url;

  // Whether this list is enabled by default.
  bool default_enabled;

  // Whether this is a built-in list (cannot be removed).
  bool builtin;
};

// Returns the catalog of all available filter lists.
// This includes built-in lists (EasyList, EasyPrivacy) and well-known
// community lists (Fanboy's, regional lists, etc.).
std::vector<FilterListEntry> GetFilterListCatalog();

// Returns only the built-in lists that are enabled by default.
std::vector<FilterListEntry> GetDefaultFilterLists();

}  // namespace oxy::adblock

#endif  // CHROME_BROWSER_OXY_ADBLOCK_ASTRO_ADBLOCK_FILTER_LIST_CATALOG_H_
