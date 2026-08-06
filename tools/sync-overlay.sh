#!/usr/bin/env bash
# sync-overlay.sh — copy the Astro overlay into a verified Chromium checkout.
#
# Replaces `rsync -av --delete src/ chromium/src/ 2>/dev/null || true`, which
# deleted every upstream file the overlay did not provide, wrote to whatever
# path it was pointed at without checking, discarded stderr, and reported
# success unconditionally.
#
# This script:
#   * never deletes anything;
#   * verifies the destination really is a Chromium checkout before writing;
#   * writes only to destinations declared in tools/overlay.allowlist;
#   * fails when the overlay grows a path nobody declared;
#   * fails when an overlay file would silently overwrite an upstream file;
#   * fails when a declared overwrite collides with a patch, unless that
#     collision is explicitly declared in the allowlist;
#   * prints every planned operation and touches nothing under --dry-run;
#   * records everything it wrote in build/reports/overlay-manifest.json.
#
# Usage:
#   tools/sync-overlay.sh [--dry-run] [--source DIR] [--dest DIR]
#                         [--allowlist FILE]

ASTRO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ASTRO_ROOT
# shellcheck source=tools/lib/astro-common.sh
source "$ASTRO_ROOT/tools/lib/astro-common.sh"

OVERLAY_SOURCE="$ASTRO_ROOT/src"
OVERLAY_DEST=""
ALLOWLIST="$ASTRO_ROOT/tools/overlay.allowlist"
PATCHES_DIR="$ASTRO_ROOT/patches"

# Upper bound on overlay size. The overlay is a hand-maintained set of Astro
# files; a sudden jump means something other than Astro code got in.
ASTRO_OVERLAY_MAX_FILES="${ASTRO_OVERLAY_MAX_FILES:-500}"

usage() {
    cat >&2 <<'EOF'
Usage: tools/sync-overlay.sh [options]

  --dry-run            Print every planned operation; change nothing.
  --source DIR         Overlay source (default: <repo>/src)
  --dest DIR           Chromium checkout (default: <repo>/chromium/src,
                       or $ASTRO_CHROMIUM_SRC)
  --allowlist FILE     Destination allowlist (default: tools/overlay.allowlist)
  --patches DIR        Patch tree scanned for overlay/patch collisions
                       (default: <repo>/patches)
  -h, --help           This message.

Environment:
  ASTRO_OVERLAY_MAX_FILES        Overlay file-count ceiling (default 500)
  ASTRO_ALLOW_DIRTY_CHROMIUM=1   Developer-only override for the unrelated
                                 local-changes guard. Never set in CI.
EOF
}

while [ $# -gt 0 ]; do
    case "$1" in
        --dry-run)   ASTRO_DRY_RUN=1 ;;
        --source)    shift; OVERLAY_SOURCE="${1:?--source needs a directory}" ;;
        --dest)      shift; OVERLAY_DEST="${1:?--dest needs a directory}" ;;
        --allowlist) shift; ALLOWLIST="${1:?--allowlist needs a file}" ;;
        --patches)   shift; PATCHES_DIR="${1:?--patches needs a directory}" ;;
        -h|--help)   usage; exit 0 ;;
        *)           usage; astro::die "Unknown argument: $1" ;;
    esac
    shift
done

astro::require_cmd git python3 sha256sum
astro::require_dir "$OVERLAY_SOURCE" "overlay source directory"
astro::require_file "$ALLOWLIST" "overlay allowlist"

astro::info "=== Astro overlay sync ==="
astro::info "Overlay source: $OVERLAY_SOURCE"
if astro::dry_run; then
    astro::info "Mode: DRY RUN (no filesystem changes)"
fi

# --------------------------------------------------------------------------
# Destination verification — nothing is written before this succeeds.
# --------------------------------------------------------------------------

astro::resolve_chromium_src "$OVERLAY_DEST"
CHROMIUM_SRC="$ASTRO_RESOLVED_CHROMIUM_SRC"
astro::info "Destination:    $CHROMIUM_SRC (verified Chromium checkout)"

# --------------------------------------------------------------------------
# Load the allowlist
# --------------------------------------------------------------------------

declare -a ALLOW_KIND=() ALLOW_PATH=() ALLOW_ATTRS=()

load_allowlist() {
    local line kind path attrs
    local lineno=0
    while IFS= read -r line || [ -n "$line" ]; do
        lineno=$((lineno + 1))
        line="${line%%#*}"
        line="${line#"${line%%[![:space:]]*}"}"
        line="${line%"${line##*[![:space:]]}"}"
        [ -n "$line" ] || continue

        read -r kind path attrs <<< "$line"
        case "$kind" in
            dir|file|overwrite) ;;
            *) astro::die "$ALLOWLIST:$lineno: unknown entry kind '$kind' (expected dir, file or overwrite)" ;;
        esac
        [ -n "$path" ] || astro::die "$ALLOWLIST:$lineno: entry has no destination path"
        case "$path" in
            /*|*..*) astro::die "$ALLOWLIST:$lineno: destination must be a relative path without '..': $path" ;;
        esac
        if [ "$kind" = "overwrite" ]; then
            case "$attrs" in
                *owner=*) ;;
                *) astro::die "$ALLOWLIST:$lineno: overwrite entries require owner=<team>" ;;
            esac
            case "$attrs" in
                *issue=*) ;;
                *) astro::die "$ALLOWLIST:$lineno: overwrite entries require issue=<number>" ;;
            esac
        fi
        ALLOW_KIND+=("$kind")
        ALLOW_PATH+=("$path")
        ALLOW_ATTRS+=("$attrs")
    done < "$ALLOWLIST"

    [ "${#ALLOW_PATH[@]}" -gt 0 ] || astro::die "$ALLOWLIST declares no destinations"
}

load_allowlist
astro::info "Allowlist:      ${#ALLOW_PATH[@]} declared destination(s) from $ALLOWLIST"

# Sets MATCHED_INDEX to the single matching allowlist entry, or dies.
# Assigns to a global rather than echoing, so astro::die inside it exits the
# script instead of only a command-substitution subshell.
MATCHED_INDEX=-1
match_allowlist_index() {
    local rel="$1"
    local i
    MATCHED_INDEX=-1
    for i in "${!ALLOW_PATH[@]}"; do
        case "${ALLOW_KIND[$i]}" in
            dir)
                case "$rel" in
                    "${ALLOW_PATH[$i]}"/*) MATCHED_INDEX=$i ;;
                esac
                ;;
            file|overwrite)
                if [ "$rel" = "${ALLOW_PATH[$i]}" ]; then MATCHED_INDEX=$i; fi
                ;;
        esac
        if [ "$MATCHED_INDEX" -ge 0 ]; then break; fi
    done
    if [ "$MATCHED_INDEX" -lt 0 ]; then
        astro::die_with_hint \
            "Overlay file has no declared destination: $rel" \
            "Every overlay destination must be declared in $ALLOWLIST." \
            "Add a 'dir', 'file' or 'overwrite' entry for it, or remove the file" \
            "from $OVERLAY_SOURCE. Refusing to write an undeclared path into Chromium."
    fi
}

# --------------------------------------------------------------------------
# Patch/overlay collision detection
#
# The overlay is copied after patches are applied, so an overlay file that
# overwrites a destination a patch also modifies silently reverts that patch.
# Every such collision must be declared on the allowlist entry.
# --------------------------------------------------------------------------

patches_touching() {
    local rel="$1" status=0 matches
    [ -d "$PATCHES_DIR" ] || return 0
    # Patch headers name the file as "+++ b/<path>".
    matches="$(grep -rlF --include='*.patch' -- "+++ b/$rel" "$PATCHES_DIR")" || status=$?
    # grep exits 1 for "no matches", which is the normal case here. Anything
    # above that is a real failure and must not be treated as "no collisions".
    if [ "$status" -gt 1 ]; then
        astro::die "grep failed while scanning patches for $rel (exit $status)"
    fi
    [ -n "$matches" ] || return 0
    printf '%s\n' "$matches" | sed 's|^.*/||' | sort -u
}

assert_declared_collisions() {
    local rel="$1" attrs="$2"
    local actual declared undeclared=""
    actual="$(patches_touching "$rel" | paste -sd, -)"
    [ -n "$actual" ] || return 0

    declared=""
    case "$attrs" in
        *conflicts-with=*)
            declared="${attrs##*conflicts-with=}"
            declared="${declared%% *}"
            ;;
    esac

    local patch
    while IFS= read -r patch; do
        [ -n "$patch" ] || continue
        case ",$declared," in
            *",$patch,"*) ;;
            *) undeclared="$undeclared $patch" ;;
        esac
    done < <(printf '%s\n' "$actual" | tr ',' '\n')

    if [ -n "$undeclared" ]; then
        astro::die_with_hint \
            "Overlay file $rel overwrites a destination that patches also modify:" \
            "  undeclared:$undeclared" \
            "" \
            "The overlay is copied AFTER patches are applied, so this copy silently" \
            "reverts those patches. Astro will not produce a partially patched tree." \
            "" \
            "Declare it on the allowlist entry with conflicts-with=<patch,...> if the" \
            "collision is understood and owned, or stop overwriting the file."
    fi

    astro::warn "declared-collision:$rel" \
        "overwrites patched file; patches reverted by this copy: $actual (declared in $ALLOWLIST)"
}

# --------------------------------------------------------------------------
# Enumerate the overlay and validate every destination BEFORE copying anything
# --------------------------------------------------------------------------

declare -a OVERLAY_FILES=()
while IFS= read -r -d '' file; do
    OVERLAY_FILES+=("${file#"$OVERLAY_SOURCE/"}")
done < <(find "$OVERLAY_SOURCE" -type f -print0 | sort -z)

FILE_COUNT="${#OVERLAY_FILES[@]}"
[ "$FILE_COUNT" -gt 0 ] || astro::die "Overlay source contains no files: $OVERLAY_SOURCE"

if [ "$FILE_COUNT" -gt "$ASTRO_OVERLAY_MAX_FILES" ]; then
    astro::die_with_hint \
        "Overlay contains $FILE_COUNT files, over the declared ceiling of $ASTRO_OVERLAY_MAX_FILES." \
        "This bound exists so an accidental mass copy fails before it reaches Chromium." \
        "Raise ASTRO_OVERLAY_MAX_FILES deliberately if the overlay really grew this much."
fi

astro::info "Overlay files:  $FILE_COUNT (ceiling $ASTRO_OVERLAY_MAX_FILES)"

# Is the destination path tracked by the Chromium checkout?
# `git ls-files` prints nothing and exits 0 for an untracked path, so this
# needs no stderr suppression and no tolerated failure.
is_tracked_upstream() {
    local rel="$1"
    [ -n "$(git -C "$CHROMIUM_SRC" ls-files -- "$rel")" ]
}

astro::info ">>> Validating destinations..."

declare -a PLAN_REL=() PLAN_KIND=()
for rel in "${OVERLAY_FILES[@]}"; do
    case "$rel" in
        *..*) astro::die "Overlay path escapes the source root: $rel" ;;
    esac

    match_allowlist_index "$rel"
    kind="${ALLOW_KIND[$MATCHED_INDEX]}"
    attrs="${ALLOW_ATTRS[$MATCHED_INDEX]}"

    if [ "$kind" = "overwrite" ]; then
        if ! is_tracked_upstream "$rel"; then
            astro::die_with_hint \
                "Allowlist declares $rel as an overwrite, but Chromium does not track it." \
                "Declare it as 'file' instead — 'overwrite' is reserved for replacing" \
                "upstream-owned files and carries a removal issue."
        fi
        assert_declared_collisions "$rel" "$attrs"
    else
        if is_tracked_upstream "$rel"; then
            astro::die_with_hint \
                "Overlay file $rel would overwrite a Chromium-tracked file, but is declared as '$kind'." \
                "Undeclared overwrites of upstream files are refused." \
                "If replacing it is intended, declare it in $ALLOWLIST as:" \
                "  overwrite $rel owner=<team> issue=<number>"
        fi
    fi

    PLAN_REL+=("$rel")
    PLAN_KIND+=("$kind")
done

astro::info "All $FILE_COUNT destination(s) declared and validated."

# --------------------------------------------------------------------------
# Protect unrelated developer work in the checkout
# --------------------------------------------------------------------------

astro::require_attributable_chromium \
    "$CHROMIUM_SRC" \
    "$ALLOWLIST" \
    "$ASTRO_REPORT_DIR/patch-report.json"

# --------------------------------------------------------------------------
# Copy
# --------------------------------------------------------------------------

astro::info ">>> Copying overlay (no deletions)..."

MANIFEST_TSV="$(mktemp)"
trap 'rm -f "$MANIFEST_TSV"' EXIT

created=0
updated=0
unchanged=0

for i in "${!PLAN_REL[@]}"; do
    rel="${PLAN_REL[$i]}"
    kind="${PLAN_KIND[$i]}"
    source_file="$OVERLAY_SOURCE/$rel"
    dest_file="$CHROMIUM_SRC/$rel"
    source_hash="$(astro::sha256 "$source_file")"

    if [ ! -f "$dest_file" ]; then
        action="create"
    elif [ "$(astro::sha256 "$dest_file")" = "$source_hash" ]; then
        action="unchanged"
    else
        action="update"
    fi

    case "$action" in
        create)    created=$((created + 1)) ;;
        update)    updated=$((updated + 1)) ;;
        unchanged) unchanged=$((unchanged + 1)) ;;
    esac

    if [ "$action" != "unchanged" ]; then
        if astro::dry_run; then
            astro::plan "$action $rel  ($kind)"
        else
            mkdir -p "$(dirname "$dest_file")"
            # -p preserves mode and timestamps; there is no --delete anywhere
            # in this script and there never may be.
            cp -p "$source_file" "$dest_file"
        fi
    fi

    printf '%s\t%s\t%s\t%s\n' "$rel" "$kind" "$action" "$source_hash" >> "$MANIFEST_TSV"
done

astro::info "create: $created   update: $updated   unchanged: $unchanged"

# --------------------------------------------------------------------------
# Manifest
# --------------------------------------------------------------------------

if astro::dry_run; then
    astro::plan "write overlay manifest to $ASTRO_REPORT_DIR/overlay-manifest.json"
else
    report_dir="$(astro::report_dir)"
    manifest="$report_dir/overlay-manifest.json"
    python3 - "$MANIFEST_TSV" "$manifest" "$OVERLAY_SOURCE" "$CHROMIUM_SRC" <<'PY'
import json, sys

tsv, output, source, destination = sys.argv[1:5]

entries = []
with open(tsv, encoding="utf-8") as handle:
    for line in handle:
        line = line.rstrip("\n")
        if not line:
            continue
        path, kind, action, digest = line.split("\t")
        entries.append({"path": path, "kind": kind, "action": action, "sha256": digest})

document = {
    "tool": "tools/sync-overlay.sh",
    "source": source,
    "destination": destination,
    "file_count": len(entries),
    "entries": entries,
}

with open(output, "w", encoding="utf-8") as handle:
    json.dump(document, handle, indent=2, sort_keys=True)
    handle.write("\n")
PY
    astro::info "Manifest:       $manifest"
fi

astro::info "=== Overlay sync complete ==="
