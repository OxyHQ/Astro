#!/usr/bin/env bash
# astro-common.sh — shared fail-closed helpers for every Astro build script.
#
# Source this, never execute it:
#
#     source "$(dirname "${BASH_SOURCE[0]}")/lib/astro-common.sh"
#
# Sourcing installs strict mode and an ERR trap in the calling script, so that
# single line is the only setup a script needs.
#
# Design rules this file exists to enforce (ASTRO-NEXT-001, issue #4):
#
#   * A failed required step exits non-zero. Always. Immediately.
#   * A genuinely optional step is declared as such at the call site via
#     astro::optional, which prints a structured warning and continues. Nothing
#     else may swallow a failure.
#   * Nothing writes into the Chromium checkout before the checkout has been
#     positively identified as a Chromium checkout.
#   * Nothing deletes from the Chromium checkout, ever.

# Guard against double-sourcing (scripts source each other).
if [ -n "${ASTRO_COMMON_SOURCED:-}" ]; then
    return 0
fi
ASTRO_COMMON_SOURCED=1

# --------------------------------------------------------------------------
# Strict mode and error reporting
# --------------------------------------------------------------------------

# -E  : ERR trap is inherited by functions, subshells and command substitutions
# -e  : exit on any unhandled non-zero status
# -u  : unset variable is an error
# -o pipefail : a pipeline fails if any element fails, not just the last
set -Eeuo pipefail

# Colours only when stderr is a terminal, so CI logs stay clean.
if [ -t 2 ]; then
    ASTRO_C_RED=$'\033[31m'
    ASTRO_C_YELLOW=$'\033[33m'
    ASTRO_C_BLUE=$'\033[34m'
    ASTRO_C_DIM=$'\033[2m'
    ASTRO_C_OFF=$'\033[0m'
else
    ASTRO_C_RED=''
    ASTRO_C_YELLOW=''
    ASTRO_C_BLUE=''
    ASTRO_C_DIM=''
    ASTRO_C_OFF=''
fi
readonly ASTRO_C_RED ASTRO_C_YELLOW ASTRO_C_BLUE ASTRO_C_DIM ASTRO_C_OFF

astro::info() {
    printf '%sINFO%s  %s\n' "$ASTRO_C_BLUE" "$ASTRO_C_OFF" "$*" >&2
}

# Structured warning for a step explicitly classified as optional.
# Every surviving non-fatal failure in the tree goes through here, so
# `grep -rn 'astro::optional' tools/` is the complete list of them.
astro::warn() {
    local tag="$1"
    shift
    printf '%sWARN%s  [%s] %s\n' "$ASTRO_C_YELLOW" "$ASTRO_C_OFF" "$tag" "$*" >&2
}

astro::error() {
    printf '%sERROR%s %s\n' "$ASTRO_C_RED" "$ASTRO_C_OFF" "$*" >&2
}

# Fatal. Prints the message and exits non-zero.
astro::die() {
    astro::error "$@"
    exit 1
}

# Fatal, with a remediation hint printed underneath the message, and an
# explicit exit status.
#
# The status is a parameter because a gate with THREE verdicts has to keep them
# apart on the way out. Collapsing "measured, and it failed" into the same exit
# code as "nothing on disk could decide it" throws away the distinction the
# third verdict exists to carry, and a caller that wants to report WHY then
# cannot. tools/check-merge-base.sh and tools/verify-build-outcome.sh both
# depend on this.
astro::die_with_status() {
    local status="$1" message="$2"
    shift 2
    astro::error "$message"
    local line
    for line in "$@"; do
        printf '      %s%s%s\n' "$ASTRO_C_DIM" "$line" "$ASTRO_C_OFF" >&2
    done
    exit "$status"
}

# Fatal, with a remediation hint printed underneath the message.
astro::die_with_hint() {
    local message="$1"
    shift
    astro::die_with_status 1 "$message" "$@"
}

# ERR trap body. Names the failing script, line, exit status and command, then
# walks the call stack so a failure inside a helper is traceable to its caller.
astro::_on_err() {
    local status="$1" line="$2" command="$3" source_file="$4"
    printf '\n%sERROR%s %s:%s: command failed (exit %s)\n' \
        "$ASTRO_C_RED" "$ASTRO_C_OFF" "$source_file" "$line" "$status" >&2
    printf '      command: %s\n' "$command" >&2
    local depth=$(( ${#FUNCNAME[@]} - 1 ))
    local i
    for (( i = 1; i < depth; i++ )); do
        printf '      at %s (%s:%s)\n' \
            "${FUNCNAME[i]}" "${BASH_SOURCE[i]}" "${BASH_LINENO[i-1]}" >&2
    done
    exit "$status"
}

trap 'astro::_on_err "$?" "$LINENO" "$BASH_COMMAND" "${BASH_SOURCE[0]}"' ERR

# --------------------------------------------------------------------------
# Optional steps
# --------------------------------------------------------------------------

# astro::optional <reason> <command> [args...]
#
# Runs a command that is allowed to fail. On failure it prints a structured
# WARN naming the reason and continues. This is the ONLY sanctioned way to
# tolerate a failure; `|| true` and `2>/dev/null` are banned by the static
# check in tools/tests/cases/no-destructive-patterns.sh.
astro::optional() {
    local reason="$1"
    shift
    local status=0
    "$@" || status=$?
    if [ "$status" -ne 0 ]; then
        astro::warn "optional:${reason}" "exit ${status}: $*"
    fi
    return 0
}

# --------------------------------------------------------------------------
# Preconditions
# --------------------------------------------------------------------------

astro::require_cmd() {
    local cmd
    for cmd in "$@"; do
        command -v "$cmd" >/dev/null || astro::die_with_hint \
            "Required command not found: $cmd" \
            "Install it and re-run. Required tools are listed in docs/build.mdx."
    done
}

astro::require_file() {
    local path="$1" what="${2:-file}"
    [ -f "$path" ] || astro::die "Required $what not found: $path"
}

astro::require_dir() {
    local path="$1" what="${2:-directory}"
    [ -d "$path" ] || astro::die "Required $what not found: $path"
}

# --------------------------------------------------------------------------
# Copying build artifacts
#
# The packaging scripts were built out of `cp … 2>/dev/null || true` lines.
# That shape cannot tell "this artifact does not exist on this platform" from
# "the build did not produce it", so a package could ship without its sandbox
# binary, its .pak resources or its ICU data and still report success.
#
# These helpers force the distinction to be made at the call site.
# --------------------------------------------------------------------------

# Fails if the source is missing. Use for anything the package cannot work
# without.
astro::copy_required() {
    local source_file="$1" destination="$2" what="${3:-artifact}"
    if [ ! -e "$source_file" ]; then
        astro::die_with_hint \
            "Required $what not found: $source_file" \
            "The build did not produce it, or the build directory is wrong." \
            "Refusing to package an incomplete artifact set."
    fi
    astro::run cp -a "$source_file" "$destination"
}

# Warns and continues if the source is missing. Use only where absence is a
# legitimate platform or configuration difference; the reason is printed.
astro::copy_optional() {
    local reason="$1" source_file="$2" destination="$3"
    if [ ! -e "$source_file" ]; then
        astro::warn "optional:${reason}" "not present, skipping: $source_file"
        return 0
    fi
    astro::run cp -a "$source_file" "$destination"
}

# Copies every match of a glob. An empty match set is reported, never silent —
# `cp dir/*.so dest/ 2>/dev/null || true` cannot distinguish "this build has no
# shared libraries" from "the glob was wrong".
astro::copy_glob() {
    local reason="$1" directory="$2" pattern="$3" destination="$4"
    local -a matches=()
    local candidate
    for candidate in "$directory"/$pattern; do
        if [ -e "$candidate" ]; then
            matches+=("$candidate")
        fi
    done
    if [ "${#matches[@]}" -eq 0 ]; then
        astro::warn "optional:${reason}" "no files matched $directory/$pattern"
        return 0
    fi
    astro::run cp -a "${matches[@]}" "$destination"
}

# Byte size of a file, portable across GNU and BSD stat. Fails if the file is
# unreadable rather than yielding an empty string that later arithmetic would
# silently treat as zero.
astro::file_size() {
    local path="$1"
    if stat -c%s "$path" 2>/dev/null; then   # astro-allow:suppressed-stderr GNU probe; BSD fallback below covers the failure
        return 0
    fi
    stat -f%z "$path"
}

astro::sha256() {
    local path="$1"
    if command -v sha256sum >/dev/null; then
        sha256sum "$path" | cut -d' ' -f1
    else
        shasum -a 256 "$path" | cut -d' ' -f1
    fi
}

# --------------------------------------------------------------------------
# Release gate: an artifact named after the product must contain the product
#
# tools/package-release.sh produced `astro-0.1.0-linux-x64.tar.gz` from a build
# with no Oxy Identity, no Alia, no ad blocker and none of the five WebUI
# controllers, reported success, and left it in releases/ beside genuine
# artifacts, distinguishable only by reading it. Every packager must therefore
# answer the same question before it writes anything, and answer it in three
# values rather than two:
#
#   present       -> may be packaged under the product's name
#   absent        -> refusal, unless deliberately overridden AND renamed
#   unmeasurable  -> refusal, always
#
# The third value is the one that carries the weight. "I could not measure it"
# must never become "it is probably there", and it must never become "it is
# absent" either: a wrong path, an unexpected binary format and the real defect
# would then all produce the same verdict, which is the same as having no check.
#
# This lives in astro-common.sh, which every packager already sources, so a new
# packager cannot omit the gate by forgetting a second `source` line.
# --------------------------------------------------------------------------

# "present" or "overlayless", set by astro::require_astro_overlay. Assigned on
# load so an exported value inherited from a parent shell cannot stand in for a
# gate that never ran.
export ASTRO_OVERLAY_VERDICT=""

# astro::require_astro_overlay <platform label> <detector argument>...
#
# The detector arguments are passed straight to tools/lib/overlay_in_binary.py,
# because the right probe differs by artifact shape and the choice belongs at
# the call site where it can be justified against a real artifact.
astro::require_astro_overlay() {
    local platform="$1"
    shift
    if [ "$#" -eq 0 ]; then
        astro::die "astro::require_astro_overlay($platform): no probe arguments given"
    fi

    astro::require_cmd python3
    local detector="${ASTRO_ROOT:?ASTRO_ROOT must be set}/tools/lib/overlay_in_binary.py"
    astro::require_file "$detector" "overlay detector"

    astro::info ">>> Verifying the Astro overlay is in the $platform artifact..."
    local status=0
    python3 "$detector" "$@" || status=$?

    case "$status" in
        0)
            ASTRO_OVERLAY_VERDICT="present"
            return 0
            ;;
        1)
            # Measured, and the answer is no. Handled below.
            ;;
        2)
            astro::die_with_hint \
                "Cannot determine whether the overlay is present; refusing to package." \
                "The scan measured nothing, so packaging now would be a guess in the" \
                "one direction that cannot be corrected later: an artifact named after" \
                "the product that may not contain it." \
                "" \
                "Probe: $*"
            ;;
        *)
            # A crash is not a verdict. The detector exits 1 for "absent", which
            # is also what an unhandled exception exits, and a signal-level death
            # exits 128+n; both were observed on real artifacts on this machine.
            # Anything outside {0,1,2} is therefore unmeasurable, never absent.
            astro::die_with_hint \
                "Cannot determine whether the overlay is present; refusing to package." \
                "The scan exited $status, which is not one of its three verdicts" \
                "(0 present, 1 absent, 2 unmeasurable). It crashed rather than" \
                "answered, and a crash must not be read as an answer." \
                "" \
                "Probe: $*"
            ;;
    esac

    if [ "${ASTRO_ALLOW_OVERLAYLESS_PACKAGE:-0}" != "1" ]; then
        astro::die_with_hint \
            "Refusing to package a build with no Astro overlay as an Astro release." \
            "This is a pipeline-validation build: Chromium plus the legacy patch" \
            "base. Naming it after the product would misrepresent it." \
            "" \
            "To package it deliberately as a validation artifact:" \
            "    ASTRO_ALLOW_OVERLAYLESS_PACKAGE=1 $0" \
            "The artifact is then named, and its provenance recorded, so its nature" \
            "cannot be mistaken."
    fi

    astro::warn "override:overlayless-package" \
        "packaging a build with no Astro overlay; renaming the $platform artifact accordingly"
    ASTRO_OVERLAY_VERDICT="overlayless"
}

# astro::overlayless_artifact_name <descriptor> <extension>
#
# The one place an overridden artifact's name is composed, so every platform
# carries the same two unmistakable words and a test can assert on them without
# a per-platform table. The descriptor is the version-and-platform part only:
# nothing derived from the product name reaches the result.
#
#   astro::overlayless_artifact_name "0.1.0-linux-x64" ".tar.gz"
#     -> pipeline-validation-0.1.0-linux-x64-NO-ASTRO-OVERLAY.tar.gz
astro::overlayless_artifact_name() {
    local descriptor="$1" extension="$2"
    printf 'pipeline-validation-%s-NO-ASTRO-OVERLAY%s\n' "$descriptor" "$extension"
}

# astro::stage_provenance <destination file>
#
# Copies the build provenance into an artifact and records the overlay verdict
# in it. The filename says what the artifact is to whoever is looking at the
# directory; the provenance says it to whoever has already unpacked it and is
# about to run it.
#
# Refuses if the gate has not run, which couples the two: a packager cannot
# stage provenance for an artifact whose contents were never checked.
astro::stage_provenance() {
    local destination="$1"
    local source_file="${ASTRO_REPORT_DIR:?}/provenance.json"

    if [ -z "${ASTRO_OVERLAY_VERDICT:-}" ]; then
        astro::die "astro::stage_provenance called before the overlay gate ran: $destination"
    fi

    astro::copy_required "$source_file" "$destination" \
        "build provenance (run tools/build.sh)"

    if astro::dry_run; then
        astro::plan "annotate $destination with overlay verdict $ASTRO_OVERLAY_VERDICT"
        return 0
    fi

    python3 - "$destination" "$ASTRO_OVERLAY_VERDICT" <<'PY'
import json
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
present = sys.argv[2] == "present"

document = json.loads(path.read_text(encoding="utf-8"))
record = {
    "present": present,
    "detector": "tools/lib/overlay_in_binary.py",
    "artifact_class": "astro-release" if present else "pipeline-validation",
}
if not present:
    record["warning"] = (
        "NO-ASTRO-OVERLAY. This artifact is Chromium plus the legacy patch base: "
        "no Oxy Identity, no Alia, no ad blocker, none of the five WebUI "
        "controllers. It was packaged deliberately under "
        "ASTRO_ALLOW_OVERLAYLESS_PACKAGE=1 for pipeline validation, and is not an "
        "Astro release."
    )
# Deliberately NOT "overlay": tools/generate-provenance.sh already writes that
# key, and it answers a different question — which overlay REVISION the build
# was made from. This one answers whether the overlay reached the binary at all.
document["overlay_in_binary"] = record

path.write_text(json.dumps(document, indent=2) + "\n", encoding="utf-8")
PY
}

# --------------------------------------------------------------------------
# Build outcome: the status that decides must be the BUILD's
#
# A build was run through a wrapper. The wrapper exited 0. The build inside it
# had failed, and said so in its own words:
#
#     1 error generated.
#     17m46.20s Build Failure: 28148 done, 1 failed, 1787 remaining
#     1 steps failed: exit=1
#
# A success was very nearly reported on that basis. Two things had to be true
# at once for that to happen, and closing either alone is not enough:
#
#   * the status that reached the decision belonged to something downstream of
#     the compile — a `tee`, a pipeline, a background runner, a notification —
#     and every one of those has an exit status of its own;
#   * no log was kept, so there was nothing to check the status against.
#
# astro::run_build_step closes both. It reads the command's OWN status out of
# PIPESTATUS rather than the pipeline's, keeps the complete log, and hands both
# to a detector that treats evidence of failure in the log as outranking any
# claim of success in the status.
#
# It lives here rather than in build.sh because install-local.sh recompiles and
# fetch-cross-deps.sh re-applies the patch series, and a second copy of this
# logic is how one of them gets the fix and the others do not.
# --------------------------------------------------------------------------

# The record every recorded step appends to, re-derived later by
# tools/verify-build-outcome.sh. Truncated by the first step of each PROCESS,
# so a record can never mix a previous run's steps with this one's.
ASTRO_BUILD_RECORD_STARTED=0

# "succeeded", set by astro::require_build_outcome. Assigned on load so an
# exported value inherited from a parent shell cannot stand in for a gate that
# never ran — the same reason ASTRO_OVERLAY_VERDICT is reset above.
export ASTRO_BUILD_VERDICT=""

# astro::build_record_path — where the outcome record for this run lives.
#
# Deliberately does NOT create the directory: it is called on the dry-run path
# too, and a dry run that creates a directory is not the inert dry run the epic
# requires. The detector creates it when it actually writes.
astro::build_record_path() {
    printf '%s/build-outcome.json\n' "${ASTRO_REPORT_DIR:?ASTRO_REPORT_DIR must be set}"
}

# astro::require_build_outcome <label> <log path|""> <status|"unknown"> [command]
#
# The three-verdict gate. Exits non-zero on `failed` AND on `unmeasurable`,
# because a build nobody could measure is not a build that passed.
astro::require_build_outcome() {
    local label="$1" log="$2" status="$3" command_text="${4:-}"

    astro::require_cmd python3
    local detector="${ASTRO_ROOT:?ASTRO_ROOT must be set}/tools/lib/build_outcome.py"
    astro::require_file "$detector" "build outcome detector"

    local record
    record="$(astro::build_record_path)"

    local -a arguments=(record --file "$record" --label "$label" --status "$status")
    if [ -n "$log" ]; then
        arguments+=(--log "$log")
    fi
    if [ -n "$command_text" ]; then
        arguments+=(--command "$command_text")
    fi
    if [ "$ASTRO_BUILD_RECORD_STARTED" != "1" ]; then
        arguments+=(--reset)
        ASTRO_BUILD_RECORD_STARTED=1
    fi

    # The detector's status is captured rather than allowed to reach the ERR
    # trap: 1 and 2 are ANSWERS, and a trap would collapse them into one
    # anonymous failure.
    local verdict_status=0
    python3 "$detector" "${arguments[@]}" || verdict_status=$?

    case "$verdict_status" in
        0)
            ASTRO_BUILD_VERDICT="succeeded"
            return 0
            ;;
        1)
            astro::die_with_hint \
                "Build step '$label' FAILED. Refusing to continue or report success." \
                "The verdict above comes from the step's own exit status and its own" \
                "log. Whatever invoked this build may have exited 0; that is not the" \
                "build's status and does not change this."
            ;;
        2)
            astro::die_with_status 2 \
                "Build step '$label' is UNMEASURABLE; refusing to report success." \
                "No usable status and no usable log, so nothing on disk can decide" \
                "whether it worked. An unmeasurable build is a failure: it must not" \
                "become 'probably fine', and it must not become 'definitely broken'" \
                "either, or a wrong log path and a real defect would look the same." \
                "" \
                "Log: ${log:-(none)}"
            ;;
        *)
            # A crash is not a verdict. The detector exits 1 for "failed", which
            # is also what an unhandled exception exits, and a signal-level death
            # exits 128+n.
            astro::die_with_status 2 \
                "Build step '$label' is UNMEASURABLE; refusing to report success." \
                "The detector exited $verdict_status, which is not one of its three" \
                "verdicts (0 succeeded, 1 failed, 2 unmeasurable). It crashed rather" \
                "than answered, and a crash must not be read as an answer."
            ;;
    esac
}

# astro::run_build_step <label> <log path> -- <command> [args...]
#
# Runs a build, compile, package or test command with its complete output kept
# on disk, then decides the outcome from the COMMAND's status — never the
# pipeline's, never the caller's.
#
# Why the `if`: the command is piped into `tee` so a multi-hour compile still
# streams to the terminal, and under `set -o pipefail` a failing pipeline would
# reach the ERR trap and exit before PIPESTATUS could be read. A pipeline used
# as an `if` condition runs neither errexit nor the ERR trap, which is what
# makes reading the real status possible at all. PIPESTATUS is captured in the
# very next command in both branches because any other command clobbers it.
#
# If `tee` itself failed the log is truncated or absent, so it is NOT passed to
# the detector: an unwritable log must make the step unmeasurable rather than
# silently scan as clean.
astro::run_build_step() {
    local label="$1" log="$2"
    shift 2
    if [ "${1:-}" != "--" ]; then
        astro::die "astro::run_build_step($label) called without a -- separator"
    fi
    shift
    if [ "$#" -eq 0 ]; then
        astro::die "astro::run_build_step($label) called with no command"
    fi

    local command_text="$*"

    if astro::dry_run; then
        astro::plan "$command_text"
        astro::plan "record build outcome '$label' -> $(astro::build_record_path)"
        return 0
    fi

    mkdir -p "$(dirname "$log")"

    astro::info ">>> $label: $command_text"
    astro::info "    log: $log"

    local -a pipe_status=()
    if "$@" 2>&1 | tee "$log"; then
        pipe_status=("${PIPESTATUS[@]}")
    else
        pipe_status=("${PIPESTATUS[@]}")
    fi

    local command_status="${pipe_status[0]}"
    local tee_status="${pipe_status[1]:-0}"
    astro::info "    $label exited $command_status (tee exited $tee_status)"

    local log_argument="$log"
    if [ "$tee_status" != "0" ]; then
        astro::warn "build-outcome:log-write-failed" \
            "tee exited $tee_status writing $log; the log is truncated and cannot corroborate $label"
        log_argument=""
    elif [ ! -f "$log" ]; then
        astro::warn "build-outcome:no-log" \
            "$label wrote no log at $log; the step cannot be corroborated"
        log_argument=""
    fi

    astro::require_build_outcome "$label" "$log_argument" "$command_status" "$command_text"
}

# --------------------------------------------------------------------------
# Dry-run support
# --------------------------------------------------------------------------

# depot_tools SELF-UPDATES to origin/main on every invocation unless told not
# to, which silently defeats the pin in browser.lock.json — the pin exists
# precisely because depot_tools resolves every other revision.
#
# Observed, not theorised: one `gclient sync` moved it off the locked commit,
# and its reflog records the jump —
#   5dae8da42 HEAD@{0}: checkout: moving from 41c40cfa... to origin/main
# The next build refused, correctly, because the lock gate caught it. Setting
# this at the library level means every script that sources it is covered,
# rather than each one remembering.
export DEPOT_TOOLS_UPDATE=0

ASTRO_DRY_RUN="${ASTRO_DRY_RUN:-0}"

astro::dry_run() {
    [ "$ASTRO_DRY_RUN" = "1" ]
}

# Prints a planned operation. Used by dry-run paths so `--dry-run` output is a
# complete, greppable list of everything the real run would do.
astro::plan() {
    printf 'PLAN  %s\n' "$*"
}

# astro::run <command> [args...] — execute, or print the plan under --dry-run.
astro::run() {
    if astro::dry_run; then
        astro::plan "$*"
        return 0
    fi
    "$@"
}

# --------------------------------------------------------------------------
# Chromium checkout identification and protection
# --------------------------------------------------------------------------

# Files that must all be present for a directory to be accepted as a Chromium
# source checkout. Chosen because they exist in every Chromium revision Astro
# targets and cannot plausibly appear together anywhere else.
readonly ASTRO_CHROMIUM_SENTINELS=(
    ".gn"
    "chrome/VERSION"
    "base/BUILD.gn"
    "build/config/BUILDCONFIG.gn"
)

# astro::resolve_chromium_src [candidate]
#
# Sets ASTRO_RESOLVED_CHROMIUM_SRC to the verified absolute path of the
# Chromium checkout, or dies. Nothing in this repository may write to the
# Chromium tree without first passing its destination through this function.
#
# It assigns to a global instead of echoing so that a failure exits the script
# directly. Echoing would force callers into `x="$(astro::resolve...)"`, where
# the `exit` fires inside a command-substitution subshell and the real error
# arrives second, behind a confusing ERR-trap frame.
#
# Verification, in order:
#   1. the path exists and is a directory
#   2. it resolves (symlinks included) to an absolute path of sane depth
#   3. it is not the Astro repository, nor an ancestor of it
#   4. it is a git work tree whose TOPLEVEL IS ITSELF — a path merely sitting
#      inside some other repository is rejected
#   5. every Chromium sentinel file is present
#   6. it is the expected default location, unless ASTRO_CHROMIUM_SRC was set
#      explicitly to point somewhere else
#
# Check 4 is not theoretical. A `chromium/src` holding only the copied overlay
# resolves, via `git rev-parse --show-toplevel`, to the Astro repository root:
# a status check written against it reports on Astro's own working tree, and a
# `reset --hard` or `git clean` written against it would destroy the
# developer's uncommitted work. See issue #4.
# Exported so callers can read it after astro::resolve_chromium_src returns,
# and so static analysis sees it is consumed outside this file.
export ASTRO_RESOLVED_CHROMIUM_SRC=""

astro::resolve_chromium_src() {
    local candidate="${1:-}"
    if [ -z "$candidate" ]; then
        candidate="${ASTRO_CHROMIUM_SRC:-${ASTRO_ROOT:?ASTRO_ROOT must be set}/chromium/src}"
    fi

    [ -d "$candidate" ] || astro::die_with_hint \
        "Chromium checkout not found: $candidate" \
        "Run tools/fetch-chromium.sh first, or export ASTRO_CHROMIUM_SRC to point at an existing checkout."

    local resolved
    resolved="$(cd "$candidate" && pwd -P)"

    # A destination of "/" or "/usr" is never right and would be catastrophic.
    case "$resolved" in
        /|/usr|/usr/*|/etc|/etc/*|/bin|/bin/*|/boot|/boot/*|"$HOME")
            astro::die "Refusing to treat a system path as a Chromium checkout: $resolved"
            ;;
    esac

    local astro_root_resolved
    astro_root_resolved="$(cd "${ASTRO_ROOT:?}" && pwd -P)"
    if [ "$resolved" = "$astro_root_resolved" ]; then
        astro::die "Refusing to treat the Astro repository itself as a Chromium checkout: $resolved"
    fi
    case "$astro_root_resolved" in
        "$resolved"/*)
            astro::die "Refusing to use an ancestor of the Astro repository as a Chromium checkout: $resolved"
            ;;
    esac

    local toplevel
    if ! toplevel="$(git -C "$resolved" rev-parse --show-toplevel 2>&1)"; then
        astro::die_with_hint \
            "Not a git work tree, so it cannot be a Chromium checkout: $resolved" \
            "git said: $toplevel" \
            "Run tools/fetch-chromium.sh to create a real checkout."
    fi
    toplevel="$(cd "$toplevel" && pwd -P)"
    if [ "$toplevel" != "$resolved" ]; then
        astro::die_with_hint \
            "$resolved is not its own git work tree." \
            "Its enclosing repository is: $toplevel" \
            "This means git commands aimed at the 'Chromium checkout' would operate on" \
            "$toplevel instead — including any destructive one. Refusing to continue." \
            "Run tools/fetch-chromium.sh to create a real Chromium checkout at this path."
    fi

    local sentinel missing=()
    for sentinel in "${ASTRO_CHROMIUM_SENTINELS[@]}"; do
        [ -e "$resolved/$sentinel" ] || missing+=("$sentinel")
    done
    if [ "${#missing[@]}" -gt 0 ]; then
        astro::die_with_hint \
            "$resolved does not look like a Chromium source checkout." \
            "Missing: ${missing[*]}" \
            "Refusing to write into an unverified destination." \
            "Run tools/fetch-chromium.sh to fetch Chromium into this path."
    fi

    if [ -z "${ASTRO_CHROMIUM_SRC:-}" ]; then
        local expected
        expected="$(cd "${ASTRO_ROOT:?}" && pwd -P)/chromium/src"
        if [ "$resolved" != "$expected" ]; then
            astro::die_with_hint \
                "Chromium checkout is at an unexpected location: $resolved" \
                "Expected: $expected" \
                "Export ASTRO_CHROMIUM_SRC to use a different checkout deliberately."
        fi
    fi

    ASTRO_RESOLVED_CHROMIUM_SRC="$resolved"
}

# Maximum number of modified upstream paths tolerated before a run is treated
# as an accidental mass change.
#
# Calibrated against a real run rather than estimated. The complete ungoogled
# stack on Chromium 146.0.7680.177 produces 3,923 modified paths: 112 patches
# plus the binary pruning, which deletes 12,392 files of which those tracked by
# src's own git show up here. The previous default of 2,500 was a guess written
# before any real checkout existed, and it failed a correct run.
#
# 6,000 leaves headroom for the Astro patches on top while still catching the
# thing this guard is for: a run that has started modifying the tree wholesale.
ASTRO_MAX_MODIFIED_UPSTREAM_PATHS="${ASTRO_MAX_MODIFIED_UPSTREAM_PATHS:-6000}"

# Prints one modified/untracked path per line. Parsed in python3 rather than
# sed because `--porcelain -z` emits a second NUL-separated field for renames
# which carries no status prefix, and a fixed 3-character strip corrupts it.
astro::_dirty_paths() {
    local src="$1"
    git -C "$src" status --porcelain=v1 -z --untracked-files=all | python3 -c '
import sys

records = sys.stdin.buffer.read().split(b"\0")
index = 0
while index < len(records):
    record = records[index]
    index += 1
    if not record:
        continue
    status, path = record[:2], record[3:]
    print(path.decode("utf-8", "surrogateescape"))
    # A rename or copy is followed by its origin path as a bare extra field.
    if status[0:1] in (b"R", b"C") or status[1:2] in (b"R", b"C"):
        if index < len(records) and records[index]:
            print(records[index].decode("utf-8", "surrogateescape"))
            index += 1
'
}

# astro::require_pristine_chromium <src>
#
# Used by steps that are only correct against an untouched checkout — patch
# application above all, since applying a patch stack onto an already-modified
# tree is exactly how a partially-patched binary gets built.
astro::require_pristine_chromium() {
    local src="$1"
    local dirty
    dirty="$(astro::_dirty_paths "$src")"
    if [ -z "$dirty" ]; then
        return 0
    fi
    local count
    count="$(printf '%s\n' "$dirty" | wc -l | tr -d '[:space:]')"

    if [ "${ASTRO_ALLOW_DIRTY_CHROMIUM:-0}" = "1" ]; then
        astro::warn "override:dirty-chromium" \
            "proceeding against a checkout with $count modified path(s) because ASTRO_ALLOW_DIRTY_CHROMIUM=1"
        return 0
    fi

    astro::die_with_hint \
        "Chromium checkout has $count local modification(s) and must be pristine for this step." \
        "First 20:" \
        "$(printf '%s\n' "$dirty" | sed -n '1,20 s/^/  /p')" \
        "" \
        "Astro will not patch on top of an unknown tree: the result would be neither" \
        "the reviewed patch set nor upstream." \
        "" \
        "To inspect:  git -C $src status" \
        "To recover:  see docs/recovery.mdx (it prints the pinned revision before it acts)" \
        "To override: ASTRO_ALLOW_DIRTY_CHROMIUM=1 (developer-only; never set in CI)"
}

# astro::require_attributable_chromium <src> <allowlist-file> [manifest...]
#
# Used by steps that legitimately run against an already-patched tree. Every
# modified path must be attributable to something Astro itself wrote: a
# destination prefix declared in the overlay allowlist, or a path recorded in a
# manifest emitted by an earlier pipeline step. Anything else is unrelated
# developer work and blocks the run.
astro::require_attributable_chromium() {
    local src="$1" allowlist="$2"
    shift 2

    local dirty
    dirty="$(astro::_dirty_paths "$src")"
    [ -n "$dirty" ] || return 0

    local total
    total="$(printf '%s\n' "$dirty" | wc -l | tr -d '[:space:]')"
    if [ "$total" -gt "$ASTRO_MAX_MODIFIED_UPSTREAM_PATHS" ]; then
        if [ "${ASTRO_ALLOW_DIRTY_CHROMIUM:-0}" != "1" ]; then
            astro::die_with_hint \
                "Chromium checkout has $total modified paths, over the limit of $ASTRO_MAX_MODIFIED_UPSTREAM_PATHS." \
                "This is the accidental-mass-change guard. Something has gone wrong." \
                "Raise ASTRO_MAX_MODIFIED_UPSTREAM_PATHS deliberately if the patch stack really grew this much."
        fi
        astro::warn "override:dirty-chromium" "$total modified paths exceeds the limit; continuing on override"
    fi

    # The set arithmetic runs in python3, not bash loops: a full patch stack
    # records tens of thousands of paths, and an O(dirty x recorded) shell
    # comparison over that takes minutes.
    #
    # The program is passed with `python3 -c` rather than on stdin: stdin is
    # already carrying the dirty-path list, and a `python3 - <<'PY'` heredoc
    # silently wins over the pipe, leaving sys.stdin empty and every path
    # looking attributable.
    local attribution_program
    attribution_program="$(cat <<'PY'
import json, sys

allowlist_path, *manifests = sys.argv[1:]

prefixes = []
try:
    with open(allowlist_path, encoding="utf-8") as handle:
        for line in handle:
            line = line.split("#", 1)[0].strip()
            if not line:
                continue
            fields = line.split()
            if len(fields) >= 2:
                prefixes.append(fields[1].rstrip("/"))
except FileNotFoundError:
    pass

recorded = set()

# "pruned" and "substituted" are as much a record of what Astro did to the tree
# as "files" is. Binary pruning DELETES tracked files, which git reports as
# modifications, so leaving those keys out made every pruned file unattributable
# and the post-application check fail on a tree the pipeline itself produced.
RECORDED_KEYS = ("path", "paths", "files", "pruned", "substituted")


def collect(node):
    if isinstance(node, dict):
        for key in RECORDED_KEYS:
            value = node.get(key)
            if isinstance(value, str):
                recorded.add(value)
            elif isinstance(value, list):
                recorded.update(item for item in value if isinstance(item, str))
        for value in node.values():
            collect(value)
    elif isinstance(node, list):
        for item in node:
            collect(item)

for manifest in manifests:
    try:
        with open(manifest, encoding="utf-8") as handle:
            collect(json.load(handle))
    except (FileNotFoundError, json.JSONDecodeError):
        continue

for raw in sys.stdin:
    path = raw.rstrip("\n")
    if not path:
        continue
    if path in recorded:
        continue
    if any(path == prefix or path.startswith(prefix + "/") for prefix in prefixes):
        continue
    print(path)
PY
)"

    local unattributed
    unattributed="$(printf '%s\n' "$dirty" | python3 -c "$attribution_program" "$allowlist" "$@")"

    if [ -z "$unattributed" ]; then
        astro::info "Chromium checkout has $total modified path(s), all attributable to Astro."
        return 0
    fi

    local unattributed_count
    unattributed_count="$(printf '%s\n' "$unattributed" | wc -l | tr -d '[:space:]')"

    if [ "${ASTRO_ALLOW_DIRTY_CHROMIUM:-0}" = "1" ]; then
        astro::warn "override:dirty-chromium" \
            "$unattributed_count unattributable modified path(s) accepted because ASTRO_ALLOW_DIRTY_CHROMIUM=1"
        return 0
    fi

    astro::die_with_hint \
        "Chromium checkout has $unattributed_count modified path(s) Astro did not write." \
        "First 20:" \
        "$(printf '%s\n' "$unattributed" | sed -n '1,20 s/^/  /p')" \
        "" \
        "These are unrelated local changes. Astro preserves developer work by default" \
        "and will not build on top of a tree it cannot account for." \
        "" \
        "To override: ASTRO_ALLOW_DIRTY_CHROMIUM=1 (developer-only; never set in CI)"
}

# astro::require_vendored_rust_deps <chromium-src> <overlay-source>
#
# The overlay's Rust targets depend on crates that live in the Chromium tree but
# are NOT part of a Chromium checkout: `tools/vendor-adblock-rust.sh` fetches
# them and asks gnrt to generate their BUILD.gn files. A checkout that has never
# been vendored into — or one that was reset, since everything vendoring writes
# is untracked — therefore has a hole in the build graph.
#
# Until the overlay had a build edge nothing noticed, because GN never loaded
# the overlay's BUILD.gn files at all. With the edge in place the hole surfaces
# as a `gn gen` failure naming a file nobody wrote:
#
#     ERROR at //chrome/browser/oxy/adblock/rs/BUILD.gn:25:5: Unable to load
#     ".../third_party/rust/adblock/v0_9/BUILD.gn".
#
# which reads as a defect in the overlay rather than as a missing pipeline step.
# The labels are derived from the overlay's own BUILD.gn files rather than
# listed here, so a new Rust dependency is covered the day it is added.
astro::require_vendored_rust_deps() {
    local src="$1" overlay="$2"
    astro::require_dir "$src" "Chromium checkout"
    astro::require_dir "$overlay" "overlay source"

    # The directory is required above, so the only way this pipeline fails is
    # grep matching nothing — an overlay with no Rust dependency, which is a
    # legitimate empty result rather than a swallowed failure. Written as an
    # `if` for exactly that reason: `|| true` would also hide a real error.
    local labels
    if ! labels="$(grep -rhoE '"//third_party/rust/[A-Za-z0-9_]+/v[0-9_]+:' "$overlay" \
                       | sed 's/^"//; s/:$//' | sort -u)"; then
        labels=""
    fi

    local -a missing=()
    local label crate_path
    while IFS= read -r label; do
        [ -n "$label" ] || continue
        crate_path="${label#//}"
        if [ ! -f "$src/$crate_path/BUILD.gn" ]; then
            missing+=("$crate_path")
        fi
    done <<< "$labels"

    if [ "${#missing[@]}" -eq 0 ]; then
        return 0
    fi

    astro::die_with_hint \
        "The Chromium checkout is missing ${#missing[@]} vendored Rust crate(s) the overlay depends on:" \
        "$(printf '  %s\n' "${missing[@]}")" \
        "" \
        "Nothing in a Chromium checkout provides these — they are vendored from" \
        "crates.io and their BUILD.gn files are generated. Everything that step" \
        "writes is untracked, so a reset checkout loses all of it." \
        "" \
        "Run:  tools/vendor-adblock-rust.sh" \
        "" \
        "Without it gn gen fails hours later with 'Unable to load', which reads as" \
        "a defect in the overlay rather than as a step that was never run."
}

# Prints the modified-tree summary required before build generation, so both
# local and CI logs record exactly what tree was compiled.
astro::summarize_chromium_tree() {
    local src="$1"
    printf '\n=== Chromium checkout summary (%s) ===\n' "$src"
    printf -- '--- git status --short ---\n'
    git -C "$src" status --short
    printf -- '--- git diff --stat ---\n'
    git -C "$src" diff --stat
    printf -- '--- HEAD ---\n'
    git -C "$src" --no-pager log -1 --format='%H %d %s'
    printf '=== end summary ===\n\n'
}

# --------------------------------------------------------------------------
# Manifests and reports
# --------------------------------------------------------------------------

# Exported: tools/build.sh runs tools/verify-build-outcome.sh as a child, and a
# child that computed a different report directory would re-derive a record
# this run never wrote — reporting `unmeasurable` on a perfectly good build.
export ASTRO_REPORT_DIR="${ASTRO_REPORT_DIR:-${ASTRO_ROOT:-.}/build/reports}"

astro::report_dir() {
    mkdir -p "$ASTRO_REPORT_DIR"
    printf '%s\n' "$ASTRO_REPORT_DIR"
}

