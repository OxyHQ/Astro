#!/usr/bin/env bash
# AGENTS.md is prepended to EVERY agent session, so its bytes are paid on every
# task forever. This file reached 83 KB / 1,298 lines by accretion — a pipeline
# walkthrough or a file inventory appended by the change that produced it, none
# of them wrong on its own, none visible except in the sum. Nothing breaks when
# it grows, which is exactly why it grew, and exactly why it needs a gate rather
# than a convention.
#
# The scanner is tools/tests/lib/scan-agents-md-size.py. This case runs it
# against the real repository, then proves each of its rules and both of its
# vacuity floors can actually fire — a size check nobody is near and a regex
# that stopped matching both report a clean tree.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

SCANNER="$ASTRO_ROOT/tools/tests/lib/scan-agents-md-size.py"
tmp="$(harness::tmpdir)"

harness::assert_file_exists "$SCANNER"

# --------------------------------------------------------------------------
# The real repository
# --------------------------------------------------------------------------

harness::run python3 "$SCANNER" --repo "$ASTRO_ROOT"
harness::assert_status 0 "every AGENTS.md is within budget"
harness::assert_output_contains "AGENTS.md" "the scan names what it read"

# The vacuity floor on the real run: the scan must have found the root file.
# A broken git listing reports a clean tree otherwise.
harness::assert_output_contains "scanned 1 AGENTS.md file(s): AGENTS.md" \
    "the scan covered the root file and says so"

# --------------------------------------------------------------------------
# Fixtures
# --------------------------------------------------------------------------

make_repo() {
    local dir="$1"
    mkdir -p "$dir"
    harness::setup_run git -C "$dir" init --quiet
}

commit_repo() {
    harness::setup_run git -C "$1" add -A
    harness::setup_run git -C "$1" commit --quiet -m "fixture"
}

scan_fixture() {
    harness::run python3 "$SCANNER" --repo "$1" "${@:2}"
}

# --- Within budget -----------------------------------------------------------

ok="$tmp/ok"
make_repo "$ok"
printf '# Fixture\n\nA rule.\n' > "$ok/AGENTS.md"
commit_repo "$ok"

scan_fixture "$ok"
harness::assert_status 0 "a small root AGENTS.md"

# --- Over the root budget ----------------------------------------------------

big="$tmp/big"
make_repo "$big"
python3 -c "open('$big/AGENTS.md','w').write('#'*(20*1024))"
commit_repo "$big"

scan_fixture "$big"
harness::assert_status 1 "a root AGENTS.md over its budget"
harness::assert_output_contains "over its 12 KB budget" "the finding names the budget"
harness::assert_output_contains "move the material to" "the finding says where it goes"

# --- The nested budget is a DIFFERENT number, and it is applied --------------
#
# 10 KB sits strictly between the two budgets, which is what makes this pair a
# discriminator: a scanner using the root budget everywhere passes the first of
# these, and one using the nested budget everywhere fails the second.

nested="$tmp/nested"
make_repo "$nested"
printf '# Fixture\n\nA rule.\n' > "$nested/AGENTS.md"
mkdir -p "$nested/packages/thing"
python3 -c "open('$nested/packages/thing/AGENTS.md','w').write('x'*(10*1024))"
commit_repo "$nested"

scan_fixture "$nested"
harness::assert_status 1 "a nested AGENTS.md held to the smaller budget"
harness::assert_output_contains "packages/thing/AGENTS.md" "the nested file is named"
harness::assert_output_contains "over its 8 KB budget" "the nested budget is the one applied"

root_same_size="$tmp/root-same-size"
make_repo "$root_same_size"
python3 -c "open('$root_same_size/AGENTS.md','w').write('x'*(10*1024))"
commit_repo "$root_same_size"

scan_fixture "$root_same_size"
harness::assert_status 0 "the same 10 KB at the ROOT path is within budget"

# --- Per-issue headings ------------------------------------------------------

issue="$tmp/issue"
make_repo "$issue"
printf '# Fixture\n\n## The unified offer model (#57)\n\nprose\n' > "$issue/AGENTS.md"
commit_repo "$issue"

scan_fixture "$issue"
harness::assert_status 1 "a per-issue heading"
harness::assert_output_contains "per-issue heading" "the rule is named"
harness::assert_output_contains "docs/" "the finding says where per-issue notes go"

# --- The false-positive direction --------------------------------------------
#
# A gate that cries wolf is a gate somebody disables. This repository's prose
# names issue numbers constantly, and a step number in a heading is not an
# issue.

quiet="$tmp/quiet"
make_repo "$quiet"
printf '# Fixture\n\n## Step #1\n\nIssue #57 owns this; see #114 and #1012.\n' > "$quiet/AGENTS.md"
commit_repo "$quiet"

scan_fixture "$quiet"
harness::assert_status 0 "issue numbers in body prose, and a one-digit step heading"

# --------------------------------------------------------------------------
# Vacuity — both floors, each in its own fixture
#
# Without these the whole gate could stop reading files and every repository
# would report clean.
# --------------------------------------------------------------------------

none="$tmp/none"
make_repo "$none"
printf 'no instructions here\n' > "$none/README.md"
commit_repo "$none"

scan_fixture "$none"
harness::assert_status 2 "a tree with no AGENTS.md must not read as a pass"

rootless="$tmp/rootless"
make_repo "$rootless"
mkdir -p "$rootless/packages/thing"
printf '# Nested only\n' > "$rootless/packages/thing/AGENTS.md"
commit_repo "$rootless"

scan_fixture "$rootless"
harness::assert_status 2 "a tree that has lost its ROOT AGENTS.md must not read as a pass"

# --------------------------------------------------------------------------
# Mutation: prove each rule is load-bearing
#
# Both rules are checked against the same fixture with the rule disabled, so a
# rule that had silently stopped discriminating cannot pass by measuring
# nothing. The size rule is mutated through its budget, the heading rule
# through its own switch.
# --------------------------------------------------------------------------

scan_fixture "$big" --root-budget "$((64 * 1024))"
harness::assert_status 0 "the size finding was the BUDGET, not something incidental"

scan_fixture "$issue" --no-issue-headings
harness::assert_status 0 "the heading finding was the HEADING rule, not something incidental"

# And the disabled runs must still have read the file — exit 0 is also what a
# scan of nothing returns.
harness::assert_output_contains "scanned 1 AGENTS.md file(s)" \
    "the mutated run measured the fixture rather than an empty tree"

harness::pass
