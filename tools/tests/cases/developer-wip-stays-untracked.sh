#!/usr/bin/env bash
# Files this repository has deliberately decided NOT to track must stay
# untracked, and the decision has to be enforced by something other than
# whoever runs `git add` next.
#
# This gate exists because the decision was already violated. PR #31 states
# plainly:
#
#     `tools/setup-win-sdk.sh` is deliberately not committed. It is an
#     untracked developer WIP file.
#
# It was nonetheless committed — swept into 0837c13 by a `git add` broad enough
# to catch a file nothing in that commit's message mentions, alongside six
# changes that are each described in detail. The commit that absorbed it was
# reverted by rewriting the branch; nothing prevented a repeat.
#
# The epic's rule is "preserve developer local work by default". A working-tree
# file somebody else is mid-way through is exactly that, and committing it takes
# the decision to publish unfinished work out of its author's hands.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

# Each entry: a path, and the reason it stays out of the repository.
UNTRACKED_BY_DECISION=(
    "tools/setup-win-sdk.sh|developer WIP; recorded as deliberately not committed in PR #31"
)

for entry in "${UNTRACKED_BY_DECISION[@]}"; do
    path="${entry%%|*}"
    reason="${entry#*|}"

    HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
    if git -C "$ASTRO_ROOT" ls-files --error-unmatch "$path" >/dev/null 2>&1; then
        harness::fail "$path is tracked, and it must not be: $reason

      Remove it from the index without touching the file on disk:
          git rm --cached $path

      If it genuinely belongs in the repository now, that is a decision for its
      author to make and record — not something a broad \`git add\` should
      settle. Delete the entry from UNTRACKED_BY_DECISION in the same change
      that commits it, so this gate never disagrees with the repository."
    fi
done

# The gate must be able to fail. Without this it would also pass on a typo in
# the path, a broken `ls-files` invocation, or an empty list -- and a check that
# cannot distinguish success from failure certifies nothing.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ "${#UNTRACKED_BY_DECISION[@]}" -eq 0 ]; then
    harness::fail "the list is empty; this gate would pass unconditionally"
fi

# A path that IS tracked must be detected, proving the detector fires at all.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if ! git -C "$ASTRO_ROOT" ls-files --error-unmatch tools/build.sh >/dev/null 2>&1; then
    harness::fail "the tracked-file probe failed on tools/build.sh; ls-files is not working here"
fi

# The documentation must RECORD the absence, not promise the tool.
#
# It used to promise it in four places — a prerequisite line, a cross-compile
# flow, and a row in two tool tables — which is how a script nobody had
# committed came to look like part of the build. Mentioning the name is not
# enough to pass: a future edit that re-promises it would satisfy a bare
# name grep, so the assertion is on the statement of absence.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if ! grep -rqF 'No committed script provisions it' "$ASTRO_ROOT/docs"; then
    harness::fail "the documentation no longer records that setup-win-sdk.sh is absent.
      Either it was committed under its own issue — in which case remove this
      entry in the same change — or a documentation edit went back to promising
      a script the repository does not contain."
fi

# And it must not be promised as a runnable step anywhere.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
# grep exits 0 only when it finds something, which is exactly the failure
# condition — so the status IS the assertion, with no suppression needed.
if promises="$(grep -rn '^[[:space:]]*tools/setup-win-sdk\.sh' \
        "$ASTRO_ROOT/docs" "$ASTRO_ROOT/README.md")"; then
    harness::fail "documentation presents setup-win-sdk.sh as a command to run:
$promises"
fi

harness::pass
