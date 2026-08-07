#!/usr/bin/env bash
# The run must stop at the FIRST patch that does not apply, exit non-zero, and
# leave a machine-readable report naming it.
#
# The old runner counted failures into a variable, printed the tally, and
# returned 0 — so a build could proceed with an arbitrary subset of the stack
# applied and nothing but a line of console output to say so.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

tmp="$(harness::tmpdir)"
chromium="$tmp/chromium-src"
patches="$tmp/patches"
report="$tmp/patch-report.json"

harness::make_chromium_fixture "$chromium"
printf 'alpha\n' > "$chromium/net/net_util.cc"
git -C "$chromium" add -A
git -C "$chromium" commit --quiet -m "base"

mkdir -p "$patches"
harness::write_patch "$patches/001-ok.patch"     "net/net_util.cc" "alpha"  "bravo"
harness::write_patch "$patches/002-broken.patch" "net/net_util.cc" "NOMATCH" "charlie"
harness::write_patch "$patches/003-later.patch"  "net/net_util.cc" "charlie" "delta"
cat > "$patches/series" <<'EOF'
001-ok.patch
002-broken.patch
003-later.patch
EOF

harness::run env ASTRO_CHROMIUM_SRC="$chromium" ASTRO_PATCH_REPORT="$report" \
    "$ASTRO_ROOT/tools/apply-patches.sh" astro \
    --dest "$chromium" --astro-patches "$patches"

harness::assert_nonzero_status "series containing a patch that does not apply"
harness::assert_output_contains "002-broken.patch" "names the failing patch"
harness::assert_output_contains "Patch 2 of 3" "names its position in the series"

# It stopped at the first failure: patch 3 was never attempted.
harness::assert_output_lacks "003-later.patch" "must not attempt later patches"

# Patch 1 applied, patch 3 did not.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 2))
grep -q "bravo" "$chromium/net/net_util.cc" || harness::fail "patch 1 was not applied"
grep -q "delta" "$chromium/net/net_util.cc" && harness::fail "patch 3 was applied after a failure"

# --- The report is written on the failure path and is machine-readable ------

harness::assert_file_exists "$report"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
python3 - "$report" <<'PY' || exit 1
import json, sys

with open(sys.argv[1], encoding="utf-8") as handle:
    document = json.load(handle)

assert document["outcome"] == "failed", document["outcome"]
assert document["failed_count"] == 1, document["failed_count"]
assert document["applied_count"] == 1, document["applied_count"]

names = [entry["name"] for entry in document["patches"]]
assert names == ["001-ok.patch", "002-broken.patch"], names

orders = [entry["order"] for entry in document["patches"]]
assert orders == [1, 2], orders

failing = [e for e in document["patches"] if e["status"] == "does-not-apply"]
assert len(failing) == 1 and failing[0]["name"] == "002-broken.patch", failing

applied = [e for e in document["patches"] if e["status"] == "applied"]
assert applied[0]["files"] == ["net/net_util.cc"], applied[0]["files"]
assert len(applied[0]["sha256"]) == 64, applied[0]["sha256"]
PY

# --- A clean run records the full series in declared order ------------------

clean_src="$tmp/clean-src"
clean_report="$tmp/clean-report.json"
harness::make_chromium_fixture "$clean_src"
printf 'alpha\n' > "$clean_src/net/net_util.cc"
git -C "$clean_src" add -A
git -C "$clean_src" commit --quiet -m "base"

clean_patches="$tmp/clean-patches"
mkdir -p "$clean_patches"
harness::write_patch "$clean_patches/001-a.patch" "net/net_util.cc" "alpha" "bravo"
harness::write_patch "$clean_patches/002-b.patch" "net/net_util.cc" "bravo" "charlie"
printf '001-a.patch\n002-b.patch\n' > "$clean_patches/series"

harness::run env ASTRO_CHROMIUM_SRC="$clean_src" ASTRO_PATCH_REPORT="$clean_report" \
    "$ASTRO_ROOT/tools/apply-patches.sh" astro \
    --dest "$clean_src" --astro-patches "$clean_patches"

harness::assert_status 0 "series that applies exactly"
harness::assert_file_exists "$clean_report"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
python3 - "$clean_report" <<'PY' || exit 1
import json, sys

with open(sys.argv[1], encoding="utf-8") as handle:
    document = json.load(handle)

assert document["outcome"] == "succeeded", document["outcome"]
assert document["applied_count"] == 2, document["applied_count"]
assert [e["name"] for e in document["patches"]] == ["001-a.patch", "002-b.patch"]
PY

# The modified-tree summary is printed before the run ends, so local and CI
# logs both record what tree was produced.
harness::assert_output_contains "Chromium checkout summary" "modified-tree summary"
harness::assert_output_contains "git diff --stat" "diffstat in the summary"

harness::pass
