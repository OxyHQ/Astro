#!/usr/bin/env bash
# The two real-checkout shell hazards, applied to the product baseline's own
# tooling (issue #6): tools/baseline/*.sh.
#
#   * `find … | head` dies of SIGPIPE under pipefail. A fixture holding a dozen
#     files never reproduces it, because find finishes writing before head
#     closes the pipe; 400,000 files reproduce it every time.
#   * a tracked `.orig` is upstream CONTENT, not a patch artifact. cargo vendor
#     writes `Cargo.toml.orig` beside every vendored crate, so the real tree
#     carries 181 tracked `.orig` and 0 untracked — a find-by-name artifact
#     hunt condemns a pristine checkout on sight.
#
# These scripts are exposed to both. smoke.sh and capture-network.sh drive a
# real browser against a real profile and a real build directory, so a listing
# they walk is as large as anything the build pipeline walks.
#
# It is a separate case from real-checkout-hazards.sh — which scans tools/ and
# tools/lib/ with the same two patterns — because tools/baseline/ is born at
# this layer and does not exist at the layer that case is carried back to. A
# single case would have to tolerate a missing directory, and a scan that reads
# "nothing to check" as a pass is not a scan. Splitting the file list is what
# keeps the floor honest on both branches.
#
# The demonstrations that each hazard is REAL live in real-checkout-hazards.sh
# and are deliberately not repeated: the mechanism belongs to the shell and to
# git, not to any one script, and proving it twice would not make it truer.
# What this case does need, and runs first, is proof that the regexes still
# fire — otherwise a pattern tightened into uselessness reports these scripts
# clean, which is indistinguishable from them actually being clean.
#
# Shell only. The `find … | head` hazard is a shell construct, and
# tools/baseline/ also holds Python whose equivalents are a different shape;
# they are covered by the suite's Python-facing checks, not by these regexes.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

BASELINE_SCRIPTS=(
    "$ASTRO_ROOT"/tools/baseline/*.sh
)

# Vacuity floor. An unmatched glob leaves its own pattern in the array — which
# is exactly what a missing tools/baseline/ produces — and that must fail here
# rather than reading as an empty, clean list. The three scripts are named
# outright as well, because a count alone cannot see a list that stayed the
# right size while losing the harness this case exists to scan.
harness::assert_script_list 3 \
    smoke.sh capture-network.sh generate-all.sh \
    -- "${BASELINE_SCRIPTS[@]}"

harness::assert_hazard_patterns_fire

harness::assert_no_lines_matching "$HARNESS_FIND_INTO_HEAD" \
    "a baseline script pipes find into head; against a real build directory head closes the pipe and pipefail surfaces exit 141, so the capture dies instead of reporting" \
    "${BASELINE_SCRIPTS[@]}"

harness::assert_no_lines_matching "$HARNESS_FIND_ARTIFACT_HUNT" \
    "a baseline script hunts patch artifacts with find-by-name; it must ask git for untracked files, because upstream ships 181 tracked .orig files" \
    "${BASELINE_SCRIPTS[@]}"

harness::pass
