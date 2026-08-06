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

# Fatal, with a remediation hint printed underneath the message.
astro::die_with_hint() {
    local message="$1"
    shift
    astro::error "$message"
    local line
    for line in "$@"; do
        printf '      %s%s%s\n' "$ASTRO_C_DIM" "$line" "$ASTRO_C_OFF" >&2
    done
    exit 1
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
    if stat -c%s "$path" 2>/dev/null; then   # astro-allow: GNU probe; BSD fallback below covers the failure
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
        "$(printf '%s\n' "$dirty" | head -20 | sed 's/^/  /')" \
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
        "$(printf '%s\n' "$unattributed" | head -20 | sed 's/^/  /')" \
        "" \
        "These are unrelated local changes. Astro preserves developer work by default" \
        "and will not build on top of a tree it cannot account for." \
        "" \
        "To override: ASTRO_ALLOW_DIRTY_CHROMIUM=1 (developer-only; never set in CI)"
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

ASTRO_REPORT_DIR="${ASTRO_REPORT_DIR:-${ASTRO_ROOT:-.}/build/reports}"

astro::report_dir() {
    mkdir -p "$ASTRO_REPORT_DIR"
    printf '%s\n' "$ASTRO_REPORT_DIR"
}

