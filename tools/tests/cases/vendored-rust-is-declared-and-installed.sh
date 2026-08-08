#!/usr/bin/env bash
# The vendored Rust crates are a required build input, and the licence files
# Astro supplies to them are declared rather than improvised.
#
# Two failures sit behind this case, both measured.
#
# The first: everything `tools/vendor-adblock-rust.sh` writes into the Chromium
# checkout is UNTRACKED, so a `git reset --hard` plus `git clean -fd` — the
# ordinary way to get back to a known tree — silently removes all of it. Nothing
# noticed while the overlay had no build edge, because GN never loaded the
# overlay's BUILD.gn files at all; with the edge in place the hole surfaces as
#
#     ERROR at //chrome/browser/oxy/adblock/rs/BUILD.gn:25:5: Unable to load
#     ".../third_party/rust/adblock/v0_9/BUILD.gn".
#
# which reads as a defect in the overlay rather than as a step nobody ran. Same
# class as the WebUI bundles: an input produced by another step, absent without
# a word until the build is deep enough to trip over it.
#
# The second: `gnrt gen` refuses the WHOLE run when any vendored crate has no
# licence file, and thirteen of the fifty-five crates the adblock dependency
# pulls in publish none. The fix cannot be to write the text — a copyright line
# naming the wrong holder is a false claim shipped to every user, which is the
# same failure `tools/apply-branding.sh` already has a rule about. So the texts
# are taken verbatim from upstream at pinned commits and declared in
# `tools/vendor/rust-licenses.manifest`, and this case holds that declaration to
# the same standard as the other allowlists in the tree: strict in both
# directions, verified by content, and never vacuous.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

tmp="$(harness::tmpdir)"

MANIFEST="$ASTRO_ROOT/tools/vendor/rust-licenses.manifest"
LICENSES="$ASTRO_ROOT/tools/vendor/licenses"
DRIVER="$ASTRO_ROOT/tools/lib/vendor_licenses.py"

harness::assert_file_exists "$MANIFEST" "the licence manifest is committed"
harness::assert_file_exists "$DRIVER" "the licence installer is committed"

# --------------------------------------------------------------------------
# 1. build.sh refuses a checkout the vendoring step has not run against
# --------------------------------------------------------------------------

fake_root="$tmp/astro-root"
chromium="$tmp/chromium-src"
harness::make_build_root "$fake_root" "$chromium"

before="$(harness::manifest "$chromium")"

run_build() {
    harness::run env ASTRO_CHROMIUM_SRC="$chromium" ASTRO_SKIP_LOCK_VERIFY=1 \
        "$fake_root/tools/build.sh" Release linux --dry-run
}

# The control. Every refusal below is satisfied by a build.sh that refuses
# unconditionally, so the passing case runs first and has to name the check.
run_build
harness::assert_status 0 "dry run with the vendored crate present"
harness::assert_output_contains "every vendored Rust crate the overlay depends on is present" \
    "the check reports what it measured"

# Removing the crate must fail the build, before generation.
rm -rf "${chromium:?}/third_party/rust/adblock"

run_build
harness::assert_nonzero_status "missing vendored Rust crate"
harness::assert_output_contains "missing 1 vendored Rust crate" "refusal names the count"
harness::assert_output_contains "third_party/rust/adblock/v0_9" "refusal names the crate"
harness::assert_output_contains "tools/vendor-adblock-rust.sh" "refusal names the step to run"
# The refusal text names `gn gen` itself — it is telling the reader what would
# have happened instead — so the ordering is asserted on the step before it.
harness::assert_output_lacks "Syncing the Astro overlay" "must fail before the overlay sync"

harness::setup_run git -C "$chromium" checkout -- third_party/rust/adblock/v0_9/BUILD.gn

# And the requirement must be DERIVED from the overlay, not a hard-coded name.
# A list written here would go stale the day a second Rust dependency lands, and
# would go stale silently — the build would fail on the missing crate, not on
# the missing entry. Pointing the overlay at a crate that does not exist proves
# the derivation: a hard-coded check would have nothing to say about it.
rs_build="$fake_root/src/chrome/browser/oxy/adblock/rs/BUILD.gn"
printf 'rust_static_library("x") {\n  deps = [ "//third_party/rust/madeup/v9:lib" ]\n}\n' \
    > "$rs_build"

run_build
harness::assert_nonzero_status "an overlay dependency on a crate nobody vendored"
harness::assert_output_contains "third_party/rust/madeup/v9" "the requirement follows the overlay"

printf 'rust_static_library("adblock_engine_ffi") {\n  deps = [\n    "//third_party/rust/adblock/v0_9:lib",\n  ]\n}\n' \
    > "$rs_build"
harness::assert_tree_unchanged "$chromium" "$before"

# --------------------------------------------------------------------------
# 2. The committed manifest matches the committed licence texts
#
# This runs against the real repository rather than a fixture: the point is
# that the texts in tools/vendor/licenses/ are the ones the manifest says they
# are. A fixture cannot answer that.
# --------------------------------------------------------------------------

vendor="$tmp/vendor"
mkdir -p "$vendor"

# A vendor tree holding exactly the crates the manifest installs into, each
# shaped like the real thing: a Cargo.toml, no licence file.
while read -r crate; do
    mkdir -p "$vendor/$crate"
    printf 'license = "MIT"\n' > "$vendor/$crate/Cargo.toml"
done < <(sed 's/#.*//' "$MANIFEST" | awk '$1 == "install" { print $2 }')

run_driver() {
    harness::run python3 "$DRIVER" \
        --manifest "${1:-$MANIFEST}" --licenses-dir "$LICENSES" --vendor-dir "$vendor"
}

run_driver
harness::assert_status 0 "the committed manifest installs cleanly"
harness::assert_output_contains "none left without one" "the driver reports a complete tree"

installed_count="$(find "$vendor" -type f \( -name 'LICENSE' -o -name 'LICENSE-APACHE' \) | wc -l)"
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ "$installed_count" -lt 13 ]; then
    harness::fail "expected at least 13 licence files installed, got $installed_count"
fi

# Idempotent: a second run over an already-installed tree changes nothing and
# still passes. The vendoring script runs this on every invocation.
run_driver
harness::assert_status 0 "a second run over an installed tree"

# --------------------------------------------------------------------------
# 3. Each way the declaration can rot must fail, and say which
# --------------------------------------------------------------------------

# A crate the manifest does not cover. This is the one that catches the NEXT
# crate rather than the thirteen already known.
mkdir -p "$vendor/newcrate-v1"
printf 'license = "MIT"\n' > "$vendor/newcrate-v1/Cargo.toml"

run_driver
harness::assert_nonzero_status "a vendored crate with no licence and no record"
harness::assert_output_contains "newcrate-v1 has no licence file" "names the crate"
harness::assert_output_contains "Do not write" "refuses to have the text invented"

# A gnrt placeholder is not a crate and must not be demanded a licence: gnrt
# replaces removed crates with an empty stand-in, and treating those as real
# would make the check cry wolf on every vendoring run.
printf 'license = "MIT"\nis_placeholder = true\n' > "$vendor/newcrate-v1/Cargo.toml"
run_driver
harness::assert_status 0 "a gnrt placeholder needs no licence"
rm -rf "$vendor/newcrate-v1"

# A source whose bytes no longer match what the manifest recorded.
tampered="$tmp/tampered-licenses"
cp -R "$LICENSES" "$tampered"
printf 'Copyright (c) 2026 Somebody Else\n' >> "$tampered/convert-case/LICENSE"
harness::run python3 "$DRIVER" --manifest "$MANIFEST" --licenses-dir "$tampered" --vendor-dir "$vendor"
harness::assert_nonzero_status "a licence text that changed under its declaration"
harness::assert_output_contains "does not match its declared sha256" "names the failure"
harness::assert_output_contains "convert-case/LICENSE" "names the source"

# An install naming a source nobody declared.
bad="$tmp/undeclared-source.manifest"
{ cat "$MANIFEST"; printf 'install  ghost-v1  LICENSE  nowhere/LICENSE\n'; } > "$bad"
mkdir -p "$vendor/ghost-v1"
printf 'license = "MIT"\n' > "$vendor/ghost-v1/Cargo.toml"
run_driver "$bad"
harness::assert_nonzero_status "an install naming an undeclared source"
harness::assert_output_contains "undeclared source" "names the failure"
rm -rf "$vendor/ghost-v1"

# A source no install uses — a record left behind after its crate went away.
bad="$tmp/unused-source.manifest"
{
    cat "$MANIFEST"
    printf 'source  apache-2.0/LICENSE-APACHE-COPY  0000  https://example.invalid/\n'
} > "$bad"
run_driver "$bad"
harness::assert_nonzero_status "a source no install uses"
harness::assert_output_contains "no install uses it" "names the failure"

# An install whose crate is not in the checkout: stale, not skippable.
bad="$tmp/stale-install.manifest"
{ cat "$MANIFEST"; printf 'install  gone-v9  LICENSE  seahash/LICENSE\n'; } > "$bad"
run_driver "$bad"
harness::assert_nonzero_status "an install for a crate that is not vendored"
harness::assert_output_contains "names a vendor directory that is not in the" "names the failure"
harness::assert_output_contains "gone-v9" "names the stale record"

# A crate that has started shipping its own licence: Astro must stop supplying
# one rather than overwrite or duplicate it.
printf 'MIT, from upstream this time\n' > "$vendor/seahash-v3/LICENCE.md"
rm -f "$vendor/seahash-v3/LICENSE"
run_driver
harness::assert_nonzero_status "a crate that now ships its own licence"
harness::assert_output_contains "now ships its own licence" "names the failure"
rm -f "$vendor/seahash-v3/LICENCE.md"

# An empty manifest installs nothing and must not report success.
printf '# nothing here\n' > "$tmp/empty.manifest"
run_driver "$tmp/empty.manifest"
harness::assert_nonzero_status "an empty manifest"
harness::assert_output_contains "which is the one outcome" "the vacuity floor fires"

# And an empty vendor tree is a measurement of nothing, not a clean tree.
mkdir -p "$tmp/empty-vendor"
harness::run python3 "$DRIVER" --manifest "$MANIFEST" --licenses-dir "$LICENSES" \
    --vendor-dir "$tmp/empty-vendor"
harness::assert_nonzero_status "an empty vendor tree"
harness::assert_output_contains "Nothing was measured" "the vacuity floor fires"

# --------------------------------------------------------------------------
# 4. Every declared licence text is a real file with the sha256 claimed
#
# Read straight off the committed manifest, so a record added without its file
# fails here rather than at the next vendoring run on somebody else's machine.
# --------------------------------------------------------------------------

sources=0
while read -r path digest; do
    sources=$((sources + 1))
    harness::assert_file_exists "$LICENSES/$path" "declared licence text $path"
    measured="$(sha256sum "$LICENSES/$path" | cut -d' ' -f1)"
    HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
    if [ "$measured" != "$digest" ]; then
        harness::fail "$path: manifest says $digest, file is $measured"
    fi
done < <(sed 's/#.*//' "$MANIFEST" | awk '$1 == "source" { print $2, $3 }')

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ "$sources" -lt 5 ]; then
    harness::fail "parsed $sources source records from the manifest; the parse is broken"
fi

harness::pass
