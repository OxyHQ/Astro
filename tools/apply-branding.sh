#!/usr/bin/env bash
# apply-branding.sh — Applies Astro branding to the Chromium source tree.
#
# Reads branding/astro.conf and replaces all user-facing "Chromium" strings
# in .grd resource files, the BRANDING file, and Linux package metadata.
#
# Usage:
#   tools/apply-branding.sh          # from ~/Oxy/Astro/
#   tools/apply-branding.sh --dry-run  # preview changes without writing

set -euo pipefail

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
    [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]] && continue
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
    local short_path="${file#$CHROMIUM_SRC/}"

    if $DRY_RUN; then
        local count
        count=$(grep -c "Chromium" "$file" 2>/dev/null || true)
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
COPYRIGHT=Copyright @LASTCHANGE_YEAR@ $COMPANY_NAME. All rights reserved.
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

# The main branded strings file (chrome/app/chromium_strings.grd)
GRD_CHROMIUM_STRINGS="$CHROMIUM_SRC/chrome/app/chromium_strings.grd"
if [[ -f "$GRD_CHROMIUM_STRINGS" ]]; then
    apply_sed "$GRD_CHROMIUM_STRINGS" "s/Chromium/$BROWSER_NAME/g"
fi

# The components branded strings file
GRD_COMPONENTS_CHROMIUM="$CHROMIUM_SRC/components/components_chromium_strings.grd"
if [[ -f "$GRD_COMPONENTS_CHROMIUM" ]]; then
    apply_sed "$GRD_COMPONENTS_CHROMIUM" "s/Chromium/$BROWSER_NAME/g"
fi

# The generated resources file (main UI strings)
GRD_GENERATED="$CHROMIUM_SRC/chrome/app/generated_resources.grd"
if [[ -f "$GRD_GENERATED" ]]; then
    apply_sed "$GRD_GENERATED" "s/Chromium/$BROWSER_NAME/g"
fi

# Privacy Sandbox strings
GRD_PRIVACY="$CHROMIUM_SRC/components/privacy_sandbox_strings.grd"
if [[ -f "$GRD_PRIVACY" ]]; then
    apply_sed "$GRD_PRIVACY" "s/Chromium/$BROWSER_NAME/g"
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
