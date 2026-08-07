// Copyright 2026 Oxy. Astro product module.

#ifndef ASTRO_BROWSER_ASTRO_BROWSER_MAIN_EXTRA_PARTS_H_
#define ASTRO_BROWSER_ASTRO_BROWSER_MAIN_EXTRA_PARTS_H_

#include <memory>

class ChromeBrowserMainExtraParts;

namespace astro {

// Creates Astro's browser-process lifecycle parts.
//
// This is the ONLY function Chromium calls into Astro, and it deliberately
// RETURNS the parts rather than installing them. Upstream's own
// chrome::AddMetricsExtraParts() takes a ChromeBrowserMainParts* and calls
// AddParts itself; copying that shape cost a real compile failure, because
// chrome/browser/chrome_browser_main.h includes the GENERATED header
// chrome/browser/buildflags.h, which //astro would then have to depend on.
//
// Returning instead needs only chrome_browser_main_extra_parts.h, which has
// zero includes of its own — so //astro stays a leaf of the build graph and
// acquires no dependency on Chromium's generated files. The caller does the
// one thing it is already able to do:
//
//     main_parts->AddParts(astro::CreateExtraParts());
//
// Everything Astro adds hangs off the object returned here. Growing Astro must
// never mean growing the Chromium delta.
std::unique_ptr<ChromeBrowserMainExtraParts> CreateExtraParts();

}  // namespace astro

#endif  // ASTRO_BROWSER_ASTRO_BROWSER_MAIN_EXTRA_PARTS_H_
