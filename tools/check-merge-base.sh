#!/usr/bin/env bash
# check-merge-base.sh — prove the locked upstream Chromium commit is an ancestor
# of the downstream commit being built, or refuse.
#
# Astro's Chromium integration model (docs/astro-next/architecture/
# ADR-0001-chromium-integration-model.md) is a downstream branch carrying a thin
# delta on top of an upstream Chromium tag. A branch based on the WRONG upstream
# is the one failure in the precondition list that every later gate passes: the
# tree resolves, `gn gen` writes a build graph, the compile succeeds, the binary
# links, the overlay is present — and the browser is built from a Chromium
# nobody declared. See clean-checkout-preconditions.md row 1.3, which is what
# this script decides.
#
# THREE VERDICTS, NOT TWO. The reason is in the fetch depth. Astro fetches
# Chromium at ASTRO_FETCH_DEPTH=1 by default (tools/sync-sources.sh), and a
# depth-1 checkout does not contain the history `git merge-base --is-ancestor`
# needs — it cannot answer the question at all. So:
#
#   0  ancestor       measured, and the answer is yes
#   1  not-ancestor   measured, and the answer is no
#   2  unmeasurable   the history on disk cannot decide it — a REFUSAL
#
# "I could not measure it" must never become "it is probably fine", and it must
# not become "it is wrong" either: a shallow boundary, an absent object and a
# genuinely mis-based branch would then all produce the same verdict, which is
# the same as having no check. This mirrors the three-verdict discipline
# astro::require_astro_overlay already applies to the packaging gate.
#
# What makes a "no" trustworthy: `merge-base --is-ancestor` walks real parent
# links, and a shallow clone's boundary commits are grafted to have no parents.
# So a "yes" is definitive at any depth — the path it found is real — while a
# "no" is only definitive once the repository holds complete history. That
# asymmetry is the whole design; it is why a shallow "no" deepens rather than
# refuses, and why a shallow "yes" passes immediately without fetching.
#
# Usage:
#   tools/check-merge-base.sh --repo DIR --upstream SHA --downstream SHA [options]
#
# Both commits must be full 40-character SHAs, for the same reason the lock
# requires them: a branch or tag name can resolve to a different commit later,
# and an ancestry proof about "whatever main points at today" proves nothing
# about the build.

ASTRO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ASTRO_ROOT
# shellcheck source=tools/lib/astro-common.sh
source "$ASTRO_ROOT/tools/lib/astro-common.sh"

REPO=""
UPSTREAM=""
DOWNSTREAM=""
REMOTE="origin"
DEEPEN_REF=""
ALLOW_DEEPEN=1

# Verdict exit codes. Distinct on purpose: a caller that treats every non-zero
# exit as a refusal is correct, and a caller that wants to report WHY can tell
# a measured "no" from a refusal to guess. The overlay detector's history is the
# argument — its "absent" verdict and its crash exited with the same status, so
# neither could be trusted.
readonly EXIT_ANCESTOR=0
readonly EXIT_NOT_ANCESTOR=1
readonly EXIT_UNMEASURABLE=2

# The deepening ladder: a DECLARED, BOUNDED sequence, tried in order, with the
# ancestry re-evaluated after each step.
#
# Not `--unshallow`: that is unbounded, and on Chromium it is the tens of
# gigabytes ASTRO_FETCH_DEPTH=1 exists to avoid — a gate must not silently turn
# a five-minute verification into the largest transfer in the pipeline.
#
# Why these three, in this order:
#   50    the shape the model actually describes — a thin downstream, a handful
#         of Astro commits above the locked upstream tag — with an order of
#         magnitude of headroom.
#   500   a downstream branch that has accumulated real work, or one whose base
#         sits a few upstream refresh points back.
#   5000  the last resort. Past this the branch is not a thin delta on the
#         locked upstream any more, and the right answer is a human deciding
#         which of the two revisions is wrong — not a larger fetch.
#
# Bounded: at most three network operations, at most 5,550 commits of history
# beyond the current boundary, and the same repository state always takes the
# same steps.
#
# Overriding it can only produce MORE refusals, never a wrong pass: deepening
# adds objects and never removes them, so a verdict can only move from
# unmeasurable to definite, and a definite verdict is stable under further
# deepening. That monotonicity is what makes this safe to expose.
ASTRO_MERGE_BASE_DEEPEN_STEPS="${ASTRO_MERGE_BASE_DEEPEN_STEPS:-50 500 5000}"

usage() {
    cat >&2 <<'EOF'
Usage: tools/check-merge-base.sh --repo DIR --upstream SHA --downstream SHA [options]

  --repo DIR         The git checkout to evaluate in (required).
  --upstream SHA     The locked upstream commit that must be an ancestor.
  --downstream SHA   The downstream commit being built.
  --remote NAME      Remote to deepen from (default: origin).
  --ref REF          Ref to deepen along. Without it the remote's own refspec is
                     deepened, which on a repository with many branches fetches
                     far more than the branch under test.
  --no-deepen        Never fetch. Insufficient history is reported as
                     unmeasurable immediately.
  -h, --help

Exit status:
  0  ancestor      measured: the downstream commit is built on the locked upstream
  1  not-ancestor  measured: it is not
  2  unmeasurable  the history on disk cannot decide it; nothing is assumed

Environment:
  ASTRO_MERGE_BASE_DEEPEN_STEPS   The deepening ladder (default: 50 500 5000).
EOF
}

while [ $# -gt 0 ]; do
    case "$1" in
        --repo)       shift; REPO="${1:?--repo needs a directory}" ;;
        --upstream)   shift; UPSTREAM="${1-}" ;;
        --downstream) shift; DOWNSTREAM="${1-}" ;;
        --remote)     shift; REMOTE="${1:?--remote needs a name}" ;;
        --ref)        shift; DEEPEN_REF="${1:?--ref needs a ref}" ;;
        --no-deepen)  ALLOW_DEEPEN=0 ;;
        -h|--help)    usage; exit 0 ;;
        *)            usage; astro::die "Unknown argument: $1" ;;
    esac
    # `--upstream` and `--downstream` accept an EMPTY value on purpose — that is
    # the vacuity floor's input — so the option may also be the last argument on
    # the line, leaving nothing to shift past. An unguarded `shift` there exits
    # through the ERR trap, reporting a shell failure instead of the missing
    # commit the caller actually needs to hear about.
    if [ $# -gt 0 ]; then
        shift
    fi
done

astro::require_cmd git

# --------------------------------------------------------------------------
# Refusals
# --------------------------------------------------------------------------

# astro::die_with_hint always exits 1, and this gate's whole point is that its
# two failure verdicts are distinguishable. Same layout, chosen exit code.
refuse() {
    local code="$1" message="$2"
    shift 2
    astro::error "$message"
    local line
    for line in "$@"; do
        printf '      %s%s%s\n' "$ASTRO_C_DIM" "$line" "$ASTRO_C_OFF" >&2
    done
    exit "$code"
}

# --------------------------------------------------------------------------
# The vacuity floor, before anything else
#
# A gate handed no commits measures nothing. Without this the empty string
# reaches git, which fails for its own reasons, and the run reports a refusal
# that says nothing about the fact that nobody supplied the inputs — the shape
# in which a mis-wired caller looks exactly like a genuine finding.
# --------------------------------------------------------------------------

if [ -z "$UPSTREAM" ] || [ -z "$DOWNSTREAM" ]; then
    refuse "$EXIT_UNMEASURABLE" \
        "The merge-base gate was handed no commits to check." \
        "  --upstream:   ${UPSTREAM:-<empty>}" \
        "  --downstream: ${DOWNSTREAM:-<empty>}" \
        "" \
        "This is the vacuity floor. Nothing was measured, so nothing may be" \
        "reported: a gate with no inputs must fail rather than describe an" \
        "ancestry nobody established."
fi

require_full_sha() {
    local value="$1" what="$2"
    local invalid=0
    [ "${#value}" -eq 40 ] || invalid=1
    case "$value" in
        *[!0-9a-f]*) invalid=1 ;;
    esac
    if [ "$invalid" = "1" ]; then
        refuse "$EXIT_UNMEASURABLE" \
            "$what is not a full 40-character lowercase commit SHA: $value" \
            "A branch or tag name can resolve to a different commit later, so an" \
            "ancestry proved about one proves nothing about the build. Pass the" \
            "same full SHAs browser.lock.json records."
    fi
}

require_full_sha "$UPSTREAM" "--upstream"
require_full_sha "$DOWNSTREAM" "--downstream"

# --------------------------------------------------------------------------
# The repository
#
# This gate FETCHES, so it writes into someone's .git. It therefore applies the
# same rule astro::resolve_chromium_src applies before any write: the path must
# be a git work tree whose top level IS the path. A chromium/src holding only
# the copied overlay resolves, via --show-toplevel, to the Astro repository —
# and a fetch aimed at "the Chromium checkout" would then run in Astro's own
# repository. The Chromium-specific sentinel checks stay with the caller, which
# knows it is looking at Chromium; this check is the one that must hold for any
# repository the gate is pointed at.
# --------------------------------------------------------------------------

[ -n "$REPO" ] || { usage; astro::die "--repo is required"; }
[ -d "$REPO" ] || astro::die "Repository not found: $REPO"

REPO="$(cd "$REPO" && pwd -P)"

TOPLEVEL=""
if ! TOPLEVEL="$(git -C "$REPO" rev-parse --show-toplevel 2>&1)"; then
    astro::die_with_hint \
        "Not a git work tree, so no ancestry can be evaluated in it: $REPO" \
        "git said: $TOPLEVEL"
fi
TOPLEVEL="$(cd "$TOPLEVEL" && pwd -P)"
if [ "$TOPLEVEL" != "$REPO" ]; then
    astro::die_with_hint \
        "$REPO is not its own git work tree." \
        "Its enclosing repository is: $TOPLEVEL" \
        "Ancestry would be evaluated — and history fetched — in $TOPLEVEL" \
        "instead. Refusing to act on a repository nobody named."
fi

# --------------------------------------------------------------------------
# Evaluation
# --------------------------------------------------------------------------

VERDICT=""
REASON=""
EVALUATIONS=0
DEEPENING_TAKEN=""

# Sets VERDICT to ancestor | not-ancestor | indeterminate, and REASON when the
# answer is indeterminate.
evaluate_ancestry() {
    EVALUATIONS=$((EVALUATIONS + 1))
    VERDICT=""
    REASON=""

    # Both objects must be present locally. A missing one makes merge-base exit
    # 128 with "Not a valid commit name", which is a failure to look rather than
    # an answer — and is exactly what a depth-1 checkout produces.
    local absent=""
    local commit
    for commit in "$UPSTREAM" "$DOWNSTREAM"; do
        if ! git -C "$REPO" rev-parse --verify --quiet "${commit}^{commit}" >/dev/null; then
            absent="$absent $commit"
        fi
    done
    if [ -n "$absent" ]; then
        VERDICT="indeterminate"
        REASON="commit(s) not present in the local history:${absent}"
        return 0
    fi

    local shallow
    shallow="$(git -C "$REPO" rev-parse --is-shallow-repository)"

    local status=0
    git -C "$REPO" merge-base --is-ancestor "$UPSTREAM" "$DOWNSTREAM" || status=$?

    case "$status" in
        0)
            # Definitive at any depth: the path it walked is made of real parent
            # links, and a grafted boundary can only hide paths, never invent one.
            VERDICT="ancestor"
            ;;
        1)
            if [ "$shallow" = "true" ]; then
                VERDICT="indeterminate"
                REASON="the repository is shallow, so 'not an ancestor' may only mean the connecting history was grafted away"
            else
                VERDICT="not-ancestor"
            fi
            ;;
        *)
            # A crash is not a verdict. merge-base exits 1 for a definitive "no"
            # and 128 for "I could not look"; reading the second as the first is
            # how a broken invocation becomes a confident finding.
            VERDICT="indeterminate"
            REASON="git merge-base exited $status, which is not one of its two answers (0 ancestor, 1 not an ancestor)"
            ;;
    esac
    return 0
}

# Deepens by one ladder step. Returns non-zero when deepening could not run or
# did not succeed, with REASON set; the caller turns that into a refusal, so the
# failure is reported rather than tolerated.
deepen_once() {
    local step="$1"

    if [ "$ALLOW_DEEPEN" != "1" ]; then
        REASON="$REASON; deepening was not attempted (--no-deepen)"
        return 1
    fi

    local remote_url="" remote_status=0
    remote_url="$(git -C "$REPO" remote get-url "$REMOTE" 2>&1)" || remote_status=$?
    if [ "$remote_status" -ne 0 ]; then
        REASON="$REASON; no remote '$REMOTE' to deepen from (git said: $remote_url)"
        return 1
    fi

    astro::info "  deepening by $step commit(s) from $REMOTE ($remote_url)"
    local status=0
    if [ -n "$DEEPEN_REF" ]; then
        git -C "$REPO" fetch --deepen="$step" "$REMOTE" "$DEEPEN_REF" || status=$?
    else
        git -C "$REPO" fetch --deepen="$step" "$REMOTE" || status=$?
    fi
    if [ "$status" -ne 0 ]; then
        astro::warn "merge-base:deepen-failed" \
            "deepening by $step from $REMOTE failed (exit $status)"
        REASON="$REASON; deepening by $step from $REMOTE failed (exit $status)"
        return 1
    fi

    DEEPENING_TAKEN="${DEEPENING_TAKEN:+$DEEPENING_TAKEN, }$step"
    return 0
}

astro::info "=== Astro merge-base gate ==="
astro::info "  repository:        $REPO"
astro::info "  locked upstream:   $UPSTREAM"
astro::info "  downstream commit: $DOWNSTREAM"

evaluate_ancestry

read -ra LADDER <<< "$ASTRO_MERGE_BASE_DEEPEN_STEPS"
for step in "${LADDER[@]+"${LADDER[@]}"}"; do
    [ "$VERDICT" = "indeterminate" ] || break

    case "$step" in
        ''|*[!0-9]*) astro::die "ASTRO_MERGE_BASE_DEEPEN_STEPS contains a non-numeric step: $step" ;;
    esac
    [ "$step" -gt 0 ] || astro::die "ASTRO_MERGE_BASE_DEEPEN_STEPS contains a non-positive step: $step"

    astro::info "  ancestry not yet provable ($REASON)"
    deepen_once "$step" || break
    evaluate_ancestry
done

# --------------------------------------------------------------------------
# The verdict
#
# The floor first: a broken loop, an early `return` or a deleted branch below
# would otherwise reach the end of the script and exit 0, which is the one
# outcome this gate must never produce without having measured something.
# --------------------------------------------------------------------------

if [ "$EVALUATIONS" -lt 1 ] || [ -z "$VERDICT" ]; then
    refuse "$EXIT_UNMEASURABLE" \
        "The merge-base gate produced no verdict after $EVALUATIONS evaluation(s)." \
        "Nothing was measured, so nothing is reported as measured."
fi

case "$VERDICT" in
    ancestor)
        printf 'MERGE-BASE VERDICT: ancestor\n'
        printf '  %s is an ancestor of %s\n' "$UPSTREAM" "$DOWNSTREAM"
        printf '  evaluations: %s; deepening steps: %s\n' \
            "$EVALUATIONS" "${DEEPENING_TAKEN:-none needed}"
        exit "$EXIT_ANCESTOR"
        ;;
    not-ancestor)
        printf 'MERGE-BASE VERDICT: not-ancestor\n'
        refuse "$EXIT_NOT_ANCESTOR" \
            "The downstream commit is not built on the locked upstream commit." \
            "  locked upstream:   $UPSTREAM" \
            "  downstream commit: $DOWNSTREAM" \
            "  repository:        $REPO" \
            "" \
            "A downstream branch based on the wrong upstream compiles cleanly and" \
            "produces a different browser: every later gate passes. Either the lock" \
            "names the wrong upstream, or the branch has to be rebased onto it." \
            "" \
            "To see the divergence:" \
            "  git -C $REPO log --oneline $UPSTREAM..$DOWNSTREAM" \
            "  git -C $REPO merge-base $UPSTREAM $DOWNSTREAM"
        ;;
    indeterminate)
        printf 'MERGE-BASE VERDICT: unmeasurable\n'
        refuse "$EXIT_UNMEASURABLE" \
            "Cannot establish whether the locked upstream commit is an ancestor of the downstream commit." \
            "  locked upstream:   $UPSTREAM" \
            "  downstream commit: $DOWNSTREAM" \
            "  repository:        $REPO" \
            "  reason:            $REASON" \
            "  deepening steps:   ${DEEPENING_TAKEN:-none completed}" \
            "  ladder:            $ASTRO_MERGE_BASE_DEEPEN_STEPS" \
            "" \
            "Unmeasurable is a refusal, never a pass. A downstream branch on the" \
            "wrong upstream is the one defect every later gate accepts, so an" \
            "ancestry nobody could establish must not be assumed correct." \
            "" \
            "Establish it by giving the checkout the history, then re-run:" \
            "  git -C $REPO fetch --unshallow $REMOTE" \
            "" \
            "--unshallow deepens the refs this checkout already tracks. If the" \
            "commit is not on any of them — a single-branch clone cannot see a" \
            "commit that lives only on another ref — fetch the ref carrying it:" \
            "  git -C $REPO fetch $REMOTE <ref carrying $UPSTREAM>" \
            "" \
            "  tools/check-merge-base.sh --repo $REPO \\" \
            "      --upstream $UPSTREAM --downstream $DOWNSTREAM"
        ;;
    *)
        astro::die "internal: unknown verdict '$VERDICT'"
        ;;
esac
