#!/usr/bin/env bash
# Copyright 2026 Oxy. All rights reserved.
#
# vendor-adblock-rust.sh — fetch the Rust ad blocker's crates into the Chromium
# checkout and generate the BUILD.gn files the overlay's Rust target depends on.
#
# WHERE THIS SITS IN THE PIPELINE
#
#     tools/sync-sources.sh        # check out every source at its locked commit
#     tools/apply-patches.sh       # requires a PRISTINE checkout
#     tools/vendor-adblock-rust.sh # <- here
#     tools/sync-overlay.sh
#     tools/build.sh
#
# After patching, not before: apply-patches.sh refuses a checkout carrying
# changes it cannot attribute, and this step leaves ~1,500 untracked files
# behind. The old footer of this script told the reader to run apply-patches
# next, which is an order the pipeline rejects.
#
# WHAT IT WRITES, AND WHY THAT NEEDS A RECORD
#
# Everything this step produces is UNTRACKED in the Chromium checkout — the
# vendored crate trees, the generated BUILD.gn and README.chromium files — plus
# two tracked files gnrt rewrites (`Cargo.toml`, `Cargo.lock`). Every later step
# guards the checkout with astro::require_attributable_chromium, which refuses
# any modified path Astro cannot show it wrote. So this script records its
# footprint in build/reports/vendor-report.json, and those steps read it.
# Without that record, sync-overlay.sh refuses the very tree this script just
# produced — measured, not hypothetical: 1,460 unattributable paths.
#
# Usage:
#   tools/vendor-adblock-rust.sh [--chromium-src PATH]

ASTRO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ASTRO_ROOT
# shellcheck source=tools/lib/astro-common.sh
source "$ASTRO_ROOT/tools/lib/astro-common.sh"

CHROMIUM_SRC_ARG=""
while [ $# -gt 0 ]; do
    case "$1" in
        --chromium-src) CHROMIUM_SRC_ARG="$2"; shift 2 ;;
        -h|--help)
            printf 'Usage: tools/vendor-adblock-rust.sh [--chromium-src PATH]\n'
            exit 0
            ;;
        *) astro::die "Unknown argument: $1" ;;
    esac
done

astro::require_cmd python3 git

astro::resolve_chromium_src "$CHROMIUM_SRC_ARG"
CHROMIUM_SRC="$ASTRO_RESOLVED_CHROMIUM_SRC"

GNRT="$CHROMIUM_SRC/tools/crates/run_gnrt.py"
astro::require_file "$GNRT" "Chromium's gnrt driver"

CARGO_TOML="$CHROMIUM_SRC/third_party/rust/chromium_crates_io/Cargo.toml"
astro::require_file "$CARGO_TOML" "Chromium's third-party crate manifest"

# The tree gnrt generates, relative to the checkout root: the crate sources it
# downloads and the BUILD.gn / README.chromium files it writes beside them.
VENDOR_ROOT="third_party/rust"
VENDOR_DIR="$CHROMIUM_SRC/$VENDOR_ROOT/chromium_crates_io/vendor"
LICENSE_MANIFEST="$ASTRO_ROOT/tools/vendor/rust-licenses.manifest"
LICENSE_DIR="$ASTRO_ROOT/tools/vendor/licenses"
LICENSE_DRIVER="$ASTRO_ROOT/tools/lib/vendor_licenses.py"
astro::require_file "$LICENSE_MANIFEST" "vendored-crate licence manifest"
astro::require_dir "$LICENSE_DIR" "vendored-crate licence texts"
astro::require_file "$LICENSE_DRIVER" "vendored-crate licence installer"

REPORT_DIR="$(astro::report_dir)"
VENDOR_REPORT="$REPORT_DIR/vendor-report.json"

astro::info "=== Astro: vendoring the Rust ad blocker ==="
astro::info "Checkout: $CHROMIUM_SRC"

# --------------------------------------------------------------------------
# The tree as it stands before this step touches it
#
# The footprint recorded at the end is the difference between this and the tree
# afterwards, so that a re-run neither loses the previous run's record nor
# claims the patch stack's changes as its own.
# --------------------------------------------------------------------------

VENDOR_TMPDIR="$(mktemp -d)"
trap 'rm -rf "$VENDOR_TMPDIR"' EXIT
BEFORE_FILE="$VENDOR_TMPDIR/dirty-before.txt"
AFTER_FILE="$VENDOR_TMPDIR/dirty-after.txt"

astro::info ">>> Recording the checkout state before vendoring..."
astro::_dirty_paths "$CHROMIUM_SRC" > "$BEFORE_FILE"

# --------------------------------------------------------------------------
# The dependency
#
# A caret range, resolved by Cargo. browser.lock.json records that this step
# pins nothing and why (third_party.adblock_rust, issue #5); do not "fix" that
# here without changing the lock in the same commit.
# --------------------------------------------------------------------------

if grep -q '^adblock = ' "$CARGO_TOML"; then
    astro::info "adblock is already declared in Cargo.toml"
else
    astro::info ">>> Adding the adblock dependency to Cargo.toml..."
    grep -q '^\[dependencies\]' "$CARGO_TOML" \
        || astro::die "No [dependencies] section in $CARGO_TOML"
    astro::run sed -i '/^\[dependencies\]/a adblock = { version = "0.9", default-features = false, features = ["full-regex-handling", "css-validation"] }' \
        "$CARGO_TOML"
fi

# --------------------------------------------------------------------------
# Fetch, install licences, fetch again
#
# The order is dictated by gnrt, and it is not the obvious one.
#
# `gnrt vendor` does two things in one command (tools/crates/gnrt/vendor.rs):
# `download_crates` fetches every crate whose vendor directory is absent or at
# the wrong version, and THEN `update_vendored_metadata` writes a
# `README.chromium` for each — which is where the licence check lives, and it
# fails the whole command over a single crate that published none.
#
# So on a tree that has not been vendored before, the first `gnrt vendor`
# ALWAYS stops there: the crates cannot be given their licence files until they
# have been downloaded, and downloading them is the same command that then
# refuses. The second pass skips every download (each crate is now at the right
# version) and reaches the metadata stage with the licences in place.
#
# Exactly that one failure is tolerated, and only after reading the output for
# it. A network failure, a resolution failure or a patch failure in the first
# pass must stop the run here rather than surface later as a licence record
# that "names a vendor directory that is not in the checkout".
# --------------------------------------------------------------------------

install_licenses() {
    python3 "$LICENSE_DRIVER" \
        --manifest "$LICENSE_MANIFEST" \
        --licenses-dir "$LICENSE_DIR" \
        --vendor-dir "$VENDOR_DIR" \
        --json "$REPORT_DIR/vendor-licenses.json"
}

VENDOR_LOG="$VENDOR_TMPDIR/gnrt-vendor.log"

astro::info ">>> Running gnrt vendor..."
vendor_status=0
( cd "$CHROMIUM_SRC" && python3 "$GNRT" vendor ) > "$VENDOR_LOG" 2>&1 || vendor_status=$?
cat "$VENDOR_LOG" >&2

if [ "$vendor_status" -ne 0 ]; then
    grep -q 'License file not found for crate' "$VENDOR_LOG" || astro::die_with_status \
        "$vendor_status" \
        "gnrt vendor failed for a reason this step cannot repair (see the output above)."
    astro::info "    stopped at the licence check, as expected on a freshly fetched tree"

    astro::info ">>> Installing licences for crates that publish none..."
    install_licenses

    astro::info ">>> Running gnrt vendor again..."
    ( cd "$CHROMIUM_SRC" && python3 "$GNRT" vendor )
else
    astro::info ">>> Verifying licences for crates that publish none..."
    install_licenses
fi

# --------------------------------------------------------------------------
# Generate
# --------------------------------------------------------------------------

astro::info ">>> Running gnrt gen..."
( cd "$CHROMIUM_SRC" && python3 "$GNRT" gen )

# The verdict, not the exit status: gnrt exiting 0 having written no BUILD.gn
# for the crate the overlay actually depends on is the failure this whole step
# exists to prevent, and it looks identical to success from outside.
astro::info ">>> Verifying the overlay's Rust dependencies are now present..."
astro::require_vendored_rust_deps "$CHROMIUM_SRC" "$ASTRO_ROOT/src/chrome/browser/oxy"

# --------------------------------------------------------------------------
# The footprint
# --------------------------------------------------------------------------

astro::info ">>> Recording what vendoring wrote..."
astro::_dirty_paths "$CHROMIUM_SRC" > "$AFTER_FILE"

python3 - "$BEFORE_FILE" "$AFTER_FILE" "$VENDOR_REPORT" "$VENDOR_ROOT" <<'PY'
import json
import pathlib
import sys

before_file, after_file, report_file = (pathlib.Path(argument) for argument in sys.argv[1:4])
vendor_root = sys.argv[4]

before = {line for line in before_file.read_text(encoding="utf-8").splitlines() if line}
after = {line for line in after_file.read_text(encoding="utf-8").splitlines() if line}

# What this run changed. On a tree that goes through the pipeline in order this
# is the whole footprint, and it excludes the patch stack's changes — which have
# their own report and must not be vouched for here.
written = after - before

# Plus everything still dirty inside gnrt's own output tree.
#
# Not a convenience: a vendoring run that fails part-way — and the first one on
# any tree fails part-way, at the licence check — leaves crates on disk that the
# NEXT run will not touch, because they are already at the right version. Their
# paths therefore appear in neither run's difference, and the tree ends up
# holding files no report accounts for. Measured: 1,460 of them, which is
# exactly the state that made sync-overlay.sh refuse the tree this script had
# just produced.
#
# The scope is what keeps this honest. `third_party/rust/` is generated: gnrt
# owns every file under it and rewrites them wholesale, so there is no developer
# work here for the attribution guard to protect — the next `gnrt vendor` would
# overwrite it either way. Nothing outside that prefix is claimed.
written |= {path for path in after if path == vendor_root or path.startswith(vendor_root + "/")}

report_file.write_text(
    json.dumps(
        {
            "step": "vendor-adblock-rust",
            "generated_tree": vendor_root,
            "files": sorted(written),
            "counts": {
                "written": len(written),
                "changed_by_this_run": len(after - before),
                "dirty_before": len(before),
                "dirty_after": len(after),
            },
        },
        indent=2,
    )
    + "\n",
    encoding="utf-8",
)

print(f"vendor-report: {len(written)} path(s) recorded, tree now has {len(after)} dirty path(s)")
PY

astro::info ""
astro::info "=== Vendoring complete ==="
astro::info "Vendored crates:  third_party/rust/chromium_crates_io/vendor/"
astro::info "Generated builds: third_party/rust/<crate>/<epoch>/BUILD.gn"
astro::info "Footprint record: $VENDOR_REPORT"
astro::info ""
astro::info "Next:  tools/sync-overlay.sh   then   tools/build.sh"
