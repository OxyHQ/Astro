#!/usr/bin/env bash
# A patch must apply exactly or not at all.
#
# The old runner tried, in order: `git apply`, then `git apply --3way`, then
# `patch -p1 -F3`, then `patch -p1 -F10`. Each fallback produces a tree that
# is not what the reviewed patch describes — a merge git invented, or a hunk
# planted up to ten lines away from the context it was written against.
#
# Each half of this case first PROVES the removed fallback would have
# succeeded on the fixture, then asserts the runner refuses anyway. Without
# that first step the case could pass against a patch that simply cannot be
# applied by any means, and would not be testing the removal at all.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

tmp="$(harness::tmpdir)"

# --------------------------------------------------------------------------
# Fuzz
# --------------------------------------------------------------------------

fuzz_src="$tmp/fuzz-src"
harness::make_chromium_fixture "$fuzz_src"

target="$fuzz_src/net/net_util.cc"
cat > "$target" <<'EOF'
// line 1
// line 2
// line 3
int Original() { return 0; }
// line 5
// line 6
// line 7
EOF
git -C "$fuzz_src" add -A
git -C "$fuzz_src" commit --quiet -m "fuzz base"

fuzz_patches="$tmp/fuzz-patches"
mkdir -p "$fuzz_patches"
cat > "$fuzz_patches/001-drifted.patch" <<'EOF'
diff --git a/net/net_util.cc b/net/net_util.cc
--- a/net/net_util.cc
+++ b/net/net_util.cc
@@ -1,7 +1,7 @@
 // line 1
 // line 2
 // line 3
-int Original() { return 0; }
+int Patched() { return 1; }
 // line 5
 // line 6
 // line 7
EOF
printf '001-drifted.patch\n' > "$fuzz_patches/series"

# Drift the context so exact application is impossible.
sed -i 's|// line 2|// line 2 (edited upstream)|' "$target"
git -C "$fuzz_src" add -A
git -C "$fuzz_src" commit --quiet -m "context drift"

# Premise: exact application fails, but `patch -F3` succeeds. If this premise
# ever stops holding the case must be rebuilt, not quietly weakened.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 2))
git -C "$fuzz_src" apply --check "$fuzz_patches/001-drifted.patch" 2>/dev/null \
    && harness::fail "premise broken: patch applies exactly, so it cannot test fuzz"
( cd "$fuzz_src" && patch -p1 --dry-run --forward -F3 < "$fuzz_patches/001-drifted.patch" >/dev/null 2>&1 ) \
    || harness::fail "premise broken: 'patch -F3' cannot apply it either"

harness::run env ASTRO_CHROMIUM_SRC="$fuzz_src" ASTRO_PATCH_REPORT="$tmp/fuzz-report.json" \
    "$ASTRO_ROOT/tools/apply-patches.sh" astro \
    --dest "$fuzz_src" --astro-patches "$fuzz_patches"

harness::assert_nonzero_status "patch that only applies with fuzz"
harness::assert_output_contains "does not apply exactly" "refusal reason"
harness::assert_output_contains "001-drifted.patch" "names the patch"
harness::assert_output_lacks "FUZZ" "no fuzzy application path remains"

# The tree was not modified by the refused patch.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
grep -q "int Original()" "$target" || harness::fail "target was modified despite refusal"

# --------------------------------------------------------------------------
# Three-way merge
# --------------------------------------------------------------------------

tw_src="$tmp/threeway-src"
harness::make_chromium_fixture "$tw_src"

tw_target="$tw_src/net/net_util.cc"
printf 'alpha\nbravo\ncharlie\n' > "$tw_target"
git -C "$tw_src" add -A
git -C "$tw_src" commit --quiet -m "threeway base"

# Build the patch with `git diff` so it carries the index line that lets
# `git apply --3way` find the pre-image blob.
printf 'alpha\nBRAVO-PATCHED\ncharlie\n' > "$tw_target"
tw_patches="$tmp/threeway-patches"
mkdir -p "$tw_patches"
git -C "$tw_src" diff > "$tw_patches/001-threeway.patch"
printf '001-threeway.patch\n' > "$tw_patches/series"

# Restore, then change a different line so exact application fails while a
# three-way merge still resolves.
git -C "$tw_src" checkout --quiet -- net/net_util.cc
printf 'ALPHA-LOCAL\nbravo\ncharlie\n' > "$tw_target"
git -C "$tw_src" add -A
git -C "$tw_src" commit --quiet -m "divergent edit"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 2))
git -C "$tw_src" apply --check "$tw_patches/001-threeway.patch" 2>/dev/null \
    && harness::fail "premise broken: patch applies exactly, so it cannot test --3way"
git -C "$tw_src" apply --check --3way "$tw_patches/001-threeway.patch" 2>/dev/null \
    || harness::fail "premise broken: '--3way' cannot apply it either"

harness::run env ASTRO_CHROMIUM_SRC="$tw_src" ASTRO_PATCH_REPORT="$tmp/tw-report.json" \
    "$ASTRO_ROOT/tools/apply-patches.sh" astro \
    --dest "$tw_src" --astro-patches "$tw_patches"

harness::assert_nonzero_status "patch that only applies via three-way merge"
harness::assert_output_contains "does not apply exactly" "refusal reason"
harness::assert_output_contains "no three-way merge is attempted" "states the design rule"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
grep -q "ALPHA-LOCAL" "$tw_target" || harness::fail "local content lost"
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
grep -q "BRAVO-PATCHED" "$tw_target" && harness::fail "patch was applied despite refusal"

harness::pass
