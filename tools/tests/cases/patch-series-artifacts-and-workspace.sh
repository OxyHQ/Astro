#!/usr/bin/env bash
# Three remaining patch-runner guarantees:
#
#   * order comes from a declared series that must agree with the directory in
#     both directions, not from `find | sort`;
#   * .rej / .orig artifacts left by a partial application fail the run;
#   * a checkout carrying unrelated developer work is refused, and the
#     developer-only override is the single way past it.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

tmp="$(harness::tmpdir)"

make_base() {
    local dir="$1"
    harness::make_chromium_fixture "$dir"
    printf 'alpha\n' > "$dir/net/net_util.cc"
    git -C "$dir" add -A
    git -C "$dir" commit --quiet -m "base"
}

# --------------------------------------------------------------------------
# Series must match the directory, in both directions
# --------------------------------------------------------------------------

src_a="$tmp/src-a"
make_base "$src_a"
patches_a="$tmp/patches-a"
mkdir -p "$patches_a"
harness::write_patch "$patches_a/001-a.patch" "net/net_util.cc" "alpha" "bravo"
harness::write_patch "$patches_a/002-undeclared.patch" "net/net_util.cc" "bravo" "charlie"
printf '001-a.patch\n' > "$patches_a/series"

harness::run env ASTRO_CHROMIUM_SRC="$src_a" ASTRO_PATCH_REPORT="$tmp/a.json" \
    "$ASTRO_ROOT/tools/apply-patches.sh" astro --dest "$src_a" --astro-patches "$patches_a"

harness::assert_nonzero_status "patch on disk absent from the series"
harness::assert_output_contains "does not declare" "refusal reason"
harness::assert_output_contains "002-undeclared.patch" "names the undeclared patch"
harness::assert_output_contains "not a property of the filesystem" "states the design rule"

# Nothing was applied: validation runs before application.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
grep -q "alpha" "$src_a/net/net_util.cc" || harness::fail "tree modified despite refusal"

# The inverse: a series entry with no file behind it.
src_b="$tmp/src-b"
make_base "$src_b"
patches_b="$tmp/patches-b"
mkdir -p "$patches_b"
harness::write_patch "$patches_b/001-a.patch" "net/net_util.cc" "alpha" "bravo"
printf '001-a.patch\n099-vanished.patch\n' > "$patches_b/series"

harness::run env ASTRO_CHROMIUM_SRC="$src_b" ASTRO_PATCH_REPORT="$tmp/b.json" \
    "$ASTRO_ROOT/tools/apply-patches.sh" astro --dest "$src_b" --astro-patches "$patches_b"

harness::assert_nonzero_status "series entry with no patch file"
harness::assert_output_contains "099-vanished.patch" "names the missing patch"
harness::assert_output_contains "Refusing to apply a partial stack" "refusal reason"

# --------------------------------------------------------------------------
# .rej / .orig artifacts fail the run
# --------------------------------------------------------------------------

src_c="$tmp/src-c"
make_base "$src_c"
patches_c="$tmp/patches-c"
mkdir -p "$patches_c"
harness::write_patch "$patches_c/001-a.patch" "net/net_util.cc" "alpha" "bravo"
printf '001-a.patch\n' > "$patches_c/series"

# An artifact left behind by an earlier, partially applied run.
printf '***rejected hunk***\n' > "$src_c/net/net_util.cc.rej"
git -C "$src_c" add -A
git -C "$src_c" commit --quiet -m "leftover artifact"

harness::run env ASTRO_CHROMIUM_SRC="$src_c" ASTRO_PATCH_REPORT="$tmp/c.json" \
    "$ASTRO_ROOT/tools/apply-patches.sh" astro --dest "$src_c" --astro-patches "$patches_c"

harness::assert_nonzero_status "checkout containing a .rej artifact"
harness::assert_output_contains "Patch artifacts found" "refusal reason"
harness::assert_output_contains "net_util.cc.rej" "names the artifact"
harness::assert_output_contains "applied partially" "explains the consequence"

# --------------------------------------------------------------------------
# Unrelated developer work is preserved, not patched over
# --------------------------------------------------------------------------

src_d="$tmp/src-d"
make_base "$src_d"
patches_d="$tmp/patches-d"
mkdir -p "$patches_d"
harness::write_patch "$patches_d/001-a.patch" "net/net_util.cc" "alpha" "bravo"
printf '001-a.patch\n' > "$patches_d/series"

printf 'work in progress\n' > "$src_d/net/developer_scratch.cc"

harness::run env ASTRO_CHROMIUM_SRC="$src_d" ASTRO_PATCH_REPORT="$tmp/d.json" \
    "$ASTRO_ROOT/tools/apply-patches.sh" astro --dest "$src_d" --astro-patches "$patches_d"

harness::assert_nonzero_status "checkout with unrelated developer work"
harness::assert_output_contains "must be pristine" "refusal reason"
harness::assert_output_contains "net/developer_scratch.cc" "names the developer's file"
harness::assert_output_contains "ASTRO_ALLOW_DIRTY_CHROMIUM=1" "names the override"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 2))
grep -q "work in progress" "$src_d/net/developer_scratch.cc" \
    || harness::fail "developer's file was modified"
grep -q "alpha" "$src_d/net/net_util.cc" || harness::fail "tree patched despite refusal"

# The override works, and is the only way past.
harness::run env ASTRO_CHROMIUM_SRC="$src_d" ASTRO_PATCH_REPORT="$tmp/d2.json" \
    ASTRO_ALLOW_DIRTY_CHROMIUM=1 \
    "$ASTRO_ROOT/tools/apply-patches.sh" astro --dest "$src_d" --astro-patches "$patches_d"

harness::assert_status 0 "explicit developer override"
harness::assert_output_contains "override:dirty-chromium" "structured override warning"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 2))
grep -q "bravo" "$src_d/net/net_util.cc" || harness::fail "patch not applied under override"
grep -q "work in progress" "$src_d/net/developer_scratch.cc" \
    || harness::fail "developer's file lost under override"

harness::pass
