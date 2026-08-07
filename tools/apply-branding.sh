#!/usr/bin/env bash
# apply-branding.sh — Applies Astro branding to the Chromium source tree.
#
# Reads branding/astro.conf and replaces all user-facing "Chromium" strings
# in .grd resource files, the BRANDING file, and Linux package metadata.
#
# Usage:
#   tools/apply-branding.sh          # from ~/Oxy/Astro/
#   tools/apply-branding.sh --dry-run  # preview changes without writing

ASTRO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ASTRO_ROOT
# shellcheck source=tools/lib/astro-common.sh
source "$ASTRO_ROOT/tools/lib/astro-common.sh"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CHROMIUM_SRC="$PROJECT_ROOT/chromium/src"
CONF_FILE="$PROJECT_ROOT/branding/astro.conf"
DRY_RUN=false

if [[ "${1:-}" == "--dry-run" ]]; then
    DRY_RUN=true
    echo "[DRY RUN] No files will be modified."
    echo ""
fi

# --- Load configuration ---
if [[ ! -f "$CONF_FILE" ]]; then
    echo "ERROR: Branding config not found at $CONF_FILE"
    exit 1
fi

# Source the config (only lines matching KEY="VALUE")
while IFS='=' read -r key value; do
    # Skip comments and empty lines
    if [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]]; then
        continue
    fi
    # Strip surrounding quotes from value
    value="${value%\"}"
    value="${value#\"}"
    declare "$key=$value"
done < "$CONF_FILE"

# Validate required variables
for var in BROWSER_NAME COMPANY_NAME COMPANY_FULL_NAME RDN MAC_CREATOR_CODE; do
    if [[ -z "${!var:-}" ]]; then
        echo "ERROR: $var is not set in $CONF_FILE"
        exit 1
    fi
done

echo "Applying branding: $BROWSER_NAME by $COMPANY_NAME"
echo "Source tree: $CHROMIUM_SRC"
echo ""

# --- Helper: sed replacement with dry-run support ---
apply_sed() {
    local file="$1"
    local pattern="$2"
    local short_path="${file#"$CHROMIUM_SRC"/}"

    if $DRY_RUN; then
        local count
        # grep exits 1 when there are no matches, which is a normal outcome here;
        # anything above that is a real failure and must not read as "zero".
        grep_status=0
        count="$(grep -c "Chromium" "$file")" || grep_status=$?
        if [ "$grep_status" -gt 1 ]; then
            astro::die "grep failed while scanning $file (exit $grep_status)"
        fi
        # Validate the sed EXPRESSION, not just the file's contents. Without
        # this the dry run happily plans a substitution sed will refuse to
        # execute, and the first thing the operator learns is a failure
        # halfway through a real run.
        if ! sed "$pattern" "$file" > /dev/null 2>&1; then
            astro::die "invalid sed expression for $short_path: $pattern"
        fi
        if [[ "$count" -gt 0 ]]; then
            echo "  [WOULD CHANGE] $short_path ($count occurrences of 'Chromium')"
        else
            echo "  [ALREADY CLEAN] $short_path"
        fi
    else
        sed -i "$pattern" "$file"
    fi
}

# --- 1. Update BRANDING file ---
BRANDING_FILE="$CHROMIUM_SRC/chrome/app/theme/chromium/BRANDING"

echo "=== Updating BRANDING file ==="
if [[ -f "$BRANDING_FILE" ]]; then
    if $DRY_RUN; then
        echo "  [WOULD UPDATE] chrome/app/theme/chromium/BRANDING"
    else
        cat > "$BRANDING_FILE" << EOF
COMPANY_FULLNAME=$COMPANY_FULL_NAME
COMPANY_SHORTNAME=$COMPANY_NAME
PRODUCT_FULLNAME=$BROWSER_NAME
PRODUCT_SHORTNAME=$BROWSER_NAME
PRODUCT_INSTALLER_FULLNAME=$BROWSER_NAME Installer
PRODUCT_INSTALLER_SHORTNAME=$BROWSER_NAME Installer
COPYRIGHT=Copyright @LASTCHANGE_YEAR@ $COMPANY_NAME. Based on Chromium, Copyright The Chromium Authors. All rights reserved.
MAC_BUNDLE_ID=$RDN
MAC_CREATOR_CODE=$MAC_CREATOR_CODE
MAC_TEAM_ID=
EOF
        echo "  Updated BRANDING file"
    fi
else
    echo "  WARNING: BRANDING file not found at $BRANDING_FILE"
fi
echo ""

# --- 2. Replace user-facing "Chromium" in .grd files ---
echo "=== Replacing 'Chromium' with '$BROWSER_NAME' in .grd resource files ==="

# ATTRIBUTION IS NOT BRANDING, and a blanket s/Chromium/$BROWSER_NAME/ does not
# know the difference.
#
# chrome/app/chromium_strings.grd carries two strings that name the COPYRIGHT
# HOLDER rather than the product:
#
#   IDS_ABOUT_VERSION_COMPANY_NAME   The Chromium Authors
#   IDS_ABOUT_VERSION_COPYRIGHT      Copyright <year> The Chromium Authors. ...
#
# Rewritten, the About page claims Astro's publisher wrote code it did not, on
# a codebase distributed under a licence that requires the notice be retained.
# That is a false statement shipped to every user, produced by a substitution
# that looks purely cosmetic.
#
# So the product rename skips any line naming the Chromium Authors. Astro is a
# fork; saying so is correct, not a limitation.
# Two things must survive the rename, so the substitution sits inside two
# negated address blocks. `/a/!/b/!s/...` is NOT valid sed -- a negated
# address takes a block, not another address.
SKIP_ATTRIBUTION='/Chromium Authors/!{/ChromiumOS/!'
SKIP_ATTRIBUTION_END='}'


# The set of files is DISCOVERED, not listed.
#
# A hand-written list covered four files and the tree has thirty-one, so the
# browser called itself Astro on about:version and "About Chromium" in its own
# settings menu. That is the same defect as a scheme renamed in some layers and
# not others: a rename applied to a subset chosen by hand is a rename that will
# be wrong again the next time upstream adds a file.
#
# Two exclusions, both deliberate:
#
#   *google_chrome* — the Google-Chrome-branded string variants. They are inert
#     in this build (google_chrome_branding = false), so renaming them changes
#     nothing while creating the appearance of coverage.
#
#   ChromiumOS — a DIFFERENT product, not this one. A blanket rename turns it
#     into "AstroOS", a product that does not exist.
#
# Attribution is protected by SKIP_ATTRIBUTION, as above.
BRAND_FILES=()
while IFS= read -r f; do
    case "$f" in
        *google_chrome*) continue ;;
    esac
    BRAND_FILES+=("$f")
done < <(cd "$CHROMIUM_SRC" && grep -rlE "Chromium|$BROWSER_NAME" \
             --include='*.grd' --include='*.grdp' chrome components ui 2>/dev/null | sort)

# A discovery that matched nothing would rename nothing and print a clean
# summary, which is exactly what a working run looks like.
#
# The set is matched on EITHER product name, so it is stable across runs. Keyed
# on "Chromium" alone the floor fires on the second run -- a tree that is
# already branded looks identical to a traversal that broke, and this script
# must be re-runnable.
if [[ "${#BRAND_FILES[@]}" -lt 10 ]]; then
    echo "  ERROR: only ${#BRAND_FILES[@]} resource file(s) carry a product name." >&2
    echo "         Expected at least 10. Nothing was renamed; this is a broken" >&2
    echo "         traversal, not a tree that is already branded." >&2
    exit 1
fi

for rel in "${BRAND_FILES[@]}"; do
    apply_sed "$CHROMIUM_SRC/$rel" \
        "${SKIP_ATTRIBUTION}s/Chromium/$BROWSER_NAME/g${SKIP_ATTRIBUTION_END}"
done
echo "  ${#BRAND_FILES[@]} resource file(s) processed"

echo ""

# --- 2b. Install the product logo ---
#
# The strings rename alone leaves the Chromium logo in the omnibox chip, the
# settings header and the About row -- a browser that calls itself Astro while
# showing somebody else's mark. The assets already existed under branding/;
# nothing copied them into the tree, which is why they had never appeared.
#
# Only names Chromium actually ships are installed. Inventing a destination
# would put a file in the theme directory that no resource list references, so
# it would sit there looking applied and never render.
echo "=== Installing product logo ==="

LOGO_SRC="$ASTRO_ROOT/branding/product_logo"
LOGO_DEST="$CHROMIUM_SRC/chrome/app/theme/chromium"

if [[ -d "$LOGO_SRC" ]]; then
    installed=0
    skipped=""
    for src in "$LOGO_SRC"/*; do
        [[ -f "$src" ]] || continue
        name="$(basename "$src")"
        if [[ ! -f "$LOGO_DEST/$name" ]]; then
            skipped="$skipped $name"
            continue
        fi
        if $DRY_RUN; then
            echo "  [WOULD REPLACE] chrome/app/theme/chromium/$name"
        else
            cp "$src" "$LOGO_DEST/$name"
            echo "  Replaced chrome/app/theme/chromium/$name"
        fi
        installed=$((installed + 1))
    done

    # A silent zero here would read exactly like success while leaving every
    # Chromium logo in place, which is the state this whole section exists to
    # end.
    if [[ "$installed" -eq 0 ]]; then
        echo "  ERROR: no logo matched a file Chromium ships." >&2
        echo "         Nothing was branded; this is a failure, not a no-op." >&2
        exit 1
    fi
    if [[ -n "$skipped" ]]; then
        echo "  Not installed (no upstream file of that name):$skipped"
    fi
else
    echo "  ERROR: branding/product_logo/ not found at $LOGO_SRC" >&2
    exit 1
fi
echo ""

# --- 2c. Install the IN-UI product logo ---
#
# chrome/app/theme/chromium/ above holds the APPLICATION ICON -- the desktop
# entry, the installer, the window manager. It is NOT where the logo in the
# omnibox chip, the settings header and the About row comes from.
#
# That one is a chrome_scaled_image, which grit resolves under the per-scale
# theme directories, and in a build without Google branding
# theme_resources.grd declares exactly one of them:
#
#   IDR_PRODUCT_LOGO_32  file="${branding_path_component}/product_logo_32.png"
#
# Replacing the app-icon directory alone therefore changes nothing on screen.
# Measured: after doing exactly that, chrome_100_percent.pak did not even
# rebuild -- the files were not inputs to it -- while the Chromium logo stayed
# in the UI. The tell was already in this script's own output, "not installed
# (no upstream file of that name): product_logo_32.png", naming the one asset
# that mattered.
echo "=== Installing in-UI product logo ==="

# dest-relative-path|source-file|expected-width
UI_LOGOS=(
    "default_100_percent/chromium/product_logo_32.png|product_logo_32.png|32"
    "default_200_percent/chromium/product_logo_32.png|product_logo_64.png|64"
)

ui_installed=0
for entry in "${UI_LOGOS[@]}"; do
    IFS='|' read -r rel src expected <<< "$entry"
    dest="$CHROMIUM_SRC/chrome/app/theme/$rel"
    source_file="$LOGO_SRC/$src"

    if [[ ! -f "$source_file" ]]; then
        echo "  ERROR: missing branding asset $src" >&2
        exit 1
    fi
    if [[ ! -f "$dest" ]]; then
        echo "  ERROR: no upstream file at chrome/app/theme/$rel" >&2
        echo "         The theme layout changed; re-read theme_resources.grd" >&2
        echo "         rather than creating a destination grit does not read." >&2
        exit 1
    fi

    # The scale directories are a CONTRACT about pixel size: the 200% asset must
    # be twice the 100% one. A wrong-size file installs cleanly, renders blurry
    # or misaligned, and nothing anywhere reports it.
    actual="$(python3 -c "
import struct, sys
with open('$source_file', 'rb') as f:
    header = f.read(24)
sys.stdout.write(str(struct.unpack('>I', header[16:20])[0]))
")"
    if [[ "$actual" != "$expected" ]]; then
        echo "  ERROR: $src is ${actual}px wide, but chrome/app/theme/$rel" >&2
        echo "         requires ${expected}px. Installing it would ship a logo" >&2
        echo "         at the wrong scale." >&2
        exit 1
    fi

    if $DRY_RUN; then
        echo "  [WOULD REPLACE] chrome/app/theme/$rel  (${expected}px, from $src)"
    else
        cp "$source_file" "$dest"
        echo "  Replaced chrome/app/theme/$rel  (${expected}px, from $src)"
    fi
    ui_installed=$((ui_installed + 1))
done

if [[ "$ui_installed" -eq 0 ]]; then
    echo "  ERROR: no in-UI logo installed; the UI would keep Chromium's." >&2
    exit 1
fi
echo ""

# --- 3. Update Linux package metadata ---
echo "=== Updating Linux package metadata ==="

LINUX_PACKAGE_DIR="$CHROMIUM_SRC/chrome/installer/linux"
if [[ -d "$LINUX_PACKAGE_DIR" ]]; then
    for f in "$LINUX_PACKAGE_DIR"/common/installer.include \
             "$LINUX_PACKAGE_DIR"/debian/build.sh \
             "$LINUX_PACKAGE_DIR"/rpm/build.sh; do
        if [[ -f "$f" ]]; then
            apply_sed "$f" "s/chromium-browser/${PACKAGE_NAME:-astro-browser}/g"
        fi
    done
fi

# Check for the linux desktop file
DESKTOP_FILE="$CHROMIUM_SRC/chrome/installer/linux/common/desktop.template"
if [[ -f "$DESKTOP_FILE" ]]; then
    if $DRY_RUN; then
        echo "  [WOULD UPDATE] chrome/installer/linux/common/desktop.template"
    else
        sed -i "s/Chromium/$BROWSER_NAME/g" "$DESKTOP_FILE"
        echo "  Updated desktop.template"
    fi
fi
echo ""

# --- 4. Summary ---
echo "=== Branding Summary ==="
echo "  Browser name:    $BROWSER_NAME"
echo "  Company:         $COMPANY_FULL_NAME ($COMPANY_NAME)"
echo "  Package name:    ${PACKAGE_NAME:-astro-browser}"
echo "  RDN:             $RDN"
echo "  MAC Bundle ID:   $RDN"
echo "  Install dir:     ${INSTALL_DIR:-/opt/oxy/astro}"
echo ""

if $DRY_RUN; then
    echo "Dry run complete. Re-run without --dry-run to apply changes."
else
    echo "Branding applied successfully."
    echo ""
    echo "NOTE: The Chromium open source project links on about:version are"
    echo "intentionally preserved (they credit the upstream project)."
    echo ""
    echo "After applying branding, rebuild with: tools/build.sh"
fi
