#!/usr/bin/env bash
# Two surfaces offer Astro's colour presets, and only one of them is compiled
# against the other's idea of which presets those are.
#
# Bloom gates three of its eighteen presets — `oxy` and `faircoin` are reserved
# for the accounts whose brands they are, `mono` is sold with a subscription —
# and Bloom only DECLARES the gate. Every consumer enforces it. Astro has two:
#
#   * webui/app's appearance section, which imports Bloom directly and states
#     the rule as `['oxy', ...FREE_COLOR_NAMES]`;
#   * the Customize panel's colour picker, C++, which reads the generated
#     gate table in astro_color_tokens.h through astro::IsColorPresetOffered.
#
# Nothing connects them. The TypeScript cannot see a C++ constant and the C++
# cannot import Bloom, so the two spellings of one rule can drift apart with no
# compiler, no linker and no runtime error anywhere in the path. The failure
# they produce is not a crash: it is a picker that hands out another
# organisation's brand colour, looking entirely correct while it does it, and
# the only person who ever finds out is the one whose brand it was.
#
# That is not hypothetical here. The gates reached C++ as COMMENTS at first, so
# the first consumer to iterate kColorPresetNames offered all eighteen. Bloom's
# own color-presets.ts records the same regression happening on its side
# earlier: "Conflating them is how the picker came to offer both of Oxy's
# reserved brand colours to everybody."
#
# Both directions are exercised. The repository must agree, and a copy with ONE
# side changed must fail and name it.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

tmp="$(harness::tmpdir)"

TOKENS="$ASTRO_ROOT/src/chrome/browser/oxy/ui/astro_color_tokens.h"
RULE="$ASTRO_ROOT/src/chrome/browser/oxy/astro_theme_service.h"
PREFS="$ASTRO_ROOT/src/chrome/browser/oxy/astro_pref_names.h"
TSX="$ASTRO_ROOT/webui/app/src/pages/settings/sections/appearance.tsx"
PATCH="$ASTRO_ROOT/patches/astro/070-theme-color-picker-astro-presets.patch"

harness::assert_file_exists "$TOKENS"
harness::assert_file_exists "$RULE"
harness::assert_file_exists "$PREFS"
harness::assert_file_exists "$TSX"
harness::assert_file_exists "$PATCH"

CHECK="$tmp/check.py"
cat > "$CHECK" <<'PY'
"""Compare the two offered-preset lists.

argv: <astro_color_tokens.h> <astro_theme_service.h> <astro_pref_names.h>
      <appearance.tsx> <070 patch>
Exit 0 when they agree, 1 naming every disagreement.
"""
import pathlib
import re
import sys

tokens_path, rule_path, prefs_path, tsx_path, patch_path = (
    pathlib.Path(p) for p in sys.argv[1:6]
)
problems = []
compared = 0


def read(path):
    if not path.is_file():
        problems.append(f"missing input: {path}")
        return ""
    return path.read_text(encoding="utf-8")


tokens = read(tokens_path)
rule = read(rule_path)
prefs = read(prefs_path)
tsx = read(tsx_path)
patch = read(patch_path)
if problems:
    for problem in problems:
        print(f"      {problem}")
    print("      Every input is required. An absent one is a broken path, not a pass.")
    raise SystemExit(1)

# --- what Bloom ships, and what it gates -----------------------------------

names_block = re.search(r"kColorPresetNames\s*=\s*\{\{(.*?)\}\};", tokens, re.DOTALL)
gates_block = re.search(r"kColorPresetGates\s*=\s*\{\{(.*?)\}\};", tokens, re.DOTALL)
if not names_block:
    problems.append("astro_color_tokens.h has no kColorPresetNames table")
if not gates_block:
    problems.append(
        "astro_color_tokens.h has no kColorPresetGates table. The gates used to be "
        "comments; if they are comments again, no C++ consumer can filter on them."
    )
if problems:
    for problem in problems:
        print(f"      {problem}")
    raise SystemExit(1)

names = re.findall(r'"([^"]+)"', names_block.group(1))
gates = re.findall(r"ColorPresetGate::k([A-Za-z]+)", gates_block.group(1))

# Floors first. Every comparison below is between two sets, and two empty sets
# are equal — a broken parse would otherwise be the quietest possible pass.
if len(names) < 18:
    problems.append(f"parsed {len(names)} preset name(s); Bloom ships 18")
if len(gates) != len(names):
    problems.append(
        f"parsed {len(names)} name(s) but {len(gates)} gate(s); the tables are "
        "indexed together and cannot be different lengths"
    )
if problems:
    for problem in problems:
        print(f"      {problem}")
    raise SystemExit(1)

gate_of = dict(zip(names, gates))
gated = {name for name, gate in gate_of.items() if gate != "None"}
if not gated:
    problems.append(
        "no preset is gated, so every filter in Astro is a no-op and this whole "
        "comparison would pass without measuring anything"
    )

# --- the default preset, which is the one gated preset Astro does offer -----

default_match = re.search(r'kDefaultThemePreset\[\]\s*=\s*"([^"]*)"', prefs)
if not default_match:
    problems.append("astro_pref_names.h declares no kDefaultThemePreset")
if problems:
    for problem in problems:
        print(f"      {problem}")
    raise SystemExit(1)
default = default_match.group(1)
if default not in names:
    problems.append(f"the default preset {default!r} is not one Bloom ships")

# --- the C++ rule ------------------------------------------------------------
#
# Read rather than trusted: the whole point is that it derives from the gate
# table. A rule that listed names would satisfy the set comparison below on the
# day it was written and rot silently afterwards, which is the failure this
# case exists for.

rule_body = re.search(
    r"constexpr bool IsColorPresetOffered\([^)]*\)\s*\{(.*?)\n\}", rule, re.DOTALL
)
compared += 1
if not rule_body:
    problems.append(
        "astro_theme_service.h declares no constexpr IsColorPresetOffered; the C++ "
        "side has no single rule to compare against"
    )
else:
    body = rule_body.group(1)
    if "ColorPresetGateFor" not in body:
        problems.append(
            "IsColorPresetOffered does not read ColorPresetGateFor. If it lists "
            "presets by hand, Bloom adding one offers it by default."
        )
    if "kDefaultColorPreset" not in body:
        problems.append(
            "IsColorPresetOffered does not mention kDefaultColorPreset, so Astro's "
            "own brand preset is either excluded or hard-coded"
        )
    hard_coded = re.findall(r'"([^"]+)"', body)
    if hard_coded:
        problems.append(
            f"IsColorPresetOffered names presets by literal: {hard_coded!r}. The "
            "rule has to read the generated table, not restate it."
        )

cpp_offered = {name for name in names if gate_of[name] == "None"} | {default}

compared += 1
if cpp_offered == set(names):
    problems.append(
        "the C++ side offers every preset Bloom ships, so nothing is being "
        "withheld and the filter is doing nothing"
    )

# --- the TypeScript side ------------------------------------------------------

compared += 1
if "FREE_COLOR_NAMES" not in tsx or "@oxyhq/bloom/color-presets" not in tsx:
    problems.append(
        "appearance.tsx does not import FREE_COLOR_NAMES from "
        "@oxyhq/bloom/color-presets; its palette is no longer derived from the gates"
    )

presets_match = re.search(r"PRESETS[^=\n]*=\s*\[([^\]]*)\]", tsx)
compared += 1
if not presets_match:
    problems.append("appearance.tsx declares no PRESETS list")
else:
    expression = presets_match.group(1)
    literals = re.findall(r"'([^']+)'", expression)
    spreads = re.findall(r"\.\.\.\s*([A-Za-z_][A-Za-z0-9_]*)", expression)

    if "FREE_COLOR_NAMES" not in spreads:
        problems.append(
            f"appearance.tsx's PRESETS does not spread FREE_COLOR_NAMES (it spreads "
            f"{spreads!r}). A hand-written list is exactly what drifts."
        )
    unknown = [name for name in literals if name not in names]
    if unknown:
        problems.append(
            f"appearance.tsx offers {unknown!r}, which Bloom does not ship"
        )

    ts_offered = set(literals)
    if "FREE_COLOR_NAMES" in spreads:
        ts_offered |= {name for name in names if gate_of[name] == "None"}

    compared += 1
    if ts_offered != cpp_offered:
        only_ts = sorted(ts_offered - cpp_offered)
        only_cpp = sorted(cpp_offered - ts_offered)
        problems.append(
            "the two surfaces offer different palettes"
            + (f"; only the settings page offers {only_ts}" if only_ts else "")
            + (f"; only the colour picker offers {only_cpp}" if only_cpp else "")
        )

# --- the picker actually applies the rule -------------------------------------
#
# The rule existing is not the same as the picker calling it, and the picker is
# an upstream file edited by a patch, so nothing else in this repository reads it.

compared += 1
added = "\n".join(
    line for line in patch.splitlines() if line.startswith("+")
)
if "IsColorPresetOffered" not in added:
    problems.append(
        "patch 070 never calls IsColorPresetOffered, so the picker serves the whole "
        "generated table again -- reserved brands included"
    )

if compared == 0:
    print("      nothing was compared. That is a broken traversal, not agreement.")
    raise SystemExit(1)

if problems:
    print(f"      the offered palettes disagree in {len(problems)} place(s):")
    for problem in problems:
        print(f"        {problem}")
    print("      Bloom declares the gates; both surfaces enforce them. Change the")
    print("      rule in astro_theme_service.h and appearance.tsx together.")
    raise SystemExit(1)

print(
    f"      {compared} check(s): both surfaces offer the same {len(cpp_offered)} "
    f"of Bloom's {len(names)} presets, withholding {sorted(gated - cpp_offered)}"
)
raise SystemExit(0)
PY

harness::run python3 "$CHECK" "$TOKENS" "$RULE" "$PREFS" "$TSX" "$PATCH"
harness::assert_status 0 "both surfaces offer the same presets"
harness::assert_output_contains "withholding" "says which presets are withheld"

# --------------------------------------------------------------------------
# The negative direction, one mutation at a time.
# --------------------------------------------------------------------------

mutate() {
    # mutate <name> <basename> <sed-expression>
    #
    # The mutated copy is compared against the original it came from: a sed
    # expression that matches nothing leaves the file untouched and every
    # assertion below it then passes for the wrong reason.
    local name="$1" which="$2" expression="$3"
    local dir="$tmp/$name" original
    mkdir -p "$dir"
    cp "$TOKENS" "$dir/astro_color_tokens.h"
    cp "$RULE" "$dir/astro_theme_service.h"
    cp "$PREFS" "$dir/astro_pref_names.h"
    cp "$TSX" "$dir/appearance.tsx"
    cp "$PATCH" "$dir/070.patch"
    case "$which" in
        astro_color_tokens.h)  original="$TOKENS" ;;
        astro_theme_service.h) original="$RULE" ;;
        astro_pref_names.h)    original="$PREFS" ;;
        appearance.tsx)        original="$TSX" ;;
        070.patch)             original="$PATCH" ;;
        *) harness::fail "mutate: unknown file $which" ;;
    esac
    sed -i "$expression" "$dir/$which"
    HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
    if cmp -s "$dir/$which" "$original"; then
        harness::fail "the $name mutation matched nothing in $which, so the
      assertion below it would pass against an unmodified repository"
    fi
    harness::run python3 "$CHECK" \
        "$dir/astro_color_tokens.h" "$dir/astro_theme_service.h" \
        "$dir/astro_pref_names.h" "$dir/appearance.tsx" "$dir/070.patch"
}

# NOT tested here: a wrong gate VALUE in the table. Both sides of this
# comparison read the same table, so flipping `faircoin` to ungated moves both
# sets together and they still agree — measured, not assumed. That property is
# drift from Bloom and belongs to color-tokens-are-generated-from-bloom.sh,
# which asserts the three gates by name in a compiled translation unit; the
# same flip fails there with "static assertion failed". Writing a mutation here
# that this case cannot catch would have left a passing assertion certifying
# nothing.

# The settings page adds a reserved brand of its own. This is the drift the
# case exists for: one surface widened, nothing else changed.
mutate tsx-offers-reserved appearance.tsx \
    "s|\\['oxy', \\.\\.\\.FREE_COLOR_NAMES\\]|['oxy', 'faircoin', ...FREE_COLOR_NAMES]|"
harness::assert_status 1 "one surface offering a reserved brand the other withholds"
harness::assert_output_contains "faircoin" "names the preset that would leak"

# The gates go back to being comments. The whole mechanism rests on them being
# data, so their absence has to be a failure and not an empty comparison.
mutate gates-are-comments-again astro_color_tokens.h \
    '/kColorPresetGates = {{/,/^}};/d'
harness::assert_status 1 "a table with no gate data in it"
harness::assert_output_contains "kColorPresetGates" "names what went missing"

# The settings page's list written out by hand instead of derived.
mutate hand-listed-tsx appearance.tsx \
    "s|\\['oxy', \\.\\.\\.FREE_COLOR_NAMES\\]|['oxy', 'blue', 'green']|"
harness::assert_status 1 "a hand-written palette on the TypeScript side"
harness::assert_output_contains "FREE_COLOR_NAMES" "says the palette stopped being derived"

# The C++ rule stops reading the gates.
mutate rule-ignores-gates astro_theme_service.h \
    's#ColorPresetGateFor(preset) == ColorPresetGate::kNone#true#'
harness::assert_status 1 "a rule that no longer reads the gate table"
harness::assert_output_contains "ColorPresetGateFor" "names what the rule stopped doing"

# The picker stops applying the rule.
mutate picker-ignores-rule 070.patch \
    's|IsColorPresetOffered|WasColorPresetOffered|g'
harness::assert_status 1 "a picker that no longer filters"
harness::assert_output_contains "reserved brands" "says what the picker would serve"

# The default preset moved to somebody else's brand.
mutate default-is-another-brand astro_pref_names.h \
    's|kDefaultThemePreset\[\] = "oxy"|kDefaultThemePreset[] = "faircoin"|'
harness::assert_status 1 "a default preset that is another organisation's brand"
harness::assert_output_contains "different palettes" "names the disagreement"

harness::pass
