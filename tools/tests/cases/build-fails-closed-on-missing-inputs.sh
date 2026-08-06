#!/usr/bin/env bash
# Every required build input must be checked before generation, and a missing
# one must stop the build with a non-zero exit.
#
# The old script warned about a missing WebUI bundle and carried on, producing
# a browser whose astro:// page rendered blank, and copied the ad blocker's
# filter lists only "if the directory exists" — without them the Rust engine
# holds no rules and every ShouldBlockRequest() returns false, so the ad
# blocker is a silent no-op in a binary that built and ran perfectly.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

tmp="$(harness::tmpdir)"
chromium="$tmp/chromium-src"
harness::make_chromium_fixture "$chromium"

# A minimal Astro repo layout the build script can be pointed at, so the real
# repository's own webui/ and gn_args/ are never touched by this case.
fake_root="$tmp/astro-root"
mkdir -p "$fake_root/tools" "$fake_root/gn_args" "$fake_root/depot_tools" \
         "$fake_root/src/chrome/browser/oxy/adblock/resources" \
         "$fake_root/patches"
cp "$ASTRO_ROOT/tools/build.sh" "$fake_root/tools/"
cp "$ASTRO_ROOT/tools/sync-overlay.sh" "$fake_root/tools/"
cp "$ASTRO_ROOT/tools/overlay.allowlist" "$fake_root/tools/"
mkdir -p "$fake_root/tools/lib"
cp "$ASTRO_ROOT/tools/lib/astro-common.sh" "$fake_root/tools/lib/"
printf 'is_debug = false\n' > "$fake_root/gn_args/linux.gn"
printf '! filter list\n' > "$fake_root/src/chrome/browser/oxy/adblock/resources/easylist.txt"

for page in ntp alia settings whats-new error; do
    mkdir -p "$fake_root/webui/$page/dist"
    printf '<!doctype html><title>%s</title>\n' "$page" > "$fake_root/webui/$page/dist/index.html"
done

# gn and autoninja must resolve, but must never actually run in a dry run.
cat > "$fake_root/depot_tools/gn" <<'EOF'
#!/usr/bin/env bash
echo "gn was executed during a dry run" >&2
exit 99
EOF
cp "$fake_root/depot_tools/gn" "$fake_root/depot_tools/autoninja"
chmod +x "$fake_root/depot_tools/gn" "$fake_root/depot_tools/autoninja"

before="$(harness::manifest "$chromium")"

# --- Baseline: with every input present, the dry run validates and passes ---

harness::run env ASTRO_CHROMIUM_SRC="$chromium" \
    "$fake_root/tools/build.sh" Release linux --dry-run

harness::assert_status 0 "dry run with every required input present"
harness::assert_output_contains "all 5 bundles present" "webui bundle check ran"
harness::assert_output_contains "gn gen" "planned generation"
harness::assert_output_contains "gn check" "gn check is a required step"
harness::assert_output_lacks "gn was executed during a dry run" "dry run must not invoke gn"
harness::assert_tree_unchanged "$chromium" "$before"

# --- A missing WebUI bundle stops the build, before generation --------------

rm -rf "$fake_root/webui/settings/dist"

harness::run env ASTRO_CHROMIUM_SRC="$chromium" \
    "$fake_root/tools/build.sh" Release linux --dry-run

harness::assert_nonzero_status "missing WebUI bundle"
harness::assert_output_contains "Required WebUI bundle missing" "refusal reason"
harness::assert_output_contains "webui/settings/dist" "names the missing bundle"
harness::assert_output_contains "would render blank" "explains the consequence"
harness::assert_output_lacks "gn gen" "must fail before build generation"
harness::assert_tree_unchanged "$chromium" "$before"

mkdir -p "$fake_root/webui/settings/dist"
printf '<!doctype html>\n' > "$fake_root/webui/settings/dist/index.html"

# --- A bundle directory without index.html is equally fatal -----------------

rm -f "$fake_root/webui/ntp/dist/index.html"

harness::run env ASTRO_CHROMIUM_SRC="$chromium" \
    "$fake_root/tools/build.sh" Release linux --dry-run

harness::assert_nonzero_status "WebUI bundle without index.html"
harness::assert_output_contains "no index.html" "refusal reason"

printf '<!doctype html>\n' > "$fake_root/webui/ntp/dist/index.html"

# --- Missing ad blocker filter lists stop the build -------------------------

rm -rf "$fake_root/src/chrome/browser/oxy/adblock/resources"

harness::run env ASTRO_CHROMIUM_SRC="$chromium" \
    "$fake_root/tools/build.sh" Release linux --dry-run

harness::assert_nonzero_status "missing ad blocker filter lists"
harness::assert_output_contains "ad blocker filter lists" "names the missing input"
harness::assert_output_lacks "gn gen" "must fail before build generation"

mkdir -p "$fake_root/src/chrome/browser/oxy/adblock/resources"
printf '! filter list\n' > "$fake_root/src/chrome/browser/oxy/adblock/resources/easylist.txt"

# --- A missing GN args file stops the build ---------------------------------

rm -f "$fake_root/gn_args/linux.gn"

harness::run env ASTRO_CHROMIUM_SRC="$chromium" \
    "$fake_root/tools/build.sh" Release linux --dry-run

harness::assert_nonzero_status "missing GN args file"
harness::assert_output_contains "GN args file for linux" "names the missing input"
harness::assert_output_lacks "gn gen" "must fail before build generation"

harness::assert_tree_unchanged "$chromium" "$before"

harness::pass
