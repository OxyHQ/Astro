#!/usr/bin/env bash
ASTRO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ASTRO_ROOT
# shellcheck source=tools/lib/astro-common.sh
source "$ASTRO_ROOT/tools/lib/astro-common.sh"
UNGOOGLED_DIR="$ASTRO_ROOT/.ungoogled-chromium"
PATCHES_DIR="$ASTRO_ROOT/patches/ungoogled"

# The ungoogled-chromium revision is selected by browser.lock.json, never by
# searching for a tag that looks close enough.
#
# The previous implementation tried the exact tag, then `git tag -l
# "$MAJOR.*" | tail -1`, then master with a printed warning and a ZERO exit —
# so a version bump could silently build against a patch set written for a
# different Chromium, and the only trace was a line of console output. That is
# the "no exact-version lookup falls back to a merely similar version" rule in
# epic #3, and it is now enforced by tools/sync-sources.sh, which checks out
# the locked commit or fails.

astro::info "=== Syncing ungoogled-chromium patches ==="

astro::require_file "$ASTRO_ROOT/browser.lock.json" "lock file"
LOCKED_UNGOOGLED="$(python3 "$ASTRO_ROOT/tools/lib/lock.py" --get ungoogled_chromium.commit)"
LOCKED_VERSION="$(python3 "$ASTRO_ROOT/tools/lib/lock.py" --get ungoogled_chromium.version)"

if [ ! -d "$UNGOOGLED_DIR/.git" ]; then
    astro::die_with_hint \
        "ungoogled-chromium checkout not found at $UNGOOGLED_DIR" \
        "Run tools/sync-sources.sh, which checks it out at the locked commit."
fi

CURRENT="$(git -C "$UNGOOGLED_DIR" rev-parse HEAD)"
if [ "$CURRENT" != "$LOCKED_UNGOOGLED" ]; then
    astro::die_with_hint \
        "ungoogled-chromium is not at the locked commit." \
        "  on disk: $CURRENT" \
        "  locked:  $LOCKED_UNGOOGLED ($LOCKED_VERSION)" \
        "" \
        "Nothing nearby is substituted. Run tools/sync-sources.sh."
fi

astro::info ">>> Using ungoogled-chromium $LOCKED_VERSION ($LOCKED_UNGOOGLED)"
cd "$UNGOOGLED_DIR"

# Copy patches to our patches directory
echo ""
echo ">>> Copying patches..."

# Core patches (domain substitution, binary pruning, etc.)
rm -rf "$PATCHES_DIR/core" "$PATCHES_DIR/extra"
mkdir -p "$PATCHES_DIR/core" "$PATCHES_DIR/extra"

# These copies are load-bearing: the patch stack Astro applies IS this
# content. A failure here previously left an empty or partial patch directory
# and the script still reported a successful sync.
astro::require_dir "patches/core" "ungoogled core patches"
cp -r patches/core/. "$PATCHES_DIR/core/"

astro::require_dir "patches/extra" "ungoogled extra patches"
cp -r patches/extra/. "$PATCHES_DIR/extra/"

# Also copy domain substitution and pruning configs
if [ -f "domain_regex.list" ]; then
    cp domain_regex.list "$PATCHES_DIR/"
fi
if [ -f "domain_substitution.list" ]; then
    cp domain_substitution.list "$PATCHES_DIR/"
fi
if [ -f "pruning.list" ]; then
    cp pruning.list "$PATCHES_DIR/"
fi

CORE_COUNT="$(find "$PATCHES_DIR/core" -name "*.patch" | wc -l | tr -d '[:space:]')"
EXTRA_COUNT="$(find "$PATCHES_DIR/extra" -name "*.patch" | wc -l | tr -d '[:space:]')"

if [ "$CORE_COUNT" -eq 0 ]; then
    astro::die "Sync produced no core patches; the patch stack would be empty."
fi

echo ""
echo "=== Sync complete ==="
echo "Core patches: $CORE_COUNT"
echo "Extra patches: $EXTRA_COUNT"
echo "Patches at: $PATCHES_DIR/"
echo ""
echo "Next: tools/apply-patches.sh"
