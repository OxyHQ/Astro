#!/usr/bin/env bash
# The baseline harness (issue #6) exists to produce evidence later issues cite.
# Its one unforgivable failure mode is therefore not "it broke" but "it produced
# a plausible-looking result it never measured": an empty smoke report reads as
# a passing baseline, and an empty network trace reads as "Astro contacts
# nothing at all".
#
# So both scripts must refuse loudly and write NOTHING when they cannot measure.
#
# The refusal assertions alone would be vacuous — a script that always exits 1
# passes every one of them — so this case also drives both scripts past their
# preconditions with stub executables and asserts what they do next.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

SMOKE="$ASTRO_ROOT/tools/baseline/smoke.sh"
CAPTURE="$ASTRO_ROOT/tools/baseline/capture-network.sh"
tmp="$(harness::tmpdir)"

# harness::setup points ASTRO_REPORT_DIR into the fixture, so nothing here can
# write into the repository's own build/reports.
reports="$ASTRO_REPORT_DIR"
SMOKE_REPORT="$reports/smoke-report.json"
FULL_TRACE="$reports/network-trace.json"
PHASE_TRACE="$reports/network-trace-first-run.json"

harness::assert_file_exists "$SMOKE"
harness::assert_file_exists "$CAPTURE"

MISSING_BINARY="$tmp/no-such-build/out/Release/chrome"
MISSING_RECORDER="$tmp/no-such-tools/mitmdump"

mkdir -p "$tmp/bin"

# --- --dry-run is inert ------------------------------------------------------
#
# Run first, while the report directory still does not exist, so "created no
# files" can be asserted against the directory itself rather than one name
# inside it.

harness::run "$SMOKE" --dry-run --binary "$MISSING_BINARY"
harness::assert_status 0 "smoke --dry-run"
harness::assert_output_contains "PLAN" "dry run prints a plan"
harness::assert_output_contains "chrome://astro-ntp" "the plan names the URL set it would navigate"
harness::assert_output_contains "binary is NOT present" "the plan says the binary is absent"
harness::assert_file_missing "$reports"

harness::run "$CAPTURE" --dry-run --binary "$MISSING_BINARY" --recorder "$MISSING_RECORDER"
harness::assert_status 0 "capture-network --dry-run"
harness::assert_output_contains "PLAN" "dry run prints a plan"
harness::assert_output_contains "first-run" "the plan names the phases it would record"
harness::assert_output_contains "no phase was actually recorded" "the plan states the refusal rule"
harness::assert_file_missing "$reports"

# An unknown phase is rejected before the dry run prints anything, so a typo
# cannot silently capture a different phase set.
harness::run "$CAPTURE" --dry-run --phase not-a-phase
harness::assert_nonzero_status "capture-network with an unknown phase"
harness::assert_output_contains "Unknown phase: not-a-phase" "names the bad phase"
harness::assert_output_contains "adblock-update" "lists the known phases"

# --- No browser binary: refuse, and write nothing ----------------------------

harness::run "$SMOKE" --binary "$MISSING_BINARY"
harness::assert_nonzero_status "smoke with no browser binary"
harness::assert_output_contains "$MISSING_BINARY" "the refusal names the missing binary"
harness::assert_output_contains "tools/build.sh Release linux" "the refusal gives the build command"
harness::assert_output_contains "tools/sync-sources.sh" "the refusal gives the sync command"
harness::assert_file_missing "$SMOKE_REPORT"
harness::assert_file_missing "$reports"

harness::run "$CAPTURE" --binary "$MISSING_BINARY" --recorder "$MISSING_RECORDER"
harness::assert_nonzero_status "capture-network with no browser binary"
harness::assert_output_contains "$MISSING_BINARY" "the refusal names the missing binary"
harness::assert_output_contains "tools/build.sh Release linux" "the refusal gives the build command"
harness::assert_file_missing "$FULL_TRACE"
harness::assert_file_missing "$reports"

# A binary that exists but cannot be executed is a different failure and says so.
printf 'not executable\n' > "$tmp/bin/unexecutable-browser"
harness::run "$SMOKE" --binary "$tmp/bin/unexecutable-browser"
harness::assert_nonzero_status "smoke with a non-executable binary"
harness::assert_output_contains "not executable" "distinguishes absent from unexecutable"
harness::assert_file_missing "$SMOKE_REPORT"

# --- No recorder: refuse, name it, and write nothing -------------------------
#
# A real (if fake) browser is supplied here, so this exercises the recorder gate
# rather than passing for the previous reason.

STUB_LOG="$tmp/fake-browser.log"
STUB_BROWSER="$tmp/bin/fake-browser"
cat > "$STUB_BROWSER" <<EOF
#!/usr/bin/env bash
# Records the exact argv it was invoked with, then answers like a page load.
printf '%s\n' "\$*" >> "$STUB_LOG"
printf '<html><head><title>stub</title></head><body>astro-stub-body</body></html>\n'
EOF
chmod +x "$STUB_BROWSER"

harness::run "$CAPTURE" --binary "$STUB_BROWSER" --recorder "$MISSING_RECORDER"
harness::assert_nonzero_status "capture-network with no recorder"
harness::assert_output_contains "$MISSING_RECORDER" "the refusal names the missing recorder"
harness::assert_output_contains "mitmproxy" "the refusal says what to install"
harness::assert_output_lacks "Browser binary not found" "it got past the binary gate"
harness::assert_file_missing "$FULL_TRACE"

# --- A stub browser must get FURTHER -----------------------------------------
#
# Without this, every assertion above is satisfied by a script that refuses
# unconditionally, and the case could not tell "correctly refuses" from
# "always refuses".

harness::run "$SMOKE" --binary "$STUB_BROWSER" --https-url "https://example.invalid/"

# The stub is not a browser, so every step fails — but it must fail for step
# reasons, having actually run the binary, not for the precondition reason.
harness::assert_nonzero_status "smoke against a stub that is not a real browser"
harness::assert_output_lacks "Browser binary not found" "it got past the binary gate"
harness::assert_output_contains "FAIL" "it reports per-step results"
harness::assert_file_exists "$SMOKE_REPORT"

harness::assert_file_exists "$STUB_LOG"

# The browser was really invoked, with the switches the report claims.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 4))
grep -qF -- "--headless=new" "$STUB_LOG" \
    || harness::fail "smoke.sh did not invoke the browser headless"
grep -qF -- "--dump-dom" "$STUB_LOG" \
    || harness::fail "smoke.sh did not invoke the browser with --dump-dom"
grep -qF -- "--dump-dom chrome://astro-ntp" "$STUB_LOG" \
    || harness::fail "smoke.sh did not navigate to the Astro new tab page"
grep -qE -- "--dump-dom http://127\.0\.0\.1:[0-9]+/" "$STUB_LOG" \
    || harness::fail "smoke.sh did not serve and navigate its own local HTTP origin"

# The profile is a throwaway directory. A smoke run that opened the developer's
# real profile would corrupt the state the migration fixtures capture.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 2))
if grep -qF -- "--user-data-dir=$HOME" "$STUB_LOG"; then
    harness::fail "smoke.sh pointed the browser at the developer's real profile"
fi
grep -qE -- "--user-data-dir=[^ ]*/astro-smoke\.[A-Za-z0-9]+/profile" "$STUB_LOG" \
    || harness::fail "expected a throwaway --user-data-dir in the browser command line"

# Page content stays in the log directory; the report is committed evidence.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if grep -qF 'astro-stub-body' "$SMOKE_REPORT"; then
    harness::fail "smoke-report.json contains page content; it must record findings, not DOM"
fi

# The structured report says what it measured and what it did not.
cat > "$tmp/check-smoke-report.py" <<'PY'
import json
import sys

report_path, binary = sys.argv[1:3]
with open(report_path, encoding="utf-8") as handle:
    report = json.load(handle)

problems = []

if report.get("overall_status") != "fail":
    problems.append(f"overall_status is {report.get('overall_status')!r}, expected 'fail'")
if report.get("binary", {}).get("path") != binary:
    problems.append("the report does not name the binary it ran")

steps = {step["id"]: step for step in report.get("steps", [])}
for required in ("binary-version", "clean-profile-startup",
                 "navigate:chrome-version", "navigate:http-local",
                 "window-created", "back-forward", "restart-session-restore"):
    if required not in steps:
        problems.append(f"no step recorded for {required}")

undriven = [step for step in steps.values() if step["status"] == "not-implemented"]
if len(undriven) != 3:
    problems.append(f"{len(undriven)} not-implemented steps, expected 3")
for step in undriven:
    # A gap has to say what would close it, or the report merely hides it.
    if len(step.get("detail", "")) < 40:
        problems.append(f"{step['id']} is not-implemented without a note")

if report["summary"]["failed"] < 1:
    problems.append("a stub browser produced no failing step")
if report["summary"]["not_implemented"] != 3:
    problems.append("summary disagrees with the recorded steps")

for step in steps.values():
    if step["status"] not in ("pass", "fail", "not-implemented"):
        problems.append(f"{step['id']} has an unknown status {step['status']!r}")

if problems:
    for problem in problems:
        print(f"REPORT PROBLEM: {problem}")
    sys.exit(1)
print("smoke report structure OK")
PY

harness::run python3 "$tmp/check-smoke-report.py" "$SMOKE_REPORT" "$STUB_BROWSER"
harness::assert_status 0 "smoke-report.json records the run it actually performed"
harness::assert_output_contains "smoke report structure OK" "report check ran"

# --- A stub recorder must get FURTHER too ------------------------------------
#
# It starts and exits without ever listening, which is the shape of a broken
# recorder. The refusal must name the recorder AND its exit status: that is only
# knowable by having launched it.

STUB_RECORDER="$tmp/bin/fake-mitmdump"
cat > "$STUB_RECORDER" <<'EOF'
#!/usr/bin/env bash
# Starts, never listens, exits 3.
exit 3
EOF
chmod +x "$STUB_RECORDER"

harness::run env ASTRO_CAPTURE_STARTUP_TIMEOUT=2 \
    "$CAPTURE" --binary "$STUB_BROWSER" --recorder "$STUB_RECORDER" \
    --phase first-run --seconds 1
harness::assert_nonzero_status "capture-network with a recorder that never listens"
harness::assert_output_lacks "Network recorder not found" "it got past the recorder-presence gate"
harness::assert_output_contains "did not start listening" "the refusal reason"
harness::assert_output_contains "$STUB_RECORDER" "names the recorder it launched"
harness::assert_output_contains "exit status 3" "reports the recorder's own exit status"
harness::assert_output_contains "no trace is written" "states that nothing was recorded"
harness::assert_file_missing "$PHASE_TRACE"
harness::assert_file_missing "$FULL_TRACE"

harness::pass
