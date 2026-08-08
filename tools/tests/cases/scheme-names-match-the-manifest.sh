#!/usr/bin/env bash
# Astro's scheme names exist in two places that must never disagree: the product
# manifest, which is #9's source of truth, and the C++ constants #11 registers
# with Chromium.
#
# They are NOT generated from each other, and that is deliberate. Generating the
# header would place a GENERATED file inside the target //chrome/browser reaches
# through allow_circular_includes_from — exactly the failure
# chrome/browser/BUILD.gn:8392-8414 warns about ("the gn build graph may miss
# generated dependencies, which will result in compile errors"), and it surfaces
# only in some configurations. So the header is hand-written and this case is
# what makes the duplication safe.
#
# A drift here is not cosmetic. The manifest is what the installer, the OS
# registration and the identity tests read; the header is what the browser
# actually registers. If they diverge, the product claims one scheme and speaks
# another.
#
# The happy path is the weakest part of any check like this, because it passes
# whether or not the checker can see anything. Every disagreement shape below is
# therefore exercised against a mutated FIXTURE — never the repository — and the
# assertion is on the reason printed, not merely on a non-zero exit.
#
# Two shapes are worth naming because a value comparison would certify the wrong
# thing on both:
#
#   * A header could define the untrusted scheme by CONCATENATION
#     (`kAstroUIScheme "-untrusted"`), which carries the right value while
#     making one scheme a derivative of the other. They are separate security
#     principals — separate origins, separate site URLs, separate process locks.
#   * The manifest could pin the names correctly and then hand one of them to
#     the OPERATING SYSTEM as a direct-launch scheme or an x-scheme-handler MIME
#     type, which lets any web page link straight into a privileged surface.
#     That is validator rule 9, and it is cross-field, so the schema subset
#     cannot express it.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

CHECKER="$ASTRO_ROOT/tools/lib/scheme_constants.py"
MANIFEST="$ASTRO_ROOT/docs/astro-next/architecture/product.example.json"
SCHEMA="$ASTRO_ROOT/docs/astro-next/architecture/product.schema.json"
COMMON="$ASTRO_ROOT/tools/tests/fixtures/scheme-constants/common"
HEADER="$COMMON/url_constants.h"

harness::assert_file_exists "$CHECKER"
harness::assert_file_exists "$MANIFEST"
harness::assert_file_exists "$SCHEMA"
harness::assert_file_exists "$HEADER"

# --- The product tree, which this commit cannot certify ----------------------
#
# //astro/common/url_constants.h is #11's deliverable and is not in this commit,
# while the manifest, the schema and the checker are #9's and are. That is a
# legitimate state for a commit to be in; certifying the product's scheme
# constants from it is not.
#
# So this asserts a REFUSAL, not a skip. Two properties make the difference:
#
#   * The checker asks GIT whether the header is part of the commit, never the
#     filesystem. An untracked working copy — which is exactly what a developer
#     has here today — satisfies every filesystem test and is in no commit, so a
#     filesystem test would pass in a working tree and fail in a clean checkout
#     of the same commit. That disagreement is what tools/verify-clean-head.sh
#     refuses, and it is how this case came to be written this way.
#   * The expected status is asserted EXACTLY, and 3 is a status the checker
#     produces for one reason only. The moment #11 commits the header, this run
#     returns the real verdict, this assertion goes red, and whoever landed the
#     header has to replace it with the join below. There is no branch here to
#     leave un-taken and no way to reach the absent-header expectation with the
#     file present.
harness::run python3 "$CHECKER" --check-product
harness::assert_status 3 "the product header is not part of this commit"
harness::assert_output_contains "REFUSED" "it refuses rather than reporting agreement"
harness::assert_output_contains "common/url_constants.h" "it names the absent header"
harness::assert_output_contains "issue #11" "it names the issue that lands it"
harness::assert_output_contains "NOT checked against the manifest" \
    "it says plainly which property went unchecked"

# --- Fixtures ----------------------------------------------------------------
#
# Each mutation gets its own copy of everything the checker reads, so no case can
# be affected by the one before it, and the repository is never written to.
#
# The manifest, the schema and the legacy spellings in every fixture below are
# the REPOSITORY'S OWN files, copied. Only the header and the common/ directory
# come from a fixture, because the product's are not in this commit — so the
# real manifest is genuinely under test here, and what is stubbed is the one
# artifact that could not be.

TMP="$(harness::tmpdir)"

# Recorded before the first fixture is built, and compared at the end. Every
# file the fixtures copy FROM is in this set.
SOURCES_BEFORE="$(sha256sum "$MANIFEST" "$SCHEMA" "$HEADER" \
    "$ASTRO_ROOT/src/chrome/browser/oxy/oxy_auth_service.h" \
    "$ASTRO_ROOT/src/chrome/browser/oxy/oxy_auth_callback_handler.cc")"

# fixture <name> -> prints the directory holding a pristine copy
fixture() {
    local name="$1" dir="$TMP/$1" relative
    mkdir -p "$dir/common"
    cp "$MANIFEST" "$dir/product.json"
    cp "$SCHEMA" "$dir/product.schema.json"
    cp -a "$COMMON/." "$dir/common/"
    # The pre-existing spellings the checker also gates, copied under their real
    # relative paths so a mutation below never touches the repository's own.
    while IFS= read -r relative; do
        mkdir -p "$dir/legacy/$(dirname "$relative")"
        cp "$ASTRO_ROOT/$relative" "$dir/legacy/$relative"
    done < <(python3 -c 'import sys; sys.path.insert(0, sys.argv[1]); import scheme_constants; print("\n".join(p for p, _ in scheme_constants.LEGACY_SPELLINGS))' "$ASTRO_ROOT/tools/lib")
    printf '%s\n' "$dir"
}

check_fixture() {
    local dir="$1"
    harness::run python3 "$CHECKER" --check \
        --manifest "$dir/product.json" \
        --schema "$dir/product.schema.json" \
        --header "$dir/common/url_constants.h" \
        --legacy-root "$dir/legacy" \
        --common-dir "$dir/common"
}

# Each fixture must still PASS before it is mutated. Without this a typo in the
# copy, a bad path or a checker that fails on every input would make every
# rejection below look like a working detector.
control="$(fixture control)"
check_fixture "$control"
harness::assert_status 0 "an unmutated fixture"

# And it passed having MEASURED the repository's own manifest, not just having
# agreed with itself. Every assertion here is about a real committed file: the
# names are read out of docs/astro-next/architecture/product.example.json, rule
# 9 walks that document's own platform blocks, and the legacy spellings are the
# two files under src/chrome/browser/oxy/ that spell a scheme literally.
#
# The names themselves are the deliverable, so they are asserted rather than
# only asserting that two files match each other. Two files can agree on the
# wrong value.
harness::assert_output_contains "schemes.trusted    = astro " "the trusted scheme is astro"
harness::assert_output_contains "schemes.untrusted  = astro-untrusted" \
    "the untrusted scheme is astro-untrusted"
harness::assert_output_contains "kAstroUIScheme" "the trusted scheme's C++ constant"
harness::assert_output_contains "2 scheme constants agree" "both schemes were measured"
harness::assert_output_contains "legacy spelling of schemes.trusted" \
    "the pre-existing overlay spellings are gated too, not just documented"
harness::assert_output_contains "none collides" "rule 9 ran against real fields"

# --- The header drifts from the manifest -------------------------------------

drift="$(fixture drift)"
python3 - "$drift/common/url_constants.h" <<'PY'
import pathlib, sys
path = pathlib.Path(sys.argv[1])
path.write_text(path.read_text().replace('kAstroUIScheme[] = "astro"',
                                         'kAstroUIScheme[] = "astro-ui"'))
PY
check_fixture "$drift"
harness::assert_nonzero_status "a header whose value drifted"
harness::assert_output_contains "drift: manifest schemes.trusted" "names the drifted field"
harness::assert_output_contains "'astro-ui'" "names the wrong value"

# --- The constant is gone -----------------------------------------------------
#
# A rename is the likeliest way this happens, and it is silent: the header still
# compiles, and every caller updated in the same change compiles too.

renamed="$(fixture renamed)"
python3 - "$renamed/common/url_constants.h" <<'PY'
import pathlib, sys
path = pathlib.Path(sys.argv[1])
path.write_text(path.read_text().replace("kAstroUIUntrustedScheme[]",
                                         "kAstroIsolatedScheme[]"))
PY
check_fixture "$renamed"
harness::assert_nonzero_status "a renamed constant"
harness::assert_output_contains "no constant named kAstroUIUntrustedScheme" \
    "names the constant that went missing"

# --- One scheme derived from the other ----------------------------------------
#
# The value is still exactly "astro-untrusted" after concatenation, so a check
# that compared values alone would pass this.

derived="$(fixture derived)"
python3 - "$derived/common/url_constants.h" <<'PY'
import pathlib, sys
path = pathlib.Path(sys.argv[1])
path.write_text(path.read_text().replace(
    'kAstroUIUntrustedScheme[] = "astro-untrusted"',
    'kAstroUIUntrustedScheme[] = kAstroUIScheme "-untrusted"'))
PY
check_fixture "$derived"
harness::assert_nonzero_status "a scheme built by concatenation"
harness::assert_output_contains "not a single string literal" "names the derivation"
harness::assert_output_contains "separate security principals" "says why it matters"

# --- A scheme constant with no manifest field ---------------------------------

extra="$(fixture extra)"
python3 - "$extra/common/url_constants.h" <<'PY'
import pathlib, sys
path = pathlib.Path(sys.argv[1])
addition = 'inline constexpr char kAstroDebugScheme[] = "astro-debug";\n'
path.write_text(path.read_text().replace("}  // namespace astro",
                                         addition + "\n}  // namespace astro"))
PY
check_fixture "$extra"
harness::assert_nonzero_status "a scheme constant nobody declared"
harness::assert_output_contains "kAstroDebugScheme" "names the undeclared constant"
harness::assert_output_contains "no manifest field behind it" "explains the reverse join"

# --- The schema stops pinning the value ---------------------------------------
#
# Without `const` the manifest is a source of truth nobody constrains, and the
# header would agree with it all the way to a scheme nobody reviewed.

unpinned="$(fixture unpinned)"
python3 - "$unpinned/product.schema.json" <<'PY'
import json, pathlib, sys
path = pathlib.Path(sys.argv[1])
schema = json.loads(path.read_text())
del schema["properties"]["schemes"]["properties"]["trusted"]["const"]
path.write_text(json.dumps(schema, indent=2))
PY
check_fixture "$unpinned"
harness::assert_nonzero_status "a schema that stopped pinning the scheme"
harness::assert_output_contains "not pinned with \`const\`" "names the missing pin"

# --- The manifest disagrees with its own schema -------------------------------

repinned="$(fixture repinned)"
python3 - "$repinned/product.json" <<'PY'
import json, pathlib, sys
path = pathlib.Path(sys.argv[1])
manifest = json.loads(path.read_text())
manifest["schemes"]["trusted"] = "astr0"
path.write_text(json.dumps(manifest, indent=2))
PY
check_fixture "$repinned"
harness::assert_nonzero_status "a manifest that left the pinned value"
harness::assert_output_contains "expected 'astro', got 'astr0'" "the schema itself rejects it"

# --- The two schemes collapse into one ----------------------------------------
#
# Distinct principals cannot share a string. Pinning both to the same value and
# making the manifest and header agree with it is the one way this passes every
# other check here, which is why it is asserted separately.

collapsed="$(fixture collapsed)"
python3 - "$collapsed/product.schema.json" "$collapsed/product.json" <<'PY'
import json, pathlib, sys
schema_path, manifest_path = (pathlib.Path(p) for p in sys.argv[1:3])
schema = json.loads(schema_path.read_text())
untrusted = schema["properties"]["schemes"]["properties"]["untrusted"]
untrusted["const"] = "astro"
untrusted.pop("pattern", None)
schema_path.write_text(json.dumps(schema, indent=2))
manifest = json.loads(manifest_path.read_text())
manifest["schemes"]["untrusted"] = "astro"
manifest_path.write_text(json.dumps(manifest, indent=2))
PY
python3 - "$collapsed/common/url_constants.h" <<'PY'
import pathlib, sys
path = pathlib.Path(sys.argv[1])
path.write_text(path.read_text().replace(
    'kAstroUIUntrustedScheme[] = "astro-untrusted"',
    'kAstroUIUntrustedScheme[] = "astro"'))
PY
check_fixture "$collapsed"
harness::assert_nonzero_status "two schemes sharing one string"
harness::assert_output_contains "not distinct" "names the collapse"
harness::assert_output_contains "separate security principals" "says why it matters"

# --- Rule 9: an internal scheme handed to the operating system ----------------
#
# Both shapes below leave the names correct everywhere the checks above look.
# The manifest still pins `astro`, the header still carries it, and the two are
# still distinct — and the browser has nonetheless published its privileged
# internal scheme as something any web page can link to.

launch="$(fixture launch)"
python3 - "$launch/product.json" <<'PY'
import json, pathlib, sys
path = pathlib.Path(sys.argv[1])
manifest = json.loads(path.read_text())
channels = manifest["platforms"]["windows"]["channels"]
channels["stable"]["direct_launch_url_scheme"] = manifest["schemes"]["trusted"]
path.write_text(json.dumps(manifest, indent=2))
PY
check_fixture "$launch"
harness::assert_nonzero_status "an internal scheme used as the direct-launch scheme"
harness::assert_output_contains "direct_launch_url_scheme" "names the field"
harness::assert_output_contains "link straight into a privileged surface" \
    "says what the consequence is"

handler="$(fixture handler)"
python3 - "$handler/product.json" <<'PY'
import json, pathlib, sys
path = pathlib.Path(sys.argv[1])
manifest = json.loads(path.read_text())
scheme = manifest["schemes"]["untrusted"]
manifest["platforms"]["linux"]["mime_types"].append(f"x-scheme-handler/{scheme}")
path.write_text(json.dumps(manifest, indent=2))
PY
check_fixture "$handler"
harness::assert_nonzero_status "an internal scheme registered as a MIME handler"
harness::assert_output_contains "x-scheme-handler/astro-untrusted" "names the entry"
harness::assert_output_contains "external protocol handler" "names the mechanism"

# --- Only url_constants.h may spell a scheme ----------------------------------
#
# #11's registration code lives in this same directory and correctly uses the
# constants. This is what keeps it that way — and it is why the drift checker
# does not need a second, parallel check over common/astro_schemes.cc.

literal="$(fixture literal)"
cat > "$literal/common/astro_schemes.cc" <<'CC'
// Copyright 2026 Oxy. Astro product module.
#include "astro/common/astro_schemes.h"
namespace astro {
void AddAstroSchemes(content::ContentClient::Schemes* schemes) {
  schemes->standard_schemes.push_back("astro");
}
}  // namespace astro
CC
check_fixture "$literal"
harness::assert_nonzero_status "a second file in common/ spelling the scheme"
harness::assert_output_contains "astro_schemes.cc spells the scheme" "names the file"
harness::assert_output_contains "reaches it through astro::" "names the fix"

# --- Nothing to measure must not read as a pass -------------------------------
#
# A moved file, a renamed declaration shape or a broken regex all produce an
# empty parse. Exit 2 separates "could not measure" from "measured and agreed".

empty="$(fixture empty)"
printf '// deliberately declares nothing\n' > "$empty/common/url_constants.h"
check_fixture "$empty"
harness::assert_status 2 "a header the parser found nothing in"
harness::assert_output_contains "no \`inline constexpr char\` declarations found" \
    "says it could not measure, rather than reporting agreement"

missing="$(fixture missing)"
rm -f "$missing/common/url_constants.h"
check_fixture "$missing"
harness::assert_status 2 "a header that is not there at all"
harness::assert_output_contains "header not found" "names what is missing"

# Rule 9 has the same hazard from the other direction: it walks the document for
# two field NAMES, so renaming either takes it silently out of reach.
#
# Deleting the fields does not reach this — the schema requires both, so a
# deletion is caught one layer earlier as a validation error. A coordinated
# rename in the schema AND the manifest is the shape that validates cleanly
# while leaving the rule inspecting nothing, which is exactly why the floor is
# on the COUNT of fields examined rather than on their presence.
inert="$(fixture inert)"
python3 - "$inert/product.json" "$inert/product.schema.json" <<'PY'
import json, pathlib, sys
manifest_path, schema_path = (pathlib.Path(p) for p in sys.argv[1:3])

def rename(node, old, new):
    if isinstance(node, dict):
        if old in node:
            node[new] = node.pop(old)
        for value in node.values():
            rename(value, old, new)
        if "required" in node and isinstance(node["required"], list):
            node["required"] = [new if r == old else r for r in node["required"]]
    elif isinstance(node, list):
        for item in node:
            rename(item, old, new)

for path in (manifest_path, schema_path):
    document = json.loads(path.read_text())
    rename(document, "direct_launch_url_scheme", "launch_scheme")
    rename(document, "mime_types", "mime")
    path.write_text(json.dumps(document, indent=2))
PY
check_fixture "$inert"
harness::assert_status 2 "a manifest in which rule 9 has nothing to examine"
harness::assert_output_contains "rule 9 examined no fields" "says the rule went inert"

# --- A pre-existing spelling stops matching -----------------------------------
#
# The scheme is spelled in the legacy overlay too, from before this header
# existed — and one of those two files compares a bare literal rather than the
# constant its neighbour declares. Renaming the scheme without them would break
# sign-in and compile perfectly, so they are gated, not merely documented.

stale="$(fixture stale)"
python3 - "$stale/legacy/src/chrome/browser/oxy/oxy_auth_callback_handler.cc" <<'PY'
import pathlib, sys
path = pathlib.Path(sys.argv[1])
text = path.read_text()
assert 'SchemeIs("astro")' in text
path.write_text(text.replace('SchemeIs("astro")', 'SchemeIs("astro-legacy")'))
PY
check_fixture "$stale"
harness::assert_nonzero_status "a legacy spelling left behind by a rename"
harness::assert_output_contains "oxy_auth_callback_handler.cc no longer spells" \
    "names the file that drifted"

# And the declared list must not rot into a list of files nobody has.
absent="$(fixture absent)"
rm -f "$absent/legacy/src/chrome/browser/oxy/oxy_auth_service.h"
check_fixture "$absent"
harness::assert_nonzero_status "a declared spelling whose file is gone"
harness::assert_output_contains "delete the entry in the same change" \
    "tells you to shrink the list rather than leaving it vacuous"

# --- The repository was never written to --------------------------------------
#
# Every mutation above is a copy. If one of them ever addressed the real file,
# this suite would start reporting whatever the last case left behind.
#
# Asked directly rather than by re-running the checker: a second clean run would
# only prove the checker still agrees with itself, while a content manifest of
# the files the fixtures COPY FROM proves the specific thing at stake. The
# fixture header is in that set, so a mutation that reached back through the
# copy would be named here.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
sources_after="$(sha256sum "$MANIFEST" "$SCHEMA" "$HEADER" \
    "$ASTRO_ROOT/src/chrome/browser/oxy/oxy_auth_service.h" \
    "$ASTRO_ROOT/src/chrome/browser/oxy/oxy_auth_callback_handler.cc")"
if [ "$sources_after" != "$SOURCES_BEFORE" ]; then
    printf -- '--- before ---\n%s\n--- after ---\n%s\n' \
        "$SOURCES_BEFORE" "$sources_after" >&2
    harness::fail "a fixture mutation reached the repository's own files"
fi

# And the product refusal is unchanged by any of it: no fixture created a
# common/ directory in the repository, and none of them made the checker start
# certifying the header it just said it could not see.
harness::run python3 "$CHECKER" --check-product
harness::assert_status 3 "the product refusal, after every fixture mutation"

harness::pass
