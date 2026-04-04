// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_ADBLOCK_ASTRO_ADBLOCK_RESOURCE_TYPE_H_
#define CHROME_BROWSER_OXY_ADBLOCK_ASTRO_ADBLOCK_RESOURCE_TYPE_H_

#include <string>

#include "services/network/public/mojom/fetch_api.mojom-shared.h"

namespace oxy::adblock {

// Converts a Chromium RequestDestination to the adblock-rust resource type
// string used by EasyList-format filter rules.
std::string RequestDestinationToAdBlockType(
    network::mojom::RequestDestination destination);

}  // namespace oxy::adblock

#endif  // CHROME_BROWSER_OXY_ADBLOCK_ASTRO_ADBLOCK_RESOURCE_TYPE_H_
