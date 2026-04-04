// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/oxy/adblock/astro_adblock_resource_type.h"

namespace oxy::adblock {

std::string RequestDestinationToAdBlockType(
    network::mojom::RequestDestination destination) {
  switch (destination) {
    case network::mojom::RequestDestination::kScript:
    case network::mojom::RequestDestination::kServiceWorker:
    case network::mojom::RequestDestination::kSharedWorker:
    case network::mojom::RequestDestination::kWorker:
      return "script";

    case network::mojom::RequestDestination::kImage:
    case network::mojom::RequestDestination::kFavicon:
      return "image";

    case network::mojom::RequestDestination::kStyle:
      return "stylesheet";

    case network::mojom::RequestDestination::kFont:
      return "font";

    case network::mojom::RequestDestination::kIframe:
    case network::mojom::RequestDestination::kFencedframe:
      return "subdocument";

    case network::mojom::RequestDestination::kDocument:
      return "document";

    case network::mojom::RequestDestination::kEmpty:
      // Empty destination is used for fetch/XHR requests.
      return "xmlhttprequest";

    case network::mojom::RequestDestination::kAudio:
    case network::mojom::RequestDestination::kVideo:
    case network::mojom::RequestDestination::kTrack:
      return "media";

    case network::mojom::RequestDestination::kObject:
    case network::mojom::RequestDestination::kEmbed:
      return "object";

    case network::mojom::RequestDestination::kWebBundle:
    case network::mojom::RequestDestination::kWebIdentity:
    case network::mojom::RequestDestination::kJson:
    case network::mojom::RequestDestination::kReport:
    case network::mojom::RequestDestination::kXslt:
    case network::mojom::RequestDestination::kDictionary:
    case network::mojom::RequestDestination::kSpeculationRules:
    case network::mojom::RequestDestination::kSharedStorageWorklet:
    default:
      return "other";
  }
}

}  // namespace oxy::adblock
