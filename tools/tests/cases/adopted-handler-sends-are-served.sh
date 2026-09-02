#!/usr/bin/env bash
# Every chrome.send an ADOPTED-HANDLER surface makes reaches an installed handler.
#
# Renamed from settings-sends-reach-an-adopted-handler.sh when management became
# the second such surface: a file named for one surface that covers two is the
# kind of stale name nothing recomputes. The surfaces are declared in
# webui/app/handler-surfaces.json, so a third is an entry rather than a copy of
# this file.
#
# `chrome.send` to a message no installed WebUIMessageHandler registered is not
# an error anyone sees. `WebUIImpl::ProcessWebUIMessage` reaches
# DUMP_WILL_BE_NOTREACHED, which is fatal in a DCHECK build and a SILENT NO-OP
# in the release build users get. The control draws, the button depresses,
# nothing happens, nothing is logged.
#
# Four sections of astro://settings shipped in exactly that state -- appearance,
# downloads, on-startup and import -- because nothing in the toolchain can see
# it. tsc sees a string literal. The dev fixtures answer every message
# themselves, which is what they are for, so the dev server looks correct. A
# browser run only finds the buttons somebody thought to press.
#
# The scanner joins four things over committed source alone, and the case below
# drives every direction of that join:
#
#   * a message the app sends that no installed handler registers;
#   * an event it subscribes to that no installed handler fires;
#   * a handler the manifest vouches for and the controller does not install;
#   * a handler the controller installs and the manifest does not describe.
#
# Three ways a check of this shape passes without meaning anything, each proved
# below rather than promised:
#
#   * A COMMENT READ AS A CALL. Every section documents the handler it talks to
#     and quotes its message names while doing it -- `default-browser.tsx`
#     tabulates all three of its messages in prose. A scanner reading comments
#     would keep reporting a message long after the call was deleted.
#   * A FIXTURE READ AS A CALL. Each section's `*.fixtures.ts` names the same
#     messages, as the mock's answers. Counting those would check the fixtures
#     against themselves.
#   * NOTHING MEASURED, READING AS CLEAN. The app not parsed, the manifest not
#     parsed, or the controller's handler construction no longer recognised.
#     Each has a floor and its own exit status of 2.
#
# The controller has deliberately NO count floor -- see the scanner's own note.
# Its vacuity question is whether the parse accounts for every
# AddMessageHandler call in the file, which is what tells "installs few
# handlers" (the state the defect was found in) from "the regex stopped
# matching".
#
# Every mutation runs against a COPY in the harness temp directory. The
# repository is never edited.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

SCANNER="$ASTRO_ROOT/tools/tests/lib/scan-adopted-handlers.py"
APP_DIR="$ASTRO_ROOT/webui/app/src/pages/settings"
CONTROLLER="$ASTRO_ROOT/src/chrome/browser/oxy/webui/astro_settings_ui.cc"
MANIFEST="$ASTRO_ROOT/webui/app/settings-handler-messages.json"
tmp="$(harness::tmpdir)"

harness::assert_file_exists "$SCANNER"
harness::assert_file_exists "$CONTROLLER"
harness::assert_file_exists "$MANIFEST"
harness::assert_file_exists "$APP_DIR/sections/appearance.tsx"

# scan <app-dir> <controller> <manifest>
scan() {
    harness::run python3 "$SCANNER" \
        --app-dir "$1" --controller "$2" --manifest "$3"
}

# edit <file> <python-expression-body> — rewrite a file, refusing a no-op.
#
# A mutation that matched nothing leaves the fixture identical to the original,
# and the assertion after it then proves the ORIGINAL behaves that way, which is
# already known. Every mutation here is checked for having changed something.
edit() {
    local path="$1" script="$2"
    if ! python3 - "$path" <<PYEOF
import json
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

# copy_app <name>  /  copy_file <name> <source>
copy_app() {
    local dest="$tmp/$1-app"
    rm -rf "$dest"
    mkdir -p "$dest"
    cp -R "$APP_DIR/." "$dest/"
    printf '%s\n' "$dest"
}

copy_file() {
    local dest="$tmp/$1"
    cp "$2" "$dest"
    printf '%s\n' "$dest"
}

# --------------------------------------------------------------------------
# The repository as committed
# --------------------------------------------------------------------------

# EVERY adopted surface, from the declared set — not settings alone.
#
# The join used to be written once against settings, so `management`, which
# adopts an upstream handler and sends seven messages, was invisible to it: the
# failure it exists to catch is a silent no-op in release, and a second surface
# with no coverage is the same defect waiting with nobody watching. The set
# lives in webui/app/handler-surfaces.json, so a third surface is an ENTRY
# rather than a second copy of this file.
SURFACES="$ASTRO_ROOT/webui/app/handler-surfaces.json"
harness::assert_file_exists "$SURFACES"

surface_count="$(python3 -c "
import json, sys
print(len(json.load(open(sys.argv[1]))['surfaces']))
" "$SURFACES")"

# A FLOOR ON THE SET ITSELF. A declaration file that lost its entries — or a
# reader that stopped finding them — would loop zero times and this case would
# report every assertion below as passing, which is the shape it exists to
# refuse. Raise it when a surface is added; lowering it needs the surface's
# deletion in the same change.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ "${surface_count:-0}" -lt 2 ]; then
    harness::fail "handler-surfaces.json declares ${surface_count:-0} surface(s); at
      least 2 are expected (settings and management). Either a surface was
      dropped without its coverage, or the set is no longer being read."
fi

# One scan per surface, each with its OWN floors. A surface that sends seven
# messages cannot borrow the floor of one that sends thirty-five: the floor is
# what tells "measured and clean" from "measured nothing", so it has to be that
# surface's own number.
while IFS=$'\t' read -r s_name s_app s_ctrl s_manifest s_msgs s_events s_declared; do
    harness::run python3 "$SCANNER" \
        --surface "$s_name" \
        --app-dir "$ASTRO_ROOT/$s_app" \
        --controller "$ASTRO_ROOT/$s_ctrl" \
        --manifest "$ASTRO_ROOT/$s_manifest" \
        --min-messages "$s_msgs" \
        --min-events "$s_events" \
        --min-declared "$s_declared"
    harness::assert_status 0 "$s_name: every chrome.send reaches an installed handler"
    # Names ITSELF in its own verdict. Without this the loop could scan one
    # surface three times and read as three surfaces checked.
    harness::assert_output_contains "$s_name: every chrome.send reaches an installed handler" \
        "$s_name: says which surface it verified"
done < <(python3 -c "
import json, sys
for s in json.load(open(sys.argv[1]))['surfaces']:
    print('\t'.join(str(s[k]) for k in (
        'surface', 'app_dir', 'controller', 'manifest',
        'min_messages', 'min_events', 'min_declared')))
" "$SURFACES")

# The settings surface again by name, because everything below mutates it
# specifically and needs the baseline in $RUN_STDOUT.
scan "$APP_DIR" "$CONTROLLER" "$MANIFEST"
harness::assert_status 0 "every settings chrome.send reaches an installed handler"
harness::assert_output_contains "Settings: every chrome.send reaches an installed handler" \
    "says what it verified"

# The counts, asserted here as well as inside the scanner. This case is what a
# reader consults for them, and a scan that quietly started reading less would
# otherwise pass more easily without anyone noticing it had.
sends="$(grep -oE '[0-9]+ send\(s\)' "$RUN_STDOUT" | head -1 | grep -oE '^[0-9]+')"
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ "${sends:-0}" -lt 30 ]; then
    harness::fail "only ${sends:-0} send call(s) were found. Eleven sections call a
      handler; the app source has stopped being read."
fi

# --------------------------------------------------------------------------
# The defect this exists for
# --------------------------------------------------------------------------

# --- A message no handler anywhere registers ---------------------------------

bogus="$(copy_app bogus-message)"
edit "$bogus/sections/system.tsx" \
    "text.replace(\"send('showProxySettings')\", \"send('astroBogusHandlerMessage')\", 1)"

scan "$bogus" "$CONTROLLER" "$MANIFEST"
harness::assert_status 1 "a send to a message nothing registers"
harness::assert_output_contains "astroBogusHandlerMessage" "the message is named"
harness::assert_output_contains "sections/system.tsx:" "the call site is located"
harness::assert_output_contains "silent no-op" "says what the consequence is"

# --- A message a REAL handler registers, that this page does not install ------
#
# The likelier shape by far, and the one the four broken sections had: the
# message is spelled correctly and the handler exists. Only the installation is
# missing, so a check that merely validated names against Chromium would pass.

unadopted="$(copy_file unadopted.cc "$CONTROLLER")"
edit "$unadopted" \
    "text.replace('''  web_ui->AddMessageHandler(
      std::make_unique<::settings::AppearanceHandler>(web_ui));
''', '', 1)"

scan "$APP_DIR" "$unadopted" "$MANIFEST"
harness::assert_status 1 "a correctly-spelled message whose handler is not installed"
harness::assert_output_contains "resetPinnedToolbarActions" "the orphaned message is named"
harness::assert_output_contains "openCustomizeChrome" "and so is the other one"
harness::assert_output_contains "AppearanceHandler registers it" \
    "the handler that would have served it is named"
harness::assert_output_contains "vouching for" \
    "the stale declaration is reported in its own right"

# --- An event no installed handler pushes ------------------------------------
#
# A dead listener is quieter still than a dead send: there is no button to
# press, the row simply stays on its pending state forever.

deaf="$(copy_app dead-listener)"
edit "$deaf/sections/downloads.tsx" \
    "text.replace(\"addWebUIListener('auto-open-downloads-changed'\",
                  \"addWebUIListener('auto-open-downloads-chnged'\", 1)"

scan "$deaf" "$CONTROLLER" "$MANIFEST"
harness::assert_status 1 "a listener for an event nothing fires"
harness::assert_output_contains "auto-open-downloads-chnged" "the event is named"
harness::assert_output_contains "never fires" "says what the consequence is"

# --- The right class, in the wrong namespace ---------------------------------
#
# Not hypothetical: this is the mistake that was made writing the controller.
# Every handler in chrome/browser/ui/webui/settings/ is in `namespace settings`
# except SafetyHubHandler, which is at global scope -- settings_ui.cc uses the
# bare name only because it is itself inside that namespace. The compiler does
# catch this one, which is exactly why the join runs on the fully-qualified name
# rather than the bare class: a check that matched `SafetyHubHandler` either way
# would be a check that agreed with whichever spelling it was shown.

misnamespaced="$(copy_file misnamespaced.cc "$CONTROLLER")"
edit "$misnamespaced" \
    "text.replace('std::make_unique<::SafetyHubHandler>',
                  'std::make_unique<::settings::SafetyHubHandler>', 1)"

scan "$APP_DIR" "$misnamespaced" "$MANIFEST"
harness::assert_status 1 "a handler installed under the wrong namespace"
harness::assert_output_contains "settings::SafetyHubHandler: installed by the controller" \
    "the wrong spelling is named"
harness::assert_output_contains "SafetyHubHandler: declared by the manifest" \
    "and the entry it failed to match"
harness::assert_output_contains "getVersionCardData" "its messages are reported dead"

# --- A handler installed and not described -----------------------------------
#
# Not a broken control on its own, but it makes the manifest stop describing the
# page -- and everything above is decided from the manifest.

undeclared="$(copy_file undeclared.json "$MANIFEST")"
edit "$undeclared" \
    "json.dumps({**json.loads(text), 'handlers': {k: v for k, v in json.loads(text)['handlers'].items() if k != 'SystemHandler'}}, indent=2)"

scan "$APP_DIR" "$CONTROLLER" "$undeclared"
harness::assert_status 1 "a handler the manifest does not describe"
harness::assert_output_contains "SystemHandler: installed by" "the handler is named"
harness::assert_output_contains "has stopped describing this page" "says why it matters"

# --------------------------------------------------------------------------
# Prose and fixtures are not calls
# --------------------------------------------------------------------------

# Every section's header comment names the messages it sends. Moving a real call
# into a comment must make the scanner stop seeing it -- otherwise it is
# matching documentation, and a deleted call would go on reporting as present.

commented="$(copy_app call-in-a-comment)"
edit "$commented/sections/system.tsx" \
    "text.replace(\"onPress={() => send('showProxySettings')}\",
                  \"onPress={() => undefined} /* send('astroBogusCommentedMessage') */\", 1)"

scan "$commented" "$CONTROLLER" "$MANIFEST"
harness::assert_status 0 "a send inside a comment is not a call"
harness::assert_output_lacks "astroBogusCommentedMessage" "a commented-out call is not scanned"

# The dev fixtures name the same messages, as the mock's ANSWERS. Reading them
# would check the fixtures against the manifest and never look at the sections.

fixtured="$(copy_app bogus-in-a-fixture)"
edit "$fixtured/sections/appearance.fixtures.ts" \
    "text.replace('resetPinnedToolbarActions: () => undefined,',
                  'astroBogusFixtureMessage: () => undefined,', 1)"

scan "$fixtured" "$CONTROLLER" "$MANIFEST"
harness::assert_status 0 "a message declared only in a dev fixture is not a call"
harness::assert_output_lacks "astroBogusFixtureMessage" "the fixtures are not scanned"

# --------------------------------------------------------------------------
# Vacuity floors: nothing-was-measured must not read as clean
# --------------------------------------------------------------------------

# The controller's handler construction stops being recognised. This is the
# dangerous one: with no handler parsed out, EVERY message is unserved, so the
# scan is loud rather than silent -- but the report would name thirty-five
# innocent call sites and no cause. The parse-completeness check names the cause.
reshaped="$(copy_file reshaped.cc "$CONTROLLER")"
edit "$reshaped" \
    "re.sub(r'AddMessageHandler\\(\\s*std::make_unique<', 'AddMessageHandler(MakeHandler<', text)"

scan "$APP_DIR" "$reshaped" "$MANIFEST"
harness::assert_status 2 "a controller whose handler construction is unrecognised"
harness::assert_output_contains "could be read" "says the parse fell short"
harness::assert_output_lacks "Every settings chrome.send" "must not read as a pass"

# The file installs nothing at all -- a different break from the one above, and
# the one that happens when the wrong file is passed.
silent="$(copy_file silent.cc "$CONTROLLER")"
edit "$silent" "text.replace('AddMessageHandler', 'AddSomethingElse')"

scan "$APP_DIR" "$silent" "$MANIFEST"
harness::assert_status 2 "a controller that installs no handlers at all"
harness::assert_output_contains "installs no" "says nothing was found to measure"

# The manifest is truncated. Every message would then be "served by nobody",
# which is a report about the manifest dressed up as a report about the app.
thin="$(copy_file thin.json "$MANIFEST")"
edit "$thin" \
    "json.dumps({**json.loads(text), 'handlers': {'SystemHandler': json.loads(text)['handlers']['SystemHandler']}}, indent=2)"

scan "$APP_DIR" "$CONTROLLER" "$thin"
harness::assert_status 2 "a manifest with almost nothing in it"
harness::assert_output_contains "below the floor" "names the floor it fell under"

# The manifest is not readable as JSON at all.
broken="$(copy_file broken.json "$MANIFEST")"
edit "$broken" "text.replace('{', 'not json', 1)"

scan "$APP_DIR" "$CONTROLLER" "$broken"
harness::assert_status 2 "a manifest that is not JSON"
harness::assert_output_contains "could not be read" "says it could not read it"

# The app source stops being read. Sends and listeners have separate floors
# because they break independently -- a rename of the listener helper alone
# would leave the send scan healthy.
mute="$(copy_app listeners-unrecognised)"
for module in "$mute"/sections/*.tsx; do
    python3 - "$module" <<'PYEOF'
import re
import sys

path = sys.argv[1]
with open(path, encoding="utf-8") as handle:
    text = handle.read()
with open(path, "w", encoding="utf-8") as handle:
    handle.write(re.sub(r"\baddWebUIListener\b", "subscribeToBrowser", text))
PYEOF
done

scan "$mute" "$CONTROLLER" "$MANIFEST"
harness::assert_status 2 "a source tree whose push subscriptions are unrecognised"
harness::assert_output_contains "addWebUIListener call(s) found" "names the listener floor"

empty="$tmp/empty-app"
mkdir -p "$empty"
scan "$empty" "$CONTROLLER" "$MANIFEST"
harness::assert_status 2 "an app directory with no source in it"
harness::assert_output_lacks "every chrome.send reaches" "must not read as a pass"

# --------------------------------------------------------------------------
# The loop can fail, per surface
# --------------------------------------------------------------------------
#
# Everything above proves the SETTINGS scan can fail. That says nothing about
# the other entries: a loop that skipped them, or read one surface's paths
# three times, would pass every assertion so far. So each declared surface has
# one message deleted from the handler that registers it, and each must go red
# on its own paths.
#
# Deleting a message the page SENDS is the mutation that matters, because it is
# the defect in miniature: the manifest stops vouching for it, the page keeps
# calling it, and in a real browser that is a button that depresses and does
# nothing.
while IFS=$'\t' read -r s_name s_app s_ctrl s_manifest s_msgs s_events s_declared; do
    victim="$(python3 -c "
import json, re, sys
manifest, app_dir = sys.argv[1], sys.argv[2]
declared = set()
for handler in json.load(open(manifest))['handlers'].values():
    declared.update(handler.get('messages', []))
# A message this surface actually SENDS, so removing it breaks the join rather
# than only shrinking the declaration.
import pathlib
sent = set()
for path in pathlib.Path(app_dir).rglob('*.ts*'):
    sent.update(re.findall(r\"\\b(?:send|sendWithPromise)\\s*(?:<[^<>()]*>)?\\s*\\(\\s*'([^']+)'\", path.read_text(encoding='utf-8')))
both = sorted(declared & sent)
print(both[0] if both else '')
" "$ASTRO_ROOT/$s_manifest" "$ASTRO_ROOT/$s_app")"

    HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
    if [ -z "$victim" ]; then
        harness::fail "$s_name: no message is both declared and sent, so the mutation
          below would prove nothing. Either the manifest and the page have
          nothing in common — which is the defect this case exists for — or one
          of the two is no longer being read."
    fi

    holed="$(copy_file "$s_name-manifest-hole.json" "$ASTRO_ROOT/$s_manifest")"
    edit "$holed" "json.dumps({**json.loads(text), 'handlers': {
        name: {**h, 'messages': [m for m in h.get('messages', []) if m != '$victim']}
        for name, h in json.loads(text)['handlers'].items()}}, indent=2)"

    harness::run python3 "$SCANNER" \
        --surface "$s_name" \
        --app-dir "$ASTRO_ROOT/$s_app" \
        --controller "$ASTRO_ROOT/$s_ctrl" \
        --manifest "$holed" \
        --min-messages "$s_msgs" \
        --min-events "$s_events" \
        --min-declared 1
    harness::assert_status 1 "$s_name: a sent message no installed handler registers"
    harness::assert_output_contains "$victim" "$s_name: names the message it cannot serve"
done < <(python3 -c "
import json, sys
for s in json.load(open(sys.argv[1]))['surfaces']:
    print('\t'.join(str(s[k]) for k in (
        'surface', 'app_dir', 'controller', 'manifest',
        'min_messages', 'min_events', 'min_declared')))
" "$SURFACES")

harness::pass
