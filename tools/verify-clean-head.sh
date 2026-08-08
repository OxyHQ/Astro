#!/usr/bin/env bash
# verify-clean-head.sh — run the build-safety suite against ONLY the files
# tracked at a commit, and require its verdicts to match the working tree's.
#
# A green suite run against a WORKING TREE proves nothing about the commit
# being published, because an untracked file sitting on disk satisfies every
# test that needs it. The suite cannot see the difference: it reads paths, and
# a path resolves whether or not git has ever heard of the file behind it.
#
# This repository has produced that defect four times, in both directions:
#
#   * tools/setup-win-sdk.sh — developer WIP swept INTO a commit;
#   * two .pyc files — build artifacts swept in, then propagated to five
#     branches;
#   * tools/verify-build-outcome.sh — left OUT while tools/build.sh, which
#     requires it at line 151 and invokes it at 282, went in. A clean checkout
#     had a build script that died at its own required-input check;
#   * tools/policy/manifest.py — left OUT while a committed case that runs it
#     went in.
#
# The local suite was green throughout, every time. Only materialising the
# commit on its own revealed it.
#
# Usage:
#   tools/verify-clean-head.sh [--commit COMMIT-ISH] [--keep]
#
# Exit status:
#   0  the clean tree's suite passed and agreed with the working tree's
#   1  the clean tree's suite failed, the two disagreed, or nothing was measured
#
# WHERE THIS FIRES. In CI the checkout already IS the commit, so the two runs
# agree by construction and only the clean run carries information. The
# comparison earns its place on a DEVELOPER's machine, where the working tree
# is the thing that differs. The static converse — every path a committed
# script names must itself be tracked — is a suite case
# (tools/tests/cases/committed-inputs-are-tracked.sh) precisely so that the
# property is enforced on every pull request rather than only where somebody
# happens to have uncommitted work.
#
# WHY `git archive` AND NOT `git worktree`. Not for the reason usually given: a
# worktree does NOT inherit ignored or untracked files, measured on a fixture
# carrying one of each — it checks out the commit and nothing else. The
# objections are different, and both are structural:
#
#   * `git worktree add` WRITES INTO the repository under test. It created
#     .git/worktrees/<id>/{HEAD,index,gitdir,commondir,logs/HEAD,ORIG_HEAD} on
#     that same fixture, and the entry persists until pruned. A gate that
#     mutates what it is verifying is the wrong shape.
#   * The worktree's .git is a FILE pointing back at the developer's
#     repository, so every git question asked inside it is answered by that
#     repository's object store. An archive extracted and re-initialised is
#     self-contained: its HEAD holds exactly the tracked set and nothing else,
#     which is what makes `git ls-files` inside it mean "at this commit"
#     rather than "on this machine".

ASTRO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ASTRO_ROOT
# shellcheck source=tools/lib/astro-common.sh
source "$ASTRO_ROOT/tools/lib/astro-common.sh"

COMMIT="HEAD"
KEEP_TREE="no"

usage() {
    cat >&2 <<'EOF'
Usage: tools/verify-clean-head.sh [--commit COMMIT-ISH] [--keep]

Materialises a tree holding only the files tracked at COMMIT (default HEAD),
runs tools/tests/run.sh inside it, and compares the per-case verdicts against a
run in this working tree. Fails if the clean run fails, if the two disagree, or
if nothing was measured.

  --commit COMMIT-ISH   the commit to verify (default: HEAD)
  --keep                keep the materialised tree and print its path

There is deliberately no way to run a subset. A filtered run is not this gate,
and a flag that produces something which LOOKS like the gate's verdict from a
fraction of its cases is how a gate stops being one.
EOF
}

while [ $# -gt 0 ]; do
    case "$1" in
        --commit) shift; COMMIT="${1:?--commit needs a commit-ish}" ;;
        --keep)   KEEP_TREE="yes" ;;
        -h|--help) usage; exit 0 ;;
        *)        usage; astro::die "Unknown argument: $1" ;;
    esac
    shift
done

astro::require_cmd git tar awk diff find

# --------------------------------------------------------------------------
# The repository under test
# --------------------------------------------------------------------------

# Same discipline as astro::resolve_chromium_src: the path must be a git work
# tree WHOSE TOP LEVEL IS THE PATH ITSELF. Without it, a tools/ directory
# copied under some enclosing repository would have every `git` call below
# answered by that repository, and the gate would cheerfully verify a commit
# belonging to something else.
ASTRO_ROOT_REAL="$(cd "$ASTRO_ROOT" && pwd -P)"
if ! REPO_TOPLEVEL="$(git -C "$ASTRO_ROOT_REAL" rev-parse --show-toplevel)"; then
    astro::die_with_hint \
        "Not a git work tree: $ASTRO_ROOT_REAL" \
        "This gate reads the commit out of the repository, so there has to be one."
fi
REPO_TOPLEVEL="$(cd "$REPO_TOPLEVEL" && pwd -P)"
if [ "$REPO_TOPLEVEL" != "$ASTRO_ROOT_REAL" ]; then
    astro::die_with_hint \
        "$ASTRO_ROOT_REAL is not its own git work tree." \
        "Its enclosing repository is: $REPO_TOPLEVEL" \
        "Every git command below would be answered by that repository instead," \
        "so the commit verified would not be this tree's. Refusing to continue."
fi

if ! COMMIT_SHA="$(git -C "$ASTRO_ROOT_REAL" rev-parse --verify "${COMMIT}^{commit}")"; then
    astro::die_with_hint \
        "Not a commit: $COMMIT" \
        "Pass an existing commit-ish, or omit --commit to verify HEAD."
fi

# --------------------------------------------------------------------------
# Materialise the commit
# --------------------------------------------------------------------------

WORK="$(mktemp -d "${TMPDIR:-/tmp}/astro-clean-head.XXXXXXXX")"
CLEAN_TREE="$WORK/tree"
mkdir -p "$CLEAN_TREE"

cleanup() {
    if [ "$KEEP_TREE" = "yes" ]; then
        astro::info "Kept the materialised tree: $CLEAN_TREE"
        return 0
    fi
    if [ -n "${WORK:-}" ] && [ -d "$WORK" ]; then
        rm -rf "$WORK"
    fi
}
trap cleanup EXIT

# The one line the mutation test replaces. Everything downstream is identical
# whichever tree lands here, which is the point: if this stops reading the
# COMMIT and starts reading the working tree, only the checks below can say so.
materialise_commit() {
    local sha="$1" destination="$2"
    git -C "$ASTRO_ROOT_REAL" archive --format=tar "$sha" | tar -x -C "$destination"
}

astro::info "Verifying commit $COMMIT_SHA"
materialise_commit "$COMMIT_SHA" "$CLEAN_TREE"

# --- The materialised tree must BE the commit, exactly ----------------------
#
# A count would pass on 514 wrong files. The path SETS are compared, which also
# supplies the vacuity floor: a broken archive, a wrong destination or an empty
# tree cannot produce a matching set.

COMMIT_PATHS="$WORK/commit-paths"
EXTRACTED_PATHS="$WORK/extracted-paths"

# Both sides are read NUL-separated and converted here, so neither git's path
# quoting nor a shell word split can make two identical trees look different.
git -C "$ASTRO_ROOT_REAL" ls-tree -r --name-only -z "$COMMIT_SHA" \
    | tr '\0' '\n' | LC_ALL=C sort > "$COMMIT_PATHS"
( cd "$CLEAN_TREE" && find . -mindepth 1 \( -type f -o -type l \) -print0 ) \
    | tr '\0' '\n' | sed 's|^\./||' | LC_ALL=C sort > "$EXTRACTED_PATHS"

TRACKED_COUNT="$(wc -l < "$COMMIT_PATHS")"
if [ "$TRACKED_COUNT" -lt 1 ]; then
    astro::die "The commit tracks no files at all: $COMMIT_SHA"
fi

if ! diff -u "$COMMIT_PATHS" "$EXTRACTED_PATHS" > "$WORK/extract.diff"; then
    astro::error "The materialised tree does not match the commit."
    sed 's/^/      /' "$WORK/extract.diff" >&2
    astro::die "Refusing to run the suite against a tree that is not the commit."
fi
astro::info "Materialised $TRACKED_COUNT path(s); the extracted set matches the commit exactly."

# --- Make it a repository in its own right ----------------------------------
#
# The suite asks git questions about itself — which files are tracked, what a
# path looked like at HEAD — so the clean tree needs its own object store. Its
# own, and not a link back to this one: that is what makes those answers
# properties of the commit rather than of this machine.

CLEAN_GIT_CONFIG="$WORK/gitconfig"
cat > "$CLEAN_GIT_CONFIG" <<'EOF'
[user]
    name = Astro Clean Head
    email = astro-clean-head@invalid
[init]
    defaultBranch = main
[commit]
    gpgsign = false
EOF

# Scoped to these three calls rather than exported: the two suite runs compared
# below must see the SAME environment, or the comparison measures the
# environment.
clean_git() {
    env GIT_CONFIG_GLOBAL="$CLEAN_GIT_CONFIG" GIT_CONFIG_NOSYSTEM=1 \
        git -C "$CLEAN_TREE" "$@"
}

clean_git init --quiet
# -f because a tracked path may also match a committed .gitignore rule; without
# it those files would be silently dropped and the clean HEAD would be a
# smaller commit than the one under test.
clean_git add -A -f
clean_git commit --quiet -m "clean checkout of $COMMIT_SHA"

clean_git ls-files | LC_ALL=C sort > "$WORK/clean-paths"
if ! diff -u "$COMMIT_PATHS" "$WORK/clean-paths" > "$WORK/reinit.diff"; then
    astro::error "The re-initialised repository does not track the commit's file set."
    sed 's/^/      /' "$WORK/reinit.diff" >&2
    astro::die "Refusing to run the suite against a tree git disagrees with."
fi
astro::info "Re-initialised as a self-contained repository; its tracked set matches."

astro::require_file "$CLEAN_TREE/tools/tests/run.sh" "test runner at $COMMIT_SHA"

# --------------------------------------------------------------------------
# Run both suites
# --------------------------------------------------------------------------
#
# Each run's working directory is its OWN root. This is not cosmetic: a case
# that shells out to `git rev-parse HEAD` without -C reads the process's
# current directory, so running the clean tree's suite from inside this
# repository answers with THIS repository's HEAD and the case fails on a
# difference nobody introduced. Measured, on
# tools/tests/cases/provenance-records-what-is-on-disk.sh.
#
# The clean tree deliberately has no chromium/, depot_tools/ or
# .ungoogled-chromium/. Those are declared not-tracked and are fetched at the
# locked commit, so no commit could contain them and their absence is not a
# property of this one. A case that only passes once Chromium has been fetched
# is not a build-safety gate, and this is where that would surface.

run_suite() {
    local label="$1" root="$2" log="$3"
    local status=0
    astro::info "Running the suite in the $label tree..."
    ( cd "$root" && exec ./tools/tests/run.sh ) > "$log" 2>&1 || status=$?
    printf '%s' "$status"
}

WORKING_LOG="$WORK/working.log"
CLEAN_LOG="$WORK/clean.log"

WORKING_STATUS="$(run_suite "working" "$ASTRO_ROOT_REAL" "$WORKING_LOG")"
CLEAN_STATUS="$(run_suite "clean HEAD" "$CLEAN_TREE" "$CLEAN_LOG")"

# --------------------------------------------------------------------------
# Read the verdicts
# --------------------------------------------------------------------------

# Writes "<name> <PASS|FAIL> <assertions-or-dash>" per case. Parsing the
# runner's own output rather than re-deriving it keeps this honest: the gate
# reports what the runner reported.
#
# Anchored at column zero because run.sh indents a failing case's own output by
# eight spaces, and a case is perfectly entitled to print the word PASS inside
# it. POSIX awk only: ubuntu-latest ships mawk, which has no three-argument
# match(), so the assertion count is read by walking fields instead.
read_verdicts() {
    local log="$1" out="$2"
    awk '
        /^(PASS|FAIL)  / {
            detail = "-"
            for (i = 3; i < NF; i++) {
                if ($i ~ /^\([0-9]+$/ && $(i + 1) ~ /^assertions/) {
                    detail = substr($i, 2)
                    break
                }
            }
            print $2, $1, detail
        }
    ' "$log" | LC_ALL=C sort > "$out"
}

read_verdicts "$WORKING_LOG" "$WORK/working.verdicts"
read_verdicts "$CLEAN_LOG" "$WORK/clean.verdicts"

WORKING_CASES="$(wc -l < "$WORK/working.verdicts")"
CLEAN_CASES="$(wc -l < "$WORK/clean.verdicts")"

printf '\n=== Clean-HEAD verification ===\n'
printf 'Commit:       %s\n' "$COMMIT_SHA"
printf 'Tracked:      %s path(s)\n' "$TRACKED_COUNT"
printf 'Clean tree:   %s\n' "$CLEAN_TREE"
printf 'working tree: %s case(s), runner exit %s\n' "$WORKING_CASES" "$WORKING_STATUS"
printf 'clean HEAD:   %s case(s), runner exit %s\n\n' "$CLEAN_CASES" "$CLEAN_STATUS"

FAILURES=0

# --- Vacuity floor ----------------------------------------------------------
#
# Before any verdict is read. The floor is DERIVED rather than a constant kept
# in step with the suite by hand: every case file on disk must have produced a
# verdict. A hard-coded minimum passes a run that silently skipped nine cases
# as long as it ran enough of them, and it goes stale the moment the suite
# changes size — including in a fixture, where a floor written for the real
# repository cannot be met at all and so can never be tested.
#
# The "at least one" is separate and load-bearing: with no case files the
# counts would agree at zero, which is the exact reading a broken `git
# archive`, a wrong path or an empty tree produces.
assert_every_case_ran() {
    local label="$1" root="$2" reported="$3" log="$4"
    local present=0

    # The directory can be absent rather than empty, and in the clean tree that
    # is the NORMAL shape: git stores no empty directories, so a commit whose
    # cases were all deleted materialises without the directory at all. Asking
    # find to walk a path that is not there is a stack trace where a verdict
    # belongs.
    if [ -d "$root/tools/tests/cases" ]; then
        present="$(find "$root/tools/tests/cases" -maxdepth 1 -type f -name '*.sh' | wc -l)"
    fi

    if [ "$present" -lt 1 ]; then
        astro::die_with_hint \
            "The $label tree holds no test cases at all." \
            "Nothing could have been measured, and a count of zero matching a" \
            "count of zero is not agreement. Refusing to report success."
    fi
    if [ "$reported" != "$present" ]; then
        astro::error \
            "The $label run reported $reported verdict(s) for $present case file(s)."
        printf -- '--- %s run ---\n' "$label" >&2
        sed 's/^/      /' "$log" >&2
        astro::die "Cases were skipped or the runner's output was not understood."
    fi
    astro::info "$label tree: all $present case(s) reported a verdict."
}

assert_every_case_ran "clean HEAD" "$CLEAN_TREE" "$CLEAN_CASES" "$CLEAN_LOG"
assert_every_case_ran "working" "$ASTRO_ROOT_REAL" "$WORKING_CASES" "$WORKING_LOG"

# --- The clean run must pass on its own merits ------------------------------

if [ "$CLEAN_STATUS" != "0" ]; then
    astro::error "The suite FAILED against the commit's own files (exit $CLEAN_STATUS)."
    FAILURES=$((FAILURES + 1))
fi

# --- The two runs must agree, case by case ----------------------------------
#
# Compared over the UNION, with "absent" as a verdict of its own: a case file
# present in one tree and not the other is the same defect wearing different
# clothes — an uncommitted case, or a committed case whose input never made it.

DIFFERENCES="$WORK/differences"
: > "$DIFFERENCES"

verdict_of() {
    local name="$1" file="$2" value
    value="$(awk -v want="$name" '$1 == want { print $2 }' "$file")"
    printf '%s' "${value:-absent}"
}

assertions_of() {
    local name="$1" file="$2" value
    value="$(awk -v want="$name" '$1 == want { print $3 }' "$file")"
    printf '%s' "${value:--}"
}

while IFS= read -r case_name; do
    [ -n "$case_name" ] || continue
    clean_verdict="$(verdict_of "$case_name" "$WORK/clean.verdicts")"
    working_verdict="$(verdict_of "$case_name" "$WORK/working.verdicts")"
    if [ "$clean_verdict" != "$working_verdict" ]; then
        printf '%s %s %s\n' "$case_name" "$clean_verdict" "$working_verdict" >> "$DIFFERENCES"
    fi
done < <(cut -d' ' -f1 "$WORK/clean.verdicts" "$WORK/working.verdicts" | LC_ALL=C sort -u)

if [ -s "$DIFFERENCES" ]; then
    astro::error "The clean-HEAD run and the working-tree run DISAGREE."
    printf '\n  %-46s %-8s %s\n' "case" "clean" "working" >&2
    while read -r case_name clean_verdict working_verdict; do
        printf '  %-46s %-8s %s\n' "$case_name" "$clean_verdict" "$working_verdict" >&2
    done < "$DIFFERENCES"
    printf '\nA case that passes here and fails from a clean checkout is depending on\n' >&2
    printf 'a file git has never been told about. Commit it, or declare it\n' >&2
    printf 'not-tracked in tools/tests/cases/developer-wip-stays-untracked.sh.\n' >&2
    printf 'A case that is "absent" on one side is a case file itself in that state.\n' >&2
    FAILURES=$((FAILURES + 1))
fi

# --- Assertion-count drift, reported and not enforced -----------------------
#
# A count difference is normal and explained: the working tree legitimately
# holds files the scans read (an untracked tools/*.sh adds one to the shell
# static analysis), so failing on it would cry wolf. It is printed because it
# is the cheapest available hint that a case is reading MORE in one tree than
# the other — the same coupling, one step before it changes a verdict.

COUNT_DRIFT="$WORK/count-drift"
: > "$COUNT_DRIFT"
while IFS= read -r case_name; do
    [ -n "$case_name" ] || continue
    clean_count="$(assertions_of "$case_name" "$WORK/clean.verdicts")"
    working_count="$(assertions_of "$case_name" "$WORK/working.verdicts")"
    if [ "$clean_count" != "$working_count" ] \
       && [ "$clean_count" != "-" ] && [ "$working_count" != "-" ]; then
        printf '  %-46s clean=%s working=%s\n' \
            "$case_name" "$clean_count" "$working_count" >> "$COUNT_DRIFT"
    fi
done < <(cut -d' ' -f1 "$WORK/clean.verdicts")

if [ -s "$COUNT_DRIFT" ]; then
    printf 'Assertion counts differ (informational; not part of the verdict):\n'
    cat "$COUNT_DRIFT"
    printf '\n'
fi

if [ "$FAILURES" -gt 0 ]; then
    # The clean run's own output, printed ONCE however many checks fired, so
    # the reader sees WHICH path was missing without reproducing the run.
    printf -- '\n--- clean HEAD run (%s) ---\n' "$COMMIT_SHA" >&2
    sed 's/^/      /' "$CLEAN_LOG" >&2
    astro::die "Clean-HEAD verification failed."
fi

printf 'The commit stands on its own: %s case(s), same verdict in both trees.\n' "$CLEAN_CASES"
