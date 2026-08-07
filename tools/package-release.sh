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

# The archive name is assembled from these AFTER every gate below has had its
# say, so a build that fails two of them carries both marks instead of one
# overwriting the other.
ARCHIVE_PREFIX="astro"
ARCHIVE_SUFFIX=""

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

# An artifact named after the product must contain the product. This script
# produced `astro-0.1.0-linux-x64.tar.gz` from a binary with no Oxy Identity, no
# Alia, no ad blocker and none of the five WebUI controllers, and reported
# success — the only hint was one optional-member warning about
# `adblock_resources/`, which is a warning by design. The archive then sat in
# releases/ beside genuine ones, distinguishable only by reading it.
#
# The gate lives in astro-common.sh because every packager needs exactly this
# property and none of them may implement it slightly differently. It reports
# `unmeasurable` separately from `absent`, and treats a crashed scan as the
# former: a wrong path, an unreadable binary or a detector that died must not
# produce the same verdict as the real defect.
#
# The Linux payload is the ELF the build produced, so it is scanned directly.
# Verified in both directions against real artifacts: the binary at
# chromium/src/out/PipelineCheck/chrome reports absent, and the `chrome` inside
# the shipped astro-browser_0.1.0_amd64.deb reports present.
astro::require_astro_overlay "linux x64" --binary "$BUILD_DIR/chrome"

if [ "$ASTRO_OVERLAY_VERDICT" = "overlayless" ]; then
    ARCHIVE_PREFIX="pipeline-validation"
    ARCHIVE_SUFFIX="${ARCHIVE_SUFFIX}-NO-ASTRO-OVERLAY"
fi

# A release artifact must carry the exact source revisions, GN args and
# toolchain identity it was produced from (ASTRO-NEXT-002, #5).
PROVENANCE_JSON="$ASTRO_REPORT_DIR/provenance.json"
astro::require_file "$PROVENANCE_JSON" "build provenance (run tools/build.sh)"

# The binary check above answers "is an Astro overlay in here". It cannot
# answer "was it THE overlay", because a working-tree copy and a committed one
# leave the same markers in the binary. Provenance carries that answer, so a
# build made from an overlay nobody can check out again is refused here rather
# than shipped as a release nobody can reproduce.
#
# Three states, not two: "clean", "not clean", and "nothing measured" are
# different answers, and collapsing the last into either of the others makes a
# missing measurement indistinguishable from a real verdict.
astro::info ">>> Verifying this build's overlay came from a commit..."
overlay_provenance_status=0
python3 - "$PROVENANCE_JSON" <<'PY' || overlay_provenance_status=$?
import json
import sys

path = sys.argv[1]

try:
    with open(path, encoding="utf-8") as handle:
        document = json.load(handle)
except (OSError, json.JSONDecodeError) as error:
    print(f"provenance unreadable: {error}")
    raise SystemExit(2)

overlay = document.get("overlay")
if not isinstance(overlay, dict) or "state" not in overlay:
    print(
        f"{path} records no overlay state; it was written by an older "
        "tools/generate-provenance.sh and measured nothing"
    )
    raise SystemExit(2)

state = overlay["state"]
if state == "clean":
    print(f"overlay clean at {overlay.get('revision')}")
    raise SystemExit(0)

if state == "dirty":
    print(f"overlay DIRTY: {len(overlay.get('differences', []))} path(s) differ from HEAD")
    for entry in overlay.get("differences", []):
        print(f"  {entry.get('classification')}  {entry.get('overlay_path')}")
    raise SystemExit(1)

print(f"overlay state '{state}' measured nothing: {overlay.get('reason')}")
raise SystemExit(2)
PY

case "$overlay_provenance_status" in
    0) ;;
    1)
        if [ "${ASTRO_ALLOW_DIRTY_OVERLAY_PACKAGE:-0}" != "1" ]; then
            astro::die_with_hint \
                "Refusing to package a build whose overlay did not come from a commit." \
                "The overlay was copied from a working tree carrying local changes, so" \
                "no revision reproduces this binary. The differing paths are listed above" \
                "and recorded in $PROVENANCE_JSON." \
                "" \
                "Commit the overlay changes and rebuild, or package it deliberately as an" \
                "unreproducible artifact:" \
                "    ASTRO_ALLOW_DIRTY_OVERLAY_PACKAGE=1 $0 $BUILD_DIR" \
                "The archive is then named so its nature cannot be mistaken."
        fi
        astro::warn "override:dirty-overlay-package" \
            "packaging a build made from an uncommitted overlay; renaming the archive accordingly"
        ARCHIVE_PREFIX="unreproducible"
        ARCHIVE_SUFFIX="${ARCHIVE_SUFFIX}-DIRTY-OVERLAY"
        ;;
    2)
        astro::die_with_hint \
            "Cannot determine whether this build's overlay came from a commit; refusing to package." \
            "This is not the same as a dirty overlay: nothing was measured, so there is" \
            "no verdict to override. Rebuild with tools/build.sh, which runs" \
            "tools/sync-overlay.sh and records the overlay state in provenance."
        ;;
    *)
        astro::die "Overlay provenance check failed unexpectedly (exit $overlay_provenance_status)."
        ;;
esac

astro::stage_provenance "$BUILD_DIR/provenance.json"
MEMBERS+=("provenance.json")

ARCHIVE_NAME="${ARCHIVE_PREFIX}-${VERSION}-linux-x64${ARCHIVE_SUFFIX}.tar.gz"
astro::info ">>> Creating $ARCHIVE_NAME..."

( cd "$BUILD_DIR" && tar czf "$RELEASE_DIR/$ARCHIVE_NAME" "${MEMBERS[@]}" )
astro::require_file "$RELEASE_DIR/$ARCHIVE_NAME" "release archive"

astro::info "=== Package created ==="
astro::info "Archive: $RELEASE_DIR/$ARCHIVE_NAME"
astro::info "Size: $(du -h "$RELEASE_DIR/$ARCHIVE_NAME" | cut -f1)"
