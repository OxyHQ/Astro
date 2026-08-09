#!/usr/bin/env bash
# Every chrome.send the settings app makes reaches a handler that is installed.
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

SCANNER="$ASTRO_ROOT/tools/tests/lib/scan-settings-handlers.py"
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

scan "$APP_DIR" "$CONTROLLER" "$MANIFEST"
harness::assert_status 0 "every settings chrome.send reaches an installed handler"
harness::assert_output_contains "Every settings chrome.send reaches an installed handler" \
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
harness::assert_output_lacks "Every settings chrome.send" "must not read as a pass"

harness::pass
