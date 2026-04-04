#!/usr/bin/env bash
set -euo pipefail

ASTRO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHROMIUM_SRC="$ASTRO_ROOT/chromium/src"
PATCH_SET="${1:-all}"

echo "=== Applying Patches ==="

if [ ! -d "$CHROMIUM_SRC" ]; then
    echo "ERROR: Chromium source not found at $CHROMIUM_SRC"
    exit 1
fi

cd "$CHROMIUM_SRC"

apply_patch_dir() {
    local dir="$1"
    local name="$2"

    if [ ! -d "$dir" ]; then
        echo "SKIP: $name (directory not found: $dir)"
        return
    fi

    local count=$(find "$dir" -name "*.patch" 2>/dev/null | wc -l)
    if [ "$count" -eq 0 ]; then
        echo "SKIP: $name (no patches found)"
        return
    fi

    echo ""
    echo ">>> Applying $name patches ($count patches)..."

    for patch in $(find "$dir" -name "*.patch" | sort); do
        echo "  Applying: $(basename "$patch")"
        if ! git apply --check "$patch" 2>/dev/null; then
            echo "  WARNING: Patch may not apply cleanly, trying with 3-way merge..."
            git apply --3way "$patch" || {
                echo "  ERROR: Failed to apply $(basename "$patch")"
                echo "  You may need to resolve conflicts manually."
                return 1
            }
        else
            git apply "$patch"
        fi
    done

    echo "  Done: $name patches applied successfully"
}

case "$PATCH_SET" in
    ungoogled)
        apply_patch_dir "$ASTRO_ROOT/patches/ungoogled/core" "ungoogled-core"
        apply_patch_dir "$ASTRO_ROOT/patches/ungoogled/extra" "ungoogled-extra"
        ;;
    astro)
        apply_patch_dir "$ASTRO_ROOT/patches/astro" "astro"
        ;;
    all)
        apply_patch_dir "$ASTRO_ROOT/patches/ungoogled/core" "ungoogled-core"
        apply_patch_dir "$ASTRO_ROOT/patches/ungoogled/extra" "ungoogled-extra"
        apply_patch_dir "$ASTRO_ROOT/patches/astro" "astro"
        ;;
    *)
        echo "Usage: $0 [ungoogled|astro|all]"
        exit 1
        ;;
esac

echo ""
echo "=== Patches applied ==="
