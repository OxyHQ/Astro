// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_ADBLOCK_ADBLOCK_DOMAIN_RESOLVER_H_
#define CHROME_BROWSER_OXY_ADBLOCK_ADBLOCK_DOMAIN_RESOLVER_H_

#include <string>

// Forward-declare the CXX-generated struct.
namespace oxy::adblock {
struct DomainPosition;
}

namespace oxy::adblock {

// Called from Rust via CXX bridge. Resolves the registrable domain
// within a hostname using Chromium's registry_controlled_domains.
// e.g. "ads.tracking.example.co.uk" -> start=13, end=27 ("example.co.uk")
DomainPosition resolve_domain_position(const std::string& host);

}  // namespace oxy::adblock

#endif  // CHROME_BROWSER_OXY_ADBLOCK_ADBLOCK_DOMAIN_RESOLVER_H_
