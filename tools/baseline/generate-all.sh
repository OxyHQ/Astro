#!/usr/bin/env bash
# generate-all.sh — regenerate every generated Astro Next baseline document.
#
# The baseline exists so later issues can cite it as their compatibility
# reference. That is only worth anything if it still describes the repository,
# so every generated document is produced by a committed tool and CI runs this
# with --check: regenerating must produce no diff.
#
# Without that, "later issues can cite this baseline" degrades to citing a
# snapshot nobody revalidated.
#
# Every generator derives its committed output from HEAD (tools/baseline/
# committed_state.py), never from the working tree — otherwise a baseline
# produced on a machine carrying uncommitted work embeds that work, --check
# passes there, and a clean checkout regenerates something else. Working-tree
# differences are still reported, to stderr and into build/reports/, under a
# heading that cannot be mistaken for baseline content.
#
# Usage:
#   tools/baseline/generate-all.sh            Regenerate in place.
#   tools/baseline/generate-all.sh --check    Regenerate; fail on any diff.
#
# --check leaves the working tree as it found it, so it is safe to run against
# a checkout with uncommitted work.

ASTRO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export ASTRO_ROOT
# shellcheck source=tools/lib/astro-common.sh
source "$ASTRO_ROOT/tools/lib/astro-common.sh"

BASELINE_DIR="$ASTRO_ROOT/docs/astro-next/baseline"
CHECK=0

while [ $# -gt 0 ]; do
    case "$1" in
        --check) CHECK=1 ;;
        -h|--help)
            sed -n '2,24p' "${BASH_SOURCE[0]}" >&2
            exit 0
            ;;
        *) astro::die "Unknown argument: $1" ;;
    esac
    shift
done

astro::require_cmd python3 git

REPORT_DIR="$(astro::report_dir)"
mkdir -p "$BASELINE_DIR"

# The generated set. Machine-readable output goes to build/reports/ (gitignored)
# and the committed documents carry only what is reproducible from a clean
# checkout — otherwise --check would fail on whoever's machine ran it.
generate() {
    astro::info ">>> patch inventory"
    python3 "$ASTRO_ROOT/tools/baseline/inventory_patches.py" \
        --json "$REPORT_DIR/patch-inventory.json" \
        --markdown "$BASELINE_DIR/patch-inventory.md"

    astro::info ">>> source inventory"
    python3 "$ASTRO_ROOT/tools/baseline/inventory_sources.py" \
        --json "$REPORT_DIR/source-inventory.json" \
        --markdown "$BASELINE_DIR/source-inventory.md"

    astro::info ">>> GN args matrix"
    python3 "$ASTRO_ROOT/tools/baseline/inventory_gn_args.py" \
        --json "$REPORT_DIR/gn-args.json" \
        --markdown "$BASELINE_DIR/platform-matrix.md"

    astro::info ">>> WebUI security baseline"
    python3 "$ASTRO_ROOT/tools/baseline/inventory_webui_security.py" \
        --json "$REPORT_DIR/webui-security.json" \
        --markdown "$BASELINE_DIR/security-baseline.md"

    astro::info ">>> endpoint inventory (static)"
    python3 "$ASTRO_ROOT/tools/baseline/inventory_endpoints.py" \
        --yaml "$BASELINE_DIR/network-inventory.yaml" \
        --json "$REPORT_DIR/endpoints.json"
}

if [ "$CHECK" = "0" ]; then
    generate
    astro::info "=== Baseline regenerated ==="
    exit 0
fi

# --- --check ---------------------------------------------------------------
#
# Regenerate into a scratch copy and diff, rather than regenerating in place
# and reverting: reverting means writing to the working tree, and this has to
# be safe to run against a checkout carrying unrelated uncommitted work.

astro::info "=== Checking the baseline is current ==="

SCRATCH="$(mktemp -d)"
trap 'rm -rf "$SCRATCH"' EXIT

mkdir -p "$SCRATCH/committed"
cp -a "$BASELINE_DIR/." "$SCRATCH/committed/"

generate

DRIFTED=0
while IFS= read -r name; do
    committed="$SCRATCH/committed/$name"
    current="$BASELINE_DIR/$name"
    if [ ! -f "$committed" ]; then
        astro::error "baseline document is new and uncommitted: $name"
        DRIFTED=1
        continue
    fi
    if ! cmp -s "$committed" "$current"; then
        astro::error "baseline document is out of date: $name"
        # `diff` exits 1 when the files differ, which is the case being
        # reported, and under `pipefail` that failure would propagate out of
        # `diff | head` and kill the script through the ERR trap — before the
        # explanation below ever printed. Capture it instead of piping.
        excerpt=""
        diff_status=0
        excerpt="$(diff -u "$committed" "$current")" || diff_status=$?
        if [ "$diff_status" -gt 1 ]; then
            astro::error "diff itself failed (exit $diff_status)"
        fi
        printf '%s\n' "$excerpt" | head -40 >&2
        DRIFTED=1
    fi
done < <(cd "$BASELINE_DIR" && find . -maxdepth 1 -type f \
             \( -name '*.md' -o -name '*.yaml' \) -printf '%f\n' | sort)

if [ "$DRIFTED" = "1" ]; then
    # Restore what was committed, so a failed check leaves nothing behind.
    cp -a "$SCRATCH/committed/." "$BASELINE_DIR/"
    astro::die_with_hint \
        "The committed baseline is not what the tools produce today." \
        "" \
        "Later issues cite this baseline as their compatibility reference, so a" \
        "stale document is worse than a missing one." \
        "" \
        "Regenerate and commit the result:  tools/baseline/generate-all.sh" \
        "" \
        "Order matters. Every generated document is derived from HEAD, never from" \
        "the working tree, so a document regenerated BEFORE its source change was" \
        "committed describes the previous revision and drifts here. Commit the" \
        "source first, then regenerate and commit the documents."
fi

astro::info "=== Baseline is current ==="
