# //astro is a leaf of the Chromium build graph. It may depend on Chromium
# public API; Chromium may not depend on it except through the single declared
# hook.
#
# Every entry here is a deliberate coupling. The delta report
# (tools/delta-report) fails when a Chromium-owned file references Astro from
# outside the allowlist, and this file is the mirror of that rule pointing the
# other way.
# `+chrome/browser` is the one coupling that is NOT a leaf relationship, and it
# is deliberate: Astro returns a ChromeBrowserMainExtraParts, which is a chrome/ type
# whose header has zero includes of its own. chrome/browser/BUILD.gn therefore lists //astro under
# `allow_circular_includes_from` (the same mechanism upstream already uses at
# chrome/browser/BUILD.gn:1531). It is a real concession with a documented
# failure mode — a missed generated-file dependency surfaces as a compile
# error — and it buys a six-line delta instead of a new abstraction layer.
include_rules = [
  "+base",
  "+chrome/browser/chrome_browser_main_extra_parts.h",
  "+build",
  "+content/public/browser",
  "+content/public/common",
  "+ui/base",
  "+url",
]
