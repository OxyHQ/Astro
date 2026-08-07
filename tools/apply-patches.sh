#!/usr/bin/env bash
# apply-patches.sh — apply the Astro and ungoogled-chromium patch stacks
# deterministically, or fail.
#
# This is the legacy patch pipeline. Astro Next replaces it entirely (#8); this
# rewrite makes what remains safe to run in the meantime (#4).
#
# What changed, and why:
#
#   * `git apply --3way` fallback removed. A three-way merge produces a tree
#     that is not the reviewed patch. The result compiled, so nobody noticed
#     the difference between "the patch applied" and "git invented a merge".
#   * `patch -F3` and `patch -F10` fuzzy fallbacks removed. Fuzz means the
#     patch was applied at a location its context no longer matches. With
#     -F10, ten lines of drift are accepted silently.
#   * Failures no longer accumulate into a counter that is printed and then
#     ignored. The first failure stops the run and exits non-zero.
#   * Patch order comes from a declared series file, not `find | sort`.
#   * `.rej` and `.orig` artifacts fail the run instead of sitting in the tree
#     until link time.
#   * Every run writes a machine-readable report.
#
# Usage:
#   tools/apply-patches.sh [all|ungoogled|astro|prune|domains] [options]

ASTRO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ASTRO_ROOT
# shellcheck source=tools/lib/astro-common.sh
source "$ASTRO_ROOT/tools/lib/astro-common.sh"

UNGOOGLED_PATCHES="$ASTRO_ROOT/patches/ungoogled"
ASTRO_PATCHES="$ASTRO_ROOT/patches/astro"
PATCH_SET="all"
DEST=""
SKIP_DOMAIN_SUBSTITUTION=0

usage() {
    cat >&2 <<'EOF'
Usage: tools/apply-patches.sh [set] [options]

Sets:
  all         prune + domain substitution + ungoogled + astro (default)
  ungoogled   prune + domain substitution + ungoogled patches
  astro       Astro patches only
  prune       binary pruning only
  domains     domain substitution only

Options:
  --dry-run                    Print planned operations; change nothing.
  --dest DIR                   Chromium checkout to patch.
  --astro-patches DIR          Astro patch tree (default <repo>/patches/astro)
  --ungoogled-patches DIR      ungoogled patch tree
                               (default <repo>/patches/ungoogled)
  --skip-domain-substitution   Continue without domain substitution.
  -h, --help                   This message.

Environment:
  ASTRO_ALLOW_DIRTY_CHROMIUM=1  Developer-only override for the pristine-tree
                                requirement. Never set in CI.
EOF
}

while [ $# -gt 0 ]; do
    case "$1" in
        all|ungoogled|astro|prune|domains) PATCH_SET="$1" ;;
        --dry-run)                  ASTRO_DRY_RUN=1 ;;
        --dest)                     shift; DEST="${1:?--dest needs a directory}" ;;
        --astro-patches)            shift; ASTRO_PATCHES="${1:?--astro-patches needs a directory}" ;;
        --ungoogled-patches)        shift; UNGOOGLED_PATCHES="${1:?--ungoogled-patches needs a directory}" ;;
        --skip-domain-substitution) SKIP_DOMAIN_SUBSTITUTION=1 ;;
        -h|--help)                  usage; exit 0 ;;
        *)                          usage; astro::die "Unknown argument: $1" ;;
    esac
    shift
done

astro::require_cmd git python3 sha256sum

astro::info "=== Astro patch system ==="
astro::info "Set: $PATCH_SET"
if astro::dry_run; then
    astro::info "Mode: DRY RUN (no filesystem changes)"
fi

astro::resolve_chromium_src "$DEST"
CHROMIUM_SRC="$ASTRO_RESOLVED_CHROMIUM_SRC"
astro::info "Checkout: $CHROMIUM_SRC"

REPORT_PATH="${ASTRO_PATCH_REPORT:-$ASTRO_REPORT_DIR/patch-report.json}"

# --------------------------------------------------------------------------
# Workspace protection
#
# Patching is only correct against a tree whose starting state is known. A
# partially patched or hand-edited checkout produces a binary that is neither
# upstream nor the reviewed patch set.
# --------------------------------------------------------------------------

if [ -f "$REPORT_PATH" ]; then
    # An earlier stage of this same pipeline already modified the tree.
    # Everything it recorded is attributable; anything else is not.
    astro::require_attributable_chromium \
        "$CHROMIUM_SRC" "$ASTRO_ROOT/tools/overlay.allowlist" "$REPORT_PATH"
else
    astro::require_pristine_chromium "$CHROMIUM_SRC"
fi

# --------------------------------------------------------------------------
# Series handling
#
# The series file is the single declared order. It must agree with the
# directory in both directions.
# --------------------------------------------------------------------------

read_series() {
    local series_file="$1"
    local line
    while IFS= read -r line || [ -n "$line" ]; do
        line="${line%%#*}"
        line="${line#"${line%%[![:space:]]*}"}"
        line="${line%"${line##*[![:space:]]}"}"
        if [ -n "$line" ]; then
            printf '%s\n' "$line"
        fi
    done < "$series_file"
    return 0
}

# Fails unless the series and the patch directory describe the same set.
verify_series_matches_directory() {
    local series_file="$1" patch_dir="$2" label="$3"

    astro::require_file "$series_file" "$label series file"

    local declared on_disk
    declared="$(read_series "$series_file" | sort)"
    on_disk="$(cd "$patch_dir" && find . -name '*.patch' -type f | sed 's|^\./||' | sort)"

    local missing_files extra_files
    missing_files="$(comm -23 <(printf '%s\n' "$declared") <(printf '%s\n' "$on_disk"))"
    extra_files="$(comm -13 <(printf '%s\n' "$declared") <(printf '%s\n' "$on_disk"))"

    if [ -n "$missing_files" ]; then
        astro::die_with_hint \
            "$label series lists patches that do not exist in $patch_dir:" \
            "$(printf '%s\n' "$missing_files" | sed 's/^/  /')" \
            "Refusing to apply a partial stack."
    fi
    if [ -n "$extra_files" ]; then
        astro::die_with_hint \
            "$patch_dir contains patches the $label series does not declare:" \
            "$(printf '%s\n' "$extra_files" | sed 's/^/  /')" \
            "Patch order must be a reviewed decision, not a property of the filesystem." \
            "Add them to $series_file in the intended position, or delete them."
    fi
}

# --------------------------------------------------------------------------
# Report accumulation
# --------------------------------------------------------------------------

REPORT_TSV="$(mktemp)"
PRUNED_LIST="$(mktemp)"
SUBSTITUTED_LIST="$(mktemp)"
trap 'rm -f "$REPORT_TSV" "$PRUNED_LIST" "$SUBSTITUTED_LIST"' EXIT

DOMAIN_SUBSTITUTION_STATUS="not-run"

write_report() {
    local outcome="$1"
    if astro::dry_run; then
        astro::plan "write patch report to $REPORT_PATH"
        return 0
    fi
    mkdir -p "$(dirname "$REPORT_PATH")"
    python3 - "$REPORT_TSV" "$PRUNED_LIST" "$SUBSTITUTED_LIST" "$REPORT_PATH" \
             "$PATCH_SET" "$outcome" "$DOMAIN_SUBSTITUTION_STATUS" "$CHROMIUM_SRC" <<'PY'
import json, sys

tsv, pruned, substituted, output, patch_set, outcome, domain_status, checkout = sys.argv[1:9]

patches = []
with open(tsv, encoding="utf-8") as handle:
    for line in handle:
        line = line.rstrip("\n")
        if not line:
            continue
        order, name, path, status, digest, files = line.split("\t")
        patches.append({
            "order": int(order),
            "name": name,
            "path": path,
            "status": status,
            "sha256": digest,
            "files": [entry for entry in files.split("|") if entry],
        })

def read_lines(path):
    try:
        with open(path, encoding="utf-8") as handle:
            return [line.rstrip("\n") for line in handle if line.strip()]
    except FileNotFoundError:
        return []

document = {
    "tool": "tools/apply-patches.sh",
    "patch_set": patch_set,
    "outcome": outcome,
    "checkout": checkout,
    "domain_substitution": domain_status,
    "applied_count": sum(1 for entry in patches if entry["status"] == "applied"),
    "failed_count": sum(1 for entry in patches if entry["status"] not in ("applied", "planned")),
    "patches": patches,
    "pruned": read_lines(pruned),
    "substituted": read_lines(substituted),
}

with open(output, "w", encoding="utf-8") as handle:
    json.dump(document, handle, indent=2, sort_keys=True)
    handle.write("\n")
PY
    astro::info "Report: $REPORT_PATH"
}

# Records a failure and writes the report before the run aborts, so
# docs/recovery.mdx can name the exact patch that stopped it.
record_failure() {
    local order="$1" name="$2" path="$3" status="$4" digest="$5"
    printf '%s\t%s\t%s\t%s\t%s\t%s\n' \
        "$order" "$name" "$path" "$status" "$digest" "" >> "$REPORT_TSV"
    write_report "failed"
}

# Destination paths a patch claims to modify, read from its "+++ b/" headers.
patch_target_files() {
    local patch_file="$1"
    sed -n 's|^+++ b/||p' "$patch_file" | sed 's/[[:space:]].*$//' | sort -u
}

# --------------------------------------------------------------------------
# Binary pruning
# --------------------------------------------------------------------------

run_pruning() {
    local pruning_list="$UNGOOGLED_PATCHES/pruning.list"
    astro::require_file "$pruning_list" "pruning list"

    astro::info ">>> Pruning pre-built binaries..."
    local count=0 absent=0 file
    while IFS= read -r file || [ -n "$file" ]; do
        [ -n "$file" ] || continue
        if [ -f "$CHROMIUM_SRC/$file" ]; then
            if astro::dry_run; then
                astro::plan "prune $file"
            else
                rm -f "$CHROMIUM_SRC/$file"
                printf '%s\n' "$file" >> "$PRUNED_LIST"
            fi
            count=$((count + 1))
        else
            absent=$((absent + 1))
        fi
    done < "$pruning_list"
    astro::info "    pruned $count file(s), $absent already absent"
}

# --------------------------------------------------------------------------
# Domain substitution
#
# BROKEN, and declared broken rather than hidden. See issue #4.
#
# domain_regex.list holds Python regex substitutions in "<pattern>#<replacement>"
# form using Python group references (\g<1>). ungoogled-chromium applies them
# with its own Python tool. The previous implementation here fed each raw line
# to `sed -e`, which is not a valid sed expression at all:
#
#     $ sed -e 'fonts(\\*?)\.googleapis(\\*?)\.com#f0ntz\g<1>...'
#     sed: -e expression #1, char 1: unknown command: `f'
#
# Every one of the 21 expressions failed against every one of the 17,722
# listed files. `2>/dev/null` discarded the error and the step reported
# "Substituted domains in 0 files (17722 errors)" without failing, so no Astro
# build has ever had domain substitution applied.
#
# Implementing a correct replacement is owned by #8, which replaces aggregate
# ungoogled behavior with curated decisions. What this step must not do is
# keep implying the substitution happened.
# --------------------------------------------------------------------------

run_domain_substitution() {
    local regex_list="$UNGOOGLED_PATCHES/domain_regex.list"
    local sub_list="$UNGOOGLED_PATCHES/domain_substitution.list"
    astro::require_file "$regex_list" "domain regex list"
    astro::require_file "$sub_list" "domain substitution list"

    if [ "$SKIP_DOMAIN_SUBSTITUTION" = "1" ]; then
        DOMAIN_SUBSTITUTION_STATUS="skipped-by-flag"
        astro::warn "optional:domain-substitution" \
            "skipped by --skip-domain-substitution: this build has NO domain substitution applied (issue #8)"
        return 0
    fi

    DOMAIN_SUBSTITUTION_STATUS="failed-unimplemented"
    astro::die_with_hint \
        "Domain substitution is not implemented and cannot be applied." \
        "" \
        "$regex_list holds Python regular expressions with group references" \
        "such as \\g<1>. The previous implementation passed them to 'sed -e'," \
        "which rejects them outright, and discarded the error with 2>/dev/null." \
        "The step reported success while substituting nothing, in every build." \
        "" \
        "This is now visible rather than silent. Options:" \
        "  --skip-domain-substitution   proceed without it, recorded in the report" \
        "                               as skipped. This reproduces exactly what" \
        "                               previous builds actually did." \
        "  resolve it in issue #8, which owns replacing aggregate ungoogled" \
        "  behavior with curated decisions."
}

# --------------------------------------------------------------------------
# Patch application
#
# Exact application only. No fuzz, no three-way merge, no fallback of any kind.
# --------------------------------------------------------------------------

apply_series() {
    local series_file="$1" patch_dir="$2" label="$3"

    verify_series_matches_directory "$series_file" "$patch_dir" "$label"

    local total
    total="$(read_series "$series_file" | wc -l | tr -d '[:space:]')"
    astro::info ">>> Applying $label patches ($total, in declared series order)..."

    local order=0 relative full name digest
    while IFS= read -r relative; do
        order=$((order + 1))
        full="$patch_dir/$relative"
        name="$(basename "$relative")"

        if [ ! -f "$full" ]; then
            astro::error "[$order/$total] MISSING $relative"
            record_failure "$order" "$name" "$relative" "missing" ""
            astro::die "Patch $order of $total is missing: $full"
        fi

        digest="$(astro::sha256 "$full")"

        if astro::dry_run; then
            astro::plan "apply $relative"
            printf '%s\t%s\t%s\t%s\t%s\t%s\n' \
                "$order" "$name" "$relative" "planned" "$digest" \
                "$(patch_target_files "$full" | paste -sd'|' -)" >> "$REPORT_TSV"
            continue
        fi

        # `git apply --check` is the ONLY acceptance test. If a patch does not
        # apply exactly, the run stops here.
        local check_output check_status=0
        check_output="$(git -C "$CHROMIUM_SRC" apply --check --whitespace=nowarn "$full" 2>&1)" \
            || check_status=$?

        if [ "$check_status" -ne 0 ]; then
            astro::error "[$order/$total] FAILED $relative"
            printf '%s\n' "$check_output" | sed 's/^/      /' >&2
            record_failure "$order" "$name" "$relative" "does-not-apply" "$digest"
            astro::die_with_hint \
                "Patch $order of $total does not apply exactly: $relative" \
                "" \
                "No fuzzy application and no three-way merge is attempted, by design:" \
                "either the reviewed patch applies to this tree or it does not." \
                "" \
                "The report naming this patch is at $REPORT_PATH." \
                "Recovery steps are in docs/recovery.mdx."
        fi

        git -C "$CHROMIUM_SRC" apply --whitespace=nowarn "$full"
        printf '%s\t%s\t%s\t%s\t%s\t%s\n' \
            "$order" "$name" "$relative" "applied" "$digest" \
            "$(patch_target_files "$full" | paste -sd'|' -)" >> "$REPORT_TSV"
    done < <(read_series "$series_file")

    astro::info "    applied $total/$total"
}

# --------------------------------------------------------------------------
# Post-application integrity
# --------------------------------------------------------------------------

assert_no_patch_artifacts() {
    if astro::dry_run; then
        return 0
    fi

    astro::info ">>> Checking for patch artifacts..."
    local artifacts
    # Only UNTRACKED artifacts count. Chromium ships 181 tracked `.orig` files
    # (cargo writes `Cargo.toml.orig` for each vendored Rust crate), so a
    # find-based check condemns a pristine upstream checkout. Asking git is both
    # exact and far cheaper than walking 400,000 files.
    local status_output
    status_output="$(git -C "$CHROMIUM_SRC" status --porcelain --untracked-files=all)"
    artifacts="$(printf '%s\n' "$status_output" | sed -n 's/^?? //p' \
        | grep -E '\.(rej|orig|porig)$' | head -50)" || true   # astro-allow:suppressed-failure grep finding nothing is the normal case

    if [ -n "$artifacts" ]; then
        astro::die_with_hint \
            "Patch artifacts found in the checkout:" \
            "$(printf '%s\n' "$artifacts" | sed 's/^/  /')" \
            "" \
            "A .rej or .orig file means a patch was applied partially. The old" \
            "runner left these behind and carried on; the build then failed at" \
            "link time, or worse, succeeded with a hunk missing." \
            "Recovery steps are in docs/recovery.mdx."
    fi
    astro::info "    none found"
}

# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------

case "$PATCH_SET" in
    prune)
        run_pruning
        ;;
    domains)
        run_domain_substitution
        ;;
    ungoogled)
        run_pruning
        run_domain_substitution
        apply_series "$UNGOOGLED_PATCHES/series" "$UNGOOGLED_PATCHES" "ungoogled"
        assert_no_patch_artifacts
        ;;
    astro)
        apply_series "$ASTRO_PATCHES/series" "$ASTRO_PATCHES" "astro"
        assert_no_patch_artifacts
        ;;
    all)
        run_pruning
        run_domain_substitution
        apply_series "$UNGOOGLED_PATCHES/series" "$UNGOOGLED_PATCHES" "ungoogled"
        apply_series "$ASTRO_PATCHES/series" "$ASTRO_PATCHES" "astro"
        assert_no_patch_artifacts
        ;;
esac

write_report "succeeded"

if ! astro::dry_run; then
    # Every path the checkout now shows as changed must be one this run
    # recorded: a file a patch declared, a file pruning removed, or an
    # allowlisted overlay destination. Anything else is an unexpected
    # modification or untracked file the patch stack did not account for —
    # a stray artifact, a half-applied hunk written under a new name, or
    # someone else's work — and is not something to compile.
    astro::info ">>> Verifying every change is accounted for..."
    astro::require_attributable_chromium \
        "$CHROMIUM_SRC" "$ASTRO_ROOT/tools/overlay.allowlist" "$REPORT_PATH"

    astro::summarize_chromium_tree "$CHROMIUM_SRC"
fi

astro::info "=== Patch application complete ==="
