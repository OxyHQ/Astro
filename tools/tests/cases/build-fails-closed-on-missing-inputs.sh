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
cp "$ASTRO_ROOT/tools/sync-sources.sh" "$fake_root/tools/"
cp "$ASTRO_ROOT/tools/generate-provenance.sh" "$fake_root/tools/"
cp "$ASTRO_ROOT/tools/overlay.allowlist" "$fake_root/tools/"
cp "$ASTRO_ROOT/tools/gclient.template" "$fake_root/tools/"
cp "$ASTRO_ROOT/browser.lock.schema.json" "$fake_root/"
mkdir -p "$fake_root/tools/lib"
cp "$ASTRO_ROOT/tools/lib/astro-common.sh" "$fake_root/tools/lib/"
cp "$ASTRO_ROOT/tools/lib/lock.py" "$fake_root/tools/lib/"

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

# build.sh gates on tools/sync-sources.sh --verify-only, which inspects every
# locked source, so the fixture's depot_tools and ungoogled trees have to be
# real checkouts sitting at the commits the lock names.
git -C "$fake_root/depot_tools" init --quiet --initial-branch=main
git -C "$fake_root/depot_tools" add -A
git -C "$fake_root/depot_tools" commit --quiet -m "depot_tools fixture"
git -C "$fake_root/depot_tools" checkout --quiet --detach HEAD

mkdir -p "$fake_root/.ungoogled-chromium"
printf 'patches\n' > "$fake_root/.ungoogled-chromium/README"
git -C "$fake_root/.ungoogled-chromium" init --quiet --initial-branch=main
git -C "$fake_root/.ungoogled-chromium" add -A
git -C "$fake_root/.ungoogled-chromium" commit --quiet -m "ungoogled fixture"
git -C "$fake_root/.ungoogled-chromium" checkout --quiet --detach HEAD

git -C "$chromium" checkout --quiet --detach HEAD

# A lock naming each fixture's own HEAD, so the revision gate is satisfied and
# the case can test what it is actually about: required build inputs.
write_matching_lock() {
    harness::write_lock "$fake_root/browser.lock.json" \
        "file://$chromium" "$(git -C "$chromium" rev-parse HEAD)" \
        "file://$fake_root/depot_tools" "$(git -C "$fake_root/depot_tools" rev-parse HEAD)" \
        "file://$fake_root/.ungoogled-chromium" "$(git -C "$fake_root/.ungoogled-chromium" rev-parse HEAD)"
}
write_matching_lock

# One real sync renders .gclient from the committed template, which the
# verify-only gate below then checks. Without it the gate would fail on
# configuration rather than on the build inputs this case is about.
env ASTRO_CHROMIUM_SRC="$chromium" "$fake_root/tools/sync-sources.sh" \
    --no-deps --lock "$fake_root/browser.lock.json" \
    --chromium-src "$chromium" \
    --depot-tools "$fake_root/depot_tools" \
    --ungoogled "$fake_root/.ungoogled-chromium" >/dev/null 2>&1

before="$(harness::manifest "$chromium")"

# --- Baseline: with every input present, the dry run validates and passes ---

harness::run env ASTRO_CHROMIUM_SRC="$chromium" \
    "$fake_root/tools/build.sh" Release linux --dry-run

harness::assert_status 0 "dry run with every required input present"
harness::assert_output_contains "Verifying source revisions" "the lock gate runs"
harness::assert_output_contains "all 5 bundles present" "webui bundle check ran"
harness::assert_output_contains "gn gen" "planned generation"
harness::assert_output_contains "gn check" "gn check is a required step"
harness::assert_output_lacks "gn was executed during a dry run" "dry run must not invoke gn"
harness::assert_tree_unchanged "$chromium" "$before"

# --- A missing WebUI bundle stops the build, before generation --------------

rm -rf "$fake_root/webui/settings/dist"

harness::run env ASTRO_CHROMIUM_SRC="$chromium" ASTRO_SKIP_LOCK_VERIFY=1 \
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

harness::run env ASTRO_CHROMIUM_SRC="$chromium" ASTRO_SKIP_LOCK_VERIFY=1 \
    "$fake_root/tools/build.sh" Release linux --dry-run

harness::assert_nonzero_status "WebUI bundle without index.html"
harness::assert_output_contains "no index.html" "refusal reason"

printf '<!doctype html>\n' > "$fake_root/webui/ntp/dist/index.html"

# --- Missing ad blocker filter lists stop the build -------------------------

rm -rf "$fake_root/src/chrome/browser/oxy/adblock/resources"

harness::run env ASTRO_CHROMIUM_SRC="$chromium" ASTRO_SKIP_LOCK_VERIFY=1 \
    "$fake_root/tools/build.sh" Release linux --dry-run

harness::assert_nonzero_status "missing ad blocker filter lists"
harness::assert_output_contains "ad blocker filter lists" "names the missing input"
harness::assert_output_lacks "gn gen" "must fail before build generation"

mkdir -p "$fake_root/src/chrome/browser/oxy/adblock/resources"
printf '! filter list\n' > "$fake_root/src/chrome/browser/oxy/adblock/resources/easylist.txt"

# --- A missing GN args file stops the build ---------------------------------

rm -f "$fake_root/gn_args/linux.gn"

harness::run env ASTRO_CHROMIUM_SRC="$chromium" ASTRO_SKIP_LOCK_VERIFY=1 \
    "$fake_root/tools/build.sh" Release linux --dry-run

harness::assert_nonzero_status "missing GN args file"
harness::assert_output_contains "GN args file for linux" "names the missing input"
harness::assert_output_lacks "gn gen" "must fail before build generation"

harness::assert_tree_unchanged "$chromium" "$before"

# --- The lock gate: a checkout off the locked revision stops the build -------
#
# This is the property that makes a stale self-hosted runner unable to ship a
# binary built from a commit nobody declared.

printf 'is_debug = false\n' > "$fake_root/gn_args/linux.gn"

# Point the lock at a commit the fixture is not on.
harness::write_lock "$fake_root/browser.lock.json" \
    "file://$chromium" "0000000000000000000000000000000000000001" \
    "file://$fake_root/depot_tools" "$(git -C "$fake_root/depot_tools" rev-parse HEAD)" \
    "file://$fake_root/.ungoogled-chromium" "$(git -C "$fake_root/.ungoogled-chromium" rev-parse HEAD)"

harness::run env ASTRO_CHROMIUM_SRC="$chromium" \
    "$fake_root/tools/build.sh" Release linux --dry-run
harness::assert_nonzero_status "build against a checkout off the locked revision"
harness::assert_output_contains "wrong commit" "refusal reason"
harness::assert_output_lacks "gn gen" "must fail before build generation"

# The override exists for bisecting upstream, and announces itself.
harness::run env ASTRO_CHROMIUM_SRC="$chromium" ASTRO_SKIP_LOCK_VERIFY=1 \
    "$fake_root/tools/build.sh" Release linux --dry-run
harness::assert_status 0 "explicit lock-verification override"
harness::assert_output_contains "override:skip-lock-verify" "structured override warning"

harness::pass
