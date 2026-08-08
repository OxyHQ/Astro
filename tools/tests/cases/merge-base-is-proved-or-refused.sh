#!/usr/bin/env bash
# The merge-base gate has THREE verdicts, and the third one is the case.
#
# Astro's Chromium integration model is a downstream branch carrying a thin
# delta on an upstream tag, so two revisions have to agree. A branch based on
# the WRONG upstream is the only defect in the precondition list that every
# later gate accepts: the checkout resolves, `gn gen` writes a build graph, the
# compile succeeds, the binary links, and the overlay is in it. Only ancestry
# distinguishes that build from the declared one.
#
# The trap this case exists for: Astro fetches Chromium at ASTRO_FETCH_DEPTH=1
# (tools/sync-sources.sh), and a depth-1 checkout CANNOT evaluate
# `git merge-base --is-ancestor` at all — the connecting history is not there.
# A gate that cannot measure must therefore deepen, and if that still does not
# settle it, refuse. What it must never do is read "I could not look" as "it is
# probably fine", which is the shape in which this defect ships.
#
# So every row below is asserted in BOTH directions: the same fixtures that
# prove a pass also prove the pass came from a measurement. In particular the
# shallow-clone row is run twice — once with deepening allowed, once with
# --no-deepen — because only the second run rules out a pass by assumption.
#
# Everything runs against synthetic fixtures under the harness temporary
# directory. The real chromium/ checkout is never read and never written.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

GATE="$ASTRO_ROOT/tools/check-merge-base.sh"
tmp="$(harness::tmpdir)"

harness::assert_file_exists "$GATE"

# ==========================================================================
# The origin: an upstream history, a correctly based downstream branch, and a
# downstream branch based on a DIFFERENT upstream commit.
#
# Twelve upstream commits rather than three, because the shallow rows have to
# be able to deepen by a bounded number of commits and still be short of the
# locked one — a fixture that unshallows itself in one step cannot exercise the
# ladder at all.
# ==========================================================================

origin="$tmp/origin"
mkdir -p "$origin"
harness::setup_run git -C "$origin" init --quiet --initial-branch=main

for index in $(seq 1 12); do
    printf 'upstream %s\n' "$index" > "$origin/upstream.txt"
    harness::setup_run git -C "$origin" add -A
    harness::setup_run git -C "$origin" commit --quiet -m "upstream $index"
done

UPSTREAM="$(git -C "$origin" rev-parse main)"
OTHER_UPSTREAM="$(git -C "$origin" rev-parse main~4)"

harness::setup_run git -C "$origin" checkout --quiet -b astro-next
for index in 1 2 3; do
    printf 'astro %s\n' "$index" > "$origin/astro.txt"
    harness::setup_run git -C "$origin" add -A
    harness::setup_run git -C "$origin" commit --quiet -m "astro $index"
done
DOWNSTREAM="$(git -C "$origin" rev-parse astro-next)"

# The silent failure itself: a downstream branch grown from an upstream commit
# nobody locked.
harness::setup_run git -C "$origin" checkout --quiet -b astro-wrong "$OTHER_UPSTREAM"
for index in 1 2 3; do
    printf 'astro on the wrong base %s\n' "$index" > "$origin/astro.txt"
    harness::setup_run git -C "$origin" add -A
    harness::setup_run git -C "$origin" commit --quiet -m "wrong-base astro $index"
done
MISBASED="$(git -C "$origin" rev-parse astro-wrong)"
harness::setup_run git -C "$origin" checkout --quiet main

# A commit that exists in no fixture: the "present in nothing" shape, which must
# read as unmeasurable rather than as a definitive "not an ancestor".
ABSENT_COMMIT="0000000000000000000000000000000000000001"

# --------------------------------------------------------------------------
# The fixture asserts what it claims, before anything is run against it
#
# Every refusal below is also what a broken fixture produces. These four facts
# are what separate the two, and no row implies them.
# --------------------------------------------------------------------------

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 4))
git -C "$origin" merge-base --is-ancestor "$UPSTREAM" "$DOWNSTREAM" \
    || harness::fail "fixture is not what it claims: $UPSTREAM is not an ancestor of the correctly based branch"
if git -C "$origin" merge-base --is-ancestor "$UPSTREAM" "$MISBASED"; then
    harness::fail "fixture is not what it claims: $UPSTREAM IS an ancestor of the mis-based branch, so no row below can distinguish the two"
fi
[ "$DOWNSTREAM" != "$MISBASED" ] \
    || harness::fail "fixture is not what it claims: the two downstream branches are the same commit"
[ "$UPSTREAM" != "$OTHER_UPSTREAM" ] \
    || harness::fail "fixture is not what it claims: the two upstream bases are the same commit"

# --------------------------------------------------------------------------
# Clones
#
# Every run gets its OWN clone. Deepening mutates the checkout, so two runs
# sharing one would measure different histories and the second would silently
# be testing something else.
# --------------------------------------------------------------------------

clone_full() {
    local dest="$1"
    harness::setup_run git clone --quiet "file://$origin" "$dest"
}

# Depth 1 on one branch: what tools/sync-sources.sh produces by default, and
# the state in which the ancestry question is unanswerable.
clone_shallow() {
    local dest="$1" branch="$2"
    harness::setup_run git clone --quiet --depth 1 --branch "$branch" "file://$origin" "$dest"

    local count
    count="$(git -C "$dest" rev-list --count HEAD)"
    HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 2))
    if [ "$count" != "1" ]; then
        harness::fail "the shallow fixture $dest holds $count commit(s), not 1; it is not the depth-1 state under test"
    fi
    if git -C "$dest" rev-parse --verify --quiet "${UPSTREAM}^{commit}" >/dev/null; then
        harness::fail "the shallow fixture $dest already contains $UPSTREAM, so nothing below is exercising the unreachable-history path"
    fi
}

run_gate() {
    harness::run "$GATE" --repo "$1" --upstream "$2" --downstream "$3" "${@:4}"
}

# ==========================================================================
# 1. A complete clone where the ancestry HOLDS — and no fetch is needed
# ==========================================================================

full_ok="$tmp/full-ok"
clone_full "$full_ok"

run_gate "$full_ok" "$UPSTREAM" "$DOWNSTREAM"
harness::assert_status 0 "tools/check-merge-base.sh: a complete clone where the locked commit IS an ancestor"
harness::assert_output_contains "MERGE-BASE VERDICT: ancestor" "the verdict is stated"
harness::assert_output_contains "$UPSTREAM" "the pass names the upstream commit"
harness::assert_output_contains "$DOWNSTREAM" "the pass names the downstream commit"
# The history is already there, so the gate must answer from it rather than
# spend a network operation to re-learn what it can already see.
harness::assert_output_lacks "deepening by" "a complete clone needs no deepening"

# ==========================================================================
# 2. A complete clone where the ancestry DOES NOT HOLD
# ==========================================================================

full_wrong="$tmp/full-wrong"
clone_full "$full_wrong"

run_gate "$full_wrong" "$UPSTREAM" "$MISBASED"
harness::assert_status 1 "tools/check-merge-base.sh: a mis-based branch is a measured 'no', exit 1"
harness::assert_output_contains "MERGE-BASE VERDICT: not-ancestor" "the verdict is stated"
harness::assert_output_contains "$UPSTREAM" "the refusal names the locked upstream commit"
harness::assert_output_contains "$MISBASED" "the refusal names the downstream commit"
harness::assert_output_lacks "unmeasurable" "a measured 'no' is not reported as unmeasurable"

# ==========================================================================
# 3. THE CASE THIS FILE EXISTS FOR — a depth-1 clone where the ancestry holds
#    but is not provable at that depth
#
# It must deepen and then pass on the answer, not pass on the assumption. The
# proof is in three parts, and the third is the one that matters: the SAME
# fixture, with deepening forbidden, must refuse.
# ==========================================================================

shallow_ok="$tmp/shallow-ok"
clone_shallow "$shallow_ok" astro-next

run_gate "$shallow_ok" "$UPSTREAM" "$DOWNSTREAM"
harness::assert_status 0 "tools/check-merge-base.sh: a depth-1 clone whose ancestry holds"
harness::assert_output_contains "MERGE-BASE VERDICT: ancestor" "the verdict is stated"
harness::assert_output_contains "ancestry not yet provable" "the gate says it could not answer at depth 1"
harness::assert_output_contains "deepening by 50" "the first ladder step ran"
harness::assert_output_contains "evaluations: 2" "the ancestry was re-evaluated after deepening"

# The deepening was real: the checkout now holds history it did not have.
deepened_count="$(git -C "$shallow_ok" rev-list --count HEAD)"
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 2))
if [ "$deepened_count" -le 1 ]; then
    harness::fail "the checkout still holds $deepened_count commit(s): the pass did not come from deepening"
fi
git -C "$shallow_ok" rev-parse --verify --quiet "${UPSTREAM}^{commit}" >/dev/null \
    || harness::fail "the locked upstream commit is still absent after a passing run: the verdict was not measured against it"

# The negative control on the same shape: forbid deepening and the identical
# question becomes a refusal. Without this row a gate that simply passed on
# insufficient history would look exactly like the one above.
shallow_control="$tmp/shallow-control"
clone_shallow "$shallow_control" astro-next

run_gate "$shallow_control" "$UPSTREAM" "$DOWNSTREAM" --no-deepen
harness::assert_status 2 "tools/check-merge-base.sh: the same depth-1 clone with deepening forbidden"
harness::assert_output_contains "MERGE-BASE VERDICT: unmeasurable" "insufficient history is not a pass"
harness::assert_output_contains "deepening was not attempted" "the reason names --no-deepen"

# The ladder is a SEQUENCE, re-evaluated between steps — not one fetch with a
# number attached. Three steps too small to settle it individually, and the
# third one that does.
shallow_ladder="$tmp/shallow-ladder"
clone_shallow "$shallow_ladder" astro-next

harness::run env ASTRO_MERGE_BASE_DEEPEN_STEPS="1 1 5" \
    "$GATE" --repo "$shallow_ladder" --upstream "$UPSTREAM" --downstream "$DOWNSTREAM"
harness::assert_status 0 "tools/check-merge-base.sh: a bounded ladder walked step by step"
harness::assert_output_contains "deepening by 1" "the ladder's first step ran"
harness::assert_output_contains "deepening by 5" "the ladder's last step ran"
harness::assert_output_contains "evaluations: 4" "the ancestry was re-evaluated after every step"
harness::assert_output_contains "deepening steps: 1, 1, 5" "the run reports what it fetched"

# ==========================================================================
# 3b. The shape where bare git answers the question WRONGLY
#
# Everything above deepens because an object was missing. This one is worse and
# is the reason a "no" from a shallow checkout may not be believed: BOTH commits
# are present, `git merge-base --is-ancestor` runs to completion and exits 1 —
# and the ancestry is genuinely TRUE. A depth-1 clone grafts its boundary
# commits to have no parents, so the connecting history is not absent, it is
# rewritten as "there is none".
#
# A gate that trusted git's exit status here would fail a correct build with a
# confident, specific and wrong finding. The fixture asserts git's wrong answer
# first, so the row cannot pass for want of the shape it is about.
# ==========================================================================

grafted="$tmp/grafted"
harness::setup_run git clone --quiet --depth 1 --no-single-branch "file://$origin" "$grafted"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 3))
git -C "$grafted" rev-parse --verify --quiet "${UPSTREAM}^{commit}" >/dev/null \
    || harness::fail "the grafted fixture lacks the upstream commit; it is exercising the missing-object path, not the grafted-history one"
git -C "$grafted" rev-parse --verify --quiet "${DOWNSTREAM}^{commit}" >/dev/null \
    || harness::fail "the grafted fixture lacks the downstream commit"
if git -C "$grafted" merge-base --is-ancestor "$UPSTREAM" "$DOWNSTREAM"; then
    harness::fail "git already answers correctly in the grafted fixture, so this row proves nothing"
fi

run_gate "$grafted" "$UPSTREAM" "$DOWNSTREAM"
harness::assert_status 0 "tools/check-merge-base.sh: a grafted depth-1 clone where git's own answer is wrong"
harness::assert_output_contains "MERGE-BASE VERDICT: ancestor" "the verdict is the true one"
harness::assert_output_contains "the repository is shallow" "the reason names the grafted boundary"
harness::assert_output_lacks "MERGE-BASE VERDICT: not-ancestor" \
    "git's shallow-boundary answer was not passed through as a finding"

grafted_control="$tmp/grafted-control"
harness::setup_run git clone --quiet --depth 1 --no-single-branch "file://$origin" "$grafted_control"

run_gate "$grafted_control" "$UPSTREAM" "$DOWNSTREAM" --no-deepen
harness::assert_status 2 "tools/check-merge-base.sh: the same grafted clone with deepening forbidden"
harness::assert_output_contains "MERGE-BASE VERDICT: unmeasurable" \
    "a grafted 'no' is unmeasurable, never a measured 'no'"

# ==========================================================================
# 4. Refusals — the required-failure table
#
# Every row names the reason the gate must give, so no row can be satisfied by
# an unrelated failure. Each has its own clone: a deepening run mutates its
# checkout, and a shared one would silently change what the next row measures.
# ==========================================================================

# --- Deepening runs, and still cannot settle it ------------------------------
#
# The ladder is deliberately one commit long against a fixture whose locked
# commit is four commits further back: the honest shape of a bounded ladder
# running out, which on a real Chromium fetch is the common case rather than
# the exotic one.

exhausted="$tmp/ladder-exhausted"
clone_shallow "$exhausted" astro-next

run_ladder_exhausted() {
    env ASTRO_MERGE_BASE_DEEPEN_STEPS="1" \
        "$GATE" --repo "$exhausted" --upstream "$UPSTREAM" --downstream "$DOWNSTREAM"
}

# --- Deepening cannot run at all: the remote is gone -------------------------
#
# A fetch failure is an input to the verdict, not something to tolerate. The
# origin is moved aside for the duration so the failure is real rather than
# simulated.

unreachable="$tmp/remote-unreachable"
clone_shallow "$unreachable" astro-next

run_remote_unreachable() {
    local status=0
    mv "$origin" "$origin.moved"
    env ASTRO_MERGE_BASE_DEEPEN_STEPS="1" \
        "$GATE" --repo "$unreachable" --upstream "$UPSTREAM" --downstream "$DOWNSTREAM" || status=$?
    mv "$origin.moved" "$origin"
    return "$status"
}

# --- A commit that is in no history at all -----------------------------------
#
# The complete clone rules out shallowness as the explanation, which is what
# makes this row distinct: the object is simply absent, and "I cannot find it"
# must not be reported as "it is not an ancestor". Reading the second for the
# first is how an absent object becomes a confident finding about the branch.

full_absent="$tmp/full-absent"
clone_full "$full_absent"

run_absent_commit() {
    env ASTRO_MERGE_BASE_DEEPEN_STEPS="1" \
        "$GATE" --repo "$full_absent" --upstream "$ABSENT_COMMIT" --downstream "$DOWNSTREAM"
}

# --- The vacuity floor: no commits at all ------------------------------------

run_no_commits() {
    "$GATE" --repo "$full_ok" --upstream "" --downstream "$DOWNSTREAM"
}

run_no_downstream() {
    "$GATE" --repo "$full_ok" --upstream "$UPSTREAM" --downstream ""
}

# --- A ref name instead of a commit ------------------------------------------
#
# `main` resolves to a different commit over time, so an ancestry proved about
# it proves nothing about the build — the same reason browser.lock.json refuses
# anything but a full SHA.

run_ref_name() {
    "$GATE" --repo "$full_ok" --upstream main --downstream "$DOWNSTREAM"
}

# --- A path that is not its own work tree ------------------------------------
#
# This gate FETCHES, so it writes into a .git. A chromium/src holding only the
# copied overlay resolves to the Astro repository, and a fetch aimed at "the
# Chromium checkout" would run there instead.

nested="$full_ok/nested-directory"
mkdir -p "$nested"

run_nested_path() {
    "$GATE" --repo "$nested" --upstream "$UPSTREAM" --downstream "$DOWNSTREAM"
}

# --- merge-base itself failing to look ---------------------------------------
#
# A crash is not a verdict. `git merge-base --is-ancestor` exits 1 for a
# definitive "no" and 128 when it could not evaluate at all, and reading the
# second as the first turns a broken repository into a confident finding about
# the branch — the exact collision astro::require_astro_overlay documents, where
# the overlay detector's "absent" verdict and its crash exited alike.
#
# A shim on PATH forwards every other git invocation to the real binary, so only
# the one call under test misbehaves.

shim_dir="$tmp/git-shim"
mkdir -p "$shim_dir"
cat > "$shim_dir/git" <<EOF
#!/usr/bin/env bash
for arg in "\$@"; do
    if [ "\$arg" = "merge-base" ]; then
        printf 'fatal: simulated failure to evaluate\n' >&2
        exit 128
    fi
done
exec $(command -v git) "\$@"
EOF
chmod +x "$shim_dir/git"

crashing="$tmp/merge-base-crashes"
clone_full "$crashing"

run_merge_base_crash() {
    env PATH="$shim_dir:$PATH" ASTRO_MERGE_BASE_DEEPEN_STEPS="1" \
        "$GATE" --repo "$crashing" --upstream "$UPSTREAM" --downstream "$DOWNSTREAM"
}

table_misbased="$tmp/table-misbased"
clone_full "$table_misbased"

run_misbased_branch() {
    "$GATE" --repo "$table_misbased" --upstream "$UPSTREAM" --downstream "$MISBASED"
}

harness::register_failure "a downstream branch based on the wrong upstream" \
    run_misbased_branch \
    "MERGE-BASE VERDICT: not-ancestor" "$UPSTREAM" "$MISBASED" \
    "produces a different browser: every later gate passes"
harness::register_failure "a commit that exists in no history at all" \
    run_absent_commit \
    "MERGE-BASE VERDICT: unmeasurable" "not present in the local history" \
    "$ABSENT_COMMIT"
harness::register_failure "a bounded ladder that runs out before the answer" \
    run_ladder_exhausted \
    "MERGE-BASE VERDICT: unmeasurable" "not present in the local history" \
    "deepening steps:   1" "Unmeasurable is a refusal, never a pass"
harness::register_failure "deepening that cannot run because the remote is gone" \
    run_remote_unreachable \
    "MERGE-BASE VERDICT: unmeasurable" "merge-base:deepen-failed" \
    "deepening by 1 from origin failed"
harness::register_failure "no upstream commit given" \
    run_no_commits \
    "was handed no commits to check" "This is the vacuity floor"
harness::register_failure "no downstream commit given" \
    run_no_downstream \
    "was handed no commits to check" "This is the vacuity floor"
harness::register_failure "a ref name where a commit is required" \
    run_ref_name \
    "is not a full 40-character lowercase commit SHA: main" \
    "can resolve to a different commit later"
harness::register_failure "a repository path that is not its own work tree" \
    run_nested_path \
    "is not its own git work tree" "Refusing to act on a repository nobody named"
harness::register_failure "git merge-base exiting 128 rather than answering" \
    run_merge_base_crash \
    "MERGE-BASE VERDICT: unmeasurable" \
    "git merge-base exited 128, which is not one of its two answers"

harness::run_failure_table 9

# ==========================================================================
# 5. The two refusals are DISTINGUISHABLE
#
# "Measured, and the answer is no" and "could not be measured" are different
# facts, and a caller that reports them identically has thrown away the one
# that says the pipeline's own inputs are insufficient. Both are non-zero; the
# table above asserts that. This asserts they are not the same non-zero.
# ==========================================================================

exit_codes="$tmp/exit-codes"
clone_full "$exit_codes"

run_gate "$exit_codes" "$UPSTREAM" "$MISBASED"
harness::assert_status 1 "tools/check-merge-base.sh: a measured 'no' exits 1"

harness::run env ASTRO_MERGE_BASE_DEEPEN_STEPS="1" \
    "$GATE" --repo "$exit_codes" --upstream "$ABSENT_COMMIT" --downstream "$DOWNSTREAM"
harness::assert_status 2 "tools/check-merge-base.sh: an unmeasurable ancestry exits 2"

# ==========================================================================
# 6. A shallow clone whose ancestry is genuinely FALSE is still never guessed
#
# Deepening the mis-based branch cannot reach the locked commit — it is not in
# that branch's history at any depth — so the ladder runs out. The verdict must
# be unmeasurable, NOT the "not-ancestor" that happens to be the true answer:
# a gate that guesses right for the wrong reason is a gate that will guess.
# ==========================================================================

shallow_misbased="$tmp/shallow-misbased"
clone_shallow "$shallow_misbased" astro-wrong

harness::run env ASTRO_MERGE_BASE_DEEPEN_STEPS="1" \
    "$GATE" --repo "$shallow_misbased" --upstream "$UPSTREAM" --downstream "$MISBASED"
harness::assert_status 2 "tools/check-merge-base.sh: a shallow mis-based branch is unmeasurable, not guessed"
harness::assert_output_contains "MERGE-BASE VERDICT: unmeasurable" "the verdict is stated"
harness::assert_output_lacks "MERGE-BASE VERDICT: not-ancestor" \
    "an unproven answer is never reported as a measured one"

harness::pass
