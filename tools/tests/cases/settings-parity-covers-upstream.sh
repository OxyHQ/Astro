#!/usr/bin/env bash
# Astro's settings page covers Chromium's, or says which parts it does not.
#
# "We replaced settings 100%" is a claim, and the baseline documents already
# supply the denominator: docs/astro-next/baseline/settings-parity.json is
# generated from Chromium's own router.ts, so it cannot quietly fall behind the
# browser it describes. What was missing is anything that reads the NUMERATOR.
# Without it, a Chromium roll that adds a settings screen lands, the baseline
# duly reports it as unimplemented, and nothing fails — the fact sits in a
# generated document nobody opens until someone claims parity.
#
# This case is the failure. Every one of the 110 upstream routes must either be
# claimed by a screen in the app's registry or declared in
# webui/app/settings-route-dispositions.json with a reason and a note, and the
# declarations are checked in both directions so one cannot outlive its reason.
#
# It reads COMMITTED SOURCE, not a build output: no node_modules, no dev server,
# no Chromium checkout. A gate that needed an install is a gate that gets skipped
# on the machine where it mattered.
#
# Three ways a check of this shape passes without meaning anything, each with a
# proof below rather than a promise:
#
#   * A BROKEN SCAN reads as full coverage. A walk that found no files, a string
#     scanner that parsed nothing, or a claim extraction that stopped matching
#     all report zero uncovered routes. The scanner declares its own floors and
#     exits 2 — a status of its own, distinct from both pass and fail — and the
#     rows below drive it below each floor to prove the floor fires.
#   * A COMMENT READ AS A CLAIM. The registry's prose names upstream routes
#     constantly. If prose counted, deleting a screen and leaving the comment
#     would read as covered; the row below deletes a claim, leaves the name in a
#     comment, and requires the route to be reported missing anyway.
#   * A STALE DECLARATION. A route dispositioned as "Astro does not have this"
#     while a screen routes it is a contradiction that hides a real screen from
#     anyone reading the file. It is reported, and named with the source line
#     that contradicts it.
#
# Every mutation runs against a COPY in the harness temp directory. The
# repository is never edited, so there is nothing to restore and no way for an
# interrupted run to leave a developer's tree modified.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

SCANNER="$ASTRO_ROOT/tools/tests/lib/scan-settings-routes.py"
BASELINE="$ASTRO_ROOT/docs/astro-next/baseline/settings-parity.json"
APP_DIR="$ASTRO_ROOT/webui/app/src/pages/settings"
DISPOSITIONS="$ASTRO_ROOT/webui/app/settings-route-dispositions.json"
REGISTRY="settings-page.tsx"
tmp="$(harness::tmpdir)"

harness::assert_file_exists "$SCANNER"
harness::assert_file_exists "$BASELINE"
harness::assert_file_exists "$DISPOSITIONS"
harness::assert_file_exists "$APP_DIR/$REGISTRY"

# scan <app-dir> <dispositions> [baseline]
scan() {
    harness::run python3 "$SCANNER" \
        --baseline "${3:-$BASELINE}" --app-dir "$1" --dispositions "$2"
}

# --------------------------------------------------------------------------
# The repository as committed
# --------------------------------------------------------------------------

scan "$APP_DIR" "$DISPOSITIONS"
harness::assert_status 0 "every upstream settings route is covered or declared"
harness::assert_output_contains "Settings parity is complete" "says what it verified"

# The denominator, asserted here as well as inside the scanner: this case is
# what a reader consults for the number, and a baseline that shrank would
# otherwise make the gate easier to pass without anyone noticing it had.
routes="$(grep -oE '[0-9]+ upstream route' "$RUN_STDOUT" | grep -oE '[0-9]+')"
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ "${routes:-0}" -lt 110 ]; then
    harness::fail "the scan measured against ${routes:-0} upstream route(s); Chromium's
      settings declares 110. Regenerate the baseline
      (tools/baseline/generate-all.sh) before trusting this result."
fi

covered="$(grep -oE '[0-9]+ covered' "$RUN_STDOUT" | grep -oE '[0-9]+')"
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ "${covered:-0}" -lt 50 ]; then
    harness::fail "only ${covered:-0} route(s) are covered by a screen. The registry has
      lost screens, or the claim extraction has stopped matching them."
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
# and the assertion that follows it then proves the ORIGINAL passes — which is
# already known. Every mutation here is checked for having changed something.
edit() {
    local path="$1" script="$2"
    if ! python3 - "$path" <<PYEOF
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

# --- A screen that stops claiming its route ----------------------------------

dropped="$(copy_app dropped-claim)"
edit "$dropped/$REGISTRY" "text.replace(\"upstream: ['DOWNLOADS']\", 'upstream: []', 1)"

scan "$dropped" "$DISPOSITIONS"
harness::assert_status 1 "a route no screen claims and no disposition covers"
harness::assert_output_contains "DOWNLOADS" "the unaccounted route is named"
harness::assert_output_contains "no screen claims it" "says what is wrong with it"
harness::assert_output_contains "settings-route-dispositions.json" "says where to declare it"

# --- The same, with the route name left in a comment -------------------------
#
# The proof that prose is not a claim. Without it the scanner could be matching
# anywhere in the file, and the registry's comments name upstream routes
# throughout — so deleting a screen while leaving its comment would read as
# covered.

commented="$(copy_app claim-in-a-comment)"
edit "$commented/$REGISTRY" \
    "text.replace(\"upstream: ['CAPTIONS']\", \"upstream: [] /* 'CAPTIONS' */\", 1)"

scan "$commented" "$DISPOSITIONS"
harness::assert_status 1 "a route named only inside a comment"
harness::assert_output_contains "CAPTIONS" "a commented-out claim does not count as coverage"

# --- A declaration for a route that does not exist upstream ------------------

stale="$tmp/stale-dispositions.json"
python3 - "$DISPOSITIONS" "$stale" <<'PYEOF'
import json
import sys

source, destination = sys.argv[1], sys.argv[2]
with open(source, encoding="utf-8") as handle:
    document = json.load(handle)
document["routes"]["DEFINITELY_NOT_A_ROUTE"] = {
    "reason": "google-service",
    "note": "An entry for a screen Chromium does not have, or once had.",
}
with open(destination, "w", encoding="utf-8") as handle:
    json.dump(document, handle, indent=2)
PYEOF

scan "$APP_DIR" "$stale"
harness::assert_status 1 "a declaration for a route Chromium does not have"
harness::assert_output_contains "DEFINITELY_NOT_A_ROUTE" "the stale entry is named"
harness::assert_output_contains "is not an" "says why it is stale"

# --- A declaration for a route the page DOES cover ---------------------------

contradiction="$tmp/contradictory-dispositions.json"
python3 - "$DISPOSITIONS" "$contradiction" <<'PYEOF'
import json
import sys

source, destination = sys.argv[1], sys.argv[2]
with open(source, encoding="utf-8") as handle:
    document = json.load(handle)
document["routes"]["DOWNLOADS"] = {
    "reason": "later-issue-99",
    "note": "Declared as missing while a screen in the registry routes it.",
}
with open(destination, "w", encoding="utf-8") as handle:
    json.dump(document, handle, indent=2)
PYEOF

scan "$APP_DIR" "$contradiction"
harness::assert_status 1 "a disposition for a route a screen already covers"
harness::assert_output_contains "declared as NOT covered, and covered anyway" \
    "the contradiction is named as one"
# The source line, in full: a finding that named only the route would leave the
# reader to go and find which screen contradicts it.
harness::assert_output_contains "settings-page.tsx:" "the contradicting line is located"
harness::assert_output_contains "upstream: ['DOWNLOADS']" "the contradicting line is quoted"

# --- A reason outside the vocabulary, and a missing note ---------------------

malformed="$tmp/malformed-dispositions.json"
python3 - "$DISPOSITIONS" "$malformed" <<'PYEOF'
import json
import sys

source, destination = sys.argv[1], sys.argv[2]
with open(source, encoding="utf-8") as handle:
    document = json.load(handle)
document["routes"]["SYNC"]["reason"] = "we-do-not-like-it"
document["routes"]["PEOPLE"]["note"] = ""
with open(destination, "w", encoding="utf-8") as handle:
    json.dump(document, handle, indent=2)
PYEOF

scan "$APP_DIR" "$malformed"
harness::assert_status 1 "a free-text reason and an empty note"
harness::assert_output_contains "we-do-not-like-it" "the invented reason is quoted"
harness::assert_output_contains "PEOPLE: no note" "the missing note is named"

# --------------------------------------------------------------------------
# Vacuity floors: nothing-was-measured must not read as clean
# --------------------------------------------------------------------------

empty="$tmp/empty-app"
mkdir -p "$empty"
scan "$empty" "$DISPOSITIONS"
harness::assert_status 2 "an app directory with no source in it"
harness::assert_output_contains "below the floor" "names the floor it fell under"
harness::assert_output_lacks "parity is complete" "must not read as a pass"

# One file, so the walk works and the claim count is what collapses. Without
# this row the file floor alone could be carrying the whole check.
thin="$tmp/thin-app"
rm -rf "$thin"
mkdir -p "$thin"
cp -R "$APP_DIR/." "$thin/"
rm -f "$thin/$REGISTRY" "$thin/sections/site-settings.content-types.ts"
scan "$thin" "$DISPOSITIONS"
harness::assert_status 2 "a source tree that still has files but no route claims"
harness::assert_output_contains "claimed route" "names the claim floor"

# A denominator that shrank. A coverage check against a truncated baseline
# passes trivially, and that must be a broken scan rather than a green run.
truncated="$tmp/truncated-baseline.json"
python3 - "$BASELINE" "$truncated" <<'PYEOF'
import json
import sys

source, destination = sys.argv[1], sys.argv[2]
with open(source, encoding="utf-8") as handle:
    document = json.load(handle)
document["routes"] = document["routes"][:5]
with open(destination, "w", encoding="utf-8") as handle:
    json.dump(document, handle, indent=2)
PYEOF

scan "$APP_DIR" "$DISPOSITIONS" "$truncated"
harness::assert_status 2 "a baseline that lists almost no routes"
harness::assert_output_contains "denominator is broken" "says why it refused"

harness::pass
