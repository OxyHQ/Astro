// Copyright 2026 Oxy. Astro build-safety FIXTURE — not product code.
//
// This stands in for //astro/common/url_constants.h in
// tools/tests/cases/scheme-names-match-the-manifest.sh. It is here, and
// committed, for one reason: the case mutates its subject a dozen times to
// prove each detector fires, and a subject that is not in the commit makes the
// case pass in a working tree and fail in a clean checkout of the same commit.
// That is the coupled-unit defect tools/verify-clean-head.sh exists to catch,
// and it caught this one.
//
// It is NOT a copy of the product header kept in step by hand, and nothing
// checks the two against each other. The product header is #11's, it is not in
// every commit that carries this checker, and the join against it is what
// `scheme_constants.py --check-product` performs — refusing, with its own exit
// status, while the file is absent. What this fixture is for is the CHECKER:
// every rule the checker applies to a header is exercised here, against a
// header whose shape is deliberately the narrowest thing the parser accepts.
//
// The two VALUES are load-bearing and are not free to drift. Every fixture in
// that case pairs this header with the repository's REAL manifest and schema,
// so these must be the names the manifest declares. If the product ever renames
// a scheme, the manifest, the schema, the product header and this file move in
// the same commit — and this file failing is what says so, by name.

#ifndef ASTRO_TOOLS_TESTS_FIXTURES_SCHEME_CONSTANTS_COMMON_URL_CONSTANTS_H_
#define ASTRO_TOOLS_TESTS_FIXTURES_SCHEME_CONSTANTS_COMMON_URL_CONSTANTS_H_

namespace astro {

// Written whole, each on its own line. A scheme built by concatenation —
// `kAstroUIScheme "-untrusted"` — carries the right bytes while making one
// scheme a derivative of the other, and the two are separate security
// principals. The case mutates exactly these two lines to prove the checker
// says so.
inline constexpr char kAstroUIScheme[] = "astro";
inline constexpr char kAstroUIUntrustedScheme[] = "astro-untrusted";

}  // namespace astro

#endif  // ASTRO_TOOLS_TESTS_FIXTURES_SCHEME_CONSTANTS_COMMON_URL_CONSTANTS_H_
