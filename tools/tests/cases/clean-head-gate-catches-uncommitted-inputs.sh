#!/usr/bin/env bash
# tools/verify-clean-head.sh must catch a coupled unit that was half committed.
#
# The defect it exists for is invisible by construction: commit a script A that
# needs a file B, leave B untracked, and every test that needs B passes, because
# B is sitting right there on disk. So this case does not assert that the
# working-tree suite is blind — it DEMONSTRATES it, by running that suite on the
# fixture first and requiring it to be green. Only then is the gate run, and
# required to fail and to name B.
#
# The gate is copied into a fixture repository rather than pointed at one,
# because it resolves its root from its own location — the same shape
# harness::make_build_root uses for tools/build.sh. That means the path
# resolution under test is the real one and not a flag added for testing.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

GATE_SOURCE="$ASTRO_ROOT/tools/verify-clean-head.sh"
tmp="$(harness::tmpdir)"

harness::assert_file_exists "$GATE_SOURCE"

# --------------------------------------------------------------------------
# A fixture Astro repository with one coupled unit
# --------------------------------------------------------------------------

# make_fixture <dir>
#
# Carries the REAL runner and the REAL harness, so what the gate parses is the
# output format it will meet in this repository. A hand-written stand-in
# printing PASS/FAIL lines would let the two drift, and the gate's parser would
# then be tested against a mimic of the thing it has to read.
make_fixture() {
    local dir="$1"
    mkdir -p "$dir/tools/lib" "$dir/tools/tests/lib" "$dir/tools/tests/cases"

    harness::setup_run cp "$GATE_SOURCE" "$dir/tools/verify-clean-head.sh"
    harness::setup_run cp "$ASTRO_ROOT/tools/lib/astro-common.sh" "$dir/tools/lib/"
    harness::setup_run cp "$ASTRO_ROOT/tools/tests/run.sh" "$dir/tools/tests/"
    harness::setup_run cp "$ASTRO_ROOT/tools/tests/lib/harness.sh" "$dir/tools/tests/lib/"

    # A, the committed half: a case that cannot run without B.
    cat > "$dir/tools/tests/cases/coupled-unit.sh" <<'CASE'
source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup
harness::assert_file_exists "$ASTRO_ROOT/tools/coupled-input.txt"
harness::pass
CASE

    # A second case that depends on nothing, so a gate that failed everything
    # for an unrelated reason cannot be mistaken for one that found the
    # coupling.
    cat > "$dir/tools/tests/cases/independent.sh" <<'CASE'
source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup
harness::assert_file_exists "$ASTRO_ROOT/tools/tests/run.sh"
harness::pass
CASE

    harness::setup_run git -C "$dir" init --quiet
    harness::setup_run git -C "$dir" add -A
    harness::setup_run git -C "$dir" commit --quiet -m "the committed half"

    # B, the half left behind: written AFTER the commit, so it is present on
    # disk and unknown to git — exactly the state every one of the four real
    # occurrences was in.
    printf 'the input A cannot run without\n' > "$dir/tools/coupled-input.txt"
}

fixture="$tmp/fixture"
make_fixture "$fixture"

# --------------------------------------------------------------------------
# The defect is invisible to the working-tree suite. Demonstrated, not claimed.
# --------------------------------------------------------------------------

harness::run env -C "$fixture" ./tools/tests/run.sh
harness::assert_status 0 "the working-tree suite passes with B untracked"
harness::assert_output_contains "PASS  coupled-unit" "the coupled case passes on disk"
harness::assert_output_contains "2 passed, 0 failed" "the whole fixture suite is green"

# --------------------------------------------------------------------------
# What the gate must report
#
# Returned as a status rather than asserted in place, so the SAME body can be
# run against a mutated gate below and be required to fail. A helper that
# called harness::fail could only ever be used once.
#
#   0  the gate caught it and said why
#   1  the gate exited 0
#   2  the gate did not name B
#   3  the gate did not report the coupled case as differing
# --------------------------------------------------------------------------

gate_catches_the_uncommitted_input() {
    local gate="$1"
    harness::run "$gate"
    [ "$RUN_STATUS" != "0" ] || return 1
    grep -qF "coupled-input.txt" "$RUN_STDERR" "$RUN_STDOUT" || return 2
    grep -qE 'coupled-unit +FAIL +PASS' "$RUN_STDERR" "$RUN_STDOUT" || return 3
    return 0
}

status=0
gate_catches_the_uncommitted_input "$fixture/tools/verify-clean-head.sh" || status=$?
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ "$status" != "0" ]; then
    harness::fail "the gate did not catch the half-committed coupled unit (check $status)"
fi

# The finding must be attributable, not just present: the gate has to say the
# two runs disagreed, and the case that depends on nothing must still have
# passed in the clean tree. A gate that failed everything would satisfy the
# check above without having found the coupling at all.
harness::assert_output_contains "DISAGREE" "the gate says the two runs disagree"
harness::assert_output_contains "PASS  independent" \
    "the case depending on nothing still passes from a clean checkout"

# --------------------------------------------------------------------------
# Committing B makes both runs agree
# --------------------------------------------------------------------------

harness::setup_run git -C "$fixture" add tools/coupled-input.txt
harness::setup_run git -C "$fixture" commit --quiet -m "the other half"

harness::run "$fixture/tools/verify-clean-head.sh"
harness::assert_status 0 "the gate passes once B is committed"
harness::assert_output_contains "stands on its own" "the gate says what it verified"
harness::assert_output_contains "all 2 case(s) reported a verdict" \
    "every case file produced a verdict in both trees"

# --------------------------------------------------------------------------
# Vacuity: a tree with no cases must not read as agreement
# --------------------------------------------------------------------------

caseless="$tmp/caseless"
make_fixture "$caseless"
rm -f "$caseless"/tools/tests/cases/*.sh
harness::setup_run git -C "$caseless" add -A
harness::setup_run git -C "$caseless" commit --quiet -m "no cases at all"

harness::run "$caseless/tools/verify-clean-head.sh"
harness::assert_nonzero_status "a commit with no test cases"
harness::assert_output_contains "holds no test cases at all" "the vacuous run says so"

# --------------------------------------------------------------------------
# Mutation: materialise the working tree instead of the commit
#
# The gate's whole claim rests on one line. If that line reads the working tree,
# the untracked B lands in the "clean" tree, the coupled case passes there too,
# and the gate has nothing to report — so the assertions above must stop
# holding. They are re-run verbatim against the mutant, and required to fail.
#
# A mutation that merely made the gate exit non-zero would satisfy a test that
# only checked the exit status, which is why the helper distinguishes "caught
# it" from "failed for some other reason" and this asserts on WHICH.
# --------------------------------------------------------------------------

# write_mutant <fixture dir> <sed script>...
write_mutant() {
    local dir="$1"
    shift
    local destination="$dir/tools/verify-clean-head.sh"
    local arguments=()
    local script
    for script in "$@"; do
        arguments+=(-e "$script")
    done

    sed "${arguments[@]}" "$GATE_SOURCE" > "$destination"
    chmod +x "$destination"

    HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
    if cmp -s "$GATE_SOURCE" "$destination"; then
        harness::fail "the mutation changed nothing; verify-clean-head.sh no longer contains
      the line this case mutates. Update the pattern in the same change, or the
      mutation test below is measuring the UNMUTATED gate and proves nothing."
    fi
}

# The mutation the product owner asked for: read the working tree, not the
# commit. This is a sed script, so nothing in it may expand here.
# shellcheck disable=SC2016
MUTATE_MATERIALISATION='s@^ *git -C "\$ASTRO_ROOT_REAL" archive .*@    ( cd "$ASTRO_ROOT_REAL" \&\& tar -c --exclude=.git . ) | tar -x -C "$destination"@'

mutant="$tmp/mutant"
make_fixture "$mutant"
write_mutant "$mutant" "$MUTATE_MATERIALISATION"

status=0
gate_catches_the_uncommitted_input "$mutant/tools/verify-clean-head.sh" || status=$?
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ "$status" = "0" ]; then
    harness::fail "the mutated gate — which materialises the WORKING TREE — still reported the
      half-committed coupled unit. That means the assertions above would pass
      whether or not the gate reads the commit, so they prove nothing."
fi

# The mutant is caught by the path-identity check before the comparison ever
# runs, which is a second defence and not the one under test here. Mutating
# that check too lets the run reach the comparison, and shows what the
# comparison alone is worth: with both gone, the gate CERTIFIES a commit no
# clean checkout can run. Two mutations rather than one, on purpose — a single
# mutation would have left the sharper claim unmeasured.
MUTATE_IDENTITY='s@^if ! diff -u .*@if false; then@'

blind="$tmp/blind"
make_fixture "$blind"
write_mutant "$blind" "$MUTATE_MATERIALISATION" "$MUTATE_IDENTITY"

harness::run "$blind/tools/verify-clean-head.sh"
harness::assert_status 0 "a gate reading the working tree certifies the broken commit"
harness::assert_output_contains "stands on its own" "and says so in as many words"
harness::assert_output_lacks "DISAGREE" "having found nothing to disagree about"

printf 'Mutation (working tree instead of the commit): caught at check %s; with the\n' "$status"
printf 'path-identity check also removed, the gate exits 0 on the broken commit.\n'

harness::pass
