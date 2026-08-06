#!/usr/bin/env bash
ASTRO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ASTRO_ROOT
# shellcheck source=tools/lib/astro-common.sh
source "$ASTRO_ROOT/tools/lib/astro-common.sh"
BUILD_DIR="${1:-$ASTRO_ROOT/chromium/src/out/Release}"
RELEASE_DIR="$ASTRO_ROOT/releases"
astro::require_file "$ASTRO_ROOT/VERSION" "VERSION file"
VERSION="$(cat "$ASTRO_ROOT/VERSION")"

echo "=== Packaging Astro $VERSION ==="

if [ ! -f "$BUILD_DIR/chrome" ]; then
    echo "ERROR: Build not found at $BUILD_DIR/chrome"
    echo "Run tools/build.sh first"
    exit 1
fi

mkdir -p "$RELEASE_DIR"

# Create tar.gz archive
ARCHIVE_NAME="astro-${VERSION}-linux-x64.tar.gz"
echo ">>> Creating $ARCHIVE_NAME..."

# The previous version ended in `2>/dev/null || true`, so a tar that failed
# outright — or that silently skipped every missing member — still printed
# "Package created". Required members are checked first; genuinely optional
# ones are collected only when present, and their absence is reported.
REQUIRED_MEMBERS=(chrome chrome_sandbox chrome_crashpad_handler icudtl.dat)
OPTIONAL_MEMBERS=(locales resources MEIPreload adblock_resources)

MEMBERS=()
for member in "${REQUIRED_MEMBERS[@]}"; do
    astro::require_file "$BUILD_DIR/$member" "release artifact"
    MEMBERS+=("$member")
done

for pattern in '*.so' '*.pak' '*.dat' '*.bin'; do
    matched=0
    for candidate in "$BUILD_DIR"/$pattern; do
        if [ -e "$candidate" ]; then
            MEMBERS+=("$(basename "$candidate")")
            matched=1
        fi
    done
    if [ "$matched" -eq 0 ]; then
        astro::warn "optional:archive-members" "no files matched $pattern"
    fi
done

for member in "${OPTIONAL_MEMBERS[@]}"; do
    if [ -d "$BUILD_DIR/$member" ]; then
        MEMBERS+=("$member/")
    else
        astro::warn "optional:archive-members" "not present, omitted: $member/"
    fi
done

# A release artifact must carry the exact source revisions, GN args and
# toolchain identity it was produced from (ASTRO-NEXT-002, #5).
astro::copy_required "$ASTRO_ROOT/build/reports/provenance.json" \
    "$BUILD_DIR/provenance.json" "build provenance (run tools/build.sh)"
MEMBERS+=("provenance.json")

( cd "$BUILD_DIR" && tar czf "$RELEASE_DIR/$ARCHIVE_NAME" "${MEMBERS[@]}" )
astro::require_file "$RELEASE_DIR/$ARCHIVE_NAME" "release archive"

astro::info "=== Package created ==="
astro::info "Archive: $RELEASE_DIR/$ARCHIVE_NAME"
astro::info "Size: $(du -h "$RELEASE_DIR/$ARCHIVE_NAME" | cut -f1)"
