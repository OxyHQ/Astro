#!/usr/bin/env bash
# The synthetic profile fixtures (#6) must never carry anything credential-
# shaped, and the provenance split that keeps them honest must actually hold.
#
# The secret scan below is written so it can FAIL. A scanner that has never
# fired is indistinguishable from one that cannot fire — a broken character
# class, an unanchored pattern, a grep whose exit status is thrown away all
# read as "clean" forever — so every rule is mutation-tested here by planting a
# matching sample in a throwaway copy and asserting the same scan catches it,
# names the rule and names the file.
#
# The other half is the deferred fixtures. `History`, `Login Data`, `Web Data`,
# `Sessions` and friends are Chromium-owned formats that must be captured from
# a real build; a hand-written stand-in would pass a migration test while
# exercising no migration. This case proves `--verify` rejects a hand-filled
# one and accepts a properly recorded capture, because a check that rejects
# everything is no more useful than one that rejects nothing.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

GENERATOR="$ASTRO_ROOT/tools/baseline/make_profile_fixtures.py"
COMMITTED="$ASTRO_ROOT/test/astro-next/fixtures"
tmp="$(harness::tmpdir)"

harness::assert_file_exists "$GENERATOR"

# The pref patches are read from HEAD, not from disk, because the fixtures they
# describe are committed. Checking the generator's output against a working-tree
# parse would pass on the machine that generated the fixtures and fail for
# everybody else — which is the bug that made this whole file's guarantee
# hollow. Extracted into the fixture directory so every later grep is over
# committed bytes.
PREF_PATCH_020="$tmp/committed-020-register-oxy-prefs.patch"
PREF_PATCH_046="$tmp/committed-046-adblock-prefs.patch"
git -C "$ASTRO_ROOT" show HEAD:patches/astro/020-register-oxy-prefs.patch > "$PREF_PATCH_020"
git -C "$ASTRO_ROOT" show HEAD:patches/astro/046-adblock-prefs.patch > "$PREF_PATCH_046"
harness::assert_file_exists "$PREF_PATCH_020"
harness::assert_file_exists "$PREF_PATCH_046"

# --- Credential rules --------------------------------------------------------
#
# `/` is deliberately absent from the base64 class. It is a base64 alphabet
# character, but it is also the path separator, so including it makes every
# nested fixture path ("user-data/Default/AstroAdBlock/filterlists/...") a
# 40-character "blob" — and a rule that reports the fixture tree's own layout
# is a rule somebody deletes. Dropping it costs almost nothing: a real base64
# credential of any useful length contains a 40-character slash-free window,
# which the planted sample below (which does contain `/` and `+`) proves.
SECRET_RULES=(
    "jwt|eyJ[A-Za-z0-9_-]{10,}"
    "pem-private-key|-----BEGIN"
    "inline-credential|password[[:space:]]*=[[:space:]]*[^[:space:]]"
    "base64-blob|[A-Za-z0-9+]{40,}={0,2}"
    "high-entropy-hex|[0-9a-fA-F]{32,}"
)

# -a treats binary as text on purpose. A captured profile database is binary,
# and a scanner that skips binaries would wave through the one file most likely
# to hold a real credential.
scan_for_credentials() {
    local dir="$1" report="$2"
    local rule label pattern status
    : > "$report"
    for rule in "${SECRET_RULES[@]}"; do
        label="${rule%%|*}"
        pattern="${rule#*|}"
        status=0
        grep -rnaE -- "$pattern" "$dir" > "$tmp/rule-hits" || status=$?
        # grep exits 1 for "no match", which is the expected case; anything
        # above that is the scanner itself failing and must not read as clean.
        if [ "$status" -gt 1 ]; then
            harness::fail "scanning $dir for $label: grep failed with exit $status"
        fi
        sed "s|^|$label: |" "$tmp/rule-hits" >> "$report"
    done
}

assert_no_credentials() {
    local report="$1" what="$2"
    HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
    if [ -s "$report" ]; then
        printf -- '--- credential-shaped content ---\n' >&2
        cut -c1-200 "$report" | head -20 >&2
        harness::fail "$what: credential-shaped content found in the fixtures"
    fi
}

# --- The committed fixtures are current and verify ---------------------------

harness::run python3 "$GENERATOR" --verify
harness::assert_status 0 "the committed fixtures verify"
harness::assert_output_contains "profiles" "verify reports the profile count"
harness::assert_output_contains "awaiting browser capture" "verify reports deferred entries"

# --- The generator runs and produces a manifest ------------------------------
#
# Everything below works on scratch copies. A test that regenerates into the
# repository would rewrite the very files it is checking.

harness::run python3 "$GENERATOR" --output "$tmp/fixtures"
harness::assert_status 0 "the generator runs"
harness::assert_file_exists "$tmp/fixtures/manifest.json"
harness::assert_file_exists "$tmp/fixtures/user-data/Default/Preferences"
harness::assert_file_exists "$tmp/fixtures/user-data/Profile 1/Preferences"
harness::assert_file_exists "$tmp/fixtures/user-data/Local State"

# --- Regeneration is byte-stable, and the committed tree matches -------------
#
# Both properties in one check: regenerating on top of the COMMITTED fixtures
# must change nothing. If it changes something, either the generator is
# non-deterministic or the committed fixtures are stale — and a fixture set
# that silently drifts from the code it describes is the failure this whole
# tool exists to prevent.
cp -r "$COMMITTED" "$tmp/regenerated"
regen_before="$(harness::manifest "$tmp/regenerated")"
harness::run python3 "$GENERATOR" --output "$tmp/regenerated"
harness::assert_status 0 "regenerating over the committed fixtures"
harness::assert_tree_unchanged "$tmp/regenerated" "$regen_before"

# --verify must not write either.
committed_before="$(harness::manifest "$COMMITTED")"
harness::run python3 "$GENERATOR" --verify
harness::assert_status 0 "--verify against the committed fixtures"
harness::assert_tree_unchanged "$COMMITTED" "$committed_before"

# --- No fixture carries anything credential-shaped ---------------------------

scan_for_credentials "$tmp/fixtures" "$tmp/report-clean"
assert_no_credentials "$tmp/report-clean" "generated fixtures"

scan_for_credentials "$COMMITTED" "$tmp/report-committed"
assert_no_credentials "$tmp/report-committed" "committed fixtures"

# --- Prove every rule can fire ------------------------------------------------
#
# One planted sample per rule, in a throwaway copy, restored from the pristine
# tree between plants. Each assertion checks the rule name AND the file, so a
# rule that fires for the wrong reason is not mistaken for a working one.
PLANTED_SECRETS=(
    "jwt|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.astro-planted-not-real"
    "pem-private-key|-----BEGIN OPENSSH PRIVATE KEY-----"
    "inline-credential|password=astro-planted-not-real"
    "base64-blob|AbCdEfGhIjKlMnOpQrStUvWxYz0123456789AbCdEf/GhIjKlMnOp+QrStUvWx=="
    "high-entropy-hex|0123456789abcdef0123456789abcdef0123456789abcdef"
)

cp -r "$tmp/fixtures" "$tmp/planted"
PLANT_TARGET="user-data/Default/Preferences"

for plant in "${PLANTED_SECRETS[@]}"; do
    label="${plant%%|*}"
    sample="${plant#*|}"

    cp "$tmp/fixtures/$PLANT_TARGET" "$tmp/planted/$PLANT_TARGET"
    printf '%s\n' "$sample" >> "$tmp/planted/$PLANT_TARGET"

    scan_for_credentials "$tmp/planted" "$tmp/report-planted"

    HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
    if ! grep -q "^$label: " "$tmp/report-planted"; then
        printf -- '--- scan report ---\n' >&2
        cut -c1-200 "$tmp/report-planted" >&2
        harness::fail "rule '$label' did not fire on a planted sample; it cannot catch a real one"
    fi

    HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
    if ! grep -q "^$label: .*$PLANT_TARGET" "$tmp/report-planted"; then
        harness::fail "rule '$label' fired but did not name $PLANT_TARGET"
    fi
done

# The plants were the only cause: restoring the last one leaves the copy clean.
cp "$tmp/fixtures/$PLANT_TARGET" "$tmp/planted/$PLANT_TARGET"
scan_for_credentials "$tmp/planted" "$tmp/report-restored"
assert_no_credentials "$tmp/report-restored" "restored copy"

# --- Every deferred entry carries a usable capture command -------------------

harness::run python3 - "$tmp/fixtures/manifest.json" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    manifest = json.load(handle)

entries = manifest["entries"]
deferred = [e for e in entries if e["provenance"] == "requires-browser-capture"]
generated = [e for e in entries if e["provenance"] == "generated"]

# Vacuity floor: an empty or nearly empty entry list would satisfy every loop
# below without checking anything.
if len(deferred) < 5:
    raise SystemExit(f"only {len(deferred)} deferred entries; the manifest is not describing "
                     f"the Chromium-owned state this baseline defers")
if len(generated) < 10:
    raise SystemExit(f"only {len(generated)} generated entries; the fixture set is nearly empty")

for entry in entries:
    if entry["provenance"] not in ("generated", "requires-browser-capture"):
        raise SystemExit(f"{entry['path']}: unknown provenance {entry['provenance']!r}")

for entry in deferred:
    if not entry.get("capture_command", "").strip():
        raise SystemExit(f"{entry['path']}: deferred with no capture command, so nobody can "
                         f"produce it")
    if not entry.get("reason", "").strip():
        raise SystemExit(f"{entry['path']}: deferred with no recorded reason")
    expected = entry["path"] + manifest["capture_metadata_suffix"]
    if entry.get("capture_metadata") != expected:
        raise SystemExit(f"{entry['path']}: capture metadata path is "
                         f"{entry.get('capture_metadata')!r}, expected {expected!r}")

print(f"{len(deferred)} deferred entries carry a capture command and a reason")
PY
harness::assert_status 0 "deferred entries are actionable"
harness::assert_output_contains "carry a capture command and a reason" "manifest check ran"

# --- A hand-filled deferred fixture fails --verify ---------------------------

cp -r "$tmp/fixtures" "$tmp/handfilled"
DEFERRED_FIXTURE="$tmp/handfilled/user-data/Default/History"

# Control: the copy verifies before anything is planted, so the failures below
# are attributable to the plant and not to the copy.
harness::run python3 "$GENERATOR" --verify --output "$tmp/handfilled"
harness::assert_status 0 "an untouched copy verifies"

printf 'SQLite format 3\000not really a database\n' > "$DEFERRED_FIXTURE"
harness::run python3 "$GENERATOR" --verify --output "$tmp/handfilled"
harness::assert_nonzero_status "a hand-filled deferred fixture"
harness::assert_output_contains "hand-filled" "reason the hand-filled fixture is rejected"
harness::assert_output_contains "user-data/Default/History" "the offending path is named"

# The same file WITH a recorded capture is accepted. Without this the check
# above would be satisfied by a --verify that rejects every deferred file,
# which would make capturing one impossible.
cat > "$tmp/handfilled/user-data/Default/History.capture.json" <<'EOF'
{
  "captured_at": "2026-01-31",
  "captured_from": "Astro 146.0.7680.177 release build, linux x64",
  "capture_command": "chrome --user-data-dir=$ASTRO_CAPTURE_DIR",
  "astro_revision": "169f4eb"
}
EOF
harness::run python3 "$GENERATOR" --verify --output "$tmp/handfilled"
harness::assert_status 0 "a deferred fixture with recorded capture metadata"

# Metadata that omits a required field is not a recorded capture.
cat > "$tmp/handfilled/user-data/Default/History.capture.json" <<'EOF'
{
  "captured_at": "2026-01-31",
  "captured_from": "",
  "capture_command": "chrome --user-data-dir=$ASTRO_CAPTURE_DIR",
  "astro_revision": "169f4eb"
}
EOF
harness::run python3 "$GENERATOR" --verify --output "$tmp/handfilled"
harness::assert_nonzero_status "capture metadata missing a required field"
harness::assert_output_contains "captured_from" "the missing field is named"

# --- --verify catches edits and undeclared files -----------------------------
#
# Without these, "--verify passed" would say nothing about the generated half.

cp -r "$tmp/fixtures" "$tmp/edited"
printf '{"astro": {"ntp_show_weather": true}}\n' > "$tmp/edited/user-data/Default/Preferences"
harness::run python3 "$GENERATOR" --verify --output "$tmp/edited"
harness::assert_nonzero_status "a hand-edited generated fixture"
harness::assert_output_contains "does not match" "reason the edited fixture is rejected"

cp -r "$tmp/fixtures" "$tmp/extra"
printf 'undeclared\n' > "$tmp/extra/user-data/Default/StrayProfileBlob"
harness::run python3 "$GENERATOR" --verify --output "$tmp/extra"
harness::assert_nonzero_status "an undeclared file in the fixture tree"
harness::assert_output_contains "unexplained file" "reason the stray file is rejected"
harness::assert_output_contains "StrayProfileBlob" "the stray file is named"

# --- The fixture's preference keys are the ones the patches register ---------
#
# Read out of the COMMITTED patches HERE, independently of the generator:
# comparing the generator's output against the generator's own parse would pass
# even if the parse had stopped matching reality.
mapfile -t PATCH_PREFS < <(
    grep -hoE '^\+[[:space:]]*registry->Register[A-Za-z]+Pref\("[A-Za-z0-9_.]+"' \
        "$PREF_PATCH_020" "$PREF_PATCH_046" \
        | grep -oE '"[A-Za-z0-9_.]+"' \
        | tr -d '"' \
        | sort -u
)

# The floor stays at 15 deliberately. If the committed patches register fewer
# than that, the fixtures cannot be regenerated from committed content, and the
# answer is to commit the preference work — not to lower the number, which would
# ratify one machine's uncommitted state as the baseline.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ "${#PATCH_PREFS[@]}" -lt 15 ]; then
    worktree_count="$(
        grep -hoE '^\+[[:space:]]*registry->Register[A-Za-z]+Pref\("[A-Za-z0-9_.]+"' \
            "$ASTRO_ROOT/patches/astro/020-register-oxy-prefs.patch" \
            "$ASTRO_ROOT/patches/astro/046-adblock-prefs.patch" \
            | grep -coE '"[A-Za-z0-9_.]+"'
    )"
    harness::fail "parsed only ${#PATCH_PREFS[@]} preference names from the COMMITTED patches; expected at least 15. This working tree's copies register $worktree_count. Either the extraction is broken, prefs were removed, or the preference work is not committed yet"
fi

# Flatten the fixture into dotted pref paths, the way PrefService addresses
# them. A nested document is how Chromium stores them, so a flat-key fixture
# would look right to a reader and be invisible to the browser.
#
# The walk stops at a registered pref rather than descending through it: a
# dictionary pref's CONTENTS are its value ("oxy.adblock.site_overrides" holds
# one key per site), and treating those as pref paths would report every site
# in the fixture as an unregistered preference.
python3 - "$tmp/fixtures/user-data/Default/Preferences" "${PATCH_PREFS[@]}" \
    > "$tmp/pref-paths.txt" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    document = json.load(handle)
registered = set(sys.argv[2:])


def walk(node, prefix):
    if not isinstance(node, dict):
        return
    for key, value in node.items():
        path = f"{prefix}{key}"
        print(path)
        if path not in registered:
            walk(value, path + ".")


walk(document, "")
PY

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
for pref in "${PATCH_PREFS[@]}"; do
    if ! grep -qxF "$pref" "$tmp/pref-paths.txt"; then
        harness::fail "preference '$pref' is registered by a patch but missing from the fixture"
    fi
done

# And the fixture must not have wandered off the other way: every astro./oxy.
# leaf in the fixture has to be a pref something actually registers.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
while read -r path; do
    case " ${PATCH_PREFS[*]} " in
        *" $path "*) continue ;;
    esac
    # Intermediate nodes ("oxy", "oxy.adblock") are structure, not prefs.
    if grep -qE "^$path\." "$tmp/pref-paths.txt"; then
        continue
    fi
    harness::fail "fixture contains '$path', which no patch registers"
done < <(grep -E '^(astro|oxy)\.' "$tmp/pref-paths.txt")

harness::pass
