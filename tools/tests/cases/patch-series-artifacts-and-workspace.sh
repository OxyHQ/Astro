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

# An artifact left behind by an earlier, partially applied run. It is left
# UNTRACKED on purpose: that is what a real .rej is, and it is the property the
# check keys on. Chromium itself tracks 181 `.orig` files — cargo writes
# `Cargo.toml.orig` for every vendored Rust crate — so a check that flagged
# tracked artifacts would condemn a pristine upstream checkout.
printf '***rejected hunk***\n' > "$src_c/net/net_util.cc.rej"

# An artifact present BEFORE the run is caught by the pristine-tree guard,
# because an untracked file is exactly what that guard exists to notice.
harness::run env ASTRO_CHROMIUM_SRC="$src_c" ASTRO_PATCH_REPORT="$tmp/c.json" \
    "$ASTRO_ROOT/tools/apply-patches.sh" astro --dest "$src_c" --astro-patches "$patches_c"

harness::assert_nonzero_status "checkout containing a .rej artifact"
harness::assert_output_contains "must be pristine" "the pristine guard fires first"
harness::assert_output_contains "net_util.cc.rej" "names the artifact"

# The post-application artifact scan covers the other case: an artifact that
# appears DURING the run. Bypassing the pristine guard with the developer
# override is what lets execution reach it, so this asserts the second check
# independently rather than assuming the first one covers both.
harness::run env ASTRO_CHROMIUM_SRC="$src_c" ASTRO_PATCH_REPORT="$tmp/c2.json" \
    ASTRO_ALLOW_DIRTY_CHROMIUM=1 \
    "$ASTRO_ROOT/tools/apply-patches.sh" astro --dest "$src_c" --astro-patches "$patches_c"

harness::assert_nonzero_status "artifact still present after application"
harness::assert_output_contains "Patch artifacts found" "post-application refusal reason"
harness::assert_output_contains "net_util.cc.rej" "names the artifact"
harness::assert_output_contains "applied partially" "explains the consequence"

# A TRACKED .orig must NOT be treated as an artifact: Chromium ships 181 of
# them. Without this, a pristine upstream checkout is condemned on sight.
src_c2="$tmp/src-c2"
make_base "$src_c2"
mkdir -p "$src_c2/third_party/vendored"
printf '[package]\n' > "$src_c2/third_party/vendored/Cargo.toml.orig"
git -C "$src_c2" add -A
git -C "$src_c2" commit --quiet -m "upstream ships a tracked .orig"

harness::run env ASTRO_CHROMIUM_SRC="$src_c2" ASTRO_PATCH_REPORT="$tmp/c3.json" \
    "$ASTRO_ROOT/tools/apply-patches.sh" astro --dest "$src_c2" --astro-patches "$patches_c"

harness::assert_status 0 "a tracked upstream .orig is not a patch artifact"
harness::assert_output_contains "none found" "the artifact scan came back clean"

# --------------------------------------------------------------------------
# After application, every changed path must be one the run recorded
# --------------------------------------------------------------------------

src_e="$tmp/src-e"
make_base "$src_e"
patches_e="$tmp/patches-e"
mkdir -p "$patches_e"
harness::write_patch "$patches_e/001-a.patch" "net/net_util.cc" "alpha" "bravo"
printf '001-a.patch\n' > "$patches_e/series"

# A clean run: the only changed path is the one the patch declared.
harness::run env ASTRO_CHROMIUM_SRC="$src_e" ASTRO_PATCH_REPORT="$tmp/e.json" \
    "$ASTRO_ROOT/tools/apply-patches.sh" astro --dest "$src_e" --astro-patches "$patches_e"

harness::assert_status 0 "run whose every change is accounted for"
harness::assert_output_contains "Verifying every change is accounted for" "post-run check ran"
harness::assert_output_contains "all attributable to Astro" "attribution result"

# Now a patch that writes a file it never declares in its headers — the shape
# a stray artifact or a hunk landing under an unexpected name would take.
src_f="$tmp/src-f"
make_base "$src_f"
patches_f="$tmp/patches-f"
mkdir -p "$patches_f"
cat > "$patches_f/001-adds-undeclared.patch" <<'EOF'
diff --git a/net/net_util.cc b/net/net_util.cc
--- a/net/net_util.cc
+++ b/net/net_util.cc
@@ -1 +1 @@
-alpha
+bravo
EOF
printf '001-adds-undeclared.patch\n' > "$patches_f/series"

# Simulate the stray file appearing during the run by planting it first; the
# pristine guard is satisfied because it is committed, and it only becomes
# unaccounted-for once the patch modifies it below.
printf 'stray\n' > "$src_f/net/stray_artifact.cc"
git -C "$src_f" add -A
git -C "$src_f" commit --quiet -m "committed stray"
printf 'modified out of band\n' >> "$src_f/net/stray_artifact.cc"

harness::run env ASTRO_CHROMIUM_SRC="$src_f" ASTRO_PATCH_REPORT="$tmp/f.json" \
    ASTRO_ALLOW_DIRTY_CHROMIUM=1 \
    "$ASTRO_ROOT/tools/apply-patches.sh" astro --dest "$src_f" --astro-patches "$patches_f"

# The override lets the run start, but the post-application check still reports
# the unaccounted path rather than passing it off as patched content.
harness::assert_output_contains "net/stray_artifact.cc" "names the unaccounted path"

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
