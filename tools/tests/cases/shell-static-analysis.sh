#!/usr/bin/env bash
# Static analysis over every shell script in the repository.
#
# `bash -n` always runs: it needs nothing but bash, so it can never be skipped.
# ShellCheck is required as well, because `bash -n` only catches syntax errors
# and the defects this issue is about — unquoted expansions, ignored exit
# codes, `set -e` traps — all parse perfectly.
#
# ShellCheck is looked up on PATH or via $ASTRO_SHELLCHECK. If it is absent the
# case FAILS rather than skipping: a static check that silently disappears on
# the one machine that lacks the binary is not a gate.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

mapfile -t SCRIPTS < <(
    find "$ASTRO_ROOT/tools" -name '*.sh' -type f | sort
)

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ "${#SCRIPTS[@]}" -lt 15 ]; then
    harness::fail "found only ${#SCRIPTS[@]} shell scripts; the file search is broken"
fi

# --- bash -n over everything -------------------------------------------------

for script in "${SCRIPTS[@]}"; do
    harness::run bash -n "$script"
    harness::assert_status 0 "bash -n ${script#"$ASTRO_ROOT"/}"
done

# --- ShellCheck --------------------------------------------------------------

SHELLCHECK="${ASTRO_SHELLCHECK:-}"
if [ -z "$SHELLCHECK" ] && command -v shellcheck >/dev/null; then
    SHELLCHECK="$(command -v shellcheck)"
fi

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ -z "$SHELLCHECK" ]; then
    harness::fail "$(cat <<'EOF'
ShellCheck not found.

It is a required part of this gate, not an optional extra: every defect this
issue removed parses cleanly, so bash -n alone proves nothing.

Install it:
    Debian/Ubuntu   sudo apt-get install shellcheck
    macOS           brew install shellcheck
    Any Linux       download the static binary from
                    https://github.com/koalaman/shellcheck/releases

Or point at an existing binary:
    ASTRO_SHELLCHECK=/path/to/shellcheck tools/tests/run.sh
EOF
)"
fi

# --source-path=SCRIPTDIR lets it follow `source "$(dirname …)/lib/…"`.
# --severity=style is the strictest setting, so nothing regresses silently.
harness::run "$SHELLCHECK" -x --source-path=SCRIPTDIR --severity=style "${SCRIPTS[@]}"
harness::assert_status 0 "shellcheck over tools/*.sh"

mapfile -t TEST_SCRIPTS < <(
    find "$ASTRO_ROOT/tools/tests" -name '*.sh' -type f | sort
)
harness::run "$SHELLCHECK" -x --source-path=SCRIPTDIR --severity=style "${TEST_SCRIPTS[@]}"
harness::assert_status 0 "shellcheck over the test suite itself"

harness::pass
