#!/usr/bin/env bash
# The overlay copied into Chromium must be the one the commit being built
# carries — not whatever happens to be in the working tree.
#
# The old sync copied src/ as it stood. An untracked whole-file overlay copy of
# chrome/browser/ui/webui/chrome_web_ui_configs.cc was therefore compiled into
# Chromium, pulling Astro headers into an upstream translation unit and breaking
# the build; nothing in any artifact recorded that the tree differed from every
# commit. A binary produced that way cannot be reproduced from any revision, and
# nothing said so.
#
# The gate is tested in BOTH directions. A refusal-only gate is easy to write
# and worthless: an overlay that matches HEAD must sync, and a change OUTSIDE
# the overlay must not block anything, or the check is measuring the wrong thing.
#
# Covered here, end to end: refusal for modified / untracked / deleted overlay
# paths; that nothing at all is copied when it refuses; that the explicit
# developer override lets the copy through; that the resulting build is recorded
# as not reproducible in provenance; that normal packaging then refuses it; and
# that no CI workflow sets the override.

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

# The overlay lives in a SUBDIRECTORY of its repository, exactly as src/ does in
# Astro, so the path-scoping this gate depends on is the scoping under test.
mkdir -p "$repo"
git -C "$repo" init --quiet
harness::make_overlay_fixture "$overlay" "$allowlist"
printf 'unrelated repository content\n' > "$repo/README.md"
# An ignore rule, so this case can cover the one shape `git status` cannot see.
printf '*.gen.cc\n' > "$repo/.gitignore"
git -C "$repo" add -A
git -C "$repo" commit --quiet -m "astro fixture: committed overlay"

OVERLAY_HEAD="$(git -C "$repo" rev-parse HEAD)"

# Committed content of the two files this case moves around. Restored with
# printf rather than `git checkout`, so the fixture is never repaired by the
# same tool the gate consults.
SERVICE_REL="chrome/browser/oxy/oxy_auth_service.cc"
SERVICE_COMMITTED='// astro service'
ICON_REL="chrome/app/vector_icons/alia_spark.icon"
ICON_COMMITTED='CANVAS_DIMENSIONS, 16,'

# Any arguments are passed to env as additional VAR=VALUE settings.
sync_overlay() {
    harness::run env ASTRO_CHROMIUM_SRC="$chromium" "$@" "$SYNC" \
        --source "$overlay" --dest "$chromium" --allowlist "$allowlist" \
        --patches "$patches"
}

# A path must be named on a line that also classifies it. Asserting only that
# the path appears somewhere would pass on an unrelated mention of it.
assert_classified() {
    local classification="$1" path="$2"
    HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
    local pattern="^[[:space:]]*${classification}[[:space:]]+${path//./\\.}$"
    if ! grep -qE -- "$pattern" "$RUN_STDERR" "$RUN_STDOUT"; then
        harness::fail "expected a line classifying $path as $classification"
    fi
}

# ==========================================================================
# Direction 1: an overlay that matches HEAD syncs
# ==========================================================================

sync_overlay
harness::assert_status 0 "overlay matching HEAD"
harness::assert_output_contains "matches HEAD ($OVERLAY_HEAD)" "records the revision it verified"
harness::assert_files_identical "$overlay/$SERVICE_REL" "$chromium/$SERVICE_REL"

manifest="$ASTRO_REPORT_DIR/overlay-manifest.json"
harness::assert_file_exists "$manifest"
cp "$manifest" "$tmp/manifest-clean.json"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
python3 - "$tmp/manifest-clean.json" "$OVERLAY_HEAD" <<'PY' || exit 1
import json, sys
path, head = sys.argv[1:3]
with open(path, encoding="utf-8") as handle:
    state = json.load(handle)["source_state"]
assert state["state"] == "clean", state
assert state["clean"] is True, state
assert state["revision"] == head, state
assert state["override"] is False, state
assert state["differences"] == [], state
PY

# A change OUTSIDE the overlay must not block the sync: the gate is scoped to
# the paths that are copied, not to the repository's cleanliness in general.
printf 'edited after the commit\n' >> "$repo/README.md"

sync_overlay
harness::assert_status 0 "a change outside the overlay does not block the sync"
harness::assert_output_contains "matches HEAD" "still verified against the commit"

# ==========================================================================
# Direction 2: a MODIFIED overlay file refuses, and copies nothing
# ==========================================================================

printf '// LOCAL EDIT, never committed\n' > "$overlay/$SERVICE_REL"
before="$(harness::manifest "$chromium")"

sync_overlay
harness::assert_nonzero_status "overlay modified relative to HEAD"
harness::assert_output_contains "differ from HEAD" "refusal reason"
harness::assert_output_contains "$OVERLAY_HEAD" "names the commit it compared against"
assert_classified "modified" "src/$SERVICE_REL"
harness::assert_output_contains "ASTRO_ALLOW_DIRTY_OVERLAY=1" "names the override"

# Nothing was copied. The destination still holds the committed content from
# the successful sync above, which is the proof that matters: an exit status
# alone would also be produced by a gate that refused after copying.
harness::assert_tree_unchanged "$chromium" "$before"
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if ! grep -qF -- "$SERVICE_COMMITTED" "$chromium/$SERVICE_REL"; then
    harness::fail "the destination no longer holds the committed content: $chromium/$SERVICE_REL"
fi
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if grep -qF -- "LOCAL EDIT" "$chromium/$SERVICE_REL"; then
    harness::fail "the uncommitted overlay content reached Chromium anyway"
fi

# The developer's own file is untouched: this gate detects, it never repairs.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if ! grep -qF -- "LOCAL EDIT" "$overlay/$SERVICE_REL"; then
    harness::fail "the gate modified the developer's working tree"
fi

# --dry-run validates the same input, so it must refuse too — otherwise the
# documented way to check a build before running it reports a clean bill.
harness::run env ASTRO_CHROMIUM_SRC="$chromium" "$SYNC" --dry-run \
    --source "$overlay" --dest "$chromium" --allowlist "$allowlist" \
    --patches "$patches"
harness::assert_nonzero_status "dry run against a modified overlay"

# ==========================================================================
# Direction 3: an UNTRACKED overlay file refuses
#
# This is the shape that caused the real failure, so it is asserted on its own
# rather than assumed to follow from the modified case.
# ==========================================================================

printf '%s\n' "$SERVICE_COMMITTED" > "$overlay/$SERVICE_REL"
UNTRACKED_REL="chrome/browser/oxy/oxy_untracked_wip.cc"
printf '// work in progress, never committed\n' > "$overlay/$UNTRACKED_REL"
before="$(harness::manifest "$chromium")"

sync_overlay
harness::assert_nonzero_status "untracked file under the overlay"
assert_classified "untracked" "src/$UNTRACKED_REL"
harness::assert_tree_unchanged "$chromium" "$before"
harness::assert_file_missing "$chromium/$UNTRACKED_REL"

rm "$overlay/$UNTRACKED_REL"

# --- and an IGNORED file, which no git status would ever show ----------------
#
# The copy is a filesystem operation, so .gitignore does not apply to it: an
# ignored file under the overlay is copied into Chromium like any other. It is
# reported by NEITHER `git status --untracked-files=all` NOR `git diff HEAD`,
# which is asserted here rather than assumed — it is the whole reason this gate
# compares against HEAD's tree instead of reading git status, and a future
# rewrite to the obvious `git status` implementation must fail this case.

IGNORED_REL="chrome/browser/oxy/oxy_generated.gen.cc"
printf '// generated, ignored, never committed\n' > "$overlay/$IGNORED_REL"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ -n "$(git -C "$repo" status --porcelain --untracked-files=all -- src)" ]; then
    harness::fail "the fixture's ignored file is visible to git status; this case
      is no longer testing the shape it exists for"
fi

before="$(harness::manifest "$chromium")"

sync_overlay
harness::assert_nonzero_status "ignored file under the overlay"
# Classified as ignored, not untracked: being sent to a `git status` that
# prints nothing is worse than not being told at all.
assert_classified "ignored" "src/$IGNORED_REL"
harness::assert_tree_unchanged "$chromium" "$before"
harness::assert_file_missing "$chromium/$IGNORED_REL"

rm "$overlay/$IGNORED_REL"

# ==========================================================================
# Direction 4: a DELETED tracked overlay file refuses
#
# A deletion is invisible to any check that only looks at the files present on
# disk, and it changes what the build contains just as much as an addition.
# ==========================================================================

rm "$overlay/$ICON_REL"
before="$(harness::manifest "$chromium")"

sync_overlay
harness::assert_nonzero_status "tracked overlay file deleted locally"
assert_classified "deleted" "src/$ICON_REL"
harness::assert_tree_unchanged "$chromium" "$before"

printf '%s\n' "$ICON_COMMITTED" > "$overlay/$ICON_REL"

# ==========================================================================
# The override is real, scoped, and recorded
# ==========================================================================

printf '// LOCAL EDIT, never committed\n' > "$overlay/$SERVICE_REL"

sync_overlay ASTRO_ALLOW_DIRTY_OVERLAY=1
harness::assert_status 0 "explicit developer override"
harness::assert_output_contains "override:dirty-overlay" "structured override warning"
harness::assert_output_contains "NOT reproducible" "says what the override costs"
assert_classified "modified" "src/$SERVICE_REL"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if ! grep -qF -- "LOCAL EDIT" "$chromium/$SERVICE_REL"; then
    harness::fail "the override did not copy the working-tree content"
fi

cp "$manifest" "$tmp/manifest-dirty.json"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
python3 - "$tmp/manifest-dirty.json" "src/$SERVICE_REL" <<'PY' || exit 1
import json, sys
path, changed = sys.argv[1:3]
with open(path, encoding="utf-8") as handle:
    state = json.load(handle)["source_state"]
assert state["state"] == "dirty", state
assert state["clean"] is False, state
assert state["override"] is True, state
differences = {entry["overlay_path"]: entry["classification"] for entry in state["differences"]}
assert differences == {changed: "modified"}, differences
PY

# ==========================================================================
# Provenance records it, machine-readably
# ==========================================================================

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

# ==========================================================================
# CI must never set the override
# ==========================================================================

# build-safety.yml is excluded because it carries the guard itself: the name
# has to appear there for CI to check for it anywhere else.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if offenders="$(grep -rn 'ASTRO_ALLOW_DIRTY_OVERLAY' "$ASTRO_ROOT/.github" \
        | grep -v 'build-safety.yml')"; then
    harness::fail "a file under .github/ sets the dirty-overlay override:
$offenders"
fi

# The exclusion above is what makes this scan able to pass, so prove the guard
# it excludes actually exists, and that CI runs it.
#
# The match is on an EXECUTABLE line, not on the name appearing anywhere: the
# step carries a comment block explaining the override, so a bare name grep
# stays green after the guard itself is deleted. Mutation-testing confirmed it —
# dropping the override from the guard's loop left a name-only assertion
# passing.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if ! grep -qE '^[^#]*ASTRO_ALLOW_DIRTY_OVERLAY' \
        "$ASTRO_ROOT/.github/workflows/build-safety.yml"; then
    harness::fail "CI does not assert that the dirty-overlay override is unset:
      the name appears only in comments in .github/workflows/build-safety.yml,
      so nothing executable checks for it."
fi

# And that the scan can fail at all: a grep that matches nothing reads the same
# whether the tree is clean or the pattern is wrong.
mkdir -p "$tmp/probe-github/workflows"
cat > "$tmp/probe-github/workflows/release.yml" <<'PROBE'
name: probe
jobs:
  build:
    env:
      ASTRO_ALLOW_DIRTY_OVERLAY: 1
    steps:
      - run: tools/build.sh
PROBE

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if ! grep -rn 'ASTRO_ALLOW_DIRTY_OVERLAY' "$tmp/probe-github" \
        | grep -v 'build-safety.yml' > /dev/null; then
    harness::fail "the CI scan cannot detect a workflow that sets the override"
fi

harness::pass
