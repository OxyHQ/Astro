#!/usr/bin/env bash
# The new tab page's prefs are spelled twice and nothing else compares them.
#
# Same failure as the theme prefs next door, one spelling shorter. The page no
# longer names a pref at all -- it speaks astro_ntp.mojom, which names a
# decision -- so the TypeScript third spelling that
# theme-pref-ids-match-across-the-boundary.sh has to check does not exist here.
# Two remain, and the boundary between them is still one no compiler crosses:
#
#   * chrome/browser/oxy/astro_pref_names.h, which the overlay's C++ uses;
#   * patches/astro/020-register-oxy-prefs.patch, which registers them into an
#     UPSTREAM file the overlay's headers cannot reach.
#
# An unregistered path does not fail. PrefService::GetBoolean returns false,
# GetString returns empty and GetList returns an empty list, so a widget that
# was renamed apart from its registration is a widget the browser reports as
# hidden, forever, with nothing said anywhere.
#
# The join is STRICT IN BOTH DIRECTIONS. A constant with no registration is the
# failure above; a registration with no constant is a pref written into every
# profile that nothing will ever read, which is how a rename leaves its old
# name behind.
#
# Both directions are exercised against a mutated copy as well as the real
# repository. A comparison that cannot fail is not a comparison.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

tmp="$(harness::tmpdir)"

HEADER="$ASTRO_ROOT/src/chrome/browser/oxy/astro_pref_names.h"
PATCH="$ASTRO_ROOT/patches/astro/020-register-oxy-prefs.patch"

CHECK="$tmp/check.py"
cat > "$CHECK" <<'PY'
"""Compare the two spellings of Astro's new tab page prefs.

argv: <astro_pref_names.h> <020 patch>
Exit 0 when they agree, 1 naming every disagreement.
"""
import pathlib
import re
import sys

header_path, patch_path = (pathlib.Path(p) for p in sys.argv[1:3])
problems = []

for path in (header_path, patch_path):
    if not path.is_file():
        print(f"      missing input: {path}")
        print("      Every input is required. An absent one is a broken path, not a pass.")
        raise SystemExit(1)

header = header_path.read_text(encoding="utf-8")
patch = patch_path.read_text(encoding="utf-8")

# The C++ side is the reference: it is the only spelling a compiler checks
# against its users. Every constant whose name starts kNtp counts, so adding a
# widget to the header without registering it fails here rather than in a
# profile.
declared = dict(
    re.findall(r'\bk(Ntp[A-Za-z0-9]*)\[\]\s*=\s*"([^"]*)"', header)
)
if not declared:
    print("      astro_pref_names.h declares no kNtp* constants; the shape changed.")
    raise SystemExit(1)

# Only ADDED lines count. A context line would let this pass against a
# registration the patch is deleting.
registered = set(
    re.findall(
        r'^\+\s*registry->Register(?:Boolean|String|List|Integer)Pref\("(astro\.ntp_[^"]+)"',
        patch,
        re.MULTILINE,
    )
)

for name, path in sorted(declared.items()):
    if path not in registered:
        problems.append(
            f"astro_pref_names.h declares k{name} = {path!r}, which patch 020 "
            f"does not register"
        )

for path in sorted(registered - set(declared.values())):
    problems.append(
        f"patch 020 registers {path!r}, which astro_pref_names.h declares no "
        f"constant for"
    )

# A vacuity floor. A traversal that silently matched nothing would otherwise
# report agreement, which is the failure mode this whole file exists to avoid.
if len(declared) < 10:
    problems.append(
        f"only {len(declared)} kNtp* constant(s) found; the new tab page has "
        f"seven widget visibility prefs plus order, links and notes, so a "
        f"smaller number means the parse broke rather than that prefs were "
        f"removed"
    )

if problems:
    print(f"      the new tab page prefs disagree in {len(problems)} place(s):")
    for problem in problems:
        print(f"        {problem}")
    print("      astro_pref_names.h is the reference. Change it and patch 020")
    print("      together or not at all.")
    raise SystemExit(1)

print(f"      {len(declared)} pref path(s) declared and registered, both ways")
raise SystemExit(0)
PY

harness::run python3 "$CHECK" "$HEADER" "$PATCH"
harness::assert_status 0 "the two spellings of the new tab page prefs agree"
harness::assert_output_contains "both ways" "and says the join ran in both directions"

# --------------------------------------------------------------------------
# The negative direction, one mutation at a time.
# --------------------------------------------------------------------------

mutate() {
    # mutate <name> <which> <sed-expression>
    local name="$1" which="$2" expression="$3"
    local dir="$tmp/$name"
    mkdir -p "$dir"
    cp "$HEADER" "$dir/astro_pref_names.h"
    cp "$PATCH" "$dir/020.patch"
    sed -i "$expression" "$dir/$which"
    harness::run python3 "$CHECK" "$dir/astro_pref_names.h" "$dir/020.patch"
}

mutate renamed-in-header astro_pref_names.h \
    's|"astro\.ntp_show_notes"|"astro.ntp_show_note"|'
harness::assert_status 1 "a rename in the C++ constant is caught"
harness::assert_output_contains "patch 020 does not register" \
    "and the failure names the direction that broke"

mutate renamed-in-patch 020.patch \
    's|RegisterStringPref("astro\.ntp_notes"|RegisterStringPref("astro.ntp_note"|'
harness::assert_status 1 "a rename in the registration patch is caught"
harness::assert_output_contains "declares no constant for" \
    "and names the orphaned registration"

# The list prefs are registered by a DIFFERENT method than the booleans, so a
# regex that only understood RegisterBooleanPref would pass every mutation
# above and miss these entirely.
mutate dropped-list-registration 020.patch \
    '/RegisterListPref("astro\.ntp_quick_links")/d'
harness::assert_status 1 "a dropped list-pref registration is caught"
harness::assert_output_contains "astro.ntp_quick_links" "and names the pref"

# A registration that is only CONTEXT in the patch -- the shape a revert takes
# -- must not count as registering anything.
mutate registration-demoted-to-context 020.patch \
    's|^+  registry->RegisterBooleanPref("astro\.ntp_show_clock", true);|   registry->RegisterBooleanPref("astro.ntp_show_clock", true);|'
harness::assert_status 1 "a registration present only as context does not count"
harness::assert_output_contains "astro.ntp_show_clock" "and names it"

# A missing input must fail rather than compare nothing.
harness::run python3 "$CHECK" "$tmp/absent.h" "$PATCH"
harness::assert_status 1 "an absent input fails instead of passing vacuously"
harness::assert_output_contains "missing input" "and says which one"

harness::pass
