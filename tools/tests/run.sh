#!/usr/bin/env bash
# run.sh — the Astro build-safety test suite.
#
# Proves the properties issue #4 requires: the overlay step deletes nothing,
# patches never apply fuzzily or through a merge fallback, required failures
# exit non-zero, dry-run changes nothing, and unrelated developer work in the
# Chromium checkout is refused rather than overwritten.
#
# Dependency-free on purpose so it runs on a clean machine and in CI with no
# install step.
#
# Usage:
#   tools/tests/run.sh            # everything
#   tools/tests/run.sh overlay    # only cases whose name contains "overlay"

set -Euo pipefail

TESTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ASTRO_ROOT="$(cd "$TESTS_DIR/../.." && pwd)"
export ASTRO_ROOT

FILTER="${1:-}"
PASS_TOKEN="ASTRO_TEST_CASE_PASSED"

if [ -t 1 ]; then
    C_GREEN=$'\033[32m'; C_RED=$'\033[31m'; C_DIM=$'\033[2m'; C_OFF=$'\033[0m'
else
    C_GREEN=''; C_RED=''; C_DIM=''; C_OFF=''
fi

passed=0
failed=0
failed_names=()

printf '=== Astro build-safety suite ===\n'
printf 'Repository: %s\n\n' "$ASTRO_ROOT"

for case_file in "$TESTS_DIR"/cases/*.sh; do
    [ -f "$case_file" ] || continue
    name="$(basename "$case_file" .sh)"
    if [ -n "$FILTER" ] && [[ "$name" != *"$FILTER"* ]]; then
        continue
    fi

    output_file="$(mktemp)"
    status=0
    bash "$case_file" >"$output_file" 2>&1 || status=$?

    # A case must exit 0 AND print the token. The token is the vacuity floor:
    # a case whose body was skipped or deleted exits 0 but prints nothing, and
    # would otherwise be indistinguishable from a real pass.
    if [ "$status" -eq 0 ] && grep -q "$PASS_TOKEN" "$output_file"; then
        detail="$(grep -o "$PASS_TOKEN.*" "$output_file" | head -1 | sed "s/$PASS_TOKEN //")"
        printf '%sPASS%s  %-46s %s%s%s\n' "$C_GREEN" "$C_OFF" "$name" "$C_DIM" "$detail" "$C_OFF"
        passed=$((passed + 1))
    else
        printf '%sFAIL%s  %-46s (exit %s)\n' "$C_RED" "$C_OFF" "$name" "$status"
        sed 's/^/        /' "$output_file"
        failed=$((failed + 1))
        failed_names+=("$name")
    fi
    rm -f "$output_file"
done

printf '\n=== %s passed, %s failed ===\n' "$passed" "$failed"

if [ "$failed" -gt 0 ]; then
    printf 'Failed: %s\n' "${failed_names[*]}"
    exit 1
fi

if [ "$passed" -eq 0 ]; then
    printf 'No cases ran. Refusing to report success.\n' >&2
    exit 1
fi
