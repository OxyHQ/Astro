#!/usr/bin/env bash
# verify-build-outcome.sh — prove the build succeeded, from the BUILD's own
# evidence, and refuse to guess.
#
# This is the gate a wrapper, a CI job, a background runner or a notification
# hook consults instead of trusting its own exit status. It exists because that
# trust was misplaced here: a build was run through a wrapper, the wrapper
# exited 0, and a success was very nearly reported on that basis while the
# build's own log said
#
#     1 error generated.
#     17m46.20s Build Failure: 28148 done, 1 failed, 1787 remaining
#     1 steps failed: exit=1
#
# NOTHING about the invoking process is consulted. Not its exit status, not
# whether it was backgrounded, not what it printed. The only inputs are the
# status tools/build.sh recorded for the compile itself and the log that
# compile wrote — and where the two disagree, the log wins, because a wrapper
# that lies about status is the case under test.
#
# THREE VERDICTS, NOT TWO:
#   0  succeeded     measured, and the answer is yes
#   1  failed        measured, and the answer is no
#   2  unmeasurable  nothing on disk can decide it — a REFUSAL, never a pass
#
# A crash is not a verdict: any exit outside {0,1,2} from the detector is
# treated as unmeasurable, the same discipline astro::require_astro_overlay
# applies to the packaging gate after its detector's "absent" and its unhandled
# exception were observed exiting with the same status.
#
# Usage:
#   tools/verify-build-outcome.sh                       # the default record
#   tools/verify-build-outcome.sh --record FILE
#   tools/verify-build-outcome.sh --log FILE [--status N]
#
# Options:
#   --record FILE     Build outcome record to re-derive (default:
#                     $ASTRO_REPORT_DIR/build-outcome.json).
#   --require-step L  A step label the record must contain. Repeatable.
#                     Defaults to "compile" when reading a record, so a record
#                     that never recorded the compile cannot read as clean.
#   --log FILE        Verify a bare log instead of a record. For a wrapper that
#                     captured output but no status.
#   --status N        The status the BUILD exited with, if it is known. Omit it
#                     when only the wrapper's status is available — a wrapper's
#                     status is not the build's and must not be passed here.

ASTRO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ASTRO_ROOT
# shellcheck source=tools/lib/astro-common.sh
source "$ASTRO_ROOT/tools/lib/astro-common.sh"

RECORD=""
LOG=""
STATUS=""
LABEL="build"
REQUIRED_STEPS=()
MODE=""

usage() {
    sed -n '2,50p' "${BASH_SOURCE[0]}" >&2
}

while [ $# -gt 0 ]; do
    case "$1" in
        --record)       shift; RECORD="${1:?--record needs a file}"; MODE="record" ;;
        --log)          shift; LOG="${1:?--log needs a file}"; MODE="log" ;;
        --status)       shift; STATUS="${1:?--status needs a value}" ;;
        --label)        shift; LABEL="${1:?--label needs a value}" ;;
        --require-step) shift; REQUIRED_STEPS+=("${1:?--require-step needs a label}") ;;
        -h|--help)      usage; exit 0 ;;
        *)              usage; astro::die "Unknown argument: $1" ;;
    esac
    shift
done

astro::require_cmd python3
DETECTOR="$ASTRO_ROOT/tools/lib/build_outcome.py"
astro::require_file "$DETECTOR" "build outcome detector"

if [ -n "$LOG" ] && [ -n "$RECORD" ]; then
    astro::die "--log and --record name different evidence; pass one or the other"
fi

# A status with no log is the wrapper's own claim and nothing else. Accepting it
# silently — and then ignoring it, because the record supplies its own — would
# make the flag look consulted when it is not, which is how a caller comes to
# believe it passed the build's status in when it passed the wrapper's.
if [ -n "$STATUS" ] && [ "$MODE" != "log" ]; then
    astro::die_with_hint \
        "--status is only meaningful with --log." \
        "Against a record, the status comes from what the build recorded for" \
        "itself. A status supplied on the command line is whatever the caller" \
        "believes, and the caller is the thing under suspicion."
fi

ARGS=()
if [ "$MODE" = "log" ]; then
    ARGS=(evaluate --label "$LABEL" --log "$LOG")
    if [ -n "$STATUS" ]; then
        ARGS+=(--status "$STATUS")
    fi
    astro::info ">>> Verifying a build log: $LOG"
else
    if [ -z "$RECORD" ]; then
        RECORD="${ASTRO_REPORT_DIR}/build-outcome.json"
    fi
    if [ "${#REQUIRED_STEPS[@]}" -eq 0 ]; then
        # The compile is the step a wrapper's status stands in for, so a record
        # that never recorded it is unmeasurable rather than clean.
        REQUIRED_STEPS=(compile)
    fi
    ARGS=(verify --file "$RECORD")
    for step_label in "${REQUIRED_STEPS[@]}"; do
        ARGS+=(--require-step "$step_label")
    done
    astro::info ">>> Verifying the recorded build outcome: $RECORD"
fi

# The detector's status is read into a variable rather than being allowed to
# reach the ERR trap: 1 and 2 are ANSWERS here, and an ERR trap would turn both
# into the same anonymous failure — which is the two-verdict collapse this
# script exists to avoid.
verdict_status=0
python3 "$DETECTOR" "${ARGS[@]}" || verdict_status=$?

case "$verdict_status" in
    0)
        astro::info "Build outcome verified: succeeded."
        ;;
    1)
        astro::die_with_hint \
            "The build FAILED. Refusing to report success." \
            "The verdict above is derived from the build's own exit status and" \
            "its own log, never from the status of whatever invoked it. A" \
            "wrapper, a pipeline or a notification exiting 0 around this build" \
            "does not change it."
        ;;
    2)
        astro::die_with_status 2 \
            "Cannot determine whether the build succeeded; refusing to report success." \
            "The evidence needed to decide is not on disk: no recorded status," \
            "no usable log, or a record that disagrees with its own log." \
            "" \
            "An unmeasurable build is a failure. It must never become 'probably" \
            "fine', and it must not become 'definitely broken' either — a wrong" \
            "path and a real defect would then be indistinguishable." \
            "" \
            "Produce the evidence:  tools/build.sh <type> <platform>"
        ;;
    *)
        astro::die_with_status 2 \
            "Cannot determine whether the build succeeded; refusing to report success." \
            "The detector exited $verdict_status, which is not one of its three" \
            "verdicts (0 succeeded, 1 failed, 2 unmeasurable). It crashed rather" \
            "than answered, and a crash must not be read as an answer."
        ;;
esac
