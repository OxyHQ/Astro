// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/oxy/adblock/adblock_domain_resolver.h"

#include "chrome/browser/oxy/adblock/rs/src/lib.rs.h"
#include "net/base/registry_controlled_domains/registry_controlled_domain.h"

namespace oxy::adblock {

DomainPosition resolve_domain_position(const std::string& host) {
  const auto domain =
      net::registry_controlled_domains::GetDomainAndRegistry(
          host,
          net::registry_controlled_domains::INCLUDE_PRIVATE_REGISTRIES);

  DomainPosition position;
  const size_t match = host.rfind(domain);
  if (!domain.empty() && match != std::string::npos) {
    position.start = static_cast<uint32_t>(match);
    position.end = static_cast<uint32_t>(match + domain.length());
  } else {
    position.start = 0;
    position.end = static_cast<uint32_t>(host.length());
  }
  return position;
}

}  // namespace oxy::adblock
