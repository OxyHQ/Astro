#!/usr/bin/env bash
# Provenance must describe the build that actually happened.
#
# It is generated from what is ON DISK, never from browser.lock.json. A
# provenance file derived from the lock would only restate the lock, and would
# certify a stale runner's build as correct — which is exactly the failure the
# lock exists to catch.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

SYNC="$ASTRO_ROOT/tools/sync-sources.sh"
PROVENANCE="$ASTRO_ROOT/tools/generate-provenance.sh"
tmp="$(harness::tmpdir)"

harness::assert_file_exists "$PROVENANCE"

origins="$tmp/origins"
mkdir -p "$origins"
mapfile -t CHROMIUM_SHAS < <(harness::make_source_repo "$origins/chromium" chromium sentinels)
CHROMIUM_TIP="${CHROMIUM_SHAS[2]}"
CHROMIUM_OLD="${CHROMIUM_SHAS[0]}"
mapfile -t DEPOT_SHAS < <(harness::make_source_repo "$origins/depot_tools" depot_tools)
mapfile -t UNGOOGLED_SHAS < <(harness::make_source_repo "$origins/ungoogled" ungoogled)

lock="$tmp/browser.lock.json"
cp "$ASTRO_ROOT/browser.lock.schema.json" "$tmp/browser.lock.schema.json"
harness::write_lock "$lock" \
    "file://$origins/chromium" "$CHROMIUM_TIP" \
    "file://$origins/depot_tools" "${DEPOT_SHAS[2]}" \
    "file://$origins/ungoogled" "${UNGOOGLED_SHAS[2]}"

work="$tmp/work"
mkdir -p "$work/chromium"
src="$work/chromium/src"

harness::run env ASTRO_CHROMIUM_SRC="$src" "$SYNC" --no-deps --lock "$lock" \
    --chromium-src "$src" --depot-tools "$work/depot_tools" --ungoogled "$work/ungoogled"
harness::assert_status 0 "sync fixtures into place"

gn_args="$tmp/linux.gn"
cat > "$gn_args" <<'EOF'
# a comment that must not appear as an argument
is_debug = false
symbol_level = 1
EOF

out="$tmp/provenance.json"
generate() {
    harness::run env ASTRO_CHROMIUM_SRC="$src" "$PROVENANCE" \
        --lock "$lock" --output "$out" --gn-args "$gn_args" \
        --platform linux --build-type Release \
        --chromium-src "$src" --depot-tools "$work/depot_tools" \
        --ungoogled "$work/ungoogled" "$@"
}

# --- Matching tree ----------------------------------------------------------

generate
harness::assert_status 0 "provenance for a tree matching the lock"
harness::assert_file_exists "$out"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
python3 - "$out" "$CHROMIUM_TIP" "${DEPOT_SHAS[2]}" "$gn_args" <<'PY' || exit 1
import json, subprocess, sys

path, chromium_tip, depot_tip, gn_args = sys.argv[1:5]
with open(path, encoding="utf-8") as handle:
    document = json.load(handle)

sources = document["sources"]

# Recorded revisions must match the actual repositories, not the lock.
assert sources["chromium"]["on_disk"] == chromium_tip, sources["chromium"]
assert sources["chromium"]["locked"] == chromium_tip, sources["chromium"]
assert sources["depot_tools"]["on_disk"] == depot_tip, sources["depot_tools"]

# Astro's own revision is resolved here, not carried in the lock.
assert sources["astro"]["locked"] is None, sources["astro"]
real_astro = subprocess.run(
    ["git", "rev-parse", "HEAD"], capture_output=True, text=True, check=True
).stdout.strip()
assert sources["astro"]["on_disk"] == real_astro, (sources["astro"], real_astro)

assert document["drift"] == [], document["drift"]
# `reproducible` also depends on the Astro repository's own worktree, which a
# test cannot control — a developer running the suite mid-change legitimately
# has uncommitted files. Assert what this case actually governs: the synced
# source trees are clean and match.
assert "chromium" not in document["dirty_worktrees"], document["dirty_worktrees"]
assert "depot_tools" not in document["dirty_worktrees"], document["dirty_worktrees"]

# GN args are recorded literally as well as by hash: a hash proves two builds
# match but does not say what either was built with.
assert document["gn_args"]["path"] == gn_args
assert document["gn_args"]["args"] == ["is_debug = false", "symbol_level = 1"], \
    document["gn_args"]["args"]
assert len(document["gn_args"]["sha256"]) == 64

assert document["target"] == {"platform": "linux", "build_type": "Release"}, document["target"]
assert document["toolchain"]["compiler_version"], document["toolchain"]

# A wall-clock timestamp would make two builds of identical sources differ.
assert document["timestamp_policy"] == "excluded-from-build-inputs", document
assert "timestamp" not in document
PY

# --- Drift is reported, not smoothed over -----------------------------------

git -C "$src" checkout --quiet --detach "$CHROMIUM_OLD"

generate
harness::assert_status 0 "provenance for a drifted tree (reported, not fatal by default)"
harness::assert_output_contains "DRIFT" "drift is announced"
harness::assert_output_contains "$CHROMIUM_OLD" "names the commit actually on disk"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
python3 - "$out" "$CHROMIUM_OLD" "$CHROMIUM_TIP" <<'PY' || exit 1
import json, sys
path, on_disk, locked = sys.argv[1:4]
with open(path, encoding="utf-8") as handle:
    document = json.load(handle)
assert document["sources"]["chromium"]["on_disk"] == on_disk, document["sources"]["chromium"]
assert document["sources"]["chromium"]["locked"] == locked, document["sources"]["chromium"]
assert document["drift"], "drift must be recorded"
assert document["reproducible"] is False, document
assert any("chromium" in line for line in document["drift"]), document["drift"]
PY

# --require-match is what a release build uses.
generate --require-match
harness::assert_nonzero_status "--require-match against a drifted tree"
harness::assert_output_contains "does not correspond to the lock" "refusal reason"

# --- A dirty worktree is recorded too ---------------------------------------

git -C "$src" checkout --quiet --detach "$CHROMIUM_TIP"
printf 'local edit\n' >> "$src/content.txt"

generate
harness::assert_status 0 "provenance for a dirty tree"
harness::assert_output_contains "DIRTY" "dirty worktree is announced"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
python3 - "$out" <<'PY' || exit 1
import json, sys
with open(sys.argv[1], encoding="utf-8") as handle:
    document = json.load(handle)
assert "chromium" in document["dirty_worktrees"], document["dirty_worktrees"]
assert document["reproducible"] is False, document
PY

generate --require-match
harness::assert_nonzero_status "--require-match against a dirty tree"

harness::pass
