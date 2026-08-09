#!/usr/bin/env bash
# The profile-fixture generator's declaration parses must lose nothing, and the
# check that says so must be able to fail.
#
# What this replaced. The generator used to guard four parses with minimum
# counts — "at least 15 preferences", "at least 20 settings mappings". A floor
# answers a question nobody asked: how many preferences Astro registers is a
# product decision that moves in both directions, so the number could only ever
# be wrong in one of two ways. Too low to catch a broken parse, or — the way it
# actually failed — high enough to fail on a legitimate number, at which point
# the only available repairs were to edit the constant (turning a signal into a
# silence) or to commit somebody's uncommitted work to reach it.
#
# What holds regardless of the number is that the parse loses nothing, stated as
# an identity between three counts arrived at by different routes: sites
# DETECTED by a loose recogniser, declarations PARSED by the strict one, and
# items REPRESENTED in the generated fixtures.
#
# That identity is only worth anything because the first two counts are measured
# by DIFFERENT rules. Had both come from the strict regex they would agree by
# construction and the check would be an expensive way of writing `true`. So the
# first half of this case feeds the pairing declaration shapes the real sources
# do not contain — a member-style receiver, a name held in a constant, a name
# carrying a character the strict class excludes, an entry whose missing field
# lets a DOTALL match swallow the next one — because a suite whose fixtures all
# sit on the same side of a distinction cannot tell a strict check from a loose
# one. Every registration in the committed patches is the same tidy shape, and a
# parser that had stopped narrowing anything at all would still parse all ten.
#
# The second half mutation-tests the real tool end to end: break the strict
# regex so it misses exactly one registration, break the loose recogniser so it
# sees none, break the fixture build so a parsed preference never reaches disk.
# Each must fail, and each must NAME what it lost. A check nobody has watched
# fail is indistinguishable from one that cannot.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

GENERATOR="$ASTRO_ROOT/tools/baseline/make_profile_fixtures.py"
BASELINE_DIR="$ASTRO_ROOT/tools/baseline"
tmp="$(harness::tmpdir)"

harness::assert_file_exists "$GENERATOR"

# The generator is a real repository file that may carry uncommitted work, so
# the pristine copy is taken here and restored IN PLACE on any exit — never with
# `git checkout`, which would restore it to the last COMMIT and silently discard
# whatever else is uncommitted in it.
PRISTINE="$tmp/pristine-make_profile_fixtures.py"
cp "$GENERATOR" "$PRISTINE"
generator::restore() {
    if [ -f "$PRISTINE" ]; then
        cat "$PRISTINE" > "$GENERATOR"
    fi
}
trap 'generator::restore; harness::teardown' EXIT

# --- The pairing, against shapes the real sources do not contain -------------

harness::run python3 - "$BASELINE_DIR" <<'PY'
import re
import sys

sys.path.insert(0, sys.argv[1])
import make_profile_fixtures as gen

failures = []
performed = 0


def check(label, ok, detail):
    global performed
    performed += 1
    if not ok:
        failures.append(f"{label}: {detail}")


def pairing(text, loose=None, strict=None):
    """Run the invariant, returning (detected, error text or None)."""
    loose = loose or gen.PREF_CALL_SITE_RE
    strict = strict if strict is not None else list(gen.PREF_RE.finditer(text))
    try:
        return gen.assert_parse_is_lossless("preference registration", "fixture", text,
                                            loose, strict), None
    except SystemExit as error:
        return None, str(error)


# The tidy shape, which is the ONLY shape the committed patches contain. It is
# the control: without it a pairing that rejected everything would look like a
# working check.
tidy = "\n".join([
    '  registry->RegisterStringPref("oxy.access_token", "");',
    '  registry->RegisterBooleanPref("oxy.adblock.enabled", true);',
    '  registry->RegisterDictionaryPref("oxy.adblock.site_overrides");',
])
detected, error = pairing(tidy)
check("tidy registrations", error is None, f"unexpectedly rejected:\n{error}")
check("tidy registrations", detected == 3, f"detected {detected}, expected 3")

# Shapes the strict parser deliberately narrows away. Each one is a real C++
# idiom, and each sits on the OPPOSITE side of a distinction the strict regex
# draws — which is the only way to tell that regex from one that draws none.
NARROWED = [
    (
        "member-style receiver",
        '  registry_->RegisterBooleanPref("oxy.member_style", true);',
        "registry_->",
        "PREF_RE requires the receiver to be spelled `registry->`",
    ),
    (
        "name held in a constant",
        '  registry->RegisterStringPref(kOxyAccessToken, "");',
        "kOxyAccessToken",
        "PREF_RE requires a string literal, so the pref NAME is unknowable",
    ),
    (
        "name carrying a hyphen",
        '  registry->RegisterBooleanPref("astro.ntp-show-weather", true);',
        "ntp-show-weather",
        "PREF_RE's name class is [A-Za-z0-9_.] and stops at the hyphen",
    ),
]
for label, text, marker, why in NARROWED:
    detected, error = pairing(text)
    check(label, error is not None, f"was parsed cleanly; {why}, so it must be reported")
    if error is None:
        continue
    check(label, "not parsed" in error, "failed without saying the declaration was not parsed")
    check(label, marker in error, f"failed without naming the offending text ({marker!r})")
    check(label, "fixture:1:" in error, "failed without naming the source line")

# The DOTALL failure, which no count taken from the strict regex alone can see.
# The first entry is missing `.default_enabled`, so CATALOG_RE's `.*?` runs on
# into the SECOND entry: one match where there are two, reporting id "a" with
# b's enabled flag.
merged = "\n".join([
    '  {',
    '      .id = "swallowed-list",',
    '      .name = "No enabled flag",',
    '  },',
    '  {',
    '      .id = "next-list",',
    '      .default_enabled = true,',
    '  },',
])
strict = list(gen.CATALOG_RE.finditer(merged))
check("DOTALL merge", len(strict) == 1,
      f"expected CATALOG_RE to produce one merged match, got {len(strict)}")
detected, error = pairing(merged, loose=gen.CATALOG_SITE_RE, strict=strict)
check("DOTALL merge", error is not None, "a merged catalog entry was accepted")
if error is not None:
    check("DOTALL merge", "swallowed" in error, "failed without reporting a swallowed entry")
    check("DOTALL merge", "swallowed-list" in error, "failed without naming the merged entry")

# The vacuity guard on the check itself: a "loose" recogniser that is NARROWER
# than the strict parser makes agreement between the two counts meaningless, so
# it must be rejected rather than quietly agreeing at a lower number.
detected, error = pairing(tidy, loose=re.compile(r"RegisterNothingAtAllPref\s*\("))
check("narrower loose recogniser", error is not None,
      "a loose recogniser that is not a superset of the strict parser was accepted")
if error is not None:
    check("narrower loose recogniser", "parsed but not detected" in error,
          "failed without explaining that the recogniser is not a superset")

# The loose recogniser must not fire on a DELEGATING registration, which is a
# different failure with its own check: one call hiding an unknown number of
# preferences.
check("delegation is not a call site",
      not gen.PREF_CALL_SITE_RE.search("  chrome::RegisterProfilePrefs(registry);"),
      "the loose recogniser counted a delegating call as a single registration")
check("delegation is detected",
      bool(gen.PREF_DELEGATION_RE.search("  oxy::RegisterOxyPrefs(registry);")),
      "a delegating registration was not recognised")

# Vacuity floor on this driver, ASSERTED rather than printed. A traversal that
# stopped early — an edit that deleted a block, a `pairing()` that raised
# something other than SystemExit and was caught somewhere else — reports no
# failures and reads exactly like a pass. A stated count that nothing compares
# against is no better: it is a number in the output presented as evidence.
#
#   2 for the tidy control, 4 per narrowed shape, 4 for the DOTALL merge,
#   2 for the narrower recogniser, 2 for delegation.
# Real failures are reported first: a shape that was wrongly ACCEPTED also skips
# the follow-up checks that inspect its error text, so the floor would fire too
# and would bury the message that says what actually went wrong.
EXPECTED_CHECKS = 2 + len(NARROWED) * 4 + 4 + 2 + 2
if failures:
    print("\n".join(failures), file=sys.stderr)
    raise SystemExit(f"{len(failures)} pairing check(s) failed")
if performed != EXPECTED_CHECKS:
    raise SystemExit(
        f"the pairing driver ran {performed} check(s), expected {EXPECTED_CHECKS}; "
        f"part of it did not execute, so a green result here means nothing"
    )
print(f"pairing checks passed ({performed} assertions over "
      f"{len(NARROWED) + 3} declaration shapes)")
PY
harness::assert_status 0 "the pairing accepts tidy declarations and rejects narrowed ones"
harness::assert_output_contains "pairing checks passed" "the pairing driver ran"

# --- The dispositions join fires in both directions --------------------------
#
# The join is what stops the record of locally-observed preferences rotting. It
# takes its document as text precisely so it can be exercised against a
# constructed one here, without the tool growing a switch that reads something
# other than committed state.

harness::run python3 - "$BASELINE_DIR" <<'PY'
import json
import sys

sys.path.insert(0, sys.argv[1])
import make_profile_fixtures as gen

COMMITTED = {"oxy.enabled"}


def document(prefs):
    return json.dumps({"prefs": prefs})


def join(prefs, committed=None):
    try:
        gen.load_pref_dispositions(document(prefs), COMMITTED if committed is None else committed)
        return None
    except SystemExit as error:
        return str(error)


LEGACY = {"status": "legacy-baseline", "purpose": "the committed one"}
LOCAL = {
    "status": "observed-local-only",
    "purpose": "a candidate",
    "owner_issue": 22,
    "observed_in": gen.PREF_PATCHES[0],
}

failures = []
performed = 0


def check(label, ok, detail):
    global performed
    performed += 1
    if not ok:
        failures.append(f"{label}: {detail}")


# Control: a document that joins cleanly. Without it, a join that rejected
# everything would satisfy every negative case below.
check("a consistent document", join({"oxy.enabled": LEGACY, "astro.candidate": LOCAL}) is None,
      "a consistent document was rejected")

CASES = [
    ("committed pref with no entry", {"astro.candidate": LOCAL}, "oxy.enabled", "no entry"),
    ("committed pref marked local-only",
     {"oxy.enabled": LOCAL}, "oxy.enabled", "DO register it now"),
    ("legacy entry the patches do not register",
     {"oxy.enabled": LEGACY, "oxy.ghost": LEGACY}, "oxy.ghost", "do not register it"),
    ("local-only entry with no owner",
     {"oxy.enabled": LEGACY, "astro.candidate": {k: v for k, v in LOCAL.items()
                                                 if k != "owner_issue"}},
     "astro.candidate", "owner_issue"),
    ("local-only entry naming a patch this tool does not read",
     {"oxy.enabled": LEGACY, "astro.candidate": {**LOCAL, "observed_in": "patches/astro/999.patch"}},
     "astro.candidate", "not one of the patches"),
    ("unknown status",
     {"oxy.enabled": {"status": "probably-fine", "purpose": "x"}}, "oxy.enabled", "is not one of"),
    ("entry with no purpose",
     {"oxy.enabled": {"status": "legacy-baseline"}}, "oxy.enabled", "no purpose"),
]
for label, prefs, named, reason in CASES:
    error = join(prefs)
    check(label, error is not None, "was accepted")
    if error is None:
        continue
    check(label, named in error, f"failed without naming {named}")
    check(label, reason in error, f"failed without the reason ({reason!r})")

# An empty document must not join vacuously.
try:
    gen.load_pref_dispositions(json.dumps({"prefs": {}}), set())
    failures.append("empty document: an empty disposition set was accepted")
except SystemExit as error:
    check("empty document", "vacuously" in str(error), "rejected without saying why")

# Same asserted vacuity floor: 1 control + 3 per rejection case + 1 for the
# empty document. Every rejection case must have run all three of its checks.
EXPECTED_CHECKS = 1 + len(CASES) * 3 + 1
if failures:
    print("\n".join(failures), file=sys.stderr)
    raise SystemExit(f"{len(failures)} disposition-join check(s) failed")
if performed != EXPECTED_CHECKS:
    raise SystemExit(
        f"the join driver ran {performed} check(s), expected {EXPECTED_CHECKS}; "
        f"part of it did not execute, so a green result here means nothing"
    )
print(f"disposition join checks passed ({performed} assertions over "
      f"{len(CASES)} rejection cases, both directions)")
PY
harness::assert_status 0 "the disposition join is strict in both directions"
harness::assert_output_contains "disposition join checks passed" "the join driver ran"

# --- Mutation: the strict parse misses the registrations with no default -----
#
# Making the optional default group REQUIRED loses exactly the registrations
# that state no default, and nothing else. A mutation that broke every
# registration would be caught by the "no registrations parsed" guard instead,
# and would prove nothing about the pairing.
#
# WHICH registrations those are is DERIVED below, not written down. This block
# used to name `oxy.adblock.site_overrides` because it was the only one, and
# that premise stopped being true the moment the new tab page port added two
# list preferences with no default. The mutation was still caught -- by an
# earlier patch -- and the assertion that read the message failed, which is a
# test breaking while the thing it guards still works. The probe now computes
# the first patch that loses anything and what it loses, so adding or removing a
# no-default registration moves the expectation with the source.

mutate() {
    local search="$1" replace="$2"
    cat "$PRISTINE" > "$GENERATOR"
    python3 - "$GENERATOR" "$search" "$replace" <<'PY'
import sys

path, search, replace = sys.argv[1], sys.argv[2], sys.argv[3]
with open(path, encoding="utf-8") as handle:
    text = handle.read()
if text.count(search) != 1:
    raise SystemExit(
        f"mutation target appears {text.count(search)} time(s), expected exactly 1: {search!r}"
    )
with open(path, "w", encoding="utf-8") as handle:
    handle.write(text.replace(search, replace))
PY
}

# Assert the mutation is live before trusting the run that follows: a mutation
# that silently failed to apply produces a green run that reads as a pass.
assert_mutation_applied() {
    local marker="$1"
    HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
    if ! grep -qF -- "$marker" "$GENERATOR"; then
        harness::fail "mutation was not applied to the generator: $marker"
    fi
}

# What the mutation will lose, read out of the committed patches with the
# generator's OWN parser rather than restated here. `read_text` reads from HEAD,
# so this describes the commit -- the same source the generator uses.
harness::run python3 - "$BASELINE_DIR" "$tmp" <<'DERIVE'
import importlib.util
import pathlib
import sys

baseline_dir, out_dir = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
sys.path.insert(0, str(baseline_dir))
spec = importlib.util.spec_from_file_location(
    "generator", baseline_dir / "make_profile_fixtures.py"
)
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)

first_patch = None
lost = []
for source in generator.PREF_PATCHES:
    text = generator.added_lines(generator.read_text(source))
    missing = [
        match.group("name")
        for match in generator.PREF_RE.finditer(text)
        if match.group("default") is None
    ]
    if missing:
        first_patch, lost = pathlib.Path(source).name, missing
        break

# A vacuity floor. With no no-default registration anywhere the mutation loses
# nothing, the generator succeeds, and every assertion after it reads as a pass
# while measuring an unbroken tool.
if first_patch is None:
    raise SystemExit(
        "no committed registration states no default, so making the default "
        "group required would lose nothing and this mutation would prove "
        "nothing. Give the probe a registration to lose, or delete it."
    )

(out_dir / "expected-patch").write_text(first_patch + "\n", encoding="utf-8")
(out_dir / "expected-prefs").write_text("\n".join(lost) + "\n", encoding="utf-8")
print(
    f"the mutation will lose {len(lost)} declaration(s) in {first_patch}: "
    + ", ".join(lost)
)
DERIVE
harness::assert_status 0 "deriving what the strict-parse mutation will lose"
harness::assert_output_contains "the mutation will lose" "the derivation ran"

harness::run mutate \
    '(?:\s*,\s*(?P<default>.*?))?\s*\)\s*;' \
    '(?:\s*,\s*(?P<default>.*?))\s*\)\s*;'
harness::assert_status 0 "planting the strict-parse mutation"
assert_mutation_applied '(?:\s*,\s*(?P<default>.*?))\s*\)\s*;'

harness::run python3 "$GENERATOR" --output "$tmp/mutated"
harness::assert_nonzero_status "a strict parse that misses a registration"
harness::assert_output_contains "losing declarations" "names the failure"
harness::assert_output_contains "not parsed" "says the declaration was not parsed"
harness::assert_output_contains "$(cat "$tmp/expected-patch")" \
    "names the patch the declaration was lost from"
while read -r lost_pref; do
    harness::assert_output_contains "$lost_pref" "names the lost preference $lost_pref"
done < "$tmp/expected-prefs"
harness::assert_file_missing "$tmp/mutated/manifest.json"

# --- Mutation: the loose recogniser stops being a superset -------------------
#
# Narrowing the loose recogniser to match the strict one is the single edit that
# would turn this whole invariant into an expensive `true`. It must be loud.

harness::run mutate \
    'PREF_CALL_SITE_RE = re.compile(r"Register\w*Pref\s*\(")' \
    'PREF_CALL_SITE_RE = re.compile(r"RegisterNothingAtAllPref\s*\(")'
harness::assert_status 0 "planting the loose-recogniser mutation"
assert_mutation_applied 'RegisterNothingAtAllPref'

harness::run python3 "$GENERATOR" --output "$tmp/blind"
harness::assert_nonzero_status "a loose recogniser that detects nothing"
harness::assert_output_contains "parsed but not detected" "explains the recogniser is not a superset"
harness::assert_output_contains "proves nothing" "says why agreement would be meaningless"

# --- Mutation: a parsed preference never reaches the fixture -----------------
#
# The third count. The parse can be perfect and the value can still fall out on
# the way to disk, and nothing upstream of the output can see that.

harness::run mutate \
    'for pref in prefs:
        set_nested(document, pref["name"], synthetic_value(pref, profile))' \
    'for pref in prefs[1:]:
        set_nested(document, pref["name"], synthetic_value(pref, profile))'
harness::assert_status 0 "planting the dropped-preference mutation"
assert_mutation_applied 'for pref in prefs[1:]:'

harness::run python3 "$GENERATOR" --output "$tmp/dropped"
harness::assert_nonzero_status "a preference that never reaches the fixture"
harness::assert_output_contains "reached the generated fixtures" "names the failure"
harness::assert_output_contains "Astro-owned preferences (profile 'Default')" "names the profile"

# --- Restored, the generator is green again ----------------------------------
#
# Without this the three failures above would be attributable to the copy rather
# than to the mutations, and a leftover mutation would fail every later run for
# a reason this case created.

generator::restore
harness::assert_files_identical "$PRISTINE" "$GENERATOR"

harness::run python3 "$GENERATOR" --verify
harness::assert_status 0 "the restored generator verifies the committed fixtures"

harness::pass
