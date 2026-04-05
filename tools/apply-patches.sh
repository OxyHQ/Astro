#!/usr/bin/env bash
set -euo pipefail

ASTRO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHROMIUM_SRC="$ASTRO_ROOT/chromium/src"
UNGOOGLED_PATCHES="$ASTRO_ROOT/patches/ungoogled"
ASTRO_PATCHES="$ASTRO_ROOT/patches/astro"
PATCH_SET="${1:-all}"

echo "=== Astro Patch System ==="

if [ ! -d "$CHROMIUM_SRC" ]; then
    echo "ERROR: Chromium source not found at $CHROMIUM_SRC"
    exit 1
fi

cd "$CHROMIUM_SRC"

# --- Binary Pruning ---
# Removes pre-built binaries from the Chromium source tree
run_pruning() {
    local pruning_list="$UNGOOGLED_PATCHES/pruning.list"
    if [ ! -f "$pruning_list" ]; then
        echo "SKIP: No pruning list found"
        return
    fi

    echo ""
    echo ">>> Pruning pre-built binaries..."
    local count=0
    local skipped=0
    while IFS= read -r file; do
        if [ -f "$CHROMIUM_SRC/$file" ]; then
            rm -f "$CHROMIUM_SRC/$file"
            count=$((count + 1))
        else
            skipped=$((skipped + 1))
        fi
    done < "$pruning_list"
    echo "  Pruned $count files ($skipped already absent)"
}

# --- Domain Substitution ---
# Replaces Google domains in source files with non-functional alternatives
run_domain_substitution() {
    local sub_list="$UNGOOGLED_PATCHES/domain_substitution.list"
    local regex_list="$UNGOOGLED_PATCHES/domain_regex.list"

    if [ ! -f "$sub_list" ] || [ ! -f "$regex_list" ]; then
        echo "SKIP: Domain substitution files not found"
        return
    fi

    echo ""
    echo ">>> Running domain substitution..."

    # Build sed command from regex list
    local sed_args=""
    while IFS= read -r regex; do
        [ -z "$regex" ] && continue
        [[ "$regex" == \#* ]] && continue
        sed_args="$sed_args -e '$regex'"
    done < "$regex_list"

    local count=0
    local errors=0
    while IFS= read -r file; do
        if [ -f "$CHROMIUM_SRC/$file" ]; then
            if eval sed -i "$sed_args" "$CHROMIUM_SRC/$file" 2>/dev/null; then
                count=$((count + 1))
            else
                errors=$((errors + 1))
            fi
        fi
    done < "$sub_list"
    echo "  Substituted domains in $count files ($errors errors)"
}

# --- Patch Application ---
# Applies patches in order from the series file
apply_ungoogled_patches() {
    local series_file="$UNGOOGLED_PATCHES/series"

    if [ ! -f "$series_file" ]; then
        echo "ERROR: No series file found at $series_file"
        return 1
    fi

    local total=$(grep -v '^\s*$' "$series_file" | grep -v '^\s*#' | wc -l)
    echo ""
    echo ">>> Applying ungoogled-chromium patches ($total patches from series)..."

    local applied=0
    local failed=0

    while IFS= read -r patch_path; do
        # Skip empty lines and comments
        [ -z "$patch_path" ] && continue
        [[ "$patch_path" == \#* ]] && continue

        local full_path="$UNGOOGLED_PATCHES/$patch_path"
        if [ ! -f "$full_path" ]; then
            echo "  MISSING: $patch_path"
            failed=$((failed + 1))
            continue
        fi

        if git apply --check "$full_path" 2>/dev/null; then
            git apply "$full_path"
            applied=$((applied + 1))
        else
            echo "  CONFLICT: $patch_path (trying 3-way merge...)"
            if git apply --3way "$full_path" 2>/dev/null; then
                applied=$((applied + 1))
            else
                echo "  FAILED: $patch_path"
                failed=$((failed + 1))
            fi
        fi
    done < "$series_file"

    echo "  Applied: $applied / $total ($failed failed)"
    if [ "$failed" -gt 0 ]; then
        echo "  WARNING: Some patches failed. Manual resolution may be needed."
    fi
}

apply_astro_patches() {
    if [ ! -d "$ASTRO_PATCHES" ]; then
        echo "SKIP: No Astro patches directory"
        return
    fi

    local count=$(find "$ASTRO_PATCHES" -name "*.patch" 2>/dev/null | wc -l)
    if [ "$count" -eq 0 ]; then
        echo "SKIP: No Astro patches found"
        return
    fi

    echo ""
    echo ">>> Applying Astro patches ($count patches)..."

    local applied=0
    local failed=0

    for patch in $(find "$ASTRO_PATCHES" -name "*.patch" | sort); do
        local name=$(basename "$patch")

        # Try exact git apply first
        if git apply --check "$patch" 2>/dev/null; then
            git apply "$patch"
            applied=$((applied + 1))
        # Try with fuzzy matching (patch -p1 allows context mismatch)
        elif patch -p1 --forward --no-backup-if-mismatch -F3 < "$patch" 2>/dev/null | grep -q "patching"; then
            applied=$((applied + 1))
            echo "  FUZZY: $name"
        # Try with even more fuzz
        elif patch -p1 --forward --no-backup-if-mismatch -F10 < "$patch" 2>/dev/null | grep -q "patching"; then
            applied=$((applied + 1))
            echo "  FUZZ10: $name"
        else
            failed=$((failed + 1))
            echo "  FAILED: $name"
        fi
    done

    echo "  Applied: $applied / $count ($failed failed)"
}

# --- Main ---
case "$PATCH_SET" in
    ungoogled)
        run_pruning
        run_domain_substitution
        apply_ungoogled_patches
        ;;
    astro)
        apply_astro_patches
        ;;
    all)
        run_pruning
        run_domain_substitution
        apply_ungoogled_patches
        apply_astro_patches
        ;;
    prune)
        run_pruning
        ;;
    domains)
        run_domain_substitution
        ;;
    *)
        echo "Usage: $0 [all|ungoogled|astro|prune|domains]"
        echo ""
        echo "  all        - Apply everything (prune + domains + ungoogled + astro)"
        echo "  ungoogled  - Pruning + domain substitution + ungoogled patches"
        echo "  astro      - Astro-specific patches only"
        echo "  prune      - Binary pruning only"
        echo "  domains    - Domain substitution only"
        exit 1
        ;;
esac

echo ""
echo "=== Done ==="
