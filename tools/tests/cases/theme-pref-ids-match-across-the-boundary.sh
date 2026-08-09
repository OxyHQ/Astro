#!/usr/bin/env bash
# The theme prefs are spelled in three places and nothing else compares them.
#
# A pref path is a string on every side of the browser/page boundary. The C++
# constant, the registration inside a patch, and the TypeScript the page reads
# are three independent spellings of one fact, and every mechanism that would
# normally catch a rename is absent here by construction:
#
#   * the patch edits an upstream file, so it cannot include the overlay's
#     header and cannot use the constant;
#   * the page is TypeScript, so no C++ symbol reaches it either;
#   * PrefService::GetString on an unregistered path does not fail -- it
#     returns the type's empty value. A page reading a pref nobody registered
#     therefore renders its default, silently and forever.
#
# The failure that produces is a control that looks right, moves when clicked,
# and changes nothing. This case is the only thing standing between a rename
# and that outcome.
#
# Both directions are exercised: the real repository must agree, and a copy
# with ONE of the three spellings changed must fail, naming it. A comparison
# that cannot fail is not a comparison.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

tmp="$(harness::tmpdir)"

HEADER="$ASTRO_ROOT/src/chrome/browser/oxy/astro_pref_names.h"
PATCH="$ASTRO_ROOT/patches/astro/020-register-oxy-prefs.patch"
TS="$ASTRO_ROOT/webui/app/src/platform/browser/pref-ids.ts"
TOKENS="$ASTRO_ROOT/src/chrome/browser/oxy/ui/astro_color_tokens.h"

CHECK="$tmp/check.py"
cat > "$CHECK" <<'PY'
"""Compare the three spellings of Astro's theme prefs.

argv: <astro_pref_names.h> <020 patch> <pref-ids.ts> <astro_color_tokens.h>
Exit 0 when they agree, 1 naming every disagreement.
"""
import pathlib
import re
import sys

header_path, patch_path, ts_path, tokens_path = (
    pathlib.Path(p) for p in sys.argv[1:5]
)
problems = []
compared = 0


def read(path):
    if not path.is_file():
        problems.append(f"missing input: {path}")
        return None
    return path.read_text(encoding="utf-8")


header = read(header_path)
patch = read(patch_path)
ts = read(ts_path)
tokens = read(tokens_path)
if problems:
    for problem in problems:
        print(f"      {problem}")
    print("      Every input is required. An absent one is a broken path, not a pass.")
    raise SystemExit(1)


def cpp_constant(name):
    match = re.search(rf'{name}\[\]\s*=\s*"([^"]*)"', header)
    return match.group(1) if match else None


# The C++ side is the reference: it is the only spelling a compiler checks
# against its users.
truth = {
    "preset pref path": cpp_constant("kThemePreset"),
    "preset default": cpp_constant("kDefaultThemePreset"),
}
for label, value in truth.items():
    if value is None:
        problems.append(f"astro_pref_names.h declares no constant for the {label}")
if problems:
    for problem in problems:
        print(f"      {problem}")
    raise SystemExit(1)

# --- the patch that registers it ------------------------------------------
#
# Only ADDED lines count. A context line would let the check pass against a
# registration the patch is deleting.
registrations = re.findall(
    r'^\+\s*registry->RegisterStringPref\("([^"]+)",\s*"([^"]*)"\);',
    patch,
    re.MULTILINE,
)
registered = {path: default for path, default in registrations}
compared += 1
if truth["preset pref path"] not in registered:
    problems.append(
        f"patch 020 registers no pref at {truth['preset pref path']!r}; "
        f"it adds {sorted(registered)!r}"
    )
elif registered[truth["preset pref path"]] != truth["preset default"]:
    problems.append(
        f"patch 020 registers {truth['preset pref path']!r} with default "
        f"{registered[truth['preset pref path']]!r}, "
        f"astro_pref_names.h says {truth['preset default']!r}"
    )

# --- the page that reads it -----------------------------------------------
ts_match = re.search(r"THEME_PRESET_PREF\s*=\s*'([^']*)'", ts)
compared += 1
if not ts_match:
    problems.append("pref-ids.ts exports no THEME_PRESET_PREF")
elif ts_match.group(1) != truth["preset pref path"]:
    problems.append(
        f"pref-ids.ts THEME_PRESET_PREF is {ts_match.group(1)!r}, "
        f"astro_pref_names.h says {truth['preset pref path']!r}"
    )

# --- the default has to be a colour this build ships -----------------------
#
# astro_color_mixer.cc static_asserts the same thing, but only once the
# overlay compiles, which is a far more expensive place to learn it.
names = re.search(
    r"kColorPresetNames\s*=\s*\{\{(.*?)\}\};", tokens, re.DOTALL
)
compared += 1
if not names:
    problems.append("astro_color_tokens.h has no kColorPresetNames table to check against")
else:
    shipped = re.findall(r'"([^"]+)"', names.group(1))
    if not shipped:
        problems.append("kColorPresetNames parsed as empty; the table shape changed")
    elif truth["preset default"] not in shipped:
        problems.append(
            f"the registered default preset {truth['preset default']!r} is not one of "
            f"the {len(shipped)} presets in astro_color_tokens.h"
        )

# The upstream half of the pair. Astro deliberately adds no pref of its own for
# light/dark, so the TS constant has to name upstream's -- and that name is
# spelled in a Chromium header this repository does not carry.
COLOR_SCHEME = "browser.theme.color_scheme2"
scheme_match = re.search(r"COLOR_SCHEME_PREF\s*=\s*'([^']*)'", ts)
compared += 1
if not scheme_match:
    problems.append("pref-ids.ts exports no COLOR_SCHEME_PREF")
elif scheme_match.group(1) != COLOR_SCHEME:
    problems.append(
        f"pref-ids.ts COLOR_SCHEME_PREF is {scheme_match.group(1)!r}; upstream's "
        f"prefs::kBrowserColorScheme is {COLOR_SCHEME!r}"
    )

if compared == 0:
    print("      nothing was compared. That is a broken traversal, not agreement.")
    raise SystemExit(1)

if problems:
    print(f"      the theme prefs disagree in {len(problems)} place(s):")
    for problem in problems:
        print(f"        {problem}")
    print("      astro_pref_names.h is the reference. Change it, patch 020 and")
    print("      pref-ids.ts together or not at all.")
    raise SystemExit(1)

print(f"      {compared} spelling(s) agree on {truth['preset pref path']} "
      f"(default {truth['preset default']})")
raise SystemExit(0)
PY

harness::run python3 "$CHECK" "$HEADER" "$PATCH" "$TS" "$TOKENS"
harness::assert_status 0 "the three spellings of the theme prefs agree"

# --------------------------------------------------------------------------
# The negative direction, one mutation at a time.
#
# Each copy changes exactly one spelling. A check that passes any of these is
# not reading that file at all.
# --------------------------------------------------------------------------

mutate() {
    # mutate <name> <which> <sed-expression>
    local name="$1" which="$2" expression="$3"
    local dir="$tmp/$name"
    mkdir -p "$dir"
    cp "$HEADER" "$dir/astro_pref_names.h"
    cp "$PATCH" "$dir/020.patch"
    cp "$TS" "$dir/pref-ids.ts"
    cp "$TOKENS" "$dir/astro_color_tokens.h"
    sed -i "$expression" "$dir/$which"
    harness::run python3 "$CHECK" \
        "$dir/astro_pref_names.h" "$dir/020.patch" "$dir/pref-ids.ts" \
        "$dir/astro_color_tokens.h"
}

mutate renamed-in-header astro_pref_names.h \
    's|"astro\.theme\.preset"|"astro.theme.color_preset"|'
harness::assert_status 1 "a rename in the C++ constant is caught"
harness::assert_output_contains "patch 020 registers no pref" \
    "and the failure names the patch that no longer matches"

mutate renamed-in-patch 020.patch \
    's|RegisterStringPref("astro\.theme\.preset"|RegisterStringPref("astro.theme.color_preset"|'
harness::assert_status 1 "a rename in the registration patch is caught"

mutate renamed-in-page pref-ids.ts \
    "s|THEME_PRESET_PREF = 'astro.theme.preset'|THEME_PRESET_PREF = 'astro.theme.color_preset'|"
harness::assert_status 1 "a rename in the page's constant is caught"
harness::assert_output_contains "THEME_PRESET_PREF" \
    "and the failure names the page constant"

mutate default-not-shipped astro_pref_names.h \
    's|kDefaultThemePreset\[\] = "oxy"|kDefaultThemePreset[] = "chartreuse"|'
harness::assert_status 1 "a default naming a preset Bloom does not ship is caught"
harness::assert_output_contains "is not one of the" \
    "and the failure says how many presets there are"

mutate upstream-scheme-pref pref-ids.ts \
    "s|COLOR_SCHEME_PREF = 'browser.theme.color_scheme2'|COLOR_SCHEME_PREF = 'browser.theme.color_scheme'|"
harness::assert_status 1 "a wrong spelling of upstream's scheme pref is caught"

# A missing input must fail rather than compare nothing.
harness::run python3 "$CHECK" "$tmp/absent.h" "$PATCH" "$TS" "$TOKENS"
harness::assert_status 1 "an absent input fails instead of passing vacuously"
harness::assert_output_contains "missing input" "and says which one"

harness::pass
