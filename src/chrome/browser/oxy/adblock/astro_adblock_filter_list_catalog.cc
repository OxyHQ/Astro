// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/oxy/adblock/astro_adblock_filter_list_catalog.h"

namespace oxy::adblock {

std::vector<FilterListEntry> GetFilterListCatalog() {
  return {
      // === Built-in (always available, enabled by default) ===
      {
          .id = "easylist",
          .name = "EasyList",
          .description = "Primary ad blocking rules used by most ad blockers",
          .url = GURL("https://easylist.to/easylist/easylist.txt"),
          .default_enabled = true,
          .builtin = true,
      },
      {
          .id = "easyprivacy",
          .name = "EasyPrivacy",
          .description = "Blocks tracking scripts, pixels, and analytics",
          .url = GURL("https://easylist.to/easylist/easyprivacy.txt"),
          .default_enabled = true,
          .builtin = true,
      },

      // === Optional community lists ===
      {
          .id = "fanboy-annoyance",
          .name = "Fanboy's Annoyance List",
          .description =
              "Blocks cookie notices, social widgets, and other annoyances",
          .url = GURL("https://easylist.to/easylist/fanboy-annoyance.txt"),
          .default_enabled = false,
          .builtin = false,
      },
      {
          .id = "fanboy-social",
          .name = "Fanboy's Social Blocking List",
          .description = "Blocks social media widgets and buttons",
          .url = GURL(
              "https://easylist.to/easylist/fanboy-social.txt"),
          .default_enabled = false,
          .builtin = false,
      },
      {
          .id = "peter-lowe",
          .name = "Peter Lowe's Ad and Tracking Server List",
          .description = "Compact list of known ad and tracking domains",
          .url = GURL(
              "https://pgl.yoyo.org/adservers/"
              "serverlist.php?hostformat=adblockplus&showintro=1&mimetype="
              "plaintext"),
          .default_enabled = false,
          .builtin = false,
      },

      // === Regional lists ===
      {
          .id = "easylist-germany",
          .name = "EasyList Germany",
          .description = "German-specific ad blocking rules",
          .url = GURL(
              "https://easylist.to/easylistgermany/easylistgermany.txt"),
          .default_enabled = false,
          .builtin = false,
      },
      {
          .id = "easylist-spain",
          .name = "EasyList Spain",
          .description = "Spanish-specific ad blocking rules",
          .url = GURL("https://easylist-downloads.adblockplus.org/"
                       "easylistspanish.txt"),
          .default_enabled = false,
          .builtin = false,
      },
      {
          .id = "easylist-france",
          .name = "Liste FR",
          .description = "French-specific ad blocking rules",
          .url = GURL("https://easylist-downloads.adblockplus.org/"
                       "liste_fr.txt"),
          .default_enabled = false,
          .builtin = false,
      },
      {
          .id = "easylist-china",
          .name = "EasyList China",
          .description = "Chinese-specific ad blocking rules",
          .url = GURL("https://easylist-downloads.adblockplus.org/"
                       "easylistchina.txt"),
          .default_enabled = false,
          .builtin = false,
      },
      {
          .id = "easylist-dutch",
          .name = "EasyList Dutch",
          .description = "Dutch-specific ad blocking rules",
          .url = GURL("https://easylist-downloads.adblockplus.org/"
                       "easylistdutch.txt"),
          .default_enabled = false,
          .builtin = false,
      },
      {
          .id = "easylist-italy",
          .name = "EasyList Italy",
          .description = "Italian-specific ad blocking rules",
          .url = GURL("https://easylist-downloads.adblockplus.org/"
                       "easylistitaly.txt"),
          .default_enabled = false,
          .builtin = false,
      },
  };
}

std::vector<FilterListEntry> GetDefaultFilterLists() {
  auto catalog = GetFilterListCatalog();
  std::vector<FilterListEntry> defaults;
  for (auto& entry : catalog) {
    if (entry.default_enabled) {
      defaults.push_back(std::move(entry));
    }
  }
  return defaults;
}

}  // namespace oxy::adblock
