#!/usr/bin/env bash
# Astro's native colour table is a transcription of Bloom's design tokens, and
# must never stop being one.
#
# src/chrome/browser/oxy/ui/astro_color_tokens.h holds every Bloom colour, for
# every preset, in both schemes, as a constexpr SkColor. Nothing about it is a
# decision: `tools/generate-color-mixer.py` reads
# @oxyhq/bloom/design-tokens/tokens.json and writes the file. The moment a value
# in it stops matching Bloom, the native UI and the WebUI surfaces paint
# different colours from the same preset — and that shows up as a design
# complaint months later, never as a build failure.
#
# So this case is the build failure. It also guards the two ways a drift check
# of this shape passes without meaning anything:
#
#   * A BROKEN PARSE reads as "no drift". A generator that returned an empty
#     table, or a header this stopped being able to count, would compare equal
#     to nothing and report clean. The floors below are what tell those apart:
#     the committed header must carry at least Bloom's 18 presets and 50 of its
#     58 tokens, and the number of colour values in it must be exactly the
#     product of its own declared dimensions.
#   * A HEADER NOBODY COMPILES. This suite runs with no Chromium checkout, so
#     "the generated C++ is valid C++" would otherwise go unasked until a full
#     build — hours away, on someone else's machine. The header is compiled here
#     against a stub SkColor.h that substitutes through the include path, so the
#     file under test is byte-for-byte the file that ships.
#
# The DTCG-to-SkColor conversion gets its own proof rather than a reading. DTCG
# spells alpha last (#rrggbbaa) and SkColor packs it first (0xAARRGGBB); the
# fixture's opaque and translucent tokens deliberately share an RGB triple, so
# the correct value and the byte-swapped one cannot both appear, and the wrong
# one is asserted absent as well as the right one being present.
#
# Bloom arrives through webui/app's dependency tree, which is not committed. A
# clean checkout therefore cannot regenerate from the real document, and the
# generator says so with a status of its own (3) rather than a failure. That
# branch is announced, never silent — a skip nobody sees is a check nobody has.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

GENERATOR="$ASTRO_ROOT/tools/generate-color-mixer.py"
HEADER="$ASTRO_ROOT/src/chrome/browser/oxy/ui/astro_color_tokens.h"
FIXTURES="$ASTRO_ROOT/tools/tests/fixtures/color-tokens"
FIXTURE_TOKENS="$FIXTURES/tokens.json"
SKIA_STUB="$FIXTURES/skia-stub"
tmp="$(harness::tmpdir)"

harness::assert_file_exists "$GENERATOR"
harness::assert_file_exists "$HEADER"
harness::assert_file_exists "$FIXTURE_TOKENS"
harness::assert_file_exists "$SKIA_STUB/third_party/skia/include/core/SkColor.h"

# --- The committed header declares itself generated --------------------------
#
# Without this, the next person to want a different colour edits the header, and
# the following regeneration reverts them with no explanation.

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if ! head -20 "$HEADER" | grep -q 'GENERATED FILE'; then
    harness::fail "$(basename "$HEADER") does not say it is generated"
fi

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if ! head -20 "$HEADER" | grep -q 'tools/generate-color-mixer.py'; then
    harness::fail "$(basename "$HEADER") does not name the tool that generates it"
fi

# The Bloom release each value came from is the only thing that makes the table
# auditable, so it has to be IN the file, not in a commit message.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if ! head -20 "$HEADER" | grep -qE '@oxyhq/bloom@[0-9]+\.[0-9]+\.[0-9]+'; then
    harness::fail "$(basename "$HEADER") does not record which Bloom release it came from"
fi

# --- Floors: a broken parse must not read as "no drift" ----------------------

presets="$(grep -oE 'kColorPresetCount = [0-9]+' "$HEADER" | grep -oE '[0-9]+')"
tokens="$(grep -oE 'kColorTokenCount = [0-9]+' "$HEADER" | grep -oE '[0-9]+')"
schemes="$(grep -oE 'kColorSchemeCount = [0-9]+' "$HEADER" | grep -oE '[0-9]+')"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ "${presets:-0}" -lt 18 ]; then
    harness::fail "the committed header declares ${presets:-0} preset(s); Bloom ships 18.
      Either the document lost presets or the transcription is broken; both are
      the same defect from here, and neither may pass as 'no drift'."
fi

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ "${tokens:-0}" -lt 50 ]; then
    harness::fail "the committed header declares ${tokens:-0} token(s); Bloom ships 58.
      A partial table compares equal to itself and would otherwise report clean."
fi

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ "${schemes:-0}" -ne 2 ]; then
    harness::fail "the committed header declares ${schemes:-0} scheme(s); light and dark are 2"
fi

# The dimensions above are the header's own claims. This is the count of what it
# actually contains, so a table truncated after its declarations cannot pass.
values="$(grep -cE '^ +0x[0-9A-F]{8}u,  // ' "$HEADER")"
expected=$((presets * schemes * tokens))

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ "$values" -ne "$expected" ]; then
    harness::fail "the header carries $values colour values but declares
      $presets × $schemes × $tokens = $expected. The table and its dimensions disagree."
fi

# Every value must be a full 8-digit ARGB literal. A 6-digit one would be a
# fully transparent colour that renders as nothing at all.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if grep -qE '^ +0x[0-9A-F]{1,7}u,  // ' "$HEADER"; then
    grep -nE '^ +0x[0-9A-F]{1,7}u,  // ' "$HEADER" >&2
    harness::fail "a colour value is not a full 8-digit ARGB literal"
fi

# --- The conversion, proved against a fixture --------------------------------
#
# Fixture rather than Bloom, because the assertion has to name exact bytes and
# Bloom's values move with every release. The fixture is committed, so these
# numbers are facts about the generator and not about whatever is installed.

fixture_header="$tmp/fixture_color_tokens.h"

harness::run python3 "$GENERATOR" --tokens "$FIXTURE_TOKENS" --output "$fixture_header"
harness::assert_status 0 "generating from the committed fixture document"
harness::assert_file_exists "$fixture_header"

# #0a141e28 -> 0x280A141E. DTCG puts alpha last, SkColor puts it first.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if ! grep -q '0x280A141Eu,  // primary-subtle' "$fixture_header"; then
    grep -n 'primary-subtle' "$fixture_header" >&2
    harness::fail "the translucent fixture token did not convert to 0x280A141E"
fi

# #0a141e -> 0xFF0A141E. Same RGB as the token above; only the alpha differs,
# which is what makes the pair able to tell the two byte orders apart.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if ! grep -q '0xFF0A141Eu,  // background' "$fixture_header"; then
    harness::fail "a 6-digit hex did not become an opaque SkColor"
fi

# The byte-swapped value must be absent. Asserting the right answer is present
# does not, on its own, rule out both appearing somewhere in a 2,000-line table.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if grep -q '0x0A141E28u' "$fixture_header"; then
    harness::fail "the DTCG byte order reached the table: alpha is still last"
fi

# The real header must not carry it either, and the same for the fixture's other
# translucent pair (0x7F010203 correct, 0x0102037F swapped).
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if ! grep -q '0x7F010203u,  // primary-subtle' "$fixture_header"; then
    harness::fail "the second translucent fixture token did not convert to 0x7F010203"
fi

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if grep -q '0x0102037Fu' "$fixture_header"; then
    harness::fail "the DTCG byte order reached the table for the second token"
fi

# --- Deterministic, and independent of the document's key order --------------
#
# The drift check is only meaningful if a regeneration that changed no VALUE
# produces no diff. Two separate properties: the emitter is a pure function of
# what it read, and what it read is not the JSON's key order — Bloom's document
# is machine-written and its ordering is Bloom's business, not a contract.

second="$tmp/second-run.h"
harness::run python3 "$GENERATOR" --tokens "$FIXTURE_TOKENS" --output "$second"
harness::assert_status 0 "a second generation from the same document"
harness::assert_files_identical "$fixture_header" "$second"

shuffled="$tmp/shuffled/tokens.json"
mkdir -p "$tmp/shuffled"
cp "$FIXTURES/package.json" "$tmp/shuffled/package.json"
python3 - "$FIXTURE_TOKENS" "$shuffled" <<'REORDER'
import json
import sys

# Reverse every object's key order, at every depth. Values are untouched, so a
# generator that emits in document order produces a different file and a
# generator that sorts produces the same one.
def reverse(node):
    if isinstance(node, dict):
        return {key: reverse(node[key]) for key in reversed(list(node))}
    return node

source, destination = sys.argv[1], sys.argv[2]
with open(source, encoding="utf-8") as handle:
    document = json.load(handle)
with open(destination, "w", encoding="utf-8") as handle:
    json.dump(reverse(document), handle, indent=2)
REORDER

reordered="$tmp/reordered.h"
harness::run python3 "$GENERATOR" --tokens "$shuffled" --output "$reordered"
harness::assert_status 0 "generating from a key-reordered document"
harness::assert_files_identical "$fixture_header" "$reordered"

# The reordering must have changed the input, or the assertion above compares a
# file with itself and proves nothing.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if cmp -s "$FIXTURE_TOKENS" "$shuffled"; then
    harness::fail "the reordered document is byte-identical to the original;
      the reordering step did nothing and the ordering assertion is vacuous"
fi

# --- A malformed document is refused, never transcribed ----------------------
#
# Each of these would otherwise produce a header that compiles: a ragged token
# set silently fills a fixed-size array, and an unrecognised colour string is
# the shape a change to Bloom's contract arrives in.

malformed="$tmp/malformed"
mkdir -p "$malformed"
cp "$FIXTURES/package.json" "$malformed/package.json"

python3 - "$FIXTURE_TOKENS" "$malformed/ragged.json" <<'RAGGED'
import json
import sys

source, destination = sys.argv[1], sys.argv[2]
with open(source, encoding="utf-8") as handle:
    document = json.load(handle)
del document["color"]["mono"]["dark"]["chart-1"]
with open(destination, "w", encoding="utf-8") as handle:
    json.dump(document, handle, indent=2)
RAGGED

harness::run python3 "$GENERATOR" --tokens "$malformed/ragged.json" \
    --output "$tmp/must-not-exist.h"
harness::assert_status 2 "a preset missing a token the others carry"
harness::assert_output_contains "does not carry the same tokens" "names the disagreement"
harness::assert_output_contains "chart-1" "names the missing token"
harness::assert_file_missing "$tmp/must-not-exist.h"

python3 - "$FIXTURE_TOKENS" "$malformed/not-hex.json" <<'NOTHEX'
import json
import sys

source, destination = sys.argv[1], sys.argv[2]
with open(source, encoding="utf-8") as handle:
    document = json.load(handle)
document["color"]["teal"]["light"]["background"]["$value"] = "rgb(10, 20, 30)"
with open(destination, "w", encoding="utf-8") as handle:
    json.dump(document, handle, indent=2)
NOTHEX

harness::run python3 "$GENERATOR" --tokens "$malformed/not-hex.json" \
    --output "$tmp/still-must-not-exist.h"
harness::assert_status 2 "a colour value that is not sRGB hex"
harness::assert_output_contains "color.teal.light.background" "names the token"
harness::assert_output_contains "shape contract" "explains what was violated"
harness::assert_file_missing "$tmp/still-must-not-exist.h"

# A gate kind this transcription does not know is refused, not transcribed. The
# alternative is the one that ships a defect: an unrecognised gate read as "no
# gate" puts a reserved preset in the picker, and the picker looks correct.
python3 - "$FIXTURE_TOKENS" "$malformed/unknown-gate.json" <<'UNKNOWNGATE'
import json
import sys

source, destination = sys.argv[1], sys.argv[2]
with open(source, encoding="utf-8") as handle:
    document = json.load(handle)
document["color"]["teal"]["$extensions"]["so.oxy.bloom"]["gate"] = "enterprise"
with open(destination, "w", encoding="utf-8") as handle:
    json.dump(document, handle, indent=2)
UNKNOWNGATE

harness::run python3 "$GENERATOR" --tokens "$malformed/unknown-gate.json" \
    --output "$tmp/gate-must-not-exist.h"
harness::assert_status 2 "a gate kind Bloom did not have when this was written"
harness::assert_output_contains "enterprise" "names the gate it did not recognise"
harness::assert_output_contains "ungated" "says which way the guess would have gone"
harness::assert_file_missing "$tmp/gate-must-not-exist.h"

# --- The gates are DATA, and the table is complete ---------------------------
#
# They were C++ comments until a consumer iterated kColorPresetNames and offered
# every preset in it, reserved brands included. A comment cannot be filtered on,
# so the emission is asserted here rather than read.

gate_entries="$(grep -cE '^ +ColorPresetGate::k[A-Za-z]+,' "$HEADER")"
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ "$gate_entries" -ne "$presets" ]; then
    harness::fail "the header carries $gate_entries gate entries for $presets presets.
      A short table indexes out of range or silently mis-attributes a gate."
fi

# At least one preset must actually be gated. Every consumer's filter is a
# no-op otherwise, and a no-op filter passes every test written about it.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if ! grep -qE '^ +ColorPresetGate::k(Handle|Premium),' "$HEADER"; then
    harness::fail "no preset in the committed header is gated. Bloom gates three;
      if that has genuinely changed, every gate filter in Astro is now vacuous
      and this case is the only thing that would have said so."
fi

# --- Drift is detected, and says how to fix it -------------------------------
#
# Mutated in a temp copy: the committed header is never touched by this suite,
# so there is nothing to restore and no way for an interrupted run to leave a
# developer's tree edited.

drifted="$tmp/drifted.h"
cp "$fixture_header" "$drifted"

harness::run python3 "$GENERATOR" --tokens "$FIXTURE_TOKENS" --output "$drifted" --check
harness::assert_status 0 "an unmodified generated header"
harness::assert_output_contains "is current" "says what it verified"

# One byte. Not a deleted section, not a reordering — the smallest edit that
# could reach production, which is somebody adjusting a single colour by hand.
python3 - "$drifted" <<'MUTATE'
import sys

path = sys.argv[1]
with open(path, encoding="utf-8") as handle:
    text = handle.read()
mutated = text.replace("0x280A141Eu", "0x290A141Eu", 1)
if mutated == text:
    raise SystemExit("the mutation matched nothing; the drift proof would be vacuous")
with open(path, "w", encoding="utf-8") as handle:
    handle.write(mutated)
MUTATE

harness::run python3 "$GENERATOR" --tokens "$FIXTURE_TOKENS" --output "$drifted" --check
harness::assert_status 1 "a hand-edited generated header, reported with its own status"
harness::assert_output_contains "is out of date" "names the problem"
harness::assert_output_contains "tools/generate-color-mixer.py" "names the regenerate command"
harness::assert_output_contains "Never hand-edit" "says why it drifted"

# A missing header is drift too, not a reason to say nothing.
harness::run python3 "$GENERATOR" --tokens "$FIXTURE_TOKENS" \
    --output "$tmp/absent-header.h" --check
harness::assert_status 1 "a header that does not exist yet"
harness::assert_output_contains "does not exist" "names the problem"

# --- The generated C++ compiles, and means what it says ----------------------

CXX="${ASTRO_CXX:-}"
if [ -z "$CXX" ]; then
    for candidate in g++ clang++; do
        if command -v "$candidate" >/dev/null; then
            CXX="$(command -v "$candidate")"
            break
        fi
    done
fi

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ -z "$CXX" ]; then
    harness::fail "$(cat <<'EOF'
No C++ compiler found.

It is a required part of this gate, not an optional extra: this suite runs with
no Chromium checkout, so without it "the generated colour table is valid C++"
is not asked anywhere until a full build.

Install one:
    Debian/Ubuntu   sudo apt-get install g++
    macOS           xcode-select --install

Or point at an existing binary:
    ASTRO_CXX=/path/to/g++ tools/tests/run.sh
EOF
)"
fi

# The values, asserted at compile time through the accessor the mixer will use.
# This is the same conversion the greps above checked, arrived at the other way:
# through the enumerations, the array nesting and the constexpr indexing, any of
# which could be wrong while the literals are right.
cat > "$tmp/fixture-tu.cc" <<'EOF'
#include "fixture_color_tokens.h"

static_assert(astro::kColorPresetCount == 2);
static_assert(astro::kColorSchemeCount == 2);
static_assert(astro::kColorTokenCount == 4);

static_assert(astro::ColorTokenValue(astro::ColorPreset::kTeal,
                                     astro::ColorScheme::kLight,
                                     astro::ColorToken::kPrimarySubtle) ==
                  0x280A141Eu,
              "DTCG spells alpha last; SkColor packs it first");
static_assert(astro::ColorTokenValue(astro::ColorPreset::kTeal,
                                     astro::ColorScheme::kLight,
                                     astro::ColorToken::kBackground) ==
                  0xFF0A141Eu,
              "a 6-digit hex is opaque");
static_assert(astro::ColorTokenValue(astro::ColorPreset::kMono,
                                     astro::ColorScheme::kDark,
                                     astro::ColorToken::kSurfaceForeground) ==
                  0xFFDDDDDDu,
              "the second preset's dark scheme is where it is indexed");

static_assert(astro::ColorPresetFromName("mono") == astro::ColorPreset::kMono);
static_assert(!astro::ColorPresetFromName("nonesuch").has_value(),
              "an unknown preset name is absent, never a silent default");

// The fixture carries one ungated preset and one gated one, which is the pair
// a reader has to be able to tell apart. A fixture where every preset sat on
// the same side of that line would pass whether the gate was transcribed or
// dropped on the floor.
static_assert(astro::ColorPresetGateFor(astro::ColorPreset::kTeal) ==
                  astro::ColorPresetGate::kNone,
              "an absent gate is kNone");
static_assert(astro::ColorPresetGateFor(astro::ColorPreset::kMono) ==
                  astro::ColorPresetGate::kPremium,
              "a declared gate reaches the table as data");
static_assert(astro::kColorPresetGates.size() == astro::kColorPresetCount);
EOF

harness::run "$CXX" -std=c++20 -fsyntax-only -Wall -Wextra \
    -I "$tmp" -I "$SKIA_STUB" "$tmp/fixture-tu.cc"
harness::assert_status 0 "the generated fixture header compiles and its values check out"

# The static assertions must be capable of failing. A translation unit whose
# assertions are never evaluated compiles just as cleanly as a correct one.
cat > "$tmp/wrong-tu.cc" <<'EOF'
#include "fixture_color_tokens.h"

// The DTCG byte order, asserted deliberately. This must NOT compile.
static_assert(astro::ColorTokenValue(astro::ColorPreset::kTeal,
                                     astro::ColorScheme::kLight,
                                     astro::ColorToken::kPrimarySubtle) ==
              0x0A141E28u);
EOF

harness::run "$CXX" -std=c++20 -fsyntax-only -I "$tmp" -I "$SKIA_STUB" \
    "$tmp/wrong-tu.cc"
harness::assert_nonzero_status "a translation unit asserting the byte-swapped value"
harness::assert_output_contains "static assertion" "the compiler rejected it for the stated reason"

# The same, for the gate. This is the regression stated as an assertion: a
# gated preset reading as ungated is what put a reserved brand in the picker,
# so the check that would catch it must be shown to fail when it is wrong.
cat > "$tmp/wrong-gate-tu.cc" <<'EOF'
#include "fixture_color_tokens.h"

// mono is gated on premium in the fixture. This must NOT compile.
static_assert(astro::ColorPresetGateFor(astro::ColorPreset::kMono) ==
              astro::ColorPresetGate::kNone);
EOF

harness::run "$CXX" -std=c++20 -fsyntax-only -I "$tmp" -I "$SKIA_STUB" \
    "$tmp/wrong-gate-tu.cc"
harness::assert_nonzero_status "a translation unit reading a gated preset as ungated"
harness::assert_output_contains "static assertion" "the compiler rejected it"

# And the compile step must be reading the generated header, rather than passing
# because the compiler found something else by that name — a quoted include
# resolves beside the translation unit, so the corrupted copy is placed there.
mkdir -p "$tmp/broken"
cp "$fixture_header" "$tmp/broken/fixture_color_tokens.h"
cp "$tmp/fixture-tu.cc" "$tmp/broken/fixture-tu.cc"
printf 'namespace astro { int unterminated( ;\n' >> "$tmp/broken/fixture_color_tokens.h"

harness::run "$CXX" -std=c++20 -fsyntax-only -I "$SKIA_STUB" \
    "$tmp/broken/fixture-tu.cc"
harness::assert_nonzero_status "a corrupted header beside the translation unit"

# --- The header that ships ---------------------------------------------------
#
# Compiled from src/ at the path Chromium will use, against the same stub. The
# real Skia header is not on disk here; substituting through -I means the file
# under test carries the real include and needs no build-only variant.

cat > "$tmp/real-tu.cc" <<'EOF'
#include "chrome/browser/oxy/ui/astro_color_tokens.h"

static_assert(astro::kColorPresetCount >= 18);
static_assert(astro::kColorTokenCount >= 50);
static_assert(astro::kColorPresetNames.size() == astro::kColorPresetCount);
static_assert(astro::kColorTokenNames.size() == astro::kColorTokenCount);

// Bloom's own preset, by the name the astro.theme.preset pref stores.
static_assert(astro::ColorPresetFromName("oxy").has_value());
static_assert(astro::ColorTokenValue(astro::ColorPreset::kOxy,
                                     astro::ColorScheme::kDark,
                                     astro::ColorToken::kBackground) != 0u);

// The three gates Bloom declares today, named individually because each one is
// a different claim and they are not interchangeable. `faircoin` is the one
// that matters most: it is another organisation's reserved brand, it is the
// preset the colour picker offered by mistake, and this is the assertion that
// notices if it ever reads as ungated again.
static_assert(astro::ColorPresetGateFor(astro::ColorPreset::kFaircoin) ==
                  astro::ColorPresetGate::kHandle);
static_assert(astro::ColorPresetGateFor(astro::ColorPreset::kOxy) ==
                  astro::ColorPresetGate::kHandle);
static_assert(astro::ColorPresetGateFor(astro::ColorPreset::kMono) ==
                  astro::ColorPresetGate::kPremium);
static_assert(astro::ColorPresetGateFor(astro::ColorPreset::kGreen) ==
                  astro::ColorPresetGate::kNone);
EOF

harness::run "$CXX" -std=c++20 -fsyntax-only -Wall -Wextra \
    -I "$ASTRO_ROOT/src" -I "$SKIA_STUB" "$tmp/real-tu.cc"
harness::assert_status 0 "the committed colour header compiles"

# --- Drift against the real Bloom document -----------------------------------
#
# webui/app/node_modules is not committed, so a clean checkout genuinely cannot
# run this. The generator reports that as a status of its own rather than as a
# failure, and the skip is printed: an unannounced skip is how a gate stops
# being one without anybody deciding to remove it.

harness::run python3 "$GENERATOR" --check
case "$RUN_STATUS" in
    0)
        harness::assert_status 0 "the committed header matches the installed Bloom"
        harness::assert_output_contains "is current" "says what it verified"

        # The same mutation proof, against the document that actually governs
        # the committed file.
        real_copy="$tmp/real-copy.h"
        cp "$HEADER" "$real_copy"
        python3 - "$real_copy" <<'MUTATE_REAL'
import re
import sys

path = sys.argv[1]
with open(path, encoding="utf-8") as handle:
    text = handle.read()
match = re.search(r"^( +)0x([0-9A-F]{8})u,(  // .+)$", text, re.MULTILINE)
if match is None:
    raise SystemExit("no colour value found to mutate; the drift proof would be vacuous")
flipped = f"{int(match.group(2), 16) ^ 0x01:08X}"
with open(path, "w", encoding="utf-8") as handle:
    handle.write(text.replace(match.group(0), f"{match.group(1)}0x{flipped}u,{match.group(3)}", 1))
MUTATE_REAL

        harness::run python3 "$GENERATOR" --check --output "$real_copy"
        harness::assert_status 1 "one flipped bit in a copy of the committed header"
        harness::assert_output_contains "tools/generate-color-mixer.py" \
            "names the regenerate command"
        printf '      checked against the installed Bloom document.\n'
        ;;
    1)
        harness::fail "the committed colour header is not what the installed Bloom
      document produces. The header is generated; regenerate it rather than
      editing it, and commit the result:

          tools/generate-color-mixer.py

$(cat "$RUN_STDERR")"
        ;;
    3)
        harness::assert_status 3 "no Bloom package installed"
        harness::assert_output_contains "bun install" "says how to install it"
        harness::assert_output_lacks "is current" "must not read as a pass"
        printf '      no @oxyhq/bloom in webui/app/node_modules; the drift row did not run.\n'
        ;;
    *)
        harness::fail "checking the committed header against the installed Bloom document
      exited $RUN_STATUS: it is none of current (0), drifted (1) or absent (3).
$(cat "$RUN_STDERR")"
        ;;
esac

harness::pass
