#!/bin/bash
# Copyright 2026 Oxy. All rights reserved.
#
# Vendors the adblock-rust crate and its dependencies into the Chromium
# third_party/rust directory, and generates the corresponding BUILD.gn files.
#
# Prerequisites:
#   - Chromium source must be fetched (tools/fetch-chromium.sh)
#   - Chromium's gnrt tool must be available
#
# Usage:
#   tools/vendor-adblock-rust.sh

set -euo pipefail

ASTRO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHROMIUM_SRC="${ASTRO_ROOT}/chromium/src"

if [ ! -d "${CHROMIUM_SRC}" ]; then
    echo "Error: Chromium source not found at ${CHROMIUM_SRC}"
    echo "Run tools/fetch-chromium.sh first."
    exit 1
fi

echo "=== Astro: Vendoring adblock-rust ==="

# Step 1: Add adblock-rust to the Cargo.toml for third-party crates.
CARGO_TOML="${CHROMIUM_SRC}/third_party/rust/chromium_crates_io/Cargo.toml"

if grep -q "adblock" "${CARGO_TOML}" 2>/dev/null; then
    echo "adblock-rust already present in Cargo.toml"
else
    echo "Adding adblock-rust to ${CARGO_TOML}..."
    # Add the adblock dependency. We use v0.9 which is the latest stable
    # version compatible with our feature set.
    #
    # The exact insertion point may vary by Chromium version. We append
    # to the [dependencies] section.
    if grep -q "\[dependencies\]" "${CARGO_TOML}"; then
        # Add after the [dependencies] line
        sed -i '/\[dependencies\]/a adblock = { version = "0.9", default-features = false, features = ["full-regex-handling", "css-validation"] }' "${CARGO_TOML}"
        echo "Added adblock = \"0.9\" to Cargo.toml"
    else
        echo "Error: Could not find [dependencies] section in ${CARGO_TOML}"
        exit 1
    fi
fi

# Step 2: Vendor the crate and all transitive dependencies.
echo "Vendoring crates..."
cd "${CHROMIUM_SRC}"

# Use Chromium's gnrt tool to vendor crates.
# gnrt is typically at tools/crates/run_gnrt.py
GNRT="${CHROMIUM_SRC}/tools/crates/run_gnrt.py"

if [ ! -f "${GNRT}" ]; then
    echo "Error: gnrt tool not found at ${GNRT}"
    echo "This tool is part of Chromium's build system."
    exit 1
fi

echo "Running gnrt vendor..."
python3 "${GNRT}" vendor

# Step 3: Generate BUILD.gn files for all vendored crates.
echo "Running gnrt gen..."
python3 "${GNRT}" gen

echo ""
echo "=== adblock-rust vendored successfully ==="
echo ""
echo "Vendored crates are at: third_party/rust/chromium_crates_io/vendor/"
echo "Generated BUILD.gn files are at: third_party/rust/adblock/"
echo ""
echo "Next steps:"
echo "  1. Run tools/apply-patches.sh to apply all patches"
echo "  2. Run tools/build.sh to build Astro"
