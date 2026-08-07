#!/usr/bin/env bash
# What the dirty-overlay override COSTS, once a build has used it.
#
# tools/sync-overlay.sh refuses an overlay that does not match the commit being
# built, and ASTRO_ALLOW_DIRTY_OVERLAY=1 waves that refusal through. The
# refusal and the override are the layer below and are asserted in
# overlay-must-derive-from-head.sh. What is asserted here is everything that
# happens afterwards, all of which is written and read by the provenance
# generator — which does not exist at that layer, and is why this is a separate
# case:
#
#   * the resulting build is recorded as not reproducible, machine-readably,
#     with the offending paths NAMED rather than a bare verdict;
#   * a committed overlay is recorded as clean, so the verdict is not simply
#     this generator's only answer;
#   * a MISSING manifest is recorded as "unmeasured", never as clean;
#   * the strict verdict a release build asks for is refused;
#   * normal packaging then refuses the artifact, and the deliberate override
#     names the artifact for what it is.
#
# Everything runs against synthetic fixtures under the harness temporary
# directory. The real chromium/ checkout and the real releases/ directory are
# never touched.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

SYNC="$ASTRO_ROOT/tools/sync-overlay.sh"
PROVENANCE="$ASTRO_ROOT/tools/generate-provenance.sh"

tmp="$(harness::tmpdir)"
chromium="$tmp/chromium-src"
repo="$tmp/astro"
overlay="$repo/src"
allowlist="$tmp/overlay.allowlist"
patches="$tmp/patches"
mkdir -p "$patches"

harness::make_chromium_fixture "$chromium"
OVERLAY_HEAD="$(harness::make_overlay_repo "$repo" "$allowlist")"

SERVICE_REL="chrome/browser/oxy/oxy_auth_service.cc"

# --------------------------------------------------------------------------
# The two manifests everything below is measured against
#
# Produced by really running the overlay sync rather than hand-written, so a
# change to the manifest's shape surfaces here instead of leaving this case
# asserting against a format nothing writes any more.
# --------------------------------------------------------------------------

sync_overlay() {
    harness::setup_run env ASTRO_CHROMIUM_SRC="$chromium" "$@" "$SYNC" \
        --source "$overlay" --dest "$chromium" --allowlist "$allowlist" \
        --patches "$patches"
}

manifest="$ASTRO_REPORT_DIR/overlay-manifest.json"

sync_overlay
cp "$manifest" "$tmp/manifest-clean.json"

printf '// LOCAL EDIT, never committed\n' > "$overlay/$SERVICE_REL"
sync_overlay ASTRO_ALLOW_DIRTY_OVERLAY=1
cp "$manifest" "$tmp/manifest-dirty.json"

# The fixture floor. Every provenance assertion below is a statement about one
# of these two manifests, so if the two are not actually a clean one and a dirty
# one, the whole case is measuring a distinction that is not there — and a
# refusal-heavy case fails to notice, because a broken fixture also produces
# refusals.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
python3 - "$tmp/manifest-clean.json" "$tmp/manifest-dirty.json" "$OVERLAY_HEAD" "src/$SERVICE_REL" <<'PY' || exit 1
import json, sys
clean_path, dirty_path, head, changed = sys.argv[1:5]

def state(path):
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)["source_state"]

clean, dirty = state(clean_path), state(dirty_path)
assert clean["state"] == "clean", clean
assert clean["revision"] == head, clean
assert dirty["state"] == "dirty", dirty
assert dirty["override"] is True, dirty
assert [entry["overlay_path"] for entry in dirty["differences"]] == [changed], dirty
PY

# --------------------------------------------------------------------------
# Provenance records it, machine-readably
# --------------------------------------------------------------------------

mapfile -t DEPOT_SHAS < <(harness::make_source_repo "$tmp/depot_tools" depot_tools)
mapfile -t UNGOOGLED_SHAS < <(harness::make_source_repo "$tmp/ungoogled" ungoogled)
lock="$tmp/browser.lock.json"
cp "$ASTRO_ROOT/browser.lock.schema.json" "$tmp/browser.lock.schema.json"
harness::write_lock "$lock" \
    "file://$chromium" "$(git -C "$chromium" rev-parse HEAD)" \
    "file://$tmp/depot_tools" "${DEPOT_SHAS[2]}" \
    "file://$tmp/ungoogled" "${UNGOOGLED_SHAS[2]}"

generate_provenance() {
    local overlay_manifest="$1" output="$2"
    harness::run env ASTRO_CHROMIUM_SRC="$chromium" "$PROVENANCE" \
        --lock "$lock" --output "$output" --platform linux --build-type Release \
        --chromium-src "$chromium" --depot-tools "$tmp/depot_tools" \
        --ungoogled "$tmp/ungoogled" --overlay-manifest "$overlay_manifest"
}

generate_provenance "$tmp/manifest-dirty.json" "$tmp/provenance-dirty.json"
harness::assert_status 0 "provenance for a build made from a dirty overlay"
harness::assert_output_contains "NOT-REPRODUCIBLE dirty overlay" "announced on stderr"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
python3 - "$tmp/provenance-dirty.json" "src/$SERVICE_REL" <<'PY' || exit 1
import json, sys
path, changed = sys.argv[1:3]
with open(path, encoding="utf-8") as handle:
    document = json.load(handle)

assert document["reproducible"] is False, document["reproducible"]

overlay = document["overlay"]
assert overlay["state"] == "dirty", overlay
assert overlay["clean"] is False, overlay
assert overlay["override"] is True, overlay
assert [entry["overlay_path"] for entry in overlay["differences"]] == [changed], overlay

# The reason must NAME the paths: "not reproducible" with no subject is a
# verdict nobody can act on.
reasons = [line for line in document["not_reproducible_because"] if "overlay" in line]
assert reasons, document["not_reproducible_because"]
assert any(changed in line for line in reasons), reasons
PY

generate_provenance "$tmp/manifest-clean.json" "$tmp/provenance-clean.json"
harness::assert_status 0 "provenance for a build made from a committed overlay"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
python3 - "$tmp/provenance-clean.json" "$OVERLAY_HEAD" <<'PY' || exit 1
import json, sys
path, head = sys.argv[1:3]
with open(path, encoding="utf-8") as handle:
    document = json.load(handle)

overlay = document["overlay"]
assert overlay["state"] == "clean", overlay
assert overlay["clean"] is True, overlay
assert overlay["revision"] == head, overlay

# `reproducible` also answers for source drift and for worktrees this case does
# not control, so the assertion is the one this case governs: no reason blames
# the overlay. Without this, the dirty assertion above would pass just as well
# against a generator that always blames the overlay.
blamed = [line for line in document["not_reproducible_because"] if "overlay" in line]
assert not blamed, blamed
PY

# A missing manifest is "unmeasured", never "clean": a check whose pass and
# whose nothing-was-measured look the same certifies nothing.
generate_provenance "$tmp/no-such-manifest.json" "$tmp/provenance-unmeasured.json"
harness::assert_status 0 "provenance with no overlay manifest"
harness::assert_output_contains "NOT-REPRODUCIBLE overlay unmeasured" "distinguishes it from clean"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
python3 - "$tmp/provenance-unmeasured.json" <<'PY' || exit 1
import json, sys
with open(sys.argv[1], encoding="utf-8") as handle:
    document = json.load(handle)
overlay = document["overlay"]
assert overlay["state"] == "unmeasured", overlay
assert overlay["clean"] is False, overlay
assert "sync-overlay.sh did not run" in (overlay["reason"] or ""), overlay
assert document["reproducible"] is False, document["reproducible"]
PY

# A release build asks for the strict verdict, and must not get one.
harness::run env ASTRO_CHROMIUM_SRC="$chromium" "$PROVENANCE" \
    --lock "$lock" --output "$tmp/provenance-strict.json" \
    --platform linux --build-type Release --require-match \
    --chromium-src "$chromium" --depot-tools "$tmp/depot_tools" \
    --ungoogled "$tmp/ungoogled" --overlay-manifest "$tmp/manifest-dirty.json"
harness::assert_nonzero_status "--require-match against a dirty overlay"
harness::assert_output_contains "did not come from a commit" "refusal names the overlay"

# ==========================================================================
# The verdict itself, with nothing else able to move it
#
# Every provenance run above executes the generator out of the REAL repository,
# so `reproducible` there also answers for Astro's own worktree — which a test
# cannot control and which is dirty whenever anyone is mid-change. Asserting
# "reproducible is False" under those conditions passes whether or not the
# overlay was consulted at all: mutation-testing confirmed it, a generator
# computing the verdict as `not drift and not dirty` satisfied every assertion
# above while ignoring the overlay entirely.
#
# So the verdict is measured once more where NOTHING ELSE is wrong: a
# committed, clean miniature Astro repository holding the generator, a clean
# Chromium fixture, and a lock naming exactly what is on disk. The overlay is
# then the only input that can move the answer, in either direction.
# ==========================================================================

mirror="$tmp/astro-mirror"
mkdir -p "$mirror/tools/lib"
cp "$PROVENANCE" "$mirror/tools/"
cp -R "$ASTRO_ROOT/tools/lib/." "$mirror/tools/lib/"
# A byte-compiled cache copied out of the real tree would be COMMITTED here and
# then rewritten by the first run — cp -R gives the sources new mtimes, so
# python regenerates the .pyc — leaving this repository dirty for the second
# run only. The control would then pass and the comparison fail, for a reason
# that has nothing to do with the overlay.
rm -rf "$mirror/tools/lib/__pycache__"
cp "$ASTRO_ROOT/browser.lock.schema.json" "$mirror/"
git -C "$mirror" init --quiet
git -C "$mirror" add -A
git -C "$mirror" commit --quiet -m "astro mirror: committed and clean"

clean_chromium="$tmp/chromium-clean"
harness::make_chromium_fixture "$clean_chromium"

mirror_lock="$mirror/browser.lock.json"
harness::write_lock "$mirror_lock" \
    "file://$clean_chromium" "$(git -C "$clean_chromium" rev-parse HEAD)" \
    "file://$tmp/depot_tools" "${DEPOT_SHAS[2]}" \
    "file://$tmp/ungoogled" "${UNGOOGLED_SHAS[2]}"

verdict_provenance() {
    local overlay_manifest="$1" output="$2"
    harness::run env ASTRO_CHROMIUM_SRC="$clean_chromium" \
        "$mirror/tools/generate-provenance.sh" \
        --lock "$mirror_lock" --output "$output" --platform linux --build-type Release \
        --chromium-src "$clean_chromium" --depot-tools "$tmp/depot_tools" \
        --ungoogled "$tmp/ungoogled" --overlay-manifest "$overlay_manifest"
}

verdict_provenance "$tmp/manifest-clean.json" "$tmp/verdict-clean.json"
harness::assert_status 0 "verdict run with a committed overlay"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
python3 - "$tmp/verdict-clean.json" <<'PY' || exit 1
import json, sys
with open(sys.argv[1], encoding="utf-8") as handle:
    document = json.load(handle)
# The control: with nothing else wrong, the answer is reproducible. Without
# this, "not reproducible" could be this generator's only answer.
assert document["drift"] == [], document["drift"]
assert document["dirty_worktrees"] == [], document["dirty_worktrees"]
assert document["not_reproducible_because"] == [], document["not_reproducible_because"]
assert document["reproducible"] is True, document
PY

verdict_provenance "$tmp/manifest-dirty.json" "$tmp/verdict-dirty.json"
harness::assert_status 0 "verdict run with an uncommitted overlay"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
python3 - "$tmp/verdict-dirty.json" "src/$SERVICE_REL" <<'PY' || exit 1
import json, sys
path, changed = sys.argv[1:3]
with open(path, encoding="utf-8") as handle:
    document = json.load(handle)
# Same tree, same lock, same everything — only the overlay manifest differs.
assert document["drift"] == [], document["drift"]
assert document["dirty_worktrees"] == [], document["dirty_worktrees"]
reasons = document["not_reproducible_because"]
assert len(reasons) == 1, reasons
assert reasons[0].startswith("dirty overlay"), reasons
assert changed in reasons[0], reasons
assert document["reproducible"] is False, document
PY

# ==========================================================================
# Packaging refuses the result
#
# Run against a miniature Astro repository so the real releases/ directory is
# never written to by a test.
# ==========================================================================

pkgroot="$tmp/pkgroot"
mkdir -p "$pkgroot/tools/lib"
cp "$ASTRO_ROOT/tools/package-release.sh" "$pkgroot/tools/"
cp -R "$ASTRO_ROOT/tools/lib/." "$pkgroot/tools/lib/"
printf '9.9.9-test\n' > "$pkgroot/VERSION"

builddir="$tmp/out-release"
mkdir -p "$builddir"
# The markers tools/lib/overlay_in_binary.py looks for, so the binary check
# passes and the overlay-provenance check is what this section measures.
printf 'pad chrome://version pad chrome://alia pad astro-ntp pad astro-error pad' \
    > "$builddir/chrome"
printf 'sandbox\n' > "$builddir/chrome_sandbox"
printf 'crashpad\n' > "$builddir/chrome_crashpad_handler"
printf 'icu\n' > "$builddir/icudtl.dat"

package() {
    harness::run env "$@" "$pkgroot/tools/package-release.sh" "$builddir"
}

# --- a build from a committed overlay packages normally ----------------------
cp "$tmp/provenance-clean.json" "$ASTRO_REPORT_DIR/provenance.json"
package
harness::assert_status 0 "packaging a build made from a committed overlay"
harness::assert_file_exists "$pkgroot/releases/astro-9.9.9-test-linux-x64.tar.gz"

# --- a build from a dirty overlay is refused ---------------------------------
cp "$tmp/provenance-dirty.json" "$ASTRO_REPORT_DIR/provenance.json"
package
harness::assert_nonzero_status "packaging a build made from a dirty overlay"
harness::assert_output_contains "Refusing to package a build whose overlay did not come from a commit" \
    "refusal reason"
harness::assert_output_contains "src/$SERVICE_REL" "names the offending overlay path"
harness::assert_output_contains "ASTRO_ALLOW_DIRTY_OVERLAY_PACKAGE=1" "names the override"
harness::assert_file_missing "$pkgroot/releases/unreproducible-9.9.9-test-linux-x64-DIRTY-OVERLAY.tar.gz"

# --- and the override names the artifact for what it is ----------------------
package ASTRO_ALLOW_DIRTY_OVERLAY_PACKAGE=1
harness::assert_status 0 "packaging deliberately as an unreproducible artifact"
harness::assert_output_contains "override:dirty-overlay-package" "structured override warning"
harness::assert_file_exists "$pkgroot/releases/unreproducible-9.9.9-test-linux-x64-DIRTY-OVERLAY.tar.gz"

# --- an unmeasured overlay is refused too, and differently -------------------
cp "$tmp/provenance-unmeasured.json" "$ASTRO_REPORT_DIR/provenance.json"
package ASTRO_ALLOW_DIRTY_OVERLAY_PACKAGE=1
harness::assert_nonzero_status "packaging a build whose overlay state was never measured"
harness::assert_output_contains "Cannot determine whether this build's overlay came from a commit" \
    "refusal reason"
harness::assert_output_lacks "Refusing to package a build whose overlay did not come" \
    "must not report a verdict it does not have"

harness::pass
