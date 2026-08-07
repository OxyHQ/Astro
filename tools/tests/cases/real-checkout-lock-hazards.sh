#!/usr/bin/env bash
# The hazard a real checkout exposed in the step that FETCHES the locked
# sources, as opposed to the ones that build from them:
#
#   * a failed `git fetch` keeps nothing. Telling a user their retry resumes is
#     a promise git does not make, and acting on it wastes the one thing a bad
#     link has none of.
#
# Its siblings — `find … | head` dying of SIGPIPE, and a tracked `.orig` being
# upstream content rather than a patch artifact — belong to the build pipeline
# and live in real-checkout-hazards.sh. This one is split out because
# tools/sync-sources.sh does not exist at that layer, so a single case could
# not run there.
#
# The hazard gets a demonstration that it is real AND a guard on the wording,
# because a promise nobody can justify is a promise somebody restores.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

tmp="$(harness::tmpdir)"

count_git_objects() {
    git -C "$1" count-objects -v | awk '/^(count|in-pack):/ { total += $2 } END { print total + 0 }'
}

source_repo="$tmp/fetch-source"
harness::make_source_repo "$source_repo" "fetch-fixture" > "$tmp/fetch-source.shas"

# Control first: without it, "zero objects" proves the fetch kept nothing OR
# that count_git_objects cannot see objects at all.
dest_ok="$tmp/fetch-dest-ok"
git init --quiet "$dest_ok"
git -C "$dest_ok" remote add origin "$source_repo"
before_ok="$(count_git_objects "$dest_ok")"

harness::run git -C "$dest_ok" fetch --quiet origin "+refs/heads/main:refs/remotes/origin/main"
harness::assert_status 0 "control: a fetch from a real repository succeeds"

after_ok="$(count_git_objects "$dest_ok")"
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ "$after_ok" -le "$before_ok" ]; then
    harness::fail "control is vacuous: a successful fetch left the object count at $after_ok, so a zero count below would prove nothing"
fi

dest_bad="$tmp/fetch-dest-bad"
git init --quiet "$dest_bad"
git -C "$dest_bad" remote add origin "$tmp/no-such-repository.git"

harness::run git -C "$dest_bad" fetch origin "+refs/heads/main:refs/remotes/origin/main"
harness::assert_nonzero_status "a fetch from a remote that does not exist"

after_bad="$(count_git_objects "$dest_bad")"
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ "$after_bad" != "0" ]; then
    harness::fail "a failed fetch left $after_bad object(s) behind; the retry advice below depends on it leaving none"
fi

packs="$(ls -A "$dest_bad/.git/objects/pack")"
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ -n "$packs" ]; then
    harness::fail "a failed fetch left pack files behind: $packs"
fi

# The wording must not promise otherwise. Intent, not sentences: a rewrite that
# still says every attempt starts from scratch has to keep passing, and only a
# claim that the partial transfer survives may fail.
SYNC_SOURCES="$ASTRO_ROOT/tools/sync-sources.sh"
harness::assert_file_exists "$SYNC_SOURCES"

FETCH_FALSE_PROMISES=(
    'where it left off'
    'picks? up where'
    'resumes the (partial|failed|interrupted) (transfer|fetch|download)'
    '(partial|interrupted|failed) (transfer|fetch|download) is (kept|preserved|retained|reused)'
    'keeps (what|the bytes|the objects) (it |already )?(downloaded|transferred)'
    'already (downloaded|transferred) (objects|data|bytes) are (kept|reused|retained)'
)

# Vacuity floor for the loop below. A truncated array asserts nothing while
# still exiting zero, which is indistinguishable from a script that makes no
# false promises.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ "${#FETCH_FALSE_PROMISES[@]}" -lt 6 ]; then
    harness::fail "only ${#FETCH_FALSE_PROMISES[@]} false-promise pattern(s) declared; the list has been truncated"
fi

for promise in "${FETCH_FALSE_PROMISES[@]}"; do
    promise_hits=""
    promise_status=0
    promise_hits="$(grep -inE "$promise" "$SYNC_SOURCES")" || promise_status=$?
    HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
    if [ "$promise_status" -gt 1 ]; then
        harness::fail "grep for the false promise '$promise' failed (exit $promise_status)"
    fi
    if [ -n "$promise_hits" ]; then
        harness::fail "tools/sync-sources.sh promises a failed fetch keeps what it downloaded ('$promise'):
$promise_hits"
    fi
done

# Mutation support for the loop above: a pattern set that matched nothing at all
# would report the script clean whatever it said. A probe carrying one sentence
# of each forbidden shape proves the patterns still fire.
cat > "$tmp/probe-false-promises.txt" <<'PROBE'
The retry continues from where it left off.
A second attempt picks up where the first stopped.
It resumes the partial transfer rather than starting again.
The interrupted download is preserved between attempts.
It keeps the bytes it downloaded.
Already transferred objects are reused on the next attempt.
PROBE

for promise in "${FETCH_FALSE_PROMISES[@]}"; do
    probe_hits=0
    probe_status=0
    probe_hits="$(grep -icE "$promise" "$tmp/probe-false-promises.txt")" || probe_status=$?
    HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
    if [ "$probe_status" -gt 1 ]; then
        harness::fail "grep of the false-promise probe failed (exit $probe_status) for '$promise'"
    fi
    if [ "$probe_hits" -lt 1 ]; then
        harness::fail "the false-promise pattern '$promise' matches nothing even in the probe; it would report any wording clean"
    fi
done

# The positive half. Two occurrences are required because two different people
# read two different messages: the warning printed on every retry, and the fatal
# hint printed when the attempts run out. Either one alone leaves half the
# audience deciding to wait it out on a link that will never finish.
FETCH_STARTS_OVER='(every|each) attempt starts|retrying from the start|not a resumable operation|discards its partial transfer'
starts_over=0
starts_over_status=0
starts_over="$(grep -icE "$FETCH_STARTS_OVER" "$SYNC_SOURCES")" || starts_over_status=$?
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ "$starts_over_status" -gt 1 ]; then
    harness::fail "grep for the start-over wording failed (exit $starts_over_status)"
fi
if [ "$starts_over" -lt 2 ]; then
    harness::fail "tools/sync-sources.sh states only $starts_over time(s) that a failed fetch starts over; both the retry warning and the final hint must say so"
fi

harness::pass
