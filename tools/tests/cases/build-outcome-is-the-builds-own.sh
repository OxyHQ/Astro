#!/usr/bin/env bash
# A wrapper, a pipeline, a background runner or a notification must not be able
# to report success for a build that failed.
#
# The defect, observed on this repository: a build was run through a wrapper,
# the wrapper exited 0, and a success was very nearly reported on that basis.
# The build's own log said
#
#     1 error generated.
#     17m46.20s Build Failure: 28148 done, 1 failed, 1787 remaining
#     1 steps failed: exit=1
#
# It is the shape this repository keeps finding — a check whose pass and whose
# "nothing was really measured" look identical — with the aggravation that the
# wrapper actively ASSERTED success.
#
# Every property is checked in BOTH directions, because the cheap way to pass a
# one-directional test is a guard that always fails. So the case proves, side by
# side: a lying wrapper is caught, a wrapper failing for its OWN reasons around
# a good build is not misreported, a genuinely successful build passes, and an
# unmeasurable one refuses rather than guessing either way.
#
# The masking it guards against is demonstrated, not assumed: a control runs the
# same failing build through `| tail` under the shell GitHub Actions actually
# gives a `run:` block, and asserts that pipeline exits 0. Without that control
# the guard beside it would be defending against something nobody had shown to
# happen.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

tmp="$(harness::tmpdir)"
TOOLS="$ASTRO_ROOT/tools"
DETECTOR="$TOOLS/lib/build_outcome.py"
VERIFIER="$TOOLS/verify-build-outcome.sh"

harness::assert_file_exists "$DETECTOR"
harness::assert_file_exists "$VERIFIER"

# --------------------------------------------------------------------------
# Fixtures
# --------------------------------------------------------------------------

# A compile that fails and says so in every dialect the build tools use. The
# lines are copied from the real failure rather than invented, so the
# vocabulary is tested against what ninja, siso and clang actually emit.
cat > "$tmp/failing-build.sh" <<'FIXTURE'
#!/usr/bin/env bash
echo "[28147/29936] CXX obj/chrome/browser/oxy/adblock/astro_adblock_service.o"
echo "FAILED: obj/chrome/browser/oxy/adblock/astro_adblock_service.o"
echo "../../chrome/browser/oxy/adblock/astro_adblock_service.cc:41:3: error: no member named 'Foo'"
echo "1 error generated."
echo "17m46.20s Build Failure: 28148 done, 1 failed, 1787 remaining"
echo "1 steps failed: exit=1"
exit 1
FIXTURE

# The nastier variant: it failed, it said so, and it still exited 0. This is
# what makes the log a VETO rather than a tie-breaker.
cat > "$tmp/lying-build.sh" <<'FIXTURE'
#!/usr/bin/env bash
echo "FAILED: obj/chrome/browser/oxy/oxy_auth_service.o"
echo "1 error generated."
exit 0
FIXTURE

# A successful compile whose log is deliberately full of near-misses: siso's
# success summary contains "0 failed", and clang tallies warnings in exactly
# the shape it tallies errors. A vocabulary that condemns these condemns every
# good build in the tree.
cat > "$tmp/successful-build.sh" <<'FIXTURE'
#!/usr/bin/env bash
echo "[29936/29936] LINK ./chrome"
echo "1 warning generated."
echo "17m46.20s Build Succeeded: 29936 done, 0 failed, 0 remaining"
echo "ninja: no work to do."
exit 0
FIXTURE

# A build that fails without saying so in any dialect the vocabulary knows: a
# linker killed by the OOM reaper, a toolchain wrapper erroring out, a script
# that just returns non-zero. Its STATUS is the only evidence there is, which
# makes it the one fixture where the log veto cannot cover for a guard reading
# the wrong status — and therefore the one that keeps the status-reading
# property independently load-bearing.
cat > "$tmp/quiet-failing-build.sh" <<'FIXTURE'
#!/usr/bin/env bash
echo "[29936/29936] LINK ./chrome"
exit 1
FIXTURE

# The wrappers. Each one is a real shape from the issue: a runner that reports
# its own success, one that fails for reasons of its own, and one that pipes
# the build into a pager under the shell a CI `run:` block gets.
cat > "$tmp/wrapper-always-zero.sh" <<'FIXTURE'
#!/usr/bin/env bash
"$@"
exit 0
FIXTURE

cat > "$tmp/wrapper-always-seven.sh" <<'FIXTURE'
#!/usr/bin/env bash
"$@"
exit 7
FIXTURE

# `bash -e` with no pipefail is what GitHub Actions gives a `run:` block, and
# it is where `build | tail` stops meaning anything.
cat > "$tmp/wrapper-pipes-into-tail.sh" <<'FIXTURE'
#!/usr/bin/env bash
set -e
"$@" 2>&1 | tail -5 > "$PIPED_LOG"
FIXTURE

# Drives astro::run_build_step exactly as tools/build.sh does, so what the case
# exercises is the shared helper the real scripts call and not a restatement of
# it.
cat > "$tmp/driver.sh" <<'FIXTURE'
#!/usr/bin/env bash
ASTRO_ROOT="$1"
export ASTRO_ROOT
# shellcheck source=/dev/null
source "$ASTRO_ROOT/tools/lib/astro-common.sh"
label="$2"
log="$3"
shift 3
astro::run_build_step "$label" "$log" -- "$@"
astro::info "DRIVER-REACHED-THE-END"
FIXTURE

chmod +x "$tmp"/*.sh

# Each scenario gets its own report directory: the outcome record is truncated
# by the first recorded step of a process, and a shared directory would let one
# scenario read another's record.
report_dir() {
    local name="$1"
    printf '%s/reports-%s\n' "$tmp" "$name"
}

run_step() {
    local name="$1" label="$2"
    shift 2
    harness::run env ASTRO_REPORT_DIR="$(report_dir "$name")" \
        bash "$tmp/driver.sh" "$ASTRO_ROOT" "$label" \
        "$(report_dir "$name")/$label.log" "$@"
}

# ==========================================================================
# 1. A wrapper exiting 0 around a build that failed
# ==========================================================================
#
# Two forms of the same lie, and both have to be caught: the build itself
# exiting non-zero while something downstream reports 0, and the build
# reporting 0 while its own log says it failed.

run_step lying compile "$tmp/lying-build.sh"
harness::assert_nonzero_status "a build that failed while exiting 0"
harness::assert_output_contains "failed" "the verdict is stated"
harness::assert_output_contains "FAILED: obj/chrome/browser/oxy/oxy_auth_service.o" \
    "the message quotes the evidence line, not just a count"
harness::assert_output_contains "[ninja-failed-step]" "and names which rule matched it"
harness::assert_output_contains "1 error generated." "the compiler's own tally is quoted"
harness::assert_output_contains "and the reported status was 0" \
    "tools/lib/build_outcome.py: the log must veto a status of 0, and the report must say so"
harness::assert_output_lacks "DRIVER-REACHED-THE-END" \
    "a failed build must stop the script, not merely be noted"

# The whole point: an outer wrapper claiming success changes nothing, because
# nothing downstream reads the wrapper's status.
harness::run env ASTRO_REPORT_DIR="$(report_dir wrapped-lie)" \
    bash "$tmp/wrapper-always-zero.sh" \
    bash "$tmp/driver.sh" "$ASTRO_ROOT" compile \
    "$(report_dir wrapped-lie)/compile.log" "$tmp/failing-build.sh"
harness::assert_status 0 "the wrapper itself still exits 0 — that is the defect"

# ...and the guard, consulted afterwards, reads the BUILD's evidence.
harness::run env ASTRO_REPORT_DIR="$(report_dir wrapped-lie)" \
    "$VERIFIER" --require-step compile
harness::assert_nonzero_status "the recorded outcome behind a wrapper that exited 0"
harness::assert_output_contains "The build FAILED" "the verifier names the verdict"
harness::assert_output_contains "17m46.20s Build Failure" "and quotes the build tool's own words"
harness::assert_output_contains "1 steps failed: exit=1" "including the step tally"

# A failure the log cannot describe. Only the status can catch it, so this is
# what fails if astro::run_build_step ever starts reading the pipeline's status
# — the `tee` leg, the wrapper's, anything but the build's — instead of the
# command's own.
run_step quiet compile "$tmp/quiet-failing-build.sh"
harness::assert_nonzero_status \
    "tools/lib/astro-common.sh: a build that failed silently must still be caught by its status"
harness::assert_output_contains "compile exited 1" \
    "tools/lib/astro-common.sh: astro::run_build_step must read PIPESTATUS[0], the build's own status"
harness::assert_output_contains "the build exited 1" \
    "tools/lib/build_outcome.py: a non-zero status is a failure even with a clean log"
harness::assert_output_lacks "DRIVER-REACHED-THE-END" \
    "tools/lib/astro-common.sh: a silent failure must stop the script too"

# ==========================================================================
# 2. A wrapper exiting NON-ZERO around a build that succeeded
# ==========================================================================
#
# The direction that separates a guard from a rubber stamp facing the other
# way. A wrapper may fail for reasons entirely its own — a notification post, an
# artifact upload, a cleanup — and that must not be reported as a build failure
# any more than its success may be reported as a build success.

harness::run env ASTRO_REPORT_DIR="$(report_dir wrapped-good)" \
    bash "$tmp/wrapper-always-seven.sh" \
    bash "$tmp/driver.sh" "$ASTRO_ROOT" compile \
    "$(report_dir wrapped-good)/compile.log" "$tmp/successful-build.sh"
harness::assert_status 7 "the wrapper's own failure is the wrapper's own"

harness::run env ASTRO_REPORT_DIR="$(report_dir wrapped-good)" \
    "$VERIFIER" --require-step compile
harness::assert_status 0 "a good build inside a wrapper that exited 7"
harness::assert_output_contains "succeeded" "the verdict is success"
harness::assert_output_lacks "unmeasurable" "and it is not hedged"

# ==========================================================================
# 3. A genuinely successful build
# ==========================================================================

run_step good compile "$tmp/successful-build.sh"
harness::assert_status 0 "a successful build"
harness::assert_output_contains "DRIVER-REACHED-THE-END" "the script continues past it"
harness::assert_output_contains "the build exited 0 and its log carries no failure report" \
    "the reason is stated rather than assumed"

# The near-misses in that log are the false-positive direction. If any of them
# fired, every good build in the tree would be condemned.
harness::assert_output_lacks "[siso-steps-failed]" "'0 failed' is not a failed step"
harness::assert_output_lacks "[compiler-errors-generated]" \
    "'1 warning generated.' is not an error tally"
harness::assert_output_lacks "[siso-build-failure]" "'Build Succeeded' is not a Build Failure"

# ==========================================================================
# 4. Unmeasurable: no log, or no status, is a FAILURE
# ==========================================================================

harness::run "$VERIFIER" --log "$tmp/does-not-exist.log"
harness::assert_status 2 "a log that does not exist"
harness::assert_output_contains "unmeasurable" "the third verdict is used"
harness::assert_output_contains "no such file" "and says what was missing"

: > "$tmp/empty.log"
harness::run "$VERIFIER" --log "$tmp/empty.log"
harness::assert_status 2 "an empty log with no status"
harness::assert_output_contains "no exit status was recorded" "names what it lacked"

# A bare status of 0 with nothing to corroborate it is the wrapper's exact
# claim, so it is not a pass either.
harness::run "$VERIFIER" --log "$tmp/empty.log" --status 0
harness::assert_status 2 "exit 0 with an empty log"
harness::assert_output_contains "uncorroborated" "says why the claim is not enough"

# No record at all — the shape a wrapper that ran nothing produces.
harness::run env ASTRO_REPORT_DIR="$tmp/reports-never-written" "$VERIFIER"
harness::assert_status 2 "no build outcome record"
harness::assert_output_contains "no build outcome record" "names the missing evidence"

# A record that parses, has no steps in it, and would otherwise read as "nothing
# failed". The vacuity floor.
mkdir -p "$tmp/reports-hollow"
printf '{"steps": []}\n' > "$tmp/reports-hollow/build-outcome.json"
harness::run env ASTRO_REPORT_DIR="$tmp/reports-hollow" "$VERIFIER"
harness::assert_status 2 "a record containing no steps"
harness::assert_output_contains "contains no steps" "names the vacuity"
harness::assert_output_contains "not a clean run" "and says why that is not a pass"

# A record whose compile step was never recorded. Every step it DOES hold
# succeeded, so only the requirement that the compile be present can catch it.
mkdir -p "$tmp/reports-no-compile"
cat > "$tmp/reports-no-compile/build-outcome.json" <<JSON
{"steps": [{"label": "gn-gen", "status": 0, "log": "$tmp/reports-good/compile.log",
            "verdict": "succeeded"}]}
JSON
harness::run env ASTRO_REPORT_DIR="$tmp/reports-no-compile" "$VERIFIER" --require-step compile
harness::assert_nonzero_status "a record that never recorded the compile"
harness::assert_output_contains "no step named: compile" "names the step it wanted"

# A record edited to claim success over a log that says otherwise. The verdict
# is re-derived from the log rather than read out of the record, which is what
# makes the record a claim and the log the evidence.
mkdir -p "$tmp/reports-tampered"
cp "$tmp/reports-lying/compile.log" "$tmp/reports-tampered/compile.log"
cat > "$tmp/reports-tampered/build-outcome.json" <<JSON
{"steps": [{"label": "compile", "status": 0,
            "log": "$tmp/reports-tampered/compile.log", "verdict": "succeeded"}]}
JSON
harness::run env ASTRO_REPORT_DIR="$tmp/reports-tampered" "$VERIFIER"
harness::assert_nonzero_status "a record whose stored verdict contradicts its log"
harness::assert_output_contains "MISMATCH" "the disagreement is reported"
harness::assert_output_contains "has been edited or overwritten" "and explained"

# ==========================================================================
# 5. Pipefail: a pipeline's status must not stand in for the build's
# ==========================================================================
#
# The control comes first, because a guard defending against something nobody
# has demonstrated is indistinguishable from a guard defending against nothing.

piped_log="$tmp/piped.log"
harness::run env PIPED_LOG="$piped_log" bash "$tmp/wrapper-pipes-into-tail.sh" \
    "$tmp/failing-build.sh"
harness::assert_status 0 \
    "CONTROL: build | tail under bash -e without pipefail exits 0 — the masking is real"

# The evidence survived in the captured output even though the status did not,
# so the guard has something to work with.
harness::run "$VERIFIER" --log "$piped_log" --status 0
harness::assert_nonzero_status "the masked failure, read out of the pipeline's own capture"
harness::assert_output_contains "1 steps failed: exit=1" "the surviving evidence is quoted"

# And the same failing build through astro::run_build_step, which pipes into
# `tee` for exactly the reason the wrapper piped into `tail` — a multi-hour
# compile has to stream — reports the BUILD's status, not the pipeline's.
run_step piped compile "$tmp/failing-build.sh"
harness::assert_nonzero_status "a failing build piped into tee inside the guard"
harness::assert_output_contains "compile exited 1" \
    "tools/lib/astro-common.sh: the status read is the build's own, not the pipeline's"
harness::assert_output_contains "tee exited 0" \
    "tools/lib/astro-common.sh: the pipeline's other leg is reported separately, never substituted"

# The log the guard keeps is COMPLETE. `tail -10` kept the tail and threw away
# the diagnosis; a log that starts mid-failure cannot be scanned for anything
# the truncation removed.
harness::assert_file_exists "$(report_dir piped)/compile.log"
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if ! grep -qF '[28147/29936] CXX obj/chrome' "$(report_dir piped)/compile.log"; then
    harness::fail "the kept log is truncated: its first line is missing"
fi

# ==========================================================================
# 6. The failure vocabulary discriminates, token by token
# ==========================================================================
#
# One log per token, so a rule that stopped matching cannot hide behind the
# other four, plus the near-miss that rule most plausibly over-matches.

assert_vocabulary() {
    local rule="$1" hazardous="$2" benign="$3"

    printf '%s\n' "$hazardous" > "$tmp/vocab.log"
    harness::run "$VERIFIER" --log "$tmp/vocab.log" --status 0
    harness::assert_status 1 "$rule must condemn: $hazardous"
    harness::assert_output_contains "[$rule]" "$rule must be the rule that fired"

    printf '%s\n' "$benign" > "$tmp/vocab.log"
    harness::run "$VERIFIER" --log "$tmp/vocab.log" --status 0
    harness::assert_status 0 "$rule must ignore: $benign"
}

assert_vocabulary ninja-failed-step \
    "FAILED: obj/chrome/chrome.o" \
    "  the step is marked FAILED: in ninja's output"
assert_vocabulary ninja-build-stopped \
    "ninja: build stopped: subcommand failed." \
    "ninja: no work to do."
assert_vocabulary siso-build-failure \
    "17m46.20s Build Failure: 28148 done, 1 failed, 1787 remaining" \
    "17m46.20s Build Succeeded: 29936 done, 0 failed, 0 remaining"
assert_vocabulary siso-steps-failed \
    "1 steps failed: exit=1" \
    "0 failed, 0 remaining"
assert_vocabulary compiler-errors-generated \
    "1 error generated." \
    "1 warning generated."

# ==========================================================================
# 7. A crash is not a verdict
# ==========================================================================
#
# The detector exits 1 for "failed", which is also what an unhandled exception
# exits, and a signal-level death exits 128+n. A caller that reads any non-zero
# as "the build failed" would report a definite answer it never received —
# and the mirror-image mistake, reading an unrecognised status as success, is
# how this whole class of defect works.

crash_root="$tmp/crash-root"
mkdir -p "$crash_root/tools/lib"
cp "$VERIFIER" "$crash_root/tools/"
cp "$TOOLS/lib/astro-common.sh" "$crash_root/tools/lib/"
printf '#!/usr/bin/env python3\nimport sys\nsys.exit(3)\n' \
    > "$crash_root/tools/lib/build_outcome.py"

harness::run env ASTRO_REPORT_DIR="$tmp/reports-crash" \
    "$crash_root/tools/verify-build-outcome.sh" --log "$tmp/empty.log"
harness::assert_status 2 "a detector that crashed rather than answered"
harness::assert_output_contains "exited 3" "the unexpected status is reported"
harness::assert_output_contains "crashed rather" "and classified as a crash"
harness::assert_output_lacks "The build FAILED" \
    "a crash must not be reported as a measured failure"

# ==========================================================================
# 8. The guard is wired into the tools that build things
# ==========================================================================
#
# Everything above tests a helper. Without this section it could be a helper
# nothing calls, which is the state the repository was already in: the compile
# ran bare, kept no log, and left a wrapper's word as the only evidence.

assert_file_contains() {
    local path="$1" needle="$2" what="$3"
    HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
    if ! grep -qF -- "$needle" "$path"; then
        harness::fail "$what
  ${path#"$ASTRO_ROOT"/} does not contain: $needle"
    fi
}

assert_file_contains "$TOOLS/build.sh" 'astro::run_build_step "compile"' \
    "tools/build.sh must record its compile step's own status"
assert_file_contains "$TOOLS/build.sh" 'astro::run_build_step "gn-gen"' \
    "tools/build.sh must record gn gen too; a failed gen writes no build graph"
assert_file_contains "$TOOLS/build.sh" "tools/verify-build-outcome.sh" \
    "tools/build.sh must re-derive the outcome before it reports completion"

# INVOCATION and DECLARATION are different lines, and the assertion above only
# covers the first. `tools/verify-build-outcome.sh` appears twice in build.sh —
# once as an `astro::require_file` gate among the required inputs, once as the
# command run after the compile — so deleting the gate leaves the substring
# behind and the assertion above still passes. Measured: with both
# `astro::require_file` lines removed and the invocation left intact, this whole
# case exited 0.
#
# Nothing else covers it either. The two required-input tables derive their rows
# from these very lines, so removing a line removes its row rather than failing
# it — correct for a case that has to follow build.sh across layers, and exactly
# why the hard-coded half belongs here instead.
#
# What is lost without the gate is the fail-fast diagnosis, not the guarantee:
# astro-common.sh runs under `set -Eeuo pipefail` (unlike harness.sh, which
# omits -e) and astro::require_build_outcome re-checks the detector at use time,
# so a missing verifier still stops the build — at exit 127 mid-run rather than
# a named refusal in the first second.
# The needles carry no literal `$`: a linter reads one inside single quotes as a
# failed expansion (SC2016). Pinning the path together with the human-readable
# label instead is the stronger check anyway — it is the label the two
# required-input tables assert on, so a label edited on one side and not the
# other fails here rather than silently making their needles unmatchable.
assert_file_contains "$TOOLS/build.sh" \
    '/tools/lib/build_outcome.py" "build outcome detector"' \
    "tools/build.sh must DECLARE the detector as a required input, not merely use it"
assert_file_contains "$TOOLS/build.sh" \
    '/tools/verify-build-outcome.sh" "build outcome verifier"' \
    "tools/build.sh must DECLARE the verifier as a required input, not merely invoke it"
assert_file_contains "$TOOLS/install-local.sh" "astro::run_build_step" \
    "tools/install-local.sh recompiles and then prints 'installed successfully'"
assert_file_contains "$TOOLS/fetch-cross-deps.sh" "astro::run_build_step" \
    "tools/fetch-cross-deps.sh re-applies the whole patch series"

# Every release job that builds must also verify. Asserted as an equality
# rather than a presence: a sixth build job added without its verify step is
# the regression, and a presence check cannot see it.
WORKFLOW="$ASTRO_ROOT/.github/workflows/release.yml"
harness::assert_file_exists "$WORKFLOW"

builds="$(grep -cE '^ *run: tools/build\.sh ' "$WORKFLOW")"
verifies="$(grep -cE '^ *run: tools/verify-build-outcome\.sh ' "$WORKFLOW")"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ "$builds" -lt 5 ]; then
    harness::fail "found only $builds tools/build.sh invocation(s) in release.yml; the parse is broken"
fi
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ "$builds" != "$verifies" ]; then
    harness::fail "release.yml has $builds build invocation(s) but $verifies verify step(s); every build must be verified"
fi

# ==========================================================================
# 9. No production script pipes a build into a pager
# ==========================================================================
#
# The shape that started this: `tools/apply-patches.sh all 2>&1 | tail -10`.
# Its status was the PIPELINE's — right only because `set -o pipefail` happened
# to be on, and silently wrong the moment the line is copied into a CI `run:`
# block — and `tail -10` discarded the diagnosis, so nothing survived to check
# the status against.
#
# Scanned over the working tree rather than through the shared banned-pattern
# scanner: this rule is new, and adding it there would condemn committed
# content that this change is what removes.

# Executable lines only. `^[^#]*` cannot cross a `#`, so a comment — including
# the one tools/fetch-cross-deps.sh now carries quoting the very line it no
# longer runs — can never match. The optional `/` before the command token is
# what lets a script invoked by path (`tools/apply-patches.sh`) match at all;
# without it the pattern found the two bare-command shapes and silently missed
# the one that actually shipped.
BUILD_INTO_PAGER='^[^#]*[[:space:]/]?(autoninja|ninja|gn gen|bun run build|[a-z][a-z0-9-]*\.sh)[^#|]*\|[^#]*[[:space:]](head|tail|grep)([[:space:]]|$)'

# Both directions for the pattern itself, before anything is scanned with it: a
# regex that stopped matching would report every script clean, which is
# indistinguishable from every script being clean.
cat > "$tmp/pager-hazardous.sh" <<'PROBE'
tools/apply-patches.sh all 2>&1 | tail -10
autoninja -C out/Release chrome | tail -20
ninja -C out/Release chrome 2>&1 | grep -c FAILED
PROBE
harness::assert_pattern_hits "$BUILD_INTO_PAGER" "$tmp/pager-hazardous.sh" 3 \
    "the build-into-pager pattern must match every hazardous shape"

cat > "$tmp/pager-benign.sh" <<'PROBE'
# The old `tools/apply-patches.sh all 2>&1 | tail -10` threw away the diagnosis.
astro::run_build_step "compile" "$log" -- run_in_chromium autoninja -C "$OUT_DIR"
BUILD_TOOLS_DIR=$(find "$SDK/build-tools" -maxdepth 1 -type d | sort -V | tail -1)
( cd "$CHROMIUM_SRC" && gn check "$OUT_DIR" ) > "$GN_CHECK_LOG" 2>&1
PROBE
harness::assert_pattern_hits "$BUILD_INTO_PAGER" "$tmp/pager-benign.sh" 0 \
    "the build-into-pager pattern must ignore prose, the guarded form and unrelated finds"

mapfile -t PRODUCTION_SCRIPTS < <(
    find "$ASTRO_ROOT/tools" -maxdepth 2 -name '*.sh' -type f \
        -not -path "$ASTRO_ROOT/tools/tests/*" | sort
)
harness::assert_script_list 15 build.sh install-local.sh fetch-cross-deps.sh \
    -- "${PRODUCTION_SCRIPTS[@]}"

harness::assert_no_lines_matching "$BUILD_INTO_PAGER" \
    "a build command's status must not be taken from a pipeline into a pager" \
    "${PRODUCTION_SCRIPTS[@]}"

harness::pass
