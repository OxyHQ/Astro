#!/usr/bin/env bash
# The committed baseline must be what the tools produce today.
#
# This is the case that makes the rest of the baseline worth citing. Issue #6's
# closing criterion is "later issues can cite this baseline as their
# compatibility reference" — without a drift check that degrades to citing a
# snapshot nobody revalidated, which is worse than having no baseline at all,
# because it carries the authority of a document without the accuracy of one.
#
# And the drift check is only worth running if the generators are a function of
# something CI also has. They were not: they read the working tree, so a
# baseline generated on a machine carrying uncommitted work described a
# repository nobody else has, `--check` passed there, and a clean checkout
# regenerated different documents. The last section below is the regression
# test for that: it plants content in the working tree and proves not one byte
# of it reaches a committed document.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

GENERATE="$ASTRO_ROOT/tools/baseline/generate-all.sh"
BASELINE_DIR="$ASTRO_ROOT/docs/astro-next/baseline"
tmp="$(harness::tmpdir)"

# Working-tree files this case plants into, restored from a pristine byte copy
# on ANY exit. They are real repository files that may carry a developer's
# uncommitted work, so the restore is a trap rather than a line at the bottom,
# and it writes IN PLACE (`cat pristine > target`) rather than moving a file
# over the top, which would swap the inode.
PLANT_TARGETS=(
    "$ASTRO_ROOT/src/chrome/browser/oxy/webui/astro_alia_ui.cc"
    "$ASTRO_ROOT/patches/astro/001-branding-strings.patch"
    "$ASTRO_ROOT/gn_args/macos.gn"
)
PLANT_PRISTINE_DIR="$tmp/pristine-plants"

plant::restore() {
    local index target
    for index in "${!PLANT_TARGETS[@]}"; do
        target="${PLANT_TARGETS[$index]}"
        if [ -f "$PLANT_PRISTINE_DIR/$index" ]; then
            cat "$PLANT_PRISTINE_DIR/$index" > "$target"
        fi
    done
}
trap 'plant::restore; harness::teardown' EXIT

harness::assert_file_exists "$GENERATE"

# --- No plant ever reached the commit ----------------------------------------
#
# The restore above is a trap, so it survives a failed assertion and an
# interrupt. It does not survive SIGKILL or a machine going down, and both have
# happened: markers from this case have been committed three times now. Twice
# into baseline documents and the overlay controller, deleted in `ba1367e` and
# `c9c4383`; once into `patches/astro/001-branding-strings.patch`, where two
# planted hunk headers were swept in by `e564408` and made `git apply` reject
# the FIRST patch of the series as corrupt. `apply-patches.sh` uses `git apply
# --check` as its only acceptance test, so the whole patch pipeline stopped at
# patch one, and nothing said so — the leak is silent in every other check here.
#
# The question is asked of GIT, never of disk: this case plants these very
# strings into the working tree a few lines below, so a filesystem scan would
# report its own fixtures and could never be left enabled.
PLANTED_MARKERS=(
    "planted by the test suite"
    "AstroWorkingTreeMarker"
    "astro-worktree-marker.invalid"
    "astro_worktree_marker"
    "safe_browsing_mode = 99"
)

# This file is the one place the markers are allowed to appear, because it is
# where they are defined.
MARKER_SOURCE="tools/tests/cases/$(basename "${BASH_SOURCE[0]}")"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if ! git -C "$ASTRO_ROOT" ls-files --error-unmatch "$MARKER_SOURCE" >/dev/null 2>&1; then
    harness::fail "$MARKER_SOURCE is not tracked, so the scan below excludes a path that
      does not exist and would miss a marker planted in this file"
fi

for marker in "${PLANTED_MARKERS[@]}"; do
    # Vacuity guard: a marker this case no longer plants is a scan looking for
    # a string nothing can produce. Renaming a plant without renaming its entry
    # here would leave the gate green and blind, which is the failure shape it
    # exists to prevent.
    HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
    if [ "$(grep -cF -- "$marker" "${BASH_SOURCE[0]}")" -lt 2 ]; then
        harness::fail "'$marker' is declared in PLANTED_MARKERS but this case no longer
      plants it, so scanning for it proves nothing. Delete the entry, or restore
      the plant it belongs to."
    fi

    HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
    if leaked="$(git -C "$ASTRO_ROOT" grep -n --fixed-strings -- "$marker" HEAD \
            -- ':!'"$MARKER_SOURCE" 2>/dev/null)"; then
        harness::fail "content this case plants into the working tree is part of the commit:
$leaked

      It is a test fixture, never product state. Remove it, and if it landed in
      a patch, re-check that the patch still applies — a planted hunk header
      makes \`git apply\` reject the whole file as corrupt."
    fi
done

# The detector must fire. Built as a fixture rather than by mutating the
# repository, because the thing under test is "is this in the commit" and the
# only honest way to answer it positively is a commit that has it.
marker_fixture="$tmp/marker-fixture"
mkdir -p "$marker_fixture"
harness::setup_run git -C "$marker_fixture" init --quiet
printf 'planted by the test suite\n' > "$marker_fixture/leaked.txt"
harness::setup_run git -C "$marker_fixture" add -A
harness::setup_run git -C "$marker_fixture" -c user.email=t@t -c user.name=t \
    commit --quiet -m "a commit carrying a plant"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if ! git -C "$marker_fixture" grep -q --fixed-strings -- "planted by the test suite" HEAD; then
    harness::fail "the marker scan did not find a marker in a commit built to contain one;
      the scan is broken and its clean result above means nothing"
fi

# --- The committed documents are current -------------------------------------

harness::run "$GENERATE" --check
harness::assert_status 0 "the committed baseline matches what the tools produce"
harness::assert_output_contains "Baseline is current" "confirmation"

# --- Drift is detected -------------------------------------------------------
#
# Mutate a committed document and prove the check fails and names it. A drift
# check nobody has seen fail is indistinguishable from one that cannot.

TARGET="$BASELINE_DIR/platform-matrix.md"
harness::assert_file_exists "$TARGET"
cp "$TARGET" "$tmp/pristine-platform-matrix.md"

printf '\n<!-- deliberate drift planted by the test suite -->\n' >> "$TARGET"

harness::run "$GENERATE" --check
harness::assert_nonzero_status "a modified baseline document"
harness::assert_output_contains "out of date" "names the problem"
harness::assert_output_contains "platform-matrix.md" "names the document"
harness::assert_output_contains "compatibility reference" "explains why it matters"

# --- A failed check leaves the tree exactly as it found it -------------------
#
# --check has to be safe to run against a working tree carrying unrelated
# uncommitted work, so on failure it must restore what it FOUND — which here is
# the drifted file, not the regenerated one. Restoring the regenerated content
# would silently "fix" a developer's uncommitted edit, and a check that edits
# your working tree is a check you stop running.

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if ! grep -q 'deliberate drift planted by the test suite' "$TARGET"; then
    cp "$tmp/pristine-platform-matrix.md" "$TARGET"
    harness::fail "--check overwrote the working tree with regenerated content"
fi

# Now put the document back and confirm the tree is genuinely current again, so
# this case cannot leave a later run failing for a reason it created itself.
cp "$tmp/pristine-platform-matrix.md" "$TARGET"
harness::assert_files_identical "$tmp/pristine-platform-matrix.md" "$TARGET"

harness::run "$GENERATE" --check
harness::assert_status 0 "baseline is current again after the drift test"

# --- Every generated document declares its generator -------------------------
#
# A generated file that does not say so gets hand-edited, and the next --check
# reverts the edit with no explanation.

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
generated=0
while IFS= read -r document; do
    generated=$((generated + 1))
    if ! head -3 "$document" | grep -q 'Generated by tools/baseline/'; then
        harness::fail "$(basename "$document") does not declare which tool generates it"
    fi
done < <(grep -rl 'Generated by tools/baseline/' "$BASELINE_DIR")

if [ "$generated" -lt 4 ]; then
    harness::fail "only $generated generated document(s) found; expected the full set"
fi

# --- No committed document is derived from the working tree ------------------
#
# The bug this guards against: the generators read files off disk, so a baseline
# produced on a machine with uncommitted work embedded that work, `--check`
# passed there, and everyone else's clean checkout regenerated something else.
#
# Content is planted in three real, committed files that between them feed
# every generator: an overlay controller (source inventory byte counts, WebUI
# security directives, endpoint hosts), a patch (patch inventory hunk counts)
# and a GN args file (the platform matrix). Comparing the WHOLE baseline
# directory afterwards rather than grepping for the marker is the point: it
# catches a leaked count or size just as well as leaked text, and a marker
# string a future generator happens not to copy verbatim cannot make this pass
# vacuously.
#
# The GN plant is not decoration. Measured on this repository, uncommitted GN
# edits had put five findings into `platform-matrix.md` that do not exist in
# the committed tree — `safe_browsing_mode` and `build_with_tflite_lib` as keys
# whose value disagrees between platforms, and so on. Exactly the kind of thing
# a later issue cites as evidence.

mkdir -p "$PLANT_PRISTINE_DIR"
for index in "${!PLANT_TARGETS[@]}"; do
    harness::assert_file_exists "${PLANT_TARGETS[$index]}"
    cp "${PLANT_TARGETS[$index]}" "$PLANT_PRISTINE_DIR/$index"
done

baseline_before="$(harness::manifest "$BASELINE_DIR")"

# A controller edit: a new CSP directive, a remote origin, and a URL. Reading
# the working tree would put every one of them in a committed document.
cat >> "${PLANT_TARGETS[0]}" <<'PLANT'

// Planted by the test suite; must never reach a committed baseline document.
void AstroWorkingTreeMarker(content::WebUIDataSource* source) {
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::ImgSrc,
      "img-src https://astro-worktree-marker.invalid;");
}
PLANT

# A patch edit: one more hunk header, which the patch inventory counts.
cat >> "${PLANT_TARGETS[1]}" <<'PLANT'
@@ -1,1 +1,1 @@ planted by the test suite
PLANT

# A GN edit: a key set on one platform only, and a changed value on a key every
# platform shares. Reading the working tree would add both to the matrix, one
# as a "set on some platforms and not others" finding and one as a "value
# differs across platforms" finding.
cat >> "${PLANT_TARGETS[2]}" <<'PLANT'
astro_worktree_marker = true
safe_browsing_mode = 99
PLANT

harness::run "$GENERATE"
harness::assert_status 0 "regenerating with planted working-tree content"
harness::assert_tree_unchanged "$BASELINE_DIR" "$baseline_before"

# Belt and braces on the text itself, so a failure names the leak rather than
# only reporting that a checksum moved.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
for marker in 'astro-worktree-marker.invalid' 'astro_worktree_marker'; do
    if grep -rq "$marker" "$BASELINE_DIR"; then
        grep -rn "$marker" "$BASELINE_DIR" >&2
        harness::fail "working-tree content reached a committed baseline document"
    fi
done

# And the check still passes, which is what CI runs. If the generators read the
# working tree, this is the failure every other developer would have seen.
harness::run "$GENERATE" --check
harness::assert_status 0 "--check with unrelated uncommitted work in the tree"

# Restore byte-for-byte from the pristine copies — never with `git checkout`,
# which would discard whatever uncommitted work the target files already had.
plant::restore

for index in "${!PLANT_TARGETS[@]}"; do
    harness::assert_files_identical \
        "$PLANT_PRISTINE_DIR/$index" "${PLANT_TARGETS[$index]}"
done

harness::pass
