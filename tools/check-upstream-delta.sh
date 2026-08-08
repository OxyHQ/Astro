#!/usr/bin/env bash
# check-upstream-delta.sh — the gate on Astro's delta against Chromium-owned files.
#
# tools/upstream.allowlist declares every Chromium-owned file the //astro
# integration may modify, with an owner, an issue and a per-file cap on added
# lines. This script measures the real checkout, judges it against that
# declaration, and refuses on:
#
#   * a modified Chromium-owned file with no allowlist entry;
#   * any line removed from a Chromium-owned file that no `remove` or
#     `substitute` record in the allowlist declares — and a `substitute`
#     declares one only by PAIRING it with its recomposed form among the added
#     lines, so a removal that simply deleted the line is refused exactly as it
#     was before those records existed;
#   * a removal declaration naming a line the integration no longer removes, or
#     a substitution that pairs nothing;
#   * additions beyond a file's declared cap;
#   * added lines that do not have the shape the entry declares, or a shape that
#     requires a //astro reference and has none anywhere in its delta;
#   * a `planned` entry whose file has started to change;
#   * an allowlist entry that no longer modifies anything;
#   * a file deleted from the tree that the pruning list does not declare;
#   * a new path that neither the patch series nor the overlay allowlist declares;
#   * a measurement that covered nothing.
#
# Nothing measured this before. The Astro delta grew from three Chromium-owned
# files to eight — including two content/ files whose change REMOVES upstream
# `CHECK_EQ` scheme assertions — with nothing in the repository able to notice.
# tools/lib/upstream_delta.py holds the measurement, the subtraction and the
# verdict, because none of the three is something git can be asked for directly.
#
# It refuses rather than skips. The Chromium checkout is 55 GB and is not
# present on every machine, so an absent one means no measurement was taken —
# and a delta gate that silently reports success where it could not run is
# exactly the failure it exists to prevent. Absent inputs produce
# `unmeasurable` and a non-zero exit, never a pass.
#
# Usage:
#   tools/check-upstream-delta.sh [--report] [--chromium-src PATH]
#                                 [--allowlist FILE] [--patches DIR]
#                                 [--base COMMIT] [--json FILE]
#
#   --report   print the delta and exit 0 whatever the verdict. This is what a
#              PR description pastes; the listing and the rejection come from
#              the same measurement, so the two cannot disagree.

ASTRO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ASTRO_ROOT
# shellcheck source=tools/lib/astro-common.sh
source "$ASTRO_ROOT/tools/lib/astro-common.sh"

DRIVER="$ASTRO_ROOT/tools/lib/upstream_delta.py"
LOCK_READER="$ASTRO_ROOT/tools/lib/lock.py"
ALLOWLIST="$ASTRO_ROOT/tools/upstream.allowlist"
OVERLAY_ALLOWLIST="$ASTRO_ROOT/tools/overlay.allowlist"
PATCHES_DIR="$ASTRO_ROOT/patches"
CHROMIUM_SRC_ARG=""
BASE_COMMIT=""
JSON_OUTPUT=""
REPORT_ONLY=0

# Set the moment the measurement itself starts. Everything before that point is
# input resolution, and a failure there means the delta was never measured — a
# fact the exit status alone cannot distinguish from "measured, and it failed".
DELTA_MEASURED=0

# shellcheck disable=SC2317
#
# Same cause as tools/check-module-layering.sh's directive, and verified the
# same way: this script registers an EXIT trap and ends in an explicit `exit N`,
# which ShellCheck 0.10 treats as terminating, so it reports every line of the
# handler as unreachable. Scoped to the handler rather than the file, so an
# unreachable command elsewhere is still reported.
report_unmeasured() {
    local status=$?
    # An EXIT trap ending on a non-zero return is itself a failing command,
    # which trips the ERR trap and blames the handler for whatever actually
    # went wrong. Disarm ERR and let the handler fall off its end so bash
    # carries the original status through untouched.
    trap - ERR
    if [ "$status" -ne 0 ] && [ "$DELTA_MEASURED" -eq 0 ]; then
        printf 'unmeasurable: the downstream delta was not measured.\n' >&2
        printf '  The reason is above. This is reported as a failure rather than a\n' >&2
        printf '  pass on purpose: a delta gate that cannot see the checkout knows\n' >&2
        printf '  nothing about the delta, which is not the same as there being none.\n' >&2
    fi
}
trap report_unmeasured EXIT

usage() {
    cat >&2 <<'EOF'
Usage: tools/check-upstream-delta.sh [options]

  --report              Print the delta and exit 0 whatever the verdict.
  --chromium-src PATH   Chromium checkout (default: <repo>/chromium/src,
                        or $ASTRO_CHROMIUM_SRC)
  --allowlist FILE      Upstream allowlist (default: tools/upstream.allowlist)
  --patches DIR         Declared patch series (default: <repo>/patches)
  --base COMMIT         Base commit (default: chromium.commit from the lock)
  --json FILE           Also write the measurement as JSON
  -h, --help            This message.
EOF
}

while [ "$#" -gt 0 ]; do
    case "$1" in
        --report)        REPORT_ONLY=1; shift ;;
        --chromium-src)  CHROMIUM_SRC_ARG="${2:?--chromium-src needs a path}"; shift 2 ;;
        --allowlist)     ALLOWLIST="${2:?--allowlist needs a file}"; shift 2 ;;
        --patches)       PATCHES_DIR="${2:?--patches needs a directory}"; shift 2 ;;
        --base)          BASE_COMMIT="${2:?--base needs a commit}"; shift 2 ;;
        --json)          JSON_OUTPUT="${2:?--json needs a path}"; shift 2 ;;
        -h|--help)       usage; DELTA_MEASURED=1; exit 0 ;;
        *)               usage; astro::die "Unknown argument: $1" ;;
    esac
done

astro::require_cmd python3 git
astro::require_file "$DRIVER" "upstream delta driver"
astro::require_file "$ALLOWLIST" "upstream allowlist"
astro::require_file "$OVERLAY_ALLOWLIST" "overlay allowlist"
astro::require_dir "$PATCHES_DIR" "patch series directory"

# The base is DECLARED, never discovered. Reading it from the checkout's own
# HEAD would make the report say "no delta" for a checkout that had been
# committed to, which is the one answer it must never give by accident.
if [ -z "$BASE_COMMIT" ]; then
    astro::require_file "$LOCK_READER" "lock reader"
    BASE_COMMIT="$(python3 "$LOCK_READER" --get chromium.commit)"
fi
[ -n "$BASE_COMMIT" ] || astro::die "browser.lock.json declares no chromium.commit"

# The one resolution path, with every guard it carries — in particular that a
# chromium/src holding only the copied overlay resolves, via git, to the Astro
# repository itself, so a report written against it would be about the wrong
# tree entirely.
astro::resolve_chromium_src "$CHROMIUM_SRC_ARG"

astro::info ">>> Measuring the downstream delta against $BASE_COMMIT"
DELTA_MEASURED=1

DRIVER_ARGS=(
    --chromium-src "$ASTRO_RESOLVED_CHROMIUM_SRC"
    --base "$BASE_COMMIT"
    --allowlist "$ALLOWLIST"
    --patches "$PATCHES_DIR"
    --overlay-allowlist "$OVERLAY_ALLOWLIST"
)
if [ -n "$JSON_OUTPUT" ]; then
    DRIVER_ARGS+=(--json "$JSON_OUTPUT")
fi
if [ "$REPORT_ONLY" -eq 1 ]; then
    DRIVER_ARGS+=(--report)
fi

# The driver's exit status is the verdict, and a violation is a verdict rather
# than a crash: it is passed through instead of being left to the ERR trap,
# whose stack trace would bury the message naming the offending file.
#
# Exit 2 is the driver's own "unmeasurable" — an input it could not read — and
# it is deliberately NOT folded into 1: the operator needs to know whether the
# delta is bad or whether nothing was measured at all.
delta_status=0
python3 "$DRIVER" "${DRIVER_ARGS[@]}" || delta_status=$?

if [ "$delta_status" -eq 2 ]; then
    DELTA_MEASURED=0
fi

trap - ERR
exit "$delta_status"
