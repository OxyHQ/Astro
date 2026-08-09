#!/usr/bin/env bash
# The guards see submodule content, and the fixture proves they had to learn to.
#
# gclient writes `diff.ignoreSubmodules = dirty` into chromium/src/.git/config,
# so `git status --porcelain` prints nothing at all for a submodule carrying
# modified or untracked content. Every "is this checkout pristine" answer in
# this repository was built on that command, and so every one of them answered
# "clean" over a tree still holding the last run's patches. Measured
# 2026-08-09: a reset that satisfied both the dirty-checkout guard and
# tools/check-upstream-delta.sh then died at ungoogled patch 12 of 112, because
# third_party/search_engines_data/resources/definitions/prepopulated_engines.json
# was already patched. Thirteen files in two submodules are exposed this way —
# the same thirteen the patch replay reads out of DEPS sub-repositories.
#
# Every case below runs against a REAL git submodule with that config line set,
# because a fixture without it would pass while the real checkout failed. The
# first assertion is the negative control: it proves the blindness is present
# in the fixture, so a guard that passes later has actually looked rather than
# been handed an easy tree.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

tmp="$(harness::tmpdir)"
SUBMODULE="third_party/search_engines_data/resources"
ENGINES="$SUBMODULE/definitions/prepopulated_engines.json"

# --------------------------------------------------------------------------
# The fixture reproduces the blindness
# --------------------------------------------------------------------------

blind="$tmp/blind"
harness::make_chromium_fixture "$blind"
harness::add_submodule_fixture "$blind" "$SUBMODULE" \
    "definitions/prepopulated_engines.json" '{ "name": "Google" }'

printf '{ "name": "No Search" }\n' > "$blind/$ENGINES"

# The control. If this ever starts printing something, the fixture has stopped
# reproducing a gclient checkout and every verdict below is about a tree the
# guards never had trouble with.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
blind_output="$(git -C "$blind" status --porcelain --untracked-files=all)"
if [ -n "$blind_output" ]; then
    harness::fail "fixture does not reproduce gclient's blindness: git status printed: $blind_output"
fi

# And the enumerator the guards now use names the FILE, not just the submodule.
# `--ignore-submodules=none` alone would report `third_party/…/resources` and
# nothing more, which no declaration in this repository is written in.
harness::run python3 "$ASTRO_ROOT/tools/lib/dirty_paths.py" "$blind"
harness::assert_status 0 "enumerating a checkout with a dirty submodule"
harness::assert_output_contains "$ENGINES" "names the modified file inside the submodule"

# --------------------------------------------------------------------------
# The pristine guard fails, and names it
#
# This is the guard the measured failure went through: apply-patches.sh asks
# for a pristine tree, was told yes, and applied a stack onto a tree that
# already carried part of it.
# --------------------------------------------------------------------------

patches="$tmp/patches"
mkdir -p "$patches"
harness::write_patch "$patches/001-a.patch" "net/net_util.cc" "namespace net {}" "namespace net { /* astro */ }"
printf '001-a.patch\n' > "$patches/series"

harness::run env ASTRO_CHROMIUM_SRC="$blind" ASTRO_PATCH_REPORT="$tmp/blind.json" \
    "$ASTRO_ROOT/tools/apply-patches.sh" astro --dest "$blind" --astro-patches "$patches"

harness::assert_nonzero_status "patching over a tree whose submodule is already patched"
harness::assert_output_contains "must be pristine" "the pristine guard fires"
harness::assert_output_contains "$ENGINES" "names the file inside the submodule"
harness::assert_output_contains "docs/recovery.mdx" "points at the reset procedure"

# Nothing was applied: the guard runs before the series does.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
grep -q 'astro' "$blind/net/net_util.cc" \
    && harness::fail "a patch was applied to a tree the guard was supposed to refuse"

# --------------------------------------------------------------------------
# Clean it, and the same command passes
#
# The other half of the mutation proof. A guard that refuses everything is not
# a guard either, and a submodule-aware enumeration that reported the fifty-two
# submodules of a real checkout as permanently dirty would be exactly that.
# --------------------------------------------------------------------------

harness::setup_run git -C "$blind/$SUBMODULE" checkout -- .

harness::run python3 "$ASTRO_ROOT/tools/lib/dirty_paths.py" "$blind"
harness::assert_status 0 "enumerating a checkout whose submodule is clean"
harness::assert_output_lacks "$SUBMODULE" "a clean submodule contributes no path"

harness::run env ASTRO_CHROMIUM_SRC="$blind" ASTRO_PATCH_REPORT="$tmp/clean.json" \
    "$ASTRO_ROOT/tools/apply-patches.sh" astro --dest "$blind" --astro-patches "$patches"

harness::assert_status 0 "patching a tree whose submodule is clean"
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
grep -q 'astro' "$blind/net/net_util.cc" \
    || harness::fail "the patch did not apply to a tree the guard accepted"

# --------------------------------------------------------------------------
# A .rej inside a submodule is a patch artifact like any other
#
# Only UNTRACKED artifacts count — Chromium ships 181 tracked `.orig` files —
# and untracked content inside a submodule is the shape `git status` was least
# willing to talk about.
# --------------------------------------------------------------------------

artifacts="$tmp/artifacts"
harness::make_chromium_fixture "$artifacts"
harness::add_submodule_fixture "$artifacts" "$SUBMODULE" \
    "definitions/prepopulated_engines.json" '{ "name": "Google" }'
printf '***rejected hunk***\n' > "$artifacts/$ENGINES.rej"

harness::run python3 "$ASTRO_ROOT/tools/lib/dirty_paths.py" "$artifacts" --untracked-only
harness::assert_status 0 "enumerating untracked paths inside a submodule"
harness::assert_output_contains "$ENGINES.rej" "names the artifact inside the submodule"

harness::run env ASTRO_CHROMIUM_SRC="$artifacts" ASTRO_PATCH_REPORT="$tmp/artifacts.json" \
    "$ASTRO_ROOT/tools/apply-patches.sh" astro --dest "$artifacts" --astro-patches "$patches"

harness::assert_nonzero_status "checkout containing a .rej inside a submodule"
harness::assert_output_contains "$ENGINES.rej" "the refusal names it"

# The post-application scan is the second, independent check on the same shape.
# Reaching it needs the pristine guard waved through, which is what the
# developer override is for.
harness::run env ASTRO_CHROMIUM_SRC="$artifacts" ASTRO_PATCH_REPORT="$tmp/artifacts2.json" \
    ASTRO_ALLOW_DIRTY_CHROMIUM=1 \
    "$ASTRO_ROOT/tools/apply-patches.sh" astro --dest "$artifacts" --astro-patches "$patches"

harness::assert_nonzero_status "artifact inside a submodule still present after application"
harness::assert_output_contains "Patch artifacts found" "post-application refusal reason"
harness::assert_output_contains "$ENGINES.rej" "the post-application scan names it too"

# --------------------------------------------------------------------------
# Attribution: a submodule file the patch report records is Astro's
#
# The point of descending to FILE level rather than stopping at the submodule
# directory. A coarse verdict would have to be refused on every patched tree or
# waved through wholesale; a file-level one is answered by the same report that
# answers for the other 3,900 paths, with no list of "submodule paths the
# series may write" anywhere.
# --------------------------------------------------------------------------

attributed="$tmp/attributed"
harness::make_chromium_fixture "$attributed"
harness::add_submodule_fixture "$attributed" "$SUBMODULE" \
    "definitions/prepopulated_engines.json" '{ "name": "Google" }'
harness::make_overlay_fixture "$tmp/overlay" "$tmp/overlay.allowlist"
mkdir -p "$tmp/no-patches"

printf '{ "name": "No Search" }\n' > "$attributed/$ENGINES"

harness::run env ASTRO_CHROMIUM_SRC="$attributed" \
    "$ASTRO_ROOT/tools/sync-overlay.sh" \
    --source "$tmp/overlay" --dest "$attributed" \
    --allowlist "$tmp/overlay.allowlist" --patches "$tmp/no-patches"

harness::assert_nonzero_status "overlay onto a tree whose submodule nothing accounts for"
harness::assert_output_contains "Astro did not write" "refusal reason"
harness::assert_output_contains "$ENGINES" "names the unattributable submodule file"

# The same tree, with a report claiming that exact path.
report="$ASTRO_REPORT_DIR/patch-report.json"
mkdir -p "$ASTRO_REPORT_DIR"
cat > "$report" <<EOF
{
  "outcome": "succeeded",
  "patches": [ { "name": "012-no-search.patch", "files": ["$ENGINES"] } ]
}
EOF

harness::run env ASTRO_CHROMIUM_SRC="$attributed" \
    "$ASTRO_ROOT/tools/sync-overlay.sh" \
    --source "$tmp/overlay" --dest "$attributed" \
    --allowlist "$tmp/overlay.allowlist" --patches "$tmp/no-patches"

harness::assert_status 0 "overlay onto a tree whose submodule change the report records"
harness::assert_output_contains "all attributable to Astro" "the attribution says so"

harness::pass
