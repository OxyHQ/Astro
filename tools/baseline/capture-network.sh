#!/usr/bin/env bash
# capture-network.sh — record the MEASURED network baseline for ASTRO-NEXT-003
# (issue #6): what a fresh Astro profile actually contacts, per phase, under a
# controlled recorder.
#
# This is the measured counterpart to tools/baseline/inventory_endpoints.py,
# which lists the hosts Astro's own source and patches REFERENCE. A host in the
# static inventory that never appears here is a feature that is off or broken; a
# host here that is not in the inventory is the interesting kind of surprise.
#
# Two properties are non-negotiable.
#
#   1. It fails closed. Without a browser binary and a recorder there is nothing
#      to measure, and this command refuses rather than emitting an empty trace.
#      It NEVER writes a trace file it did not actually record: a fabricated or
#      placeholder trace would be cited later as evidence of what Astro contacts.
#
#   2. It sanitises AT RECORD TIME. The mitmproxy addon below writes header
#      NAMES, path CATEGORIES and body data CLASSES — never header values, never
#      cookie values, never bodies, never full paths or query strings. Raw flows
#      are never written to disk at all, so there is no unsanitised intermediate
#      file to leak. Sanitisation is not optional: this trace is committed
#      evidence, and a full path or an Authorization value in it is a credential
#      or a browsing record published into the repository.
#
# Usage:
#   tools/baseline/capture-network.sh [options]
#
#   --binary PATH     Browser under test (default: chromium/src/out/Release/chrome)
#   --recorder PATH   mitmdump (or mitmproxy) binary
#   --phase NAME      Capture one phase; repeatable. Default: every phase.
#   --seconds N       Override the observation window of every selected phase.
#   --report NAME     Report file name inside build/reports
#   --dry-run         Print the plan; change nothing, write nothing.

ASTRO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export ASTRO_ROOT
# shellcheck source=../lib/astro-common.sh
source "$ASTRO_ROOT/tools/lib/astro-common.sh"

BINARY="${ASTRO_CAPTURE_BINARY:-$ASTRO_ROOT/chromium/src/out/Release/chrome}"
RECORDER="${ASTRO_CAPTURE_RECORDER:-}"
REPORT_NAME=""
SECONDS_OVERRIDE=""
NAV_TIMEOUT="${ASTRO_CAPTURE_NAV_TIMEOUT:-60}"
STARTUP_TIMEOUT="${ASTRO_CAPTURE_STARTUP_TIMEOUT:-30}"

declare -a SELECTED_PHASES=()

# --------------------------------------------------------------------------
# Phase table
#
# kind=idle      launch, observe for N seconds, terminate
# kind=navigate  launch once per URL with --dump-dom
# kind=manual    cannot be driven by this harness; recorded as not-implemented,
#                never as an empty-but-successful phase
# --------------------------------------------------------------------------

declare -a PHASE_NAMES=(
    "first-run" "idle" "webui" "alia" "adblock-update" "component-update" "oxy-login"
)
declare -a PHASE_KINDS=(
    "idle" "idle" "navigate" "navigate" "idle" "idle" "manual"
)
declare -a PHASE_SECONDS=(
    30 300 0 45 180 420 0
)
declare -a PHASE_NOTES=(
    "fresh profile launched WITHOUT --no-first-run, so genuine first-run traffic is observed"
    "fresh profile left idle, long enough to cover the periodic service startup window"
    "every Astro WebUI page loaded once; identifies remote fonts and remote WebUI resources"
    "the Alia side panel page loaded, then left open"
    "filter-list traffic; the update is TIME-TRIGGERED, not forced by this harness"
    "component and extension update checks; also time-triggered, not forced"
    "needs an interactive sign-in against a NON-PRODUCTION Oxy test account plus a CDP driver to fill and submit the form. Never capture this phase against a real account: even sanitised, the phase reveals the sign-in call graph of a real identity."
)

# Pages loaded during the webui and alia phases.
declare -a WEBUI_URLS=(
    "chrome://astro-ntp" "chrome://settings" "chrome://whats-new" "chrome://astro-error"
)
declare -a ALIA_URLS=(
    "chrome://alia"
)

usage() {
    cat >&2 <<'EOF'
Usage: tools/baseline/capture-network.sh [options]

  --binary PATH     Browser binary under test
                    (default: <repo>/chromium/src/out/Release/chrome)
  --recorder PATH   mitmdump or mitmproxy binary (default: whichever is on PATH)
  --phase NAME      Capture one phase; repeatable. Default: every phase.
  --seconds N       Observation window for every selected phase, overriding the
                    per-phase default.
  --report NAME     Report file name in build/reports. Default:
                    network-trace.json, or network-trace-<phase>.json when a
                    single phase is selected, so a one-phase run never
                    overwrites the full trace.
  --dry-run         Print the plan; change nothing.
  -h, --help

Phases: first-run, idle, webui, alia, adblock-update, component-update,
        oxy-login (not implemented; requires an interactive test account)

Exit status:
  0   every selected phase was recorded
  1   nothing could be recorded, or a precondition failed (no trace is written)
  2   some phases were recorded and at least one was not; the trace is written
      and marked "complete": false

Environment:
  ASTRO_CAPTURE_BINARY             Default binary path
  ASTRO_CAPTURE_RECORDER           Default recorder path
  ASTRO_CAPTURE_STARTUP_TIMEOUT    Seconds to wait for the recorder (default 30)
  ASTRO_CAPTURE_NAV_TIMEOUT        Per-navigation timeout (default 60)
  ASTRO_REPORT_DIR                 Report directory (default: build/reports)
EOF
}

while [ $# -gt 0 ]; do
    case "$1" in
        --binary)    shift; BINARY="${1:?--binary needs a path}" ;;
        --recorder)  shift; RECORDER="${1:?--recorder needs a path}" ;;
        --phase)     shift; SELECTED_PHASES+=("${1:?--phase needs a name}") ;;
        --seconds)   shift; SECONDS_OVERRIDE="${1:?--seconds needs a number}" ;;
        --report)    shift; REPORT_NAME="${1:?--report needs a file name}" ;;
        --dry-run)   ASTRO_DRY_RUN=1 ;;
        -h|--help)   usage; exit 0 ;;
        *)           usage; astro::die "Unknown argument: $1" ;;
    esac
    shift
done

# Assigns to a global rather than echoing: astro::die inside a command
# substitution exits only the subshell, so the refusal would arrive behind an
# ERR-trap frame instead of on its own.
PHASE_INDEX=-1
resolve_phase_index() {
    local wanted="$1" i
    PHASE_INDEX=-1
    for i in "${!PHASE_NAMES[@]}"; do
        if [ "${PHASE_NAMES[$i]}" = "$wanted" ]; then
            PHASE_INDEX="$i"
            return 0
        fi
    done
    astro::die_with_hint \
        "Unknown phase: $wanted" \
        "Known phases: ${PHASE_NAMES[*]}"
}

if [ "${#SELECTED_PHASES[@]}" -eq 0 ]; then
    SELECTED_PHASES=("${PHASE_NAMES[@]}")
fi

declare -a SELECTED_INDEXES=()
for phase in "${SELECTED_PHASES[@]}"; do
    resolve_phase_index "$phase"
    SELECTED_INDEXES+=("$PHASE_INDEX")
done

if [ -z "$REPORT_NAME" ]; then
    if [ "${#SELECTED_PHASES[@]}" -eq 1 ]; then
        REPORT_NAME="network-trace-${SELECTED_PHASES[0]}.json"
    else
        REPORT_NAME="network-trace.json"
    fi
fi
case "$REPORT_NAME" in
    */*|"") astro::die "--report takes a file name inside build/reports, not a path: $REPORT_NAME" ;;
esac

if [ -n "$SECONDS_OVERRIDE" ]; then
    case "$SECONDS_OVERRIDE" in
        ''|*[!0-9]*) astro::die "--seconds takes a whole number of seconds: $SECONDS_OVERRIDE" ;;
    esac
fi

# --------------------------------------------------------------------------
# Dry run — the plan only. No temporary directory, no report directory, and
# above all no trace file.
# --------------------------------------------------------------------------

if astro::dry_run; then
    astro::info "=== Astro baseline network capture (DRY RUN) ==="
    astro::plan "binary under test: $BINARY"
    if [ ! -f "$BINARY" ]; then
        astro::plan "binary is NOT present; a real run would refuse and write no trace"
    fi
    astro::plan "recorder: ${RECORDER:-<first of mitmdump, mitmproxy on PATH>}"
    astro::plan "start the recorder on 127.0.0.1 with a per-run mitmproxy confdir"
    astro::plan "trust ONLY the recorder's CA, via --ignore-certificate-errors-spki-list"
    astro::plan "sanitise at record time: header names, path categories, body classes"
    for i in "${SELECTED_INDEXES[@]}"; do
        seconds="${SECONDS_OVERRIDE:-${PHASE_SECONDS[$i]}}"
        case "${PHASE_KINDS[$i]}" in
            idle)     astro::plan "phase ${PHASE_NAMES[$i]}: fresh profile, observe ${seconds}s" ;;
            navigate) astro::plan "phase ${PHASE_NAMES[$i]}: fresh profile, load each page with --dump-dom" ;;
            manual)   astro::plan "phase ${PHASE_NAMES[$i]}: NOT IMPLEMENTED — ${PHASE_NOTES[$i]}" ;;
        esac
    done
    astro::plan "write $ASTRO_REPORT_DIR/$REPORT_NAME"
    astro::plan "refuse to write anything if no phase was actually recorded"
    astro::info "Dry run complete. Nothing was created."
    exit 0
fi

# --------------------------------------------------------------------------
# Preconditions. Nothing is created before every one of these passes.
# --------------------------------------------------------------------------

if [ ! -f "$BINARY" ]; then
    astro::die_with_hint \
        "Browser binary not found: $BINARY" \
        "A network baseline is a MEASUREMENT of a real build. There is nothing to" \
        "measure without one, and this command will not write a trace it did not record." \
        "" \
        "Build one:" \
        "  tools/sync-sources.sh" \
        "  tools/build.sh Release linux" \
        "" \
        "Or point at an existing build:" \
        "  tools/baseline/capture-network.sh --binary /path/to/chrome"
fi
if [ ! -x "$BINARY" ]; then
    astro::die_with_hint \
        "Browser binary is not executable: $BINARY" \
        "Build one with tools/build.sh Release linux, or pass --binary /path/to/chrome."
fi

RECORDER_HINT=(
    "The trace is recorded by an intercepting proxy. Without it nothing is measured,"
    "and this command will not emit a trace it did not record."
    ""
    "Install mitmproxy:"
    "  pipx install mitmproxy          (any platform)"
    "  sudo apt-get install mitmproxy  (Debian/Ubuntu)"
    "  brew install mitmproxy          (macOS)"
    ""
    "Or point at an existing one:"
    "  tools/baseline/capture-network.sh --recorder /path/to/mitmdump"
)

if [ -n "$RECORDER" ]; then
    if [ ! -x "$RECORDER" ]; then
        # An explicit --recorder that does not exist is named, so the refusal
        # says which recorder is missing rather than "a recorder".
        if command -v "$RECORDER" >/dev/null; then
            RECORDER="$(command -v "$RECORDER")"
        else
            astro::die_with_hint \
                "Network recorder not found or not executable: $RECORDER" \
                "${RECORDER_HINT[@]}"
        fi
    fi
else
    for candidate in mitmdump mitmproxy; do
        if command -v "$candidate" >/dev/null; then
            RECORDER="$(command -v "$candidate")"
            break
        fi
    done
    if [ -z "$RECORDER" ]; then
        astro::die_with_hint \
            "Network recorder not found: neither mitmdump nor mitmproxy is on PATH" \
            "${RECORDER_HINT[@]}"
    fi
fi

astro::require_cmd python3 openssl base64 timeout mktemp

astro::info "=== Astro baseline network capture ==="
astro::info "Binary:   $BINARY"
astro::info "Recorder: $RECORDER"
astro::info "Phases:   ${SELECTED_PHASES[*]}"

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/astro-capture.XXXXXXXX")"
REPORT_DIR="$(astro::report_dir)"
REPORT_PATH="$REPORT_DIR/$REPORT_NAME"
LOG_DIR="$REPORT_DIR/capture-logs"
mkdir -p "$LOG_DIR"

RECORDER_PID=""
BROWSER_PID=""

cleanup() {
    if [ -n "$BROWSER_PID" ]; then
        astro::optional "stop-browser" kill "$BROWSER_PID"
        BROWSER_PID=""
    fi
    if [ -n "$RECORDER_PID" ]; then
        astro::optional "stop-recorder" kill "$RECORDER_PID"
        RECORDER_PID=""
    fi
    case "$WORK_DIR" in
        /tmp/astro-capture.*|"${TMPDIR:-/tmp}"/astro-capture.*) rm -rf "$WORK_DIR" ;;
    esac
}
trap cleanup EXIT

# --------------------------------------------------------------------------
# The sanitising addon
#
# It runs inside the recorder, so flows are reduced to their sanitised form
# before anything reaches the disk. There is deliberately no code path in this
# tool that writes a raw flow file.
# --------------------------------------------------------------------------

ADDON="$WORK_DIR/astro_sanitize.py"
cat > "$ADDON" <<'PY'
"""mitmproxy addon: append one SANITISED JSON record per flow.

WHAT THIS ADDON MUST NEVER WRITE, and why the sanitisation is done here rather
than in a post-processing pass: the output of this file is committed as baseline
evidence, and a post-processing pass would require an unsanitised intermediate
on disk first.

  * header VALUES        — an Authorization or Cookie value is a credential
  * cookie names/values  — a session identifier, even split across names
  * request/response BODIES — sign-in payloads, page content, telemetry contents
  * full paths and query strings — paths carry account, device and session ids

Recorded instead: host, a path CATEGORY, segment and parameter COUNTS, method,
header NAMES, whether cookies were sent and how many, body data CLASSES and size
buckets, the owning component, and whether the host is Google-owned or carries
ungoogled-chromium's domain-substitution marker.
"""

import json
import os

OUT = os.environ["ASTRO_TRACE_OUT"]
PHASE = os.environ.get("ASTRO_TRACE_PHASE", "unknown")

FONT_SUFFIXES = (".woff2", ".woff", ".ttf", ".otf", ".eot")
STATIC_SUFFIXES = (".js", ".mjs", ".css", ".png", ".jpg", ".jpeg", ".gif",
                   ".svg", ".ico", ".webp", ".avif", ".map")
FILTER_SUFFIXES = (".txt", ".dat", ".filter", ".crx", ".zip")

AUTH_MARKERS = ("/oauth", "/token", "/login", "/signin", "/sign-in", "/session",
                "/auth", "/logout")
UPDATE_MARKERS = ("/service/update2", "/update2", "/crx", "/omaha")
TELEMETRY_MARKERS = ("/log", "/metrics", "/uma", "/report", "/crash", "/csi")

# Google-owned or Google-routed, which is the distinction issue #6 asks to
# surface: a de-Googled browser that still reaches one of these is a finding.
GOOGLE_SUFFIXES = (
    "google.com", "googleapis.com", "gstatic.com", "googleusercontent.com",
    "google-analytics.com", "googlesyndication.com", "doubleclick.net",
    "googletagmanager.com", "gvt1.com", "gvt2.com", "gvt3.com", "ggpht.com",
    "youtube.com", "chromium.org", "googlezip.net", "google.cn",
)

# ungoogled-chromium rewrites Google hosts into these shapes. A request to one
# is a feature that is still ENABLED and merely pointed at a broken host —
# which is not the same thing as a feature that was removed.
SUBSTITUTION_MARKERS = ("qjz9zk", "9oo91e", "ch40m1um", "95tat1c", "f0ntz", "ch40me")

COMPONENT_SUFFIXES = (
    ("oxy.so", "oxy-identity"),
    ("alia.onl", "alia"),
    ("easylist.to", "adblock"),
    ("adtidy.org", "adblock"),
    ("fanboy.co.nz", "adblock"),
    ("githubusercontent.com", "adblock"),
    ("127.0.0.1", "local"),
    ("localhost", "local"),
)


def path_category(path):
    lowered = path.split("?", 1)[0].lower()
    if lowered in ("", "/"):
        return "root"
    for marker in AUTH_MARKERS:
        if marker in lowered:
            return "auth"
    for marker in UPDATE_MARKERS:
        if marker in lowered:
            return "update-check"
    for marker in TELEMETRY_MARKERS:
        if marker in lowered:
            return "telemetry"
    if lowered.endswith(FONT_SUFFIXES):
        return "font"
    if lowered.endswith(STATIC_SUFFIXES):
        return "static-asset"
    if lowered.endswith(FILTER_SUFFIXES):
        return "list-or-package"
    if lowered.endswith(".json"):
        return "json-document"
    if lowered.startswith("/api/") or "/api/" in lowered:
        return "api"
    return "other"


def host_flags(host):
    lowered = host.lower()
    google = any(lowered == suffix or lowered.endswith("." + suffix)
                 for suffix in GOOGLE_SUFFIXES)
    substituted = any(marker in lowered for marker in SUBSTITUTION_MARKERS)
    component = "unknown"
    for suffix, name in COMPONENT_SUFFIXES:
        if lowered == suffix or lowered.endswith("." + suffix):
            component = name
            break
    if component == "unknown" and google:
        component = "google"
    return google, substituted, component


def size_bucket(size):
    if size == 0:
        return "empty"
    if size < 1024:
        return "<1KiB"
    if size < 10 * 1024:
        return "<10KiB"
    if size < 100 * 1024:
        return "<100KiB"
    if size < 1024 * 1024:
        return "<1MiB"
    return ">=1MiB"


def body_class(headers, size):
    if size == 0:
        return "none"
    content_type = headers.get("content-type", "").split(";", 1)[0].strip().lower()
    if not content_type:
        return "unknown"
    if content_type in ("application/json", "text/json"):
        return "json"
    if content_type == "application/x-www-form-urlencoded":
        return "form-urlencoded"
    if content_type.startswith("multipart/"):
        return "multipart"
    if content_type.startswith("text/"):
        return "text"
    if content_type.startswith(("image/", "font/", "audio/", "video/")):
        return content_type.split("/", 1)[0]
    if content_type.startswith("application/"):
        return "binary"
    return "other"


def _size(message):
    content = message.raw_content
    return len(content) if content else 0


def _record(flow, outcome, status_code):
    request = flow.request
    path = request.path or "/"
    bare = path.split("?", 1)[0]
    google, substituted, component = host_flags(request.pretty_host)

    request_size = _size(request)
    response_size = _size(flow.response) if flow.response is not None else 0

    entry = {
        "phase": PHASE,
        "scheme": request.scheme,
        "host": request.pretty_host,
        "port": request.port,
        "method": request.method,
        "path_category": path_category(path),
        "path_segments": len([part for part in bare.split("/") if part]),
        "query_param_count": len(request.query),
        "cookies_sent": len(request.cookies) > 0,
        "cookie_count": len(request.cookies),
        "request_header_names": sorted({name.lower() for name in request.headers.keys()}),
        "request_body_class": body_class(request.headers, request_size),
        "request_body_size": size_bucket(request_size),
        "outcome": outcome,
        "status_code": status_code,
        "component": component,
        "google_owned": google,
        "substituted_host": substituted,
    }

    if flow.response is not None:
        entry["response_header_names"] = sorted(
            {name.lower() for name in flow.response.headers.keys()}
        )
        entry["set_cookie"] = "set-cookie" in {
            name.lower() for name in flow.response.headers.keys()
        }
        entry["response_body_class"] = body_class(flow.response.headers, response_size)
        entry["response_body_size"] = size_bucket(response_size)

    with open(OUT, "a", encoding="utf-8") as handle:
        handle.write(json.dumps(entry, sort_keys=True) + "\n")


def response(flow):
    _record(flow, "response", flow.response.status_code)


def error(flow):
    # A request that never completed is still evidence the browser tried.
    _record(flow, "error", None)
PY

PORT_PROBE="$WORK_DIR/probe.py"
cat > "$PORT_PROBE" <<'PY'
"""Exit 0 when 127.0.0.1:<port> accepts a connection, 1 otherwise.

Written as a script rather than an inline expression so a refused connection
produces an exit status instead of a traceback on stderr.
"""
import socket
import sys

try:
    socket.create_connection(("127.0.0.1", int(sys.argv[1])), 0.5).close()
except OSError:
    sys.exit(1)
PY

free_port() {
    python3 -c 'import socket
sock = socket.socket()
sock.bind(("127.0.0.1", 0))
print(sock.getsockname()[1])
sock.close()'
}

# Terminates a child and reports its exit status. `wait` is what reaps it, so
# a later liveness check cannot be fooled by a zombie.
stop_process() {
    local pid="$1" label="$2"
    astro::optional "stop-${label}" kill "$pid"
    local status=0
    wait "$pid" || status=$?
    astro::info "  $label stopped (exit $status)"
}

# --------------------------------------------------------------------------
# Phase execution
# --------------------------------------------------------------------------

PHASE_TSV="$WORK_DIR/phases.tsv"
: > "$PHASE_TSV"
RECORDED_PHASES=0
SKIPPED_PHASES=0
TOTAL_REQUESTS=0

record_phase() {
    local name="$1" status="$2" seconds="$3" requests="$4" note="$5"
    printf '%s\t%s\t%s\t%s\t%s\n' "$name" "$status" "$seconds" "$requests" \
        "$(printf '%s' "$note" | tr '\n\t' '  ')" >> "$PHASE_TSV"
}

start_recorder() {
    local phase="$1" trace_out="$2"
    RECORDER_PORT="$(free_port)"
    RECORDER_CONFDIR="$WORK_DIR/mitm-$phase"
    mkdir -p "$RECORDER_CONFDIR"
    local log="$LOG_DIR/recorder-$phase.log"

    ASTRO_TRACE_OUT="$trace_out" ASTRO_TRACE_PHASE="$phase" \
        "$RECORDER" --quiet --listen-host 127.0.0.1 --listen-port "$RECORDER_PORT" \
        --set confdir="$RECORDER_CONFDIR" -s "$ADDON" \
        >"$log" 2>&1 &
    RECORDER_PID=$!

    local ca="$RECORDER_CONFDIR/mitmproxy-ca-cert.pem"
    local waited=0
    while true; do
        if [ -f "$ca" ] && python3 "$PORT_PROBE" "$RECORDER_PORT"; then
            break
        fi
        if [ "$waited" -ge "$STARTUP_TIMEOUT" ]; then
            local recorder_status=0
            astro::optional "stop-recorder" kill "$RECORDER_PID"
            wait "$RECORDER_PID" || recorder_status=$?
            RECORDER_PID=""
            astro::die_with_hint \
                "The recorder did not start listening on 127.0.0.1:$RECORDER_PORT within ${STARTUP_TIMEOUT}s." \
                "Recorder: $RECORDER (exit status $recorder_status)" \
                "CA certificate expected at: $ca" \
                "Log: $log" \
                "" \
                "Nothing was captured, so no trace is written. A trace file from this" \
                "command always means traffic that was actually observed."
        fi
        sleep 1
        waited=$((waited + 1))
    done

    # Trust exactly the recorder's CA, rather than disabling certificate
    # verification wholesale: a run with verification off would also mask a real
    # certificate failure in the product, which the baseline is meant to record.
    RECORDER_SPKI="$(openssl x509 -in "$ca" -pubkey -noout \
        | openssl pkey -pubin -outform der \
        | openssl dgst -sha256 -binary \
        | base64)"

    astro::info "  recorder listening on 127.0.0.1:$RECORDER_PORT"
}

browser_flags() {
    local phase="$1" profile="$2"
    BROWSER_ARGS=(
        "--user-data-dir=$profile"
        "--headless=new"
        "--disable-gpu"
        "--proxy-server=http://127.0.0.1:$RECORDER_PORT"
        "--ignore-certificate-errors-spki-list=$RECORDER_SPKI"
    )
    # The first-run phase deliberately keeps first-run behaviour: suppressing it
    # would hide the very requests that phase exists to record.
    if [ "$phase" != "first-run" ]; then
        BROWSER_ARGS+=("--no-first-run" "--no-default-browser-check")
    fi
    if [ "${ASTRO_CAPTURE_NO_SANDBOX:-0}" = "1" ]; then
        BROWSER_ARGS+=("--no-sandbox")
    fi
}

run_idle_phase() {
    local phase="$1" seconds="$2" profile="$3"
    local log="$LOG_DIR/browser-$phase.log"
    browser_flags "$phase" "$profile"

    astro::info "  launching the browser and observing for ${seconds}s"
    "$BINARY" "${BROWSER_ARGS[@]}" about:blank >"$log" 2>&1 &
    BROWSER_PID=$!
    sleep "$seconds"
    stop_process "$BROWSER_PID" "browser"
    BROWSER_PID=""
}

run_navigate_phase() {
    local phase="$1" profile="$2"
    shift 2
    local url status
    browser_flags "$phase" "$profile"
    for url in "$@"; do
        status=0
        astro::info "  loading $url"
        timeout "$NAV_TIMEOUT" "$BINARY" "${BROWSER_ARGS[@]}" \
            --virtual-time-budget=10000 --dump-dom "$url" \
            >"$LOG_DIR/browser-$phase-$(printf '%s' "$url" | tr -c 'a-zA-Z0-9' '-').dom" \
            2>>"$LOG_DIR/browser-$phase.log" || status=$?
        if [ "$status" -ne 0 ]; then
            # A page that fails to load is a finding, not a reason to discard
            # the requests already observed for this phase.
            astro::warn "page-load:$phase" "$url exited $status (see $LOG_DIR/browser-$phase.log)"
        fi
    done
}

for i in "${SELECTED_INDEXES[@]}"; do
    phase="${PHASE_NAMES[$i]}"
    kind="${PHASE_KINDS[$i]}"
    seconds="${SECONDS_OVERRIDE:-${PHASE_SECONDS[$i]}}"
    note="${PHASE_NOTES[$i]}"

    if [ "$kind" = "manual" ]; then
        astro::warn "not-implemented:$phase" "$note"
        record_phase "$phase" "not-implemented" 0 0 "$note"
        SKIPPED_PHASES=$((SKIPPED_PHASES + 1))
        continue
    fi

    astro::info ">>> phase $phase"
    trace_out="$WORK_DIR/$phase.jsonl"
    : > "$trace_out"
    profile="$WORK_DIR/profile-$phase"
    mkdir -p "$profile"

    start_recorder "$phase" "$trace_out"

    case "$kind" in
        idle)     run_idle_phase "$phase" "$seconds" "$profile" ;;
        navigate)
            if [ "$phase" = "alia" ]; then
                run_navigate_phase "$phase" "$profile" "${ALIA_URLS[@]}"
                run_idle_phase "$phase" "$seconds" "$profile"
            else
                run_navigate_phase "$phase" "$profile" "${WEBUI_URLS[@]}"
            fi
            ;;
    esac

    stop_process "$RECORDER_PID" "recorder"
    RECORDER_PID=""

    requests="$(wc -l < "$trace_out" | tr -d '[:space:]')"
    astro::info "  recorded $requests request(s)"
    record_phase "$phase" "recorded" "$seconds" "$requests" "$note"
    RECORDED_PHASES=$((RECORDED_PHASES + 1))
    TOTAL_REQUESTS=$((TOTAL_REQUESTS + requests))
done

# --------------------------------------------------------------------------
# Refusals. Both of these leave no trace file behind, on purpose.
# --------------------------------------------------------------------------

if [ "$RECORDED_PHASES" -eq 0 ]; then
    astro::die_with_hint \
        "No phase was recorded, so there is no trace to write." \
        "Selected phases: ${SELECTED_PHASES[*]}" \
        "Every selected phase needs a driver this harness does not have." \
        "Select a phase this harness can drive, e.g. --phase first-run."
fi

if [ "$TOTAL_REQUESTS" -eq 0 ]; then
    astro::die_with_hint \
        "The recorder observed ZERO requests across $RECORDED_PHASES recorded phase(s)." \
        "A browser that contacts nothing at all is possible, but it is far more likely" \
        "that traffic did not reach the proxy. Check, in this order:" \
        "  * the browser accepted --ignore-certificate-errors-spki-list (see the browser log)" \
        "  * the recorder log in $LOG_DIR for TLS or addon errors" \
        "  * that this build honours --proxy-server" \
        "" \
        "No trace is written: an empty trace would read as 'Astro contacts nothing'."
fi

# --------------------------------------------------------------------------
# Trace
# --------------------------------------------------------------------------

COMPLETE="true"
EXIT_STATUS=0
if [ "$SKIPPED_PHASES" -gt 0 ]; then
    COMPLETE="false"
    EXIT_STATUS=2
fi

python3 - "$PHASE_TSV" "$REPORT_PATH" "$WORK_DIR" "$BINARY" "$RECORDER" \
    "$COMPLETE" "$LOG_DIR" <<'PY'
import datetime
import json
import os
import platform
import sys

phase_tsv, output, work_dir, binary, recorder, complete, log_dir = sys.argv[1:8]

phases = []
requests = []
with open(phase_tsv, encoding="utf-8") as handle:
    for line in handle:
        line = line.rstrip("\n")
        if not line:
            continue
        name, status, seconds, count, note = line.split("\t")
        phases.append({
            "name": name,
            "status": status,
            "observation_seconds": int(seconds),
            "request_count": int(count),
            "note": note,
        })
        jsonl = os.path.join(work_dir, name + ".jsonl")
        if status != "recorded" or not os.path.exists(jsonl):
            continue
        with open(jsonl, encoding="utf-8") as flows:
            for record in flows:
                record = record.strip()
                if record:
                    requests.append(json.loads(record))

hosts = {}
for entry in requests:
    host = hosts.setdefault(entry["host"], {
        "host": entry["host"],
        "component": entry["component"],
        "google_owned": entry["google_owned"],
        "substituted_host": entry["substituted_host"],
        "request_count": 0,
        "phases": set(),
        "path_categories": set(),
    })
    host["request_count"] += 1
    host["phases"].add(entry["phase"])
    host["path_categories"].add(entry["path_category"])

host_list = []
for host in sorted(hosts.values(), key=lambda item: item["host"]):
    host["phases"] = sorted(host["phases"])
    host["path_categories"] = sorted(host["path_categories"])
    host_list.append(host)

document = {
    "tool": "tools/baseline/capture-network.sh",
    "schema": 1,
    "issue": "ASTRO-NEXT-003 (#6)",
    "generated_at": datetime.datetime.now(datetime.timezone.utc)
                            .replace(microsecond=0).isoformat(),
    "complete": complete == "true",
    "binary": binary,
    "recorder": recorder,
    "environment": {
        "platform": platform.platform(),
        "mode": "headless (--headless=new) behind an intercepting proxy",
        "profile": "a fresh --user-data-dir per phase",
        "tls": "only the recorder CA is trusted, via --ignore-certificate-errors-spki-list",
    },
    "sanitization": {
        "applied": "at record time, inside the recorder; no raw flow file is ever written",
        "header_values": "never recorded",
        "cookie_values": "never recorded",
        "cookie_names": "never recorded (only whether cookies were sent, and how many)",
        "bodies": "never recorded (only a data class and a size bucket)",
        "paths": "category, segment count and query-parameter count only",
    },
    "dns": (
        "DNS resolution is performed by the recorder, not by the browser, so the "
        "host list below is the observable equivalent of the DNS lookups"
    ),
    "summary": {
        "phases_recorded": sum(1 for phase in phases if phase["status"] == "recorded"),
        "phases_not_implemented": sum(
            1 for phase in phases if phase["status"] == "not-implemented"
        ),
        "requests": len(requests),
        "hosts": len(host_list),
        "google_owned_hosts": sum(1 for host in host_list if host["google_owned"]),
        "substituted_hosts": sum(1 for host in host_list if host["substituted_host"]),
    },
    "notes": [
        "A phase recorded as not-implemented was NOT measured; it contributes no "
        "requests and sets \"complete\" to false.",
        "A host carrying substituted_host is a feature that is still ENABLED and "
        "pointed at ungoogled-chromium's broken host, which is not the same as a "
        "feature that was removed.",
        f"Recorder and browser logs are under {log_dir}.",
    ],
    "phases": phases,
    "hosts": host_list,
    "requests": requests,
}

with open(output, "w", encoding="utf-8") as handle:
    json.dump(document, handle, indent=2, sort_keys=True)
    handle.write("\n")
PY

astro::info "Trace:    $REPORT_PATH"
astro::info "Logs:     $LOG_DIR"
astro::info "Summary:  $RECORDED_PHASES phase(s) recorded, $TOTAL_REQUESTS request(s), $SKIPPED_PHASES phase(s) not implemented"

if [ "$EXIT_STATUS" -ne 0 ]; then
    astro::error "Network baseline is INCOMPLETE: $SKIPPED_PHASES phase(s) were not measured."
    astro::error "The trace records \"complete\": false and must not be cited as a full baseline."
    exit "$EXIT_STATUS"
fi

astro::info "=== Network capture complete: every selected phase was recorded ==="
