#!/usr/bin/env bash
# The overlay is copied AFTER patches are applied, so an overlay file that
# overwrites a destination a patch also modifies silently reverts that patch
# and produces a partially patched tree.
#
# This is not hypothetical: in this repository the overlay's whole-file copy of
# chrome/browser/ui/webui/chrome_web_ui_configs.cc reverts four patches,
# including 054-adblock-webui-register.patch, so the adblock WebUI config is
# never registered in a build. See tools/overlay.allowlist.
#
# The collision must be declared on the allowlist entry. An undeclared one is
# a hard failure; a declared one proceeds with a loud structured warning.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

tmp="$(harness::tmpdir)"
chromium="$tmp/chromium-src"
overlay="$tmp/overlay"
patches="$tmp/patches"

harness::make_chromium_fixture "$chromium"

mkdir -p "$overlay/net" "$patches"
printf '// astro replacement\n' > "$overlay/net/net_util.cc"

# A patch that modifies the same destination the overlay overwrites.
cat > "$patches/900-touches-net-util.patch" <<'EOF'
diff --git a/net/net_util.cc b/net/net_util.cc
--- a/net/net_util.cc
+++ b/net/net_util.cc
@@ -1 +1,2 @@
 namespace net {}
+// patched by 900
EOF

before="$(harness::manifest "$chromium")"

# --- Undeclared collision: hard failure -------------------------------------

allowlist_a="$tmp/allowlist-a"
cat > "$allowlist_a" <<'EOF'
overwrite net/net_util.cc owner=test issue=4
EOF

harness::run env ASTRO_CHROMIUM_SRC="$chromium" \
    "$ASTRO_ROOT/tools/sync-overlay.sh" \
    --source "$overlay" --dest "$chromium" --allowlist "$allowlist_a" \
    --patches "$patches"

harness::assert_nonzero_status "undeclared overlay/patch collision"
harness::assert_output_contains "overwrites a destination that patches also modify" "refusal reason"
harness::assert_output_contains "900-touches-net-util.patch" "names the reverted patch"
harness::assert_output_contains "reverts those patches" "explains the consequence"
harness::assert_tree_unchanged "$chromium" "$before"

# --- Declared collision: proceeds, loudly -----------------------------------

allowlist_b="$tmp/allowlist-b"
cat > "$allowlist_b" <<'EOF'
overwrite net/net_util.cc owner=test issue=4 conflicts-with=900-touches-net-util.patch
EOF

harness::run env ASTRO_CHROMIUM_SRC="$chromium" \
    "$ASTRO_ROOT/tools/sync-overlay.sh" \
    --source "$overlay" --dest "$chromium" --allowlist "$allowlist_b" \
    --patches "$patches"

harness::assert_status 0 "declared overlay/patch collision"
harness::assert_output_contains "declared-collision:net/net_util.cc" "structured warning"
harness::assert_output_contains "900-touches-net-util.patch" "names the reverted patch"
harness::assert_files_identical "$overlay/net/net_util.cc" "$chromium/net/net_util.cc"

# --- A NEW collision on an entry that already declares one still fails ------

cat > "$patches/901-also-touches-net-util.patch" <<'EOF'
diff --git a/net/net_util.cc b/net/net_util.cc
--- a/net/net_util.cc
+++ b/net/net_util.cc
@@ -1 +1,2 @@
 namespace net {}
+// patched by 901
EOF

harness::run env ASTRO_CHROMIUM_SRC="$chromium" \
    "$ASTRO_ROOT/tools/sync-overlay.sh" \
    --source "$overlay" --dest "$chromium" --allowlist "$allowlist_b" \
    --patches "$patches"

harness::assert_nonzero_status "newly added collision on an entry declaring another"
harness::assert_output_contains "901-also-touches-net-util.patch" "names only the new patch"

harness::pass
