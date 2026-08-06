#!/usr/bin/env bash
# The two gates added after a working-tree GN arg was nearly published as an
# upstream defect (docs/astro-next/baseline/findings.md, findings 2 and 8).
#
# Both are checked in BOTH directions. A drift reporter that always reports
# drift, or a ratchet that only ever fires upward, would each have passed a
# one-directional test while detecting nothing useful.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

DRIFT="$ASTRO_ROOT/tools/lib/gn_args_drift.py"
RATCHET="$ASTRO_ROOT/tools/lib/gn_check_baseline.py"
tmp="$(harness::tmpdir)"

# --------------------------------------------------------------------------
# GN args drift
# --------------------------------------------------------------------------

repo="$tmp/repo"
mkdir -p "$repo/gn_args"
git -C "$repo" init -q
git -C "$repo" config user.email astro@example.invalid
git -C "$repo" config user.name Astro
cat > "$repo/gn_args/linux.gn" <<'ARGS'
# Astro test args
is_debug = false
safe_browsing_mode = 0
target_os = "linux"
ARGS
git -C "$repo" add -A
git -C "$repo" -c commit.gpgsign=false commit -qm "args"

# Unmodified: reports the match, exits 0.
harness::run python3 "$DRIFT" --repo "$repo" --args-file "$repo/gn_args/linux.gn"
harness::assert_status 0 "args identical to HEAD"
harness::assert_output_contains "matches HEAD" "says so explicitly"
harness::assert_output_contains "3 keys" "counts the keys it parsed"

# The real-world case: one value edited locally. Reported, named, still exit 0 —
# editing GN args locally is ordinary work the epic requires to be preserved.
sed -i 's/^safe_browsing_mode = 0/safe_browsing_mode = 1/' "$repo/gn_args/linux.gn"
harness::run python3 "$DRIFT" --repo "$repo" --args-file "$repo/gn_args/linux.gn"
harness::assert_status 0 "a local GN edit is not fatal by default"
harness::assert_output_contains "differs from HEAD in 1 key" "counts the drift"
harness::assert_output_contains "safe_browsing_mode" "names the key"
harness::assert_output_contains "HEAD 0" "shows the committed value"
harness::assert_output_contains "building with 1" "shows the value being built"

# --strict is what CI and release builds pass.
harness::run python3 "$DRIFT" --repo "$repo" --args-file "$repo/gn_args/linux.gn" --strict
harness::assert_nonzero_status "--strict on drifted args"

# A key ADDED locally counts as drift too, not just a changed one.
git -C "$repo" checkout -q -- gn_args/linux.gn
echo 'enable_nacl = false' >> "$repo/gn_args/linux.gn"
harness::run python3 "$DRIFT" --repo "$repo" --args-file "$repo/gn_args/linux.gn"
harness::assert_output_contains "enable_nacl" "an added key is drift"
harness::assert_output_contains "HEAD (unset)" "reported as unset at HEAD"
git -C "$repo" checkout -q -- gn_args/linux.gn

# A key REMOVED locally, likewise — otherwise deleting a de-Google flag would be
# the one edit the reporter stayed silent about.
grep -v '^safe_browsing_mode' "$repo/gn_args/linux.gn" > "$tmp/trimmed"
cp "$tmp/trimmed" "$repo/gn_args/linux.gn"
harness::run python3 "$DRIFT" --repo "$repo" --args-file "$repo/gn_args/linux.gn"
harness::assert_output_contains "building with (unset)" "a removed key is drift"
git -C "$repo" checkout -q -- gn_args/linux.gn

# An args file that is not committed at all: every key in it is unversioned.
cp "$repo/gn_args/linux.gn" "$repo/gn_args/experiment.gn"
harness::run python3 "$DRIFT" --repo "$repo" --args-file "$repo/gn_args/experiment.gn"
harness::assert_status 0 "an uncommitted args file"
harness::assert_output_contains "not committed at HEAD" "says the content is unversioned"
harness::run python3 "$DRIFT" --repo "$repo" --args-file "$repo/gn_args/experiment.gn" --strict
harness::assert_nonzero_status "--strict on an uncommitted args file"

# An args file outside the repository cannot be compared against anything.
cp "$repo/gn_args/linux.gn" "$tmp/outside.gn"
harness::run python3 "$DRIFT" --repo "$repo" --args-file "$tmp/outside.gn"
harness::assert_status 0 "an args file outside the repository"
harness::assert_output_contains "outside the repository" "says why it cannot compare"

# --------------------------------------------------------------------------
# gn check ratchet
# --------------------------------------------------------------------------

cat > "$tmp/baseline.json" <<'JSON'
{"platforms": {"linux": 2}}
JSON

emit_log() {
    : > "$tmp/gncheck.log"
    local i
    for ((i = 0; i < $1; i++)); do
        printf 'ERROR at //chrome/browser/target_%d/BUILD.gn:10:3: Cannot include.\n' "$i" \
            >> "$tmp/gncheck.log"
        printf '#include "components/thing_%d/thing.h"\n' "$i" >> "$tmp/gncheck.log"
    done
}

emit_log 2
harness::run python3 "$RATCHET" --baseline "$tmp/baseline.json" --log "$tmp/gncheck.log" --platform linux
harness::assert_status 0 "error count equal to the baseline"
harness::assert_output_contains "2 error(s) across 2 file(s)" "counts errors and files"

emit_log 3
harness::run python3 "$RATCHET" --baseline "$tmp/baseline.json" --log "$tmp/gncheck.log" --platform linux
harness::assert_nonzero_status "more errors than the baseline"
harness::assert_output_contains "REGRESSION" "names it a regression"
harness::assert_output_contains "before raising the number" "says what to do"

# The direction a one-way ratchet would miss: fewer errors must also fail, or
# the number silently stops meaning anything the first time somebody fixes one.
emit_log 1
harness::run python3 "$RATCHET" --baseline "$tmp/baseline.json" --log "$tmp/gncheck.log" --platform linux
harness::assert_nonzero_status "fewer errors than the baseline"
harness::assert_output_contains "stale" "says the baseline must be lowered"

# A clean log against a non-zero baseline is the extreme of the same direction.
: > "$tmp/gncheck.log"
harness::run python3 "$RATCHET" --baseline "$tmp/baseline.json" --log "$tmp/gncheck.log" --platform linux
harness::assert_nonzero_status "zero errors against a non-zero baseline"

# An unmeasured platform must not look like a clean one.
emit_log 2
harness::run python3 "$RATCHET" --baseline "$tmp/baseline.json" --log "$tmp/gncheck.log" --platform macos
harness::assert_nonzero_status "a platform with no recorded baseline"
harness::assert_output_contains "no gn check baseline recorded" "names the gap"
harness::assert_output_contains "'macos'" "names the platform"

# --------------------------------------------------------------------------
# The committed baseline is the one the build actually consults
# --------------------------------------------------------------------------

committed_baseline="$ASTRO_ROOT/tools/gn-check-baseline.json"
harness::assert_file_exists "$committed_baseline"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
python3 - "$committed_baseline" "$ASTRO_ROOT/tools/build.sh" <<'PY' || exit 1
import json, pathlib, sys

baseline_path, build_sh = (pathlib.Path(p) for p in sys.argv[1:3])
document = json.loads(baseline_path.read_text(encoding="utf-8"))

platforms = document.get("platforms", {})
assert platforms, "no platforms recorded"
assert all(isinstance(v, int) and v >= 0 for v in platforms.values()), platforms

# The counts were measured against specific revisions; without them the number
# is unfalsifiable, since nobody can reproduce the tree it came from.
measured = document.get("measured_against", {})
for key in ("chromium", "ungoogled"):
    assert len(measured.get(key, "")) == 40, f"{key} is not a full commit SHA"

# And the build must actually call both gates, or every assertion above is
# testing a tool nothing runs.
text = build_sh.read_text(encoding="utf-8")
assert "tools/lib/gn_args_drift.py" in text, "build.sh does not report GN args drift"
assert "tools/lib/gn_check_baseline.py" in text, "build.sh does not ratchet gn check"
assert "gn-check-baseline.json" in text, "build.sh does not pass the committed baseline"
PY

harness::pass
