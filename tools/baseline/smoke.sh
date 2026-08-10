#!/usr/bin/env bash
# smoke.sh — the baseline smoke run for ASTRO-NEXT-003 (issue #6).
#
# Launches a clean build against a throwaway profile, navigates a representative
# set of HTTP, HTTPS, chrome:// and astro:// URLs, and writes a STRUCTURED
# result to build/reports/smoke-report.json.
#
# The property this script exists for is that its output can be believed:
#
#   * With no browser binary it refuses and writes nothing. A baseline document
#     citing an empty-but-successful smoke report is worse than one citing an
#     honest gap, because later issues quote the baseline as their compatibility
#     reference.
#   * A step this harness genuinely cannot drive is recorded as
#     status "not-implemented" with a note naming what would implement it, and
#     the RUN exits non-zero. An incomplete run can never read as a pass.
#   * Only a run in which every step passed exits 0.
#
# What is implemented here uses documented Chromium switches only
# (--headless=new, --dump-dom, --virtual-time-budget, --user-data-dir,
# --no-first-run). Anything needing a real driver — an OS window, back/forward,
# restart and session restore — is reported, not faked: --dump-dom performs
# exactly one navigation and exits, and headless mode creates no OS window, so
# a "pass" for those steps would be a fabrication.
#
# Usage:
#   tools/baseline/smoke.sh [options]
#
#   --binary PATH     Browser under test (default: chromium/src/out/Release/chrome)
#   --url-list FILE   Navigation set (default: the built-in list, printed by --dry-run)
#   --https-url URL   HTTPS target for the external-navigation step
#   --report NAME     Report file name inside build/reports
#   --dry-run         Print the plan; change nothing, write nothing.

ASTRO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export ASTRO_ROOT
# shellcheck source=../lib/astro-common.sh
source "$ASTRO_ROOT/tools/lib/astro-common.sh"

BINARY="${ASTRO_SMOKE_BINARY:-$ASTRO_ROOT/chromium/src/out/Release/chrome}"
URL_LIST=""
REPORT_NAME="smoke-report.json"
HTTPS_URL="${ASTRO_SMOKE_HTTPS_URL:-https://oxy.so/}"

# Virtual time lets a page's timers and fetches run to completion without the
# harness guessing at a wall-clock sleep.
VIRTUAL_TIME_BUDGET="${ASTRO_SMOKE_VIRTUAL_TIME_BUDGET:-8000}"
STEP_TIMEOUT="${ASTRO_SMOKE_STEP_TIMEOUT:-60}"

# Marker served by the local HTTP page. A navigation step that finds it proves
# the browser fetched and parsed a real HTTP response, not just that it exited 0.
LOCAL_PAGE_MARKER="ASTRO-SMOKE-LOCAL-PAGE-OK"

usage() {
    cat >&2 <<'EOF'
Usage: tools/baseline/smoke.sh [options]

  --binary PATH     Browser binary under test
                    (default: <repo>/chromium/src/out/Release/chrome)
  --url-list FILE   Navigation set to use instead of the built-in list.
                    One entry per line: <id> <url> <expected-substring>
                    '#' at the start of a line is a comment.
                    @LOCAL_HTTP@ expands to a page served by this script on
                    127.0.0.1; @HTTPS@ expands to --https-url.
  --https-url URL   HTTPS target (default: https://oxy.so/)
  --report NAME     Report file name in build/reports (default: smoke-report.json)
  --dry-run         Print the plan and the URL set; change nothing.
  -h, --help

Exit status:
  0   every step passed
  1   at least one step failed
  2   no step failed, but the run is INCOMPLETE (steps this harness cannot
      drive are reported as not-implemented, never as passes)

Environment:
  ASTRO_SMOKE_BINARY                 Default binary path
  ASTRO_SMOKE_HTTPS_URL              Default HTTPS target
  ASTRO_SMOKE_VIRTUAL_TIME_BUDGET    --virtual-time-budget in ms (default 8000)
  ASTRO_SMOKE_STEP_TIMEOUT           Per-step timeout in seconds (default 60)
  ASTRO_SMOKE_NO_SANDBOX=1           Add --no-sandbox. Recorded in the report,
                                     because a run without the sandbox is not a
                                     baseline of the shipped configuration.
  ASTRO_REPORT_DIR                   Report directory (default: build/reports)
EOF
}

while [ $# -gt 0 ]; do
    case "$1" in
        --binary)     shift; BINARY="${1:?--binary needs a path}" ;;
        --url-list)   shift; URL_LIST="${1:?--url-list needs a file}" ;;
        --https-url)  shift; HTTPS_URL="${1:?--https-url needs a URL}" ;;
        --report)     shift; REPORT_NAME="${1:?--report needs a file name}" ;;
        --dry-run)    ASTRO_DRY_RUN=1 ;;
        -h|--help)    usage; exit 0 ;;
        *)            usage; astro::die "Unknown argument: $1" ;;
    esac
    shift
done

case "$REPORT_NAME" in
    */*|"") astro::die "--report takes a file name inside build/reports, not a path: $REPORT_NAME" ;;
esac

astro::require_cmd python3 timeout mktemp uname

# --------------------------------------------------------------------------
# The navigation set
#
# Expectations are element ids and markers rather than visible text: ids are
# stable across locales, and a localised string would make this harness report
# a product regression on a non-English build.
# --------------------------------------------------------------------------

default_url_list() {
    cat <<EOF
# <id> <url> <expected substring in the dumped DOM>
http-local          @LOCAL_HTTP@            $LOCAL_PAGE_MARKER
https-external      @HTTPS@                 <html
chrome-version      chrome://version        command_line
chrome-newtab       chrome://newtab         id="root"
chrome-astro-ntp    chrome://astro-ntp      id="root"
astro-newtab        astro://newtab          id="root"
chrome-settings     chrome://settings       id="root"
astro-settings      astro://settings        id="root"
chrome-history      chrome://history        history-app
chrome-downloads    chrome://downloads      downloads-manager
chrome-alia         chrome://alia           id="root"
astro-alia          astro://alia            id="root"
chrome-whats-new    chrome://whats-new      id="root"
chrome-astro-error  chrome://astro-error    id="root"
EOF
}

declare -a URL_IDS=() URL_TARGETS=() URL_EXPECTS=()

# Reads entries from stdin, so the same parser serves --url-list and the
# built-in list without one of them going through a second implementation.
load_url_entries() {
    local line id url expect
    while IFS= read -r line || [ -n "$line" ]; do
        # Whole-line comments only: an expectation may legitimately contain '#'.
        case "$line" in
            '#'*) continue ;;
        esac
        line="${line#"${line%%[![:space:]]*}"}"
        line="${line%"${line##*[![:space:]]}"}"
        [ -n "$line" ] || continue

        read -r id url expect <<< "$line"
        [ -n "$url" ] || astro::die "URL list entry has no URL: $line"
        [ -n "$expect" ] || astro::die "URL list entry has no expected substring: $line"
        URL_IDS+=("$id")
        URL_TARGETS+=("$url")
        URL_EXPECTS+=("$expect")
    done
}

if [ -n "$URL_LIST" ]; then
    astro::require_file "$URL_LIST" "URL list"
    load_url_entries < "$URL_LIST"
    URL_LIST_SOURCE="$URL_LIST"
else
    load_url_entries < <(default_url_list)
    URL_LIST_SOURCE="built-in"
fi

[ "${#URL_IDS[@]}" -gt 0 ] || astro::die "URL list is empty: $URL_LIST_SOURCE"

# --------------------------------------------------------------------------
# Steps this harness cannot drive.
#
# Each carries the reason and what implementing it needs. They are data, not
# prose, so the report a later issue reads names its own gaps.
# --------------------------------------------------------------------------

declare -a UNDRIVEN_IDS=(
    "window-created"
    "back-forward"
    "restart-session-restore"
)
declare -a UNDRIVEN_REQUIREMENTS=(
    "confirm the browser creates a usable window"
    "exercise back/forward on a normal navigation"
    "exercise restart and session restore"
)
declare -a UNDRIVEN_NOTES=(
    "headless mode creates no OS window, so no switch can evidence this. Needs a headful run on a real display plus a window query (CDP Browser.getWindowForTarget/getWindowBounds, or an X11/AppKit query on the browser pid)."
    "--dump-dom performs exactly one navigation and exits, so there is no history to walk. Needs a CDP session: Page.getNavigationHistory then Page.navigateToHistoryEntry, asserting the committed URL after each move."
    "the session file is written on a clean shutdown of a browser that had a window, which headless --dump-dom never produces. Needs a headful run, a clean quit, a second launch with restore-on-startup, and a read of the restored tab set."
)

# --------------------------------------------------------------------------
# Dry run: the plan, and nothing else. No temporary directory, no report
# directory, no report file.
# --------------------------------------------------------------------------

if astro::dry_run; then
    astro::info "=== Astro baseline smoke run (DRY RUN) ==="
    astro::plan "binary under test: $BINARY"
    if [ ! -f "$BINARY" ]; then
        astro::plan "binary is NOT present; a real run would refuse and write no report"
    fi
    astro::plan "create a throwaway --user-data-dir under ${TMPDIR:-/tmp} (never the developer profile)"
    astro::plan "serve a local page on 127.0.0.1 for the HTTP navigation step"
    astro::plan "step binary-version: $BINARY --version"
    astro::plan "step clean-profile-startup: $BINARY --headless=new --user-data-dir=<temp> --no-first-run --dump-dom about:blank"
    index=0
    while [ "$index" -lt "${#URL_IDS[@]}" ]; do
        astro::plan "step navigate:${URL_IDS[$index]}: --dump-dom ${URL_TARGETS[$index]} (expect: ${URL_EXPECTS[$index]})"
        index=$((index + 1))
    done
    index=0
    while [ "$index" -lt "${#UNDRIVEN_IDS[@]}" ]; do
        astro::plan "step ${UNDRIVEN_IDS[$index]}: NOT IMPLEMENTED — ${UNDRIVEN_NOTES[$index]}"
        index=$((index + 1))
    done
    astro::plan "write $ASTRO_REPORT_DIR/$REPORT_NAME"
    astro::plan "exit non-zero unless every step passed"
    astro::info "Dry run complete. Nothing was created."
    exit 0
fi

# --------------------------------------------------------------------------
# Preconditions for a real run. Nothing is created before these pass, so a
# refused run leaves no report behind to be mistaken for a measurement.
# --------------------------------------------------------------------------

BUILD_HINT=(
    "A baseline smoke run measures a REAL build. There is nothing to measure without one,"
    "and this command will not emit an empty or placeholder report: later issues cite the"
    "baseline as their compatibility reference."
    ""
    "Build one:"
    "  tools/sync-sources.sh"
    "  tools/build.sh Release linux"
    ""
    "Or point at an existing build:"
    "  tools/baseline/smoke.sh --binary /path/to/chrome"
)

if [ ! -f "$BINARY" ]; then
    astro::die_with_hint "Browser binary not found: $BINARY" "${BUILD_HINT[@]}"
fi
if [ ! -x "$BINARY" ]; then
    astro::die_with_hint "Browser binary is not executable: $BINARY" "${BUILD_HINT[@]}"
fi

astro::info "=== Astro baseline smoke run ==="
astro::info "Binary:   $BINARY"
astro::info "URL set:  $URL_LIST_SOURCE (${#URL_IDS[@]} navigation step(s))"

REPORT_DIR="$(astro::report_dir)"
REPORT_PATH="$REPORT_DIR/$REPORT_NAME"
LOG_DIR="$REPORT_DIR/smoke-logs"
mkdir -p "$LOG_DIR"

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/astro-smoke.XXXXXXXX")"
PROFILE_DIR="$WORK_DIR/profile"
mkdir -p "$PROFILE_DIR"
STEP_TSV="$WORK_DIR/steps.tsv"
: > "$STEP_TSV"

HTTP_SERVER_PID=""

cleanup() {
    if [ -n "$HTTP_SERVER_PID" ]; then
        astro::optional "stop-local-http-server" kill "$HTTP_SERVER_PID"
        HTTP_SERVER_PID=""
    fi
    # The throwaway profile is deleted; logs live under build/reports and stay.
    case "$WORK_DIR" in
        /tmp/astro-smoke.*|"${TMPDIR:-/tmp}"/astro-smoke.*) rm -rf "$WORK_DIR" ;;
    esac
}
trap cleanup EXIT

# The profile is a fresh temporary directory. The developer's real profile is
# never opened: a smoke run that wrote to it would corrupt the very state the
# migration fixtures are supposed to capture.
declare -a BROWSER_FLAGS=(
    "--user-data-dir=$PROFILE_DIR"
    "--headless=new"
    "--disable-gpu"
    "--no-first-run"
    "--no-default-browser-check"
    "--virtual-time-budget=$VIRTUAL_TIME_BUDGET"
)
SANDBOX_STATE="enabled"
if [ "${ASTRO_SMOKE_NO_SANDBOX:-0}" = "1" ]; then
    BROWSER_FLAGS+=("--no-sandbox")
    SANDBOX_STATE="disabled by ASTRO_SMOKE_NO_SANDBOX=1"
    astro::warn "sandbox-disabled" \
        "running with --no-sandbox; this is NOT the shipped configuration and is recorded in the report"
fi

# --------------------------------------------------------------------------
# Step recording
# --------------------------------------------------------------------------

PASS_COUNT=0
FAIL_COUNT=0
UNIMPLEMENTED_COUNT=0

# Tabs and newlines are the record separators, so a detail string carrying
# either would corrupt the report rather than appear in it.
flatten() {
    printf '%s' "$*" | tr '\n\t' '  '
}

record_step() {
    local id="$1" phase="$2" requirement="$3" status="$4" detail="$5" command="$6" log="$7"
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
        "$id" "$phase" "$(flatten "$requirement")" "$status" \
        "$(flatten "$detail")" "$(flatten "$command")" "$log" >> "$STEP_TSV"

    case "$status" in
        pass)
            PASS_COUNT=$((PASS_COUNT + 1))
            astro::info "  PASS  $id — $detail"
            ;;
        fail)
            FAIL_COUNT=$((FAIL_COUNT + 1))
            astro::error "  FAIL  $id — $detail"
            ;;
        not-implemented)
            UNIMPLEMENTED_COUNT=$((UNIMPLEMENTED_COUNT + 1))
            astro::warn "not-implemented:$id" "$detail"
            ;;
        *)
            astro::die "internal: unknown step status '$status' for $id"
            ;;
    esac
}

# --------------------------------------------------------------------------
# A local HTTP origin
#
# The HTTP navigation step serves its own page rather than reaching a public
# host: a baseline must not record "the browser is broken" when the finding is
# really that the machine was offline.
# --------------------------------------------------------------------------

LOCAL_HTTP_URL=""

start_local_http_server() {
    local root="$WORK_DIR/www"
    mkdir -p "$root"
    cat > "$root/index.html" <<EOF
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Astro smoke</title></head>
<body><p id="astro-smoke-marker">$LOCAL_PAGE_MARKER</p></body></html>
EOF

    cat > "$WORK_DIR/serve.py" <<'PY'
"""Serve one directory on 127.0.0.1 and publish the assigned port.

Port 0 is used so a concurrent run of this harness cannot collide with it; the
kernel-assigned port is written to a file the shell waits for.
"""
import http.server
import os
import socketserver
import sys

root, port_file = sys.argv[1:3]
os.chdir(root)

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", 0), http.server.SimpleHTTPRequestHandler) as httpd:
    with open(port_file, "w", encoding="utf-8") as handle:
        handle.write(str(httpd.server_address[1]))
    httpd.serve_forever()
PY

    local port_file="$WORK_DIR/http-port"
    python3 "$WORK_DIR/serve.py" "$root" "$port_file" >"$LOG_DIR/local-http.log" 2>&1 &
    HTTP_SERVER_PID=$!

    local waited=0
    while [ ! -s "$port_file" ]; do
        if [ "$waited" -ge 50 ]; then
            astro::die_with_hint \
                "The local HTTP server did not report a port within 5 seconds." \
                "Log: $LOG_DIR/local-http.log" \
                "Without it the HTTP navigation step cannot be measured, and this" \
                "command does not report steps it did not run."
        fi
        sleep 0.1
        waited=$((waited + 1))
    done

    LOCAL_HTTP_URL="http://127.0.0.1:$(cat "$port_file")/"
    astro::info "Local HTTP origin: $LOCAL_HTTP_URL"
}

start_local_http_server

# --------------------------------------------------------------------------
# Steps
# --------------------------------------------------------------------------

astro::info ">>> Launch"

BROWSER_VERSION="unknown"
run_version_step() {
    local log="$LOG_DIR/binary-version.log"
    local status=0
    timeout "$STEP_TIMEOUT" "$BINARY" --version >"$log" 2>&1 || status=$?

    if [ "$status" -ne 0 ]; then
        record_step "binary-version" "launch" \
            "the baseline binary identifies itself" "fail" \
            "'$BINARY --version' exited $status" "$BINARY --version" "$log"
        return 0
    fi

    local reported
    reported="$(tr -d '\r' < "$log" | head -1)"
    # A version line is the first evidence that the path really is a browser.
    if printf '%s' "$reported" | grep -qE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+'; then
        BROWSER_VERSION="$reported"
        record_step "binary-version" "launch" \
            "the baseline binary identifies itself" "pass" \
            "$reported" "$BINARY --version" "$log"
    else
        record_step "binary-version" "launch" \
            "the baseline binary identifies itself" "fail" \
            "no Chromium-style version in the output; this path may not be a browser" \
            "$BINARY --version" "$log"
    fi
}
run_version_step

run_startup_step() {
    local log="$LOG_DIR/clean-profile-startup.log"
    local status=0
    timeout "$STEP_TIMEOUT" "$BINARY" "${BROWSER_FLAGS[@]}" --dump-dom about:blank \
        >"$LOG_DIR/clean-profile-startup.dom" 2>"$log" || status=$?

    if [ "$status" -ne 0 ]; then
        record_step "clean-profile-startup" "launch" \
            "a clean baseline build starts against a fresh profile" "fail" \
            "browser exited $status against a fresh --user-data-dir" \
            "$BINARY --headless=new --user-data-dir=<temp> --dump-dom about:blank" "$log"
        return 0
    fi

    # 'Local State' is written by the browser process during startup, so its
    # presence distinguishes "the process ran" from "the process initialised a
    # profile" — a binary that exits 0 without touching the profile is not a
    # browser that started.
    if [ -f "$PROFILE_DIR/Local State" ]; then
        record_step "clean-profile-startup" "launch" \
            "a clean baseline build starts against a fresh profile" "pass" \
            "exited 0 and initialised a fresh profile" \
            "$BINARY --headless=new --user-data-dir=<temp> --dump-dom about:blank" "$log"
    else
        record_step "clean-profile-startup" "launch" \
            "a clean baseline build starts against a fresh profile" "fail" \
            "exited 0 but wrote no 'Local State' into the fresh profile, so no browser profile was initialised" \
            "$BINARY --headless=new --user-data-dir=<temp> --dump-dom about:blank" "$log"
    fi
}
run_startup_step

astro::info ">>> Navigation"

navigate_step() {
    local id="$1" url="$2" expect="$3"
    local dom="$LOG_DIR/navigate-$id.dom"
    local log="$LOG_DIR/navigate-$id.log"
    local command="$BINARY --headless=new --user-data-dir=<temp> --virtual-time-budget=$VIRTUAL_TIME_BUDGET --dump-dom $url"
    local requirement="navigate to $url"
    local status=0

    timeout "$STEP_TIMEOUT" "$BINARY" "${BROWSER_FLAGS[@]}" --dump-dom "$url" \
        >"$dom" 2>"$log" || status=$?

    if [ "$status" -eq 124 ]; then
        record_step "navigate:$id" "navigation" "$requirement" "fail" \
            "timed out after ${STEP_TIMEOUT}s" "$command" "$log"
        return 0
    fi
    if [ "$status" -ne 0 ]; then
        record_step "navigate:$id" "navigation" "$requirement" "fail" \
            "browser exited $status" "$command" "$log"
        return 0
    fi

    local bytes
    bytes="$(astro::file_size "$dom")"
    if [ "$bytes" -eq 0 ]; then
        record_step "navigate:$id" "navigation" "$requirement" "fail" \
            "exited 0 but dumped an empty DOM" "$command" "$log"
        return 0
    fi

    # Only the expectation and the size are recorded. Page CONTENT stays in the
    # log directory and never enters the report, which is committed evidence.
    if grep -qF -- "$expect" "$dom"; then
        record_step "navigate:$id" "navigation" "$requirement" "pass" \
            "$bytes bytes of DOM, contains the expected marker" "$command" "$dom"
    else
        record_step "navigate:$id" "navigation" "$requirement" "fail" \
            "$bytes bytes of DOM, but the expected marker was absent (expected: $expect)" \
            "$command" "$dom"
    fi
}

index=0
while [ "$index" -lt "${#URL_IDS[@]}" ]; do
    target="${URL_TARGETS[$index]}"
    target="${target//@LOCAL_HTTP@/$LOCAL_HTTP_URL}"
    target="${target//@HTTPS@/$HTTPS_URL}"
    navigate_step "${URL_IDS[$index]}" "$target" "${URL_EXPECTS[$index]}"
    index=$((index + 1))
done

astro::info ">>> Steps this harness cannot drive"

index=0
while [ "$index" -lt "${#UNDRIVEN_IDS[@]}" ]; do
    record_step "${UNDRIVEN_IDS[$index]}" "interaction" \
        "${UNDRIVEN_REQUIREMENTS[$index]}" "not-implemented" \
        "${UNDRIVEN_NOTES[$index]}" "" ""
    index=$((index + 1))
done

# --------------------------------------------------------------------------
# Report
# --------------------------------------------------------------------------

OVERALL="pass"
if [ "$FAIL_COUNT" -gt 0 ]; then
    OVERALL="fail"
elif [ "$UNIMPLEMENTED_COUNT" -gt 0 ]; then
    OVERALL="incomplete"
fi

# The revisions the run measured, when the lock is readable. A smoke result
# that cannot name the tree it ran against is not a baseline.
SOURCE_REVISIONS=""
LOCK_FILE="$ASTRO_ROOT/browser.lock.json"
if [ -f "$LOCK_FILE" ]; then
    SOURCE_REVISIONS="$LOCK_FILE"
fi

python3 - "$STEP_TSV" "$REPORT_PATH" "$BINARY" "$BROWSER_VERSION" \
    "$URL_LIST_SOURCE" "$SANDBOX_STATE" "$OVERALL" "$LOG_DIR" \
    "$SOURCE_REVISIONS" "$LOCAL_HTTP_URL" "$HTTPS_URL" <<'PY'
import datetime
import json
import platform
import sys

(tsv, output, binary, version, url_list_source, sandbox, overall, log_dir,
 lock_path, local_http, https_url) = sys.argv[1:12]

steps = []
with open(tsv, encoding="utf-8") as handle:
    for line in handle:
        line = line.rstrip("\n")
        if not line:
            continue
        step_id, phase, requirement, status, detail, command, log = line.split("\t")
        steps.append({
            "id": step_id,
            "phase": phase,
            "requirement": requirement,
            "status": status,
            "detail": detail,
            "command": command or None,
            "artifact": log or None,
        })

revisions = None
if lock_path:
    with open(lock_path, encoding="utf-8") as handle:
        lock = json.load(handle)
    revisions = {}
    for name, entry in lock.items():
        if not isinstance(entry, dict):
            continue
        fields = {
            key: value
            for key, value in entry.items()
            if key in ("version", "commit", "url", "ref")
        }
        # An entry that records no revision is not a revision; emitting it as an
        # empty object would read as "this source was pinned to nothing".
        if fields:
            revisions[name] = fields

counts = {"pass": 0, "fail": 0, "not-implemented": 0}
for step in steps:
    counts[step["status"]] = counts.get(step["status"], 0) + 1

document = {
    "tool": "tools/baseline/smoke.sh",
    "schema": 1,
    "issue": "ASTRO-NEXT-003 (#6)",
    "generated_at": datetime.datetime.now(datetime.timezone.utc)
                            .replace(microsecond=0).isoformat(),
    "overall_status": overall,
    "binary": {"path": binary, "version": version},
    "source_revisions": revisions,
    "environment": {
        "platform": platform.platform(),
        "machine": platform.machine(),
        "mode": "headless (--headless=new)",
        "sandbox": sandbox,
        "profile": "throwaway --user-data-dir; the developer profile is never opened",
        "http_origin": local_http,
        "https_origin": https_url,
    },
    "url_list": url_list_source,
    "summary": {
        "total": len(steps),
        "passed": counts.get("pass", 0),
        "failed": counts.get("fail", 0),
        "not_implemented": counts.get("not-implemented", 0),
    },
    "notes": [
        "A step recorded as not-implemented was NOT measured. It is never a pass, "
        "and its presence makes the whole run exit non-zero.",
        "Page content is not stored in this report; DOM dumps and browser stderr "
        f"are under {log_dir}.",
    ],
    "steps": steps,
}

with open(output, "w", encoding="utf-8") as handle:
    json.dump(document, handle, indent=2, sort_keys=True)
    handle.write("\n")
PY

astro::info "Report:   $REPORT_PATH"
astro::info "Logs:     $LOG_DIR"
astro::info "Summary:  $PASS_COUNT passed, $FAIL_COUNT failed, $UNIMPLEMENTED_COUNT not implemented"

if [ "$FAIL_COUNT" -gt 0 ]; then
    astro::error "Baseline smoke run FAILED: $FAIL_COUNT step(s) did not pass."
    astro::error "See $REPORT_PATH and the logs in $LOG_DIR."
    exit 1
fi

if [ "$UNIMPLEMENTED_COUNT" -gt 0 ]; then
    astro::error \
        "Baseline smoke run is INCOMPLETE: $UNIMPLEMENTED_COUNT step(s) are not implemented."
    astro::error \
        "They were NOT measured. This run must not be cited as a passing baseline."
    exit 2
fi

astro::info "=== Baseline smoke run complete: every step passed ==="
