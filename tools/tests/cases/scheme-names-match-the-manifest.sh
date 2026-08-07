#!/usr/bin/env bash
# Astro's scheme names exist in two places that must never disagree: the
# product manifest, which is #9's source of truth, and the C++ constants #11
# registers with Chromium.
#
# They are NOT generated from each other, and that is deliberate. Generating
# the header would place a GENERATED file inside the target //chrome/browser
# reaches through allow_circular_includes_from — exactly the failure
# chrome/browser/BUILD.gn:8392-8414 warns about ("the gn build graph may miss
# generated dependencies, which will result in compile errors"), and it
# surfaces only in some configurations. So the header is hand-written and this
# case is what makes the duplication safe.
#
# A drift here is not cosmetic. The manifest is what the installer, the OS
# registration and the identity tests read; the header is what the browser
# actually registers. If they diverge, the product claims one scheme and speaks
# another.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

MANIFEST="$ASTRO_ROOT/docs/astro-next/architecture/product.example.json"
HEADER="$ASTRO_ROOT/common/url_constants.h"

harness::assert_file_exists "$MANIFEST"
harness::assert_file_exists "$HEADER"

compare() {
    python3 - "$1" "$2" <<'PY'
import json, re, sys

manifest_path, header_path = sys.argv[1:3]

def find(node, key):
    if isinstance(node, dict):
        for name, value in node.items():
            if name == key:
                return value
            found = find(value, key)
            if found is not None:
                return found
    elif isinstance(node, list):
        for item in node:
            found = find(item, key)
            if found is not None:
                return found
    return None

with open(manifest_path, encoding="utf-8") as handle:
    schemes = find(json.load(handle), "schemes")

if not isinstance(schemes, dict) or "trusted" not in schemes or "untrusted" not in schemes:
    print(f"the manifest declares no usable `schemes` block: {schemes!r}")
    raise SystemExit(2)

header = open(header_path, encoding="utf-8").read()
pairs = {
    "trusted": r'kAstroUIScheme\[\]\s*=\s*"([^"]+)"',
    "untrusted": r'kAstroUIUntrustedScheme\[\]\s*=\s*"([^"]+)"',
}

problems = []
for role, pattern in pairs.items():
    match = re.search(pattern, header)
    if not match:
        # Distinguishable from a mismatch: the constant is GONE or renamed,
        # which a value comparison would silently read as "nothing to compare".
        problems.append(f"{role}: no constant matching /{pattern}/ in the header")
        continue
    if match.group(1) != schemes[role]:
        problems.append(
            f"{role}: manifest says {schemes[role]!r}, header says {match.group(1)!r}"
        )

# The two names must also differ from each other. They are separate security
# principals; if a rename ever collapsed them the checks above would both pass.
if schemes.get("trusted") == schemes.get("untrusted"):
    problems.append(
        f"trusted and untrusted are the same string ({schemes['trusted']!r}); "
        "they are distinct security principals and cannot share a name"
    )

if problems:
    print("scheme names disagree:")
    for problem in problems:
        print(f"  {problem}")
    raise SystemExit(1)

print(f"scheme names agree: trusted={schemes['trusted']} untrusted={schemes['untrusted']}")
PY
}

harness::run compare "$MANIFEST" "$HEADER"
harness::assert_status 0 "the committed manifest and header agree"
harness::assert_output_contains "trusted=astro" "names the trusted scheme it checked"
harness::assert_output_contains "untrusted=astro-untrusted" "names the untrusted scheme"

# --- the check must be able to fail ------------------------------------------
#
# Every assertion above is satisfied by a comparison that always returns 0, so
# the drift is simulated against copies rather than trusted to never happen.

tmp="$(harness::tmpdir)"

sed 's/kAstroUIScheme\[\] = "astro"/kAstroUIScheme[] = "astr0"/' "$HEADER" > "$tmp/drifted.h"
harness::run compare "$MANIFEST" "$tmp/drifted.h"
harness::assert_nonzero_status "a header whose value drifted from the manifest"
harness::assert_output_contains "manifest says 'astro'" "reports the manifest value"
harness::assert_output_contains "header says 'astr0'" "reports the header value"

sed '/kAstroUIUntrustedScheme/d' "$HEADER" > "$tmp/missing.h"
harness::run compare "$MANIFEST" "$tmp/missing.h"
harness::assert_nonzero_status "a header with the constant removed"
harness::assert_output_contains "no constant matching" \
    "a MISSING constant is distinguishable from a mismatched one"

python3 - "$MANIFEST" "$tmp/collapsed.json" <<'PY'
import json, sys
src, dst = sys.argv[1:3]
with open(src, encoding="utf-8") as handle:
    document = json.load(handle)

def collapse(node):
    if isinstance(node, dict):
        if "trusted" in node and "untrusted" in node:
            node["untrusted"] = node["trusted"]
            return True
        return any(collapse(v) for v in node.values())
    if isinstance(node, list):
        return any(collapse(v) for v in node)
    return False

assert collapse(document), "no schemes block found to collapse"
with open(dst, "w", encoding="utf-8") as handle:
    json.dump(document, handle)
PY
harness::run compare "$tmp/collapsed.json" "$HEADER"
harness::assert_nonzero_status "a manifest collapsing the two principals into one name"
harness::assert_output_contains "distinct security principals" "says why that is fatal"

harness::pass
