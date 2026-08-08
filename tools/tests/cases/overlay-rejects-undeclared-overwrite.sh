#!/usr/bin/env bash
# An overlay file that would replace a Chromium-tracked file must be declared
# as `overwrite`, with an owner and a removal issue. A file that quietly
# clobbers upstream while declared as ordinary Astro-owned content is refused.
#
# Also covers the inverse: an `overwrite` entry for a path Chromium does not
# track is wrong too, because it hides a real overwrite behind an exception
# that is not actually needed.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

tmp="$(harness::tmpdir)"
chromium="$tmp/chromium-src"
overlay="$tmp/overlay"
mkdir -p "$tmp/patches"

harness::make_chromium_fixture "$chromium"

# --- Undeclared overwrite of an upstream file -------------------------------

mkdir -p "$overlay/net"
printf '// astro replacement for an upstream file\n' > "$overlay/net/net_util.cc"

allowlist_a="$tmp/allowlist-a"
cat > "$allowlist_a" <<'EOF'
dir net
EOF

before="$(harness::manifest "$chromium")"

harness::run env ASTRO_CHROMIUM_SRC="$chromium" \
    "$ASTRO_ROOT/tools/sync-overlay.sh" \
    --source "$overlay" --dest "$chromium" --allowlist "$allowlist_a" \
    --patches "$tmp/patches"

harness::assert_nonzero_status "undeclared overwrite of a tracked upstream file"
harness::assert_output_contains "would overwrite a Chromium-tracked file" "refusal reason"
harness::assert_output_contains "net/net_util.cc" "offending path"
harness::assert_tree_unchanged "$chromium" "$before"

# --- overwrite declared for a path upstream does not track ------------------

overlay_b="$tmp/overlay-b"
mkdir -p "$overlay_b/chrome/browser/oxy"
printf '// astro-owned\n' > "$overlay_b/chrome/browser/oxy/oxy_auth_service.cc"

allowlist_b="$tmp/allowlist-b"
cat > "$allowlist_b" <<'EOF'
overwrite chrome/browser/oxy/oxy_auth_service.cc owner=test issue=4
EOF

harness::run env ASTRO_CHROMIUM_SRC="$chromium" \
    "$ASTRO_ROOT/tools/sync-overlay.sh" \
    --source "$overlay_b" --dest "$chromium" --allowlist "$allowlist_b" \
    --patches "$tmp/patches"

harness::assert_nonzero_status "overwrite declared for an untracked path"
harness::assert_output_contains "Chromium does not track it" "refusal reason"
harness::assert_tree_unchanged "$chromium" "$before"

# --- overwrite entries require an owner and a removal issue -----------------

allowlist_c="$tmp/allowlist-c"
cat > "$allowlist_c" <<'EOF'
overwrite net/net_util.cc
EOF

harness::run env ASTRO_CHROMIUM_SRC="$chromium" \
    "$ASTRO_ROOT/tools/sync-overlay.sh" \
    --source "$overlay" --dest "$chromium" --allowlist "$allowlist_c" \
    --patches "$tmp/patches"

harness::assert_nonzero_status "overwrite entry without owner"
harness::assert_output_contains "require owner=" "refusal reason"
harness::assert_tree_unchanged "$chromium" "$before"

harness::pass
