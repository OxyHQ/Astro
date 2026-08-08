#!/usr/bin/env bash
# A searchable control names a screen its own section routes.
#
# The settings page's search field indexes what each section DECLARES it
# renders, and a declaration may name the fragment the control is on:
#
#     {id: 'settings.privacy.security.dns.mode', on: '/security'}
#
# That fragment is the whole of what activating the hit does, and getting it
# wrong is silent in both of the ways it can be wrong. A fragment nothing
# claims falls through `targetForPath` to the DEFAULT section, so a mistyped
# `/securty` opens Appearance. A fragment ANOTHER section routes opens a real
# screen that really does not have the control on it. Neither is a type error,
# neither is a runtime error, and both look to a user like a page that has lost
# a setting rather than like a bug anyone would report.
#
# The completeness direction here is deliberately narrow: a declared control
# must reference a fragment its section routes. It is NOT "the screen at that
# fragment draws this control" -- that is not decidable from the registry (the
# labels are computed in JSX, some from tables, some per row), and a check that
# guessed would be a check its next reader could not trust.
#
# Three ways a check of this shape passes without meaning anything, each with a
# proof below rather than a promise:
#
#   * A BROKEN PARSE reads as clean. No sections read, no fragments read, or no
#     controls read all produce "nothing misplaced". Each has a floor and its
#     own exit status of 2, and the rows below drive the scan under each one.
#   * THE OBJECT FORM SPECIFICALLY going unrecognised, which is the shape a
#     refactor breaks. Bare ids would still parse, so the control count stays
#     healthy and only the thing this case exists for stops being measured.
#     That has a floor of its own.
#   * A COMMENT READ AS A DECLARATION. Both the registry and the strings
#     modules discuss fragments in prose constantly. The row below moves a real
#     declaration into a comment and requires the control to be reported as
#     unplaced anyway.
#
# Every mutation runs against a COPY in the harness temp directory. The
# repository is never edited.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

SCANNER="$ASTRO_ROOT/tools/tests/lib/scan-settings-controls.py"
APP_DIR="$ASTRO_ROOT/webui/app/src/pages/settings"
REGISTRY="settings-page.tsx"
PRIVACY="sections/privacy.strings.ts"
tmp="$(harness::tmpdir)"

harness::assert_file_exists "$SCANNER"
harness::assert_file_exists "$APP_DIR/$REGISTRY"
harness::assert_file_exists "$APP_DIR/$PRIVACY"

# scan <app-dir>
scan() {
    harness::run python3 "$SCANNER" --app-dir "$1"
}

# --------------------------------------------------------------------------
# The repository as committed
# --------------------------------------------------------------------------

scan "$APP_DIR"
harness::assert_status 0 "every searchable control names a screen its section routes"
harness::assert_output_contains "Every searchable control names a screen" "says what it verified"

# The counts, asserted here as well as inside the scanner: this case is what a
# reader consults for them, and a scan that quietly started reading less would
# otherwise pass more easily without anyone noticing it had.
placed="$(grep -oE '[0-9]+ of them naming a screen' "$RUN_STDOUT" | grep -oE '^[0-9]+')"
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ "${placed:-0}" -lt 20 ]; then
    harness::fail "only ${placed:-0} control(s) name the screen they are on. Six sections
      declare subpage controls; the strings modules have stopped being read, or
      the declarations have been removed."
fi

# --------------------------------------------------------------------------
# Fixtures
# --------------------------------------------------------------------------

# copy_app <name> — a writable copy of the settings source to mutate.
copy_app() {
    local dest="$tmp/$1"
    rm -rf "$dest"
    mkdir -p "$dest"
    cp -R "$APP_DIR/." "$dest/"
    printf '%s\n' "$dest"
}

# edit <file> <python-expression-body> — rewrite a file, refusing a no-op.
#
# A mutation that matched nothing produces a fixture identical to the original,
# and the assertion after it then proves the ORIGINAL passes -- which is already
# known. Every mutation here is checked for having changed something.
edit() {
    local path="$1" script="$2"
    if ! python3 - "$path" <<PYEOF
import re
import sys

path = sys.argv[1]
with open(path, encoding="utf-8") as handle:
    text = handle.read()
mutated = $script
if mutated == text:
    raise SystemExit("the mutation matched nothing; the proof would be vacuous")
with open(path, "w", encoding="utf-8") as handle:
    handle.write(mutated)
PYEOF
    then
        harness::fail "fixture mutation of $path changed nothing"
    fi
}

# --- A fragment no section routes at all -------------------------------------

nowhere="$(copy_app fragment-nothing-routes)"
edit "$nowhere/$PRIVACY" \
    "text.replace(\"'settings.privacy.security.dns.mode', on: '/security'\",
                  \"'settings.privacy.security.dns.mode', on: '/securty'\", 1)"

scan "$nowhere"
harness::assert_status 1 "a control declared on a fragment nothing routes"
harness::assert_output_contains "settings.privacy.security.dns.mode" "the control is named"
harness::assert_output_contains "/securty" "the bad fragment is quoted"
harness::assert_output_contains "routed by no section at all" "says what is wrong with it"
# The location, in full: a finding that named only the control would leave the
# reader to go and find which of seventeen strings modules declared it.
harness::assert_output_contains "privacy.strings.ts:" "the declaring line is located"
harness::assert_output_contains "/security," "the fragments it could have named are listed"

# --- A fragment ANOTHER section routes ---------------------------------------
#
# The more dangerous of the two, and the one a "does this fragment exist?" check
# would miss entirely: the screen opens, renders perfectly, and is the wrong one.

elsewhere="$(copy_app fragment-of-another-section)"
edit "$elsewhere/$PRIVACY" \
    "text.replace(\"'settings.privacy.security.dns.mode', on: '/security'\",
                  \"'settings.privacy.security.dns.mode', on: '/fonts'\", 1)"

scan "$elsewhere"
harness::assert_status 1 "a control declared on another section's subpage"
harness::assert_output_contains "/fonts" "the borrowed fragment is quoted"
harness::assert_output_contains "routed by appearance instead" "names the section that owns it"

# --- The same declaration, moved into a comment ------------------------------
#
# The proof that prose is not a declaration. Without it the scanner could be
# matching anywhere in the file, and both the registry and the strings modules
# discuss fragments in prose throughout.

commented="$(copy_app declaration-in-a-comment)"
edit "$commented/$PRIVACY" \
    "text.replace(\"{id: 'settings.privacy.security.dns.mode', on: '/security'},\",
                  \"/* {id: 'settings.privacy.security.dns.mode', on: '/securty'}, */\", 1)"

scan "$commented"
harness::assert_status 0 "a declaration inside a comment declares nothing"
harness::assert_output_lacks "/securty" "a commented-out fragment is not checked"

# --- A section whose control list the registry no longer imports --------------

orphaned="$(copy_app control-list-not-imported)"
edit "$orphaned/$REGISTRY" \
    "text.replace(\"import {privacyControls} from './sections/privacy.strings.ts';\", '', 1)"
edit "$orphaned/$PRIVACY" \
    "text.replace('export const privacyControls', 'export const privacyControlsRenamed', 1)"

scan "$orphaned"
harness::assert_status 1 "a section naming a control list the registry does not import"
harness::assert_output_contains "privacy: names the control list privacyControls" \
    "the section and the missing export are both named"
harness::assert_output_contains "unsearchable" "says what the consequence is"

# --------------------------------------------------------------------------
# Vacuity floors: nothing-was-measured must not read as clean
# --------------------------------------------------------------------------

# The object form specifically stops being recognised. Bare ids still parse, so
# the control count stays healthy and only this case's whole subject vanishes.
# Without this floor that is a green run.
unplaced="$(copy_app object-form-unrecognised)"
for module in "$unplaced"/sections/*.strings.ts; do
    python3 - "$module" <<'PYEOF'
import re
import sys

path = sys.argv[1]
with open(path, encoding="utf-8") as handle:
    text = handle.read()
with open(path, "w", encoding="utf-8") as handle:
    handle.write(re.sub(r"\{id: ('[^']*'), on: '[^']*'\}", r"\1", text))
PYEOF
done

scan "$unplaced"
harness::assert_status 2 "a source tree where no control names a screen"
harness::assert_output_contains "naming a screen, below the floor" "names the floor it fell under"
harness::assert_output_lacks "Every searchable control" "must not read as a pass"

# The section table is gone by that name. Every downstream count collapses with
# it, and "no sections" would otherwise mean "no controls to find fault with".
headless="$(copy_app registry-table-renamed)"
edit "$headless/$REGISTRY" "text.replace('const SECTIONS = {', 'const SECTIONS_RENAMED = {', 1)"

scan "$headless"
harness::assert_status 2 "a registry whose section table cannot be found"
harness::assert_output_contains "registry could not be read" "says it could not read it"

# The table is found and its ENTRIES are not -- a different break from the one
# above, and the one a reformat produces. Quoted keys are valid TypeScript and
# mean exactly what bare ones do.
reshaped="$(copy_app registry-entries-unrecognised)"
edit "$reshaped/$REGISTRY" \
    "re.sub(r'(?m)^  ([a-zA-Z][a-zA-Z0-9]*): \{\$', r\"  '\\\\1': {\", text)"

scan "$reshaped"
harness::assert_status 2 "a registry whose section entries are no longer recognised"
harness::assert_output_contains "section(s) out of the registry" "names the section floor"

# The strings modules stop being read while the registry still parses. A
# separate floor from the one above, because the two break independently.
stripped="$(copy_app strings-modules-empty)"
for module in "$stripped"/sections/*.strings.ts; do
    python3 - "$module" <<'PYEOF'
import re
import sys

path = sys.argv[1]
with open(path, encoding="utf-8") as handle:
    text = handle.read()
# Empty every control list, leaving the export and the type in place.
with open(path, "w", encoding="utf-8") as handle:
    handle.write(re.sub(r"(export const [A-Za-z0-9_]+Controls[^=]*=\s*)\[.*?\n\];",
                        r"\1[];", text, flags=re.S))
PYEOF
done

scan "$stripped"
harness::assert_status 2 "a source tree whose sections declare no controls at all"
harness::assert_output_contains "control entr(ies), below the floor" "names the control floor"

empty="$tmp/empty-app"
mkdir -p "$empty"
scan "$empty"
harness::assert_status 2 "an app directory with no source in it"
harness::assert_output_lacks "Every searchable control" "must not read as a pass"

harness::pass
