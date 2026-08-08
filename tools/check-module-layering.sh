#!/usr/bin/env bash
# check-module-layering.sh — enforce `//astro`'s include_rules.
#
# `//astro` is a leaf of the Chromium build graph, and its one coupling to
# `chrome/` is confined to a single layer. That contract is written in DEPS
# files: the module root grants Chromium's public API and subtracts `-chrome`,
# `browser/DEPS` re-grants the single `chrome/` header the integration hook
# needs, and `common/DEPS` restates the subtraction so a later edit to the root
# cannot widen the bottom layer.
#
# Nothing ran it. `gn check` — which tools/build.sh does run — validates GN
# dependency EDGES; it never opens a DEPS file, and checkdeps never appeared in
# tools/ or .github/ at all. So every `include_rules` entry in `//astro` was a
# rule that could not fail, which is the one shape this repository's own rules
# call worse than no check.
#
# The mechanism that reads those files is Chromium's own
# buildtools/checkdeps/checkdeps.py. This script points it at the module and
# turns its output into a verdict; tools/lib/module_layering.py holds the
# scoping, the vacuity floor and the reporting, because none of the three is
# something the CLI can be asked for.
#
# It refuses rather than skips. checkdeps ships INSIDE the Chromium checkout,
# so with no checkout there is no measurement — and a layering gate that
# silently reports success on a machine where it could not run is exactly the
# failure it exists to prevent. Absent inputs produce `unmeasurable` and a
# non-zero exit, never a pass.
#
# Usage:
#   tools/check-module-layering.sh [--chromium-src PATH] [--scope PATH]

ASTRO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ASTRO_ROOT
# shellcheck source=tools/lib/astro-common.sh
source "$ASTRO_ROOT/tools/lib/astro-common.sh"

SCOPE_FILE="$ASTRO_ROOT/tools/astro-module.scope"
DRIVER="$ASTRO_ROOT/tools/lib/module_layering.py"
CHROMIUM_SRC_ARG=""

# Set the moment the check itself starts. Everything before that point is input
# resolution, and a failure there means the module was not checked — a fact the
# exit status alone cannot distinguish from "checked, and it failed". The trap
# below adds the verdict after the specific error, so the detail comes first and
# the conclusion last.
LAYERING_MEASURED=0

# shellcheck disable=SC2317
#
# The cause is NOT "shellcheck cannot see trap invocation" — that was measured
# and is false. A trap handler alone reports nothing. The trigger is this
# script's unconditional top-level `exit` at the end: ShellCheck 0.10 treats it
# as terminating and does not model the EXIT trap firing afterwards, so every
# line of the handler is reported unreachable. Bisected to a seven-line
# reproduction, verified in both directions — delete only the final `exit` and
# the same file is clean.
#
# This will recur in ANY script that registers an EXIT trap and ends in an
# explicit `exit N`, so the directive is scoped to the handler rather than the
# file: an unreachable command elsewhere in this script must still be reported.
# tools/tests/cases/shell-static-analysis.sh asserts this directive is
# load-bearing, because a suppression nobody has seen suppress anything is
# indistinguishable from a decorative comment — two of the repository's five
# astro-allow markers were exactly that (findings.md, finding 11).
report_unmeasured() {
    local status=$?
    # An EXIT trap that ends on a non-zero `return` is itself a failing command,
    # which trips the ERR trap and prints a stack trace attributing the failure
    # to this handler rather than to whatever actually went wrong. Disarming ERR
    # here, and letting the handler fall off its end, leaves bash to carry the
    # original exit status through untouched.
    trap - ERR
    if [ "$status" -ne 0 ] && [ "$LAYERING_MEASURED" -eq 0 ]; then
        printf 'unmeasurable: //astro was not checked against its include_rules.\n' >&2
        printf '  The reason is above. checkdeps lives in the Chromium checkout, so a\n' >&2
        printf '  missing or unusable checkout means no measurement was taken — this is\n' >&2
        printf '  reported as a failure rather than a pass on purpose.\n' >&2
    fi
}
trap report_unmeasured EXIT

while [ "$#" -gt 0 ]; do
    case "$1" in
        --chromium-src)
            CHROMIUM_SRC_ARG="${2:?--chromium-src needs a path}"
            shift 2
            ;;
        --scope)
            SCOPE_FILE="${2:?--scope needs a path}"
            shift 2
            ;;
        -h|--help)
            astro::info "Usage: tools/check-module-layering.sh [--chromium-src PATH] [--scope PATH]"
            LAYERING_MEASURED=1
            exit 0
            ;;
        *)
            astro::die "Unknown argument: $1"
            ;;
    esac
done

astro::require_cmd python3 git
astro::require_file "$DRIVER" "//astro layering driver"
astro::require_file "$SCOPE_FILE" "//astro scope declaration"

# The one resolution path. Every guard it carries applies here too — in
# particular that a `chromium/src` holding only the copied overlay resolves, via
# git, to the Astro repository itself.
astro::resolve_chromium_src "$CHROMIUM_SRC_ARG"

astro::info ">>> Checking //astro against its include_rules (checkdeps)"
LAYERING_MEASURED=1

# The driver's exit status is the verdict, and a violation is a verdict rather
# than a crash: it is passed through instead of being left to the ERR trap,
# whose stack trace would bury the message that names the offending file.
layering_status=0
python3 "$DRIVER" \
    --chromium-src "$ASTRO_RESOLVED_CHROMIUM_SRC" \
    --scope "$SCOPE_FILE" || layering_status=$?

# `exit N` for a non-zero N is itself a failing command, so the ERR trap would
# print a stack trace pointing at this line — burying the message that names the
# offending file under a frame about the script that reported it.
trap - ERR
exit "$layering_status"
