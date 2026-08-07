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

# ShellCheck 0.10.0 is a static Haskell binary and its runtime occasionally
# dies on a signal — observed twice here as SIGABRT (134) and SIGSEGV (139),
# roughly 2 in 40 invocations, only while the machine was under concurrent
# load, and never reproducible in isolation (0 failures in 15 consecutive runs
# of this case, and 0 in 24 direct invocations).
#
# A crashed linter is NOT a lint finding, and a gate that cannot tell the two
# apart is the "check that cannot distinguish success from failure" trap: it
# either reports phantom style errors or, worse, gets marked flaky and
# disabled. So a signal-level exit is retried once and, if it recurs, reported
# as a crash in its own words. A real lint failure is never retried.
run_shellcheck() {
    local what="$1"
    shift

    harness::run "$SHELLCHECK" -x --source-path=SCRIPTDIR --severity=style "$@"
    if [ "$RUN_STATUS" -ge 128 ]; then
        printf 'NOTE shellcheck died on signal (exit %s) during "%s"; retrying once\n' \
            "$RUN_STATUS" "$what" >&2
        harness::run "$SHELLCHECK" -x --source-path=SCRIPTDIR --severity=style "$@"
        if [ "$RUN_STATUS" -ge 128 ]; then
            harness::fail "$what: shellcheck itself crashed twice (exit $RUN_STATUS). This is a tool failure, not a lint finding."
        fi
    fi
    harness::assert_status 0 "$what"
}

# --source-path=SCRIPTDIR lets it follow `source "$(dirname …)/lib/…"`.
# --severity=style is the strictest setting, so nothing regresses silently.
run_shellcheck "shellcheck over tools/*.sh" "${SCRIPTS[@]}"

mapfile -t TEST_SCRIPTS < <(
    find "$ASTRO_ROOT/tools/tests" -name '*.sh' -type f | sort
)
run_shellcheck "shellcheck over the test suite itself" "${TEST_SCRIPTS[@]}"

# --- every shellcheck-disable directive must be load-bearing -----------------
#
# This repository had ZERO shellcheck-disable directives until one became
# unavoidable: a script registering an EXIT trap and ending in an explicit
# `exit N` reports its whole handler as unreachable, because ShellCheck 0.10
# treats the top-level exit as terminating and does not model the trap firing
# after it.
#
# A suppression nobody has seen suppress anything is indistinguishable from a
# decorative comment. Two of this repository's five `astro-allow:` markers were
# exactly that for months (findings.md, finding 11), so every directive is
# checked here by REMOVING it and requiring the warning to reappear.

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
disable_tmp="$(harness::tmpdir)/disables"
mkdir -p "$disable_tmp"
directives=0
while IFS= read -r script; do
    grep -q 'shellcheck disable=' "$script" || continue
    directives=$((directives + 1))
    stripped="$disable_tmp/$(basename "$script")"
    grep -v 'shellcheck disable=' "$script" > "$stripped"
    # awk rather than `grep -c`: grep exits 1 when the count is zero, and zero
    # is a legitimate answer here, so `grep -c` would need a suppression to read
    # its own output. awk always exits 0 and prints the count.
    before="$("$SHELLCHECK" -x -S info "$script" | awk '/SC[0-9]/{n++} END{print n+0}')"
    after="$("$SHELLCHECK" -x -S info "$stripped" | awk '/SC[0-9]/{n++} END{print n+0}')"
    if [ "$after" -le "$before" ]; then
        harness::fail "$script carries a shellcheck-disable that suppresses nothing:
      with it    $before finding(s)
      without it $after finding(s)
      A directive that changes no outcome is a comment pretending to be a
      decision. Remove it, or fix the code so it is needed."
    fi
done < <(find "$ASTRO_ROOT/tools" -maxdepth 2 -name '*.sh' -type f)

# A vacuity floor pointing the other way: if the repository ever has no
# directives at all, this block silently checks nothing, and that is fine — but
# it must be VISIBLE rather than looking like a pass.
printf "      shellcheck-disable directives checked: %s\n" "$directives" >&2

harness::pass
