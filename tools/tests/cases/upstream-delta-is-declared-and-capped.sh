#!/usr/bin/env bash
# Every Chromium-owned file the //astro integration modifies must be declared in
# tools/upstream.allowlist, with an owner, an issue and a cap on added lines —
# and no shape may remove an upstream line.
#
# The delta this gate exists for grew from three Chromium-owned files to ten
# with nothing in the repository able to notice, which is the state that makes
# a path-only "may this file be touched" answer insufficient:
# 007-oxy-auth-build-hook.patch was 7 added lines against 36 REMOVED, and those
# 36 stripped Safe Browsing notification content detection, accessibility,
# Screen AI and the dangerous-download UI. It would have passed any allowlist
# that only asked WHICH file, because chrome/browser/BUILD.gn is exactly the
# file a build hook should touch.
#
# The clean run comes FIRST, deliberately. A red row in a failure table means
# nothing unless the same fixture is known to go green without the mutation:
# otherwise a broken fixture reports every row as a pass for the wrong reason.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

GATE="$ASTRO_ROOT/tools/check-upstream-delta.sh"
TMP="$(harness::tmpdir)"
FIXTURE_BASE=""

# --------------------------------------------------------------------------
# Fixture
#
# A synthetic Chromium checkout carrying, against its base commit: three
# declared //astro hooks, one change a declared patch accounts for, one file
# the declared pruning list removes, and one new file a declared patch creates.
# Everything a real tree has, at a size a test can reason about.
# --------------------------------------------------------------------------

build_fixture() {
    local root="$1"
    local src="$root/chromium-src"
    local patches="$root/patches"

    rm -rf "$root"
    mkdir -p "$src" "$patches/ungoogled/core" "$patches/astro"

    harness::make_chromium_fixture "$src"

    mkdir -p "$src/chrome/browser" "$src/base/test/data" "$src/content/public/common"

    cat > "$src/chrome/browser/BUILD.gn" <<'EOF'
static_library("browser") {
  allow_circular_includes_from = [
    "//chrome/browser/preloading",
  ]

  deps = [
    ":browser_process",
  ]
}
EOF

    cat > "$src/chrome/browser/DEPS" <<'EOF'
include_rules = [
  "+apps",
]
EOF

    cat > "$src/chrome/browser/chrome_browser_main.cc" <<'EOF'
#include "chrome/browser/browser_process.h"

void Create() {
  chrome::AddMetricsExtraParts(main_parts.get());
}
EOF

    cat > "$src/chrome/browser/about_flags.cc" <<'EOF'
const FeatureEntry kFeatureEntries[] = {
};
EOF

    cat > "$src/chrome/browser/patched.cc" <<'EOF'
void Patched() {
  UpstreamCall();
}
EOF

    cat > "$src/content/public/common/url_utils.cc" <<'EOF'
bool IsWebUIScheme(const std::string& scheme) {
  return scheme == kChromeUIScheme;
}
EOF

    printf 'BINARY TEST DATA\n' > "$src/base/test/data/binary.bin"
    # Genuinely binary, NUL byte and all: git reports a modified binary file as
    # `M` in --name-status and then emits "Binary files ... differ" with no
    # `+++` header and no hunks, so its diff text never arrives. That is the
    # shape the parse-mismatch floor exists for.
    printf 'chrome\0icon\n' > "$src/chrome/browser/opaque.dat"

    git -C "$src" add -A
    git -C "$src" commit --quiet -m "fixture base"
    FIXTURE_BASE="$(git -C "$src" rev-parse HEAD)"

    # --- the declared patch series -------------------------------------
    #
    # Read from `series` rather than globbed, because a patch file nobody
    # applies must not be able to excuse a change in the tree.

    cat > "$patches/ungoogled/core/example.patch" <<'EOF'
--- a/chrome/browser/patched.cc
+++ b/chrome/browser/patched.cc
@@ -1,3 +1,3 @@
 void Patched() {
-  UpstreamCall();
+  UngoogledCall();
 }
EOF
    printf 'core/example.patch\n' > "$patches/ungoogled/series"

    cat > "$patches/astro/001-new-file.patch" <<'EOF'
--- /dev/null
+++ b/chrome/browser/astro_created.h
@@ -0,0 +1,1 @@
+// created by a declared patch
EOF
    printf '001-new-file.patch\n' > "$patches/astro/series"

    printf 'base/test/data/binary.bin\n' > "$patches/ungoogled/pruning.list"

    cat > "$root/overlay.allowlist" <<'EOF'
dir chrome/browser/oxy
EOF

    cat > "$root/upstream.allowlist" <<'EOF'
gn-append    chrome/browser/BUILD.gn               owner=test issue=7  max-added=4
include-rule chrome/browser/DEPS                   owner=test issue=7  max-added=1
call-hook    chrome/browser/chrome_browser_main.cc owner=test issue=7  max-added=2
planned      content/public/common/url_utils.cc    owner=test issue=12 max-added=40
EOF

    # --- the working tree: what the integration actually did ------------

    # gn-append: a circular-include allowance and two deps labels. Both deps
    # labels are load-bearing upstream — GN requires every
    # allow_circular_includes_from entry to also appear in deps, and the roll-up
    # is what causes astro/BUILD.gn to be parsed at all.
    cat > "$src/chrome/browser/BUILD.gn" <<'EOF'
static_library("browser") {
  allow_circular_includes_from = [
    "//astro/browser",
    "//chrome/browser/preloading",
  ]

  deps = [
    "//astro:browser",
    "//astro/browser",
    ":browser_process",
  ]
}
EOF

    cat > "$src/chrome/browser/DEPS" <<'EOF'
include_rules = [
  "+astro",
  "+apps",
]
EOF

    cat > "$src/chrome/browser/chrome_browser_main.cc" <<'EOF'
#include "astro/browser/astro_browser_main_extra_parts.h"
#include "chrome/browser/browser_process.h"

void Create() {
  chrome::AddMetricsExtraParts(main_parts.get());
  main_parts->AddParts(astro::CreateExtraParts());
}
EOF

    # A change the declared patch accounts for; it must subtract to nothing.
    cat > "$src/chrome/browser/patched.cc" <<'EOF'
void Patched() {
  UngoogledCall();
}
EOF

    # A deletion the declared pruning list accounts for.
    rm -f "$src/base/test/data/binary.bin"

    # A new file a declared patch creates.
    printf '// created by a declared patch\n' > "$src/chrome/browser/astro_created.h"
}

run_gate() {
    local root="$1"
    shift
    env ASTRO_CHROMIUM_SRC="$root/chromium-src" "$GATE" \
        --chromium-src "$root/chromium-src" \
        --base "$FIXTURE_BASE" \
        --allowlist "$root/upstream.allowlist" \
        --patches "$root/patches" \
        "$@"
}

# --------------------------------------------------------------------------
# 1. The clean, within-cap delta PASSES
#
# This is the discriminator for every row below. Without it a fixture that
# cannot build reports each mutation as a refusal that fired, when in fact
# nothing was ever measured.
# --------------------------------------------------------------------------

CLEAN="$TMP/clean"
harness::setup_run build_fixture "$CLEAN"

# The gate reads tools/overlay.allowlist from the repository root by default,
# and the fixture has its own; --chromium-src plus an explicit overlay
# allowlist keeps the case away from the real 55 GB tree entirely.
harness::run env ASTRO_CHROMIUM_SRC="$CLEAN/chromium-src" \
    "$GATE" --chromium-src "$CLEAN/chromium-src" --base "$FIXTURE_BASE" \
    --allowlist "$CLEAN/upstream.allowlist" --patches "$CLEAN/patches" \
    --json "$TMP/clean.json"
harness::assert_status 0 "a clean, within-cap delta passes"
harness::assert_output_contains "no violations" "clean verdict"

# It passed for the right reason: the three hooks were MEASURED, not missed.
# A gate that measured nothing also prints no violations.
harness::assert_output_contains "chrome/browser/BUILD.gn" "gn-append hook measured"
harness::assert_output_contains "chrome/browser/DEPS" "include-rule hook measured"
harness::assert_output_contains "chrome/browser/chrome_browser_main.cc" "call-hook measured"

# And the patch-attributed change, the pruned file and the patch-created file
# were subtracted rather than reported. If the subtraction broke, these would
# appear as violations.
harness::assert_output_lacks "chrome/browser/patched.cc" "patch-attributed change subtracted"
harness::assert_output_lacks "base/test/data/binary.bin" "declared pruning subtracted"
harness::assert_output_lacks "astro_created.h" "patch-created file subtracted"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
python3 - "$TMP/clean.json" <<'PY' || harness::fail "clean JSON did not record the measured delta"
import json, sys
document = json.load(open(sys.argv[1]))
assert document["verdict"] == "clean", document["verdict"]
delta = {row["path"]: row for row in document["integration_delta"]}
expected = {
    "chrome/browser/BUILD.gn": (3, 0),
    "chrome/browser/DEPS": (1, 0),
    "chrome/browser/chrome_browser_main.cc": (2, 0),
}
assert set(delta) == set(expected), sorted(delta)
for path, (added, removed) in expected.items():
    got = (delta[path]["added"], delta[path]["removed"])
    assert got == (added, removed), (path, got, (added, removed))
PY

# --------------------------------------------------------------------------
# 2. Every refusal, each proved to fire AND to name the offending path
# --------------------------------------------------------------------------

# An undeclared Chromium-owned file.
row_undeclared() {
    local root="$TMP/undeclared"
    build_fixture "$root" >/dev/null
    printf '  // touched by nobody in particular\n' >> "$root/chromium-src/chrome/browser/about_flags.cc"
    run_gate "$root"
}
harness::register_failure "a modified Chromium-owned file with no allowlist entry" \
    row_undeclared "[undeclared]" "chrome/browser/about_flags.cc" "no entry in tools/upstream.allowlist"

# ANY removal, in a file that IS allowlisted and IS within its cap. This is the
# 007 shape and the reason a path-only allowlist is not enough.
row_removal() {
    local root="$TMP/removal"
    build_fixture "$root" >/dev/null
    cat > "$root/chromium-src/chrome/browser/chrome_browser_main.cc" <<'EOF'
#include "astro/browser/astro_browser_main_extra_parts.h"
#include "chrome/browser/browser_process.h"

void Create() {
  main_parts->AddParts(astro::CreateExtraParts());
}
EOF
    run_gate "$root"
}
harness::register_failure "a removal inside an allowlisted, within-cap file" \
    row_removal "[removal]" "chrome/browser/chrome_browser_main.cc" \
    "No shape permits this" "chrome::AddMetricsExtraParts"

# Additions beyond the declared cap.
row_cap() {
    local root="$TMP/cap"
    build_fixture "$root" >/dev/null
    local index
    for index in 1 2 3 4 5; do
        printf '    "//astro/extra%s",\n' "$index" >> "$root/chromium-src/chrome/browser/BUILD.gn"
    done
    run_gate "$root"
}
harness::register_failure "additions beyond a declared cap" \
    row_cap "[cap]" "chrome/browser/BUILD.gn" "against a declared max-added of 4"

# Added lines that do not have the declared shape. Within the cap, no removal —
# only the shape is wrong, which is what tells a hook from an edit.
row_shape() {
    local root="$TMP/shape"
    build_fixture "$root" >/dev/null
    cat > "$root/chromium-src/chrome/browser/DEPS" <<'EOF'
include_rules = [
  "+astro",
  "+apps",
]
skip_child_includes = [
  "third_party",
]
EOF
    run_gate "$root"
}
harness::register_failure "added lines that do not have the declared shape" \
    row_shape "[shape]" "chrome/browser/DEPS" "declared \`include-rule\`"

# A `planned` entry grants nothing: the moment its file changes, it fails.
row_planned() {
    local root="$TMP/planned"
    build_fixture "$root" >/dev/null
    cat > "$root/chromium-src/content/public/common/url_utils.cc" <<'EOF'
bool IsWebUIScheme(const std::string& scheme) {
  return Contains(WebUISchemes(), scheme);
}
EOF
    run_gate "$root"
}
harness::register_failure "a planned hook that has landed" \
    row_planned "[planned-hook-landed]" "content/public/common/url_utils.cc" \
    "A planned entry grants nothing"

# A live entry naming a file the integration no longer modifies. A permission
# nobody uses is a permission nobody reviews.
row_stale() {
    local root="$TMP/stale"
    build_fixture "$root" >/dev/null
    printf 'call-hook chrome/browser/never_touched.cc owner=test issue=7 max-added=2\n' \
        >> "$root/upstream.allowlist"
    run_gate "$root"
}
harness::register_failure "a stale allowlist entry" \
    row_stale "[stale]" "chrome/browser/never_touched.cc" "modifies nothing in it"

# A file deleted from the tree that the declared pruning list does not name.
row_deleted_file() {
    local root="$TMP/deleted"
    build_fixture "$root" >/dev/null
    rm -f "$root/chromium-src/chrome/browser/about_flags.cc"
    run_gate "$root"
}
harness::register_failure "a deletion the pruning list does not declare" \
    row_deleted_file "[deleted-file]" "chrome/browser/about_flags.cc" \
    "pruning.list does not declare"

# A new Chromium-owned path neither the patch series nor the overlay declares.
# `git diff` never reports untracked files at all, so a report built only from
# `git diff` is blind to exactly this.
row_new_file() {
    local root="$TMP/newfile"
    build_fixture "$root" >/dev/null
    printf '// astro code in the wrong tree\n' \
        > "$root/chromium-src/chrome/browser/astro_smuggled.cc"
    run_gate "$root"
}
harness::register_failure "a new path no declaration accounts for" \
    row_new_file "[new-file]" "chrome/browser/astro_smuggled.cc" \
    "//astro, which is a separate checkout"

# Vacuity: a measurement that covered nothing must not read as clean. The
# integration delta is emptied while the tree is still plainly modified.
row_vacuity_no_delta() {
    local root="$TMP/vacuous"
    build_fixture "$root" >/dev/null
    local src="$root/chromium-src"
    git -C "$src" checkout -- chrome/browser/BUILD.gn chrome/browser/DEPS \
        chrome/browser/chrome_browser_main.cc
    run_gate "$root"
}
harness::register_failure "an integration delta covering zero files" \
    row_vacuity_no_delta "[vacuity]" "integration delta covers zero files"

# Vacuity: an allowlist that parsed nothing is a failure, not a permissive
# default. Without this the gate reports "no violations" for a file it never
# managed to read.
row_vacuity_empty_allowlist() {
    local root="$TMP/emptylist"
    build_fixture "$root" >/dev/null
    printf '# nothing declared\n' > "$root/upstream.allowlist"
    run_gate "$root"
}
harness::register_failure "an allowlist that declares nothing" \
    row_vacuity_empty_allowlist "unmeasurable" "declares no entries"

# Vacuity: the pruning list is a subtrahend, and an empty one would make every
# deletion in the tree look undeclared — or, if the rule were the other way
# round, make every deletion look fine. Either way nothing was measured.
#
# This row exists because a mutation aimed at the allowlist floor silently hit
# THIS floor instead: the two had byte-identical opening lines, and the case
# stayed green, which said the pruning floor was never exercised.
row_vacuity_empty_pruning() {
    local root="$TMP/emptypruning"
    build_fixture "$root" >/dev/null
    # Truncated, not commented out: pruning.list is ungoogled's own plain
    # newline-separated path list and has no comment syntax. Inventing one here
    # would mean silently dropping any real path containing a '#'.
    : > "$root/patches/ungoogled/pruning.list"
    run_gate "$root"
}
harness::register_failure "a pruning list that declares nothing" \
    row_vacuity_empty_pruning "unmeasurable" "declares no files"

# Vacuity: a path git calls modified whose diff text never arrived. A modified
# binary file is the reachable instance — no `+++` header, no hunks — and a
# file whose diff was not parsed reads as "no delta", which is the one answer
# this gate must never give by accident.
row_vacuity_parse_mismatch() {
    local root="$TMP/binarymod"
    build_fixture "$root" >/dev/null
    printf 'chrome\0changed\n' > "$root/chromium-src/chrome/browser/opaque.dat"
    run_gate "$root"
}
harness::register_failure "a modified file whose diff text never arrived" \
    row_vacuity_parse_mismatch "[vacuity]" "produced no diff text" \
    "chrome/browser/opaque.dat"

# Unmeasurable: a base that RESOLVES but is not the commit it names. `--base
# HEAD` resolves perfectly and is still not a declared revision — the report
# would silently describe whatever the checkout happened to be sitting on.
# Distinct from the row below, which is a base that does not resolve at all.
row_ambiguous_base() {
    local root="$TMP/ambiguousbase"
    build_fixture "$root" >/dev/null
    env ASTRO_CHROMIUM_SRC="$root/chromium-src" "$GATE" \
        --chromium-src "$root/chromium-src" --base "HEAD" \
        --allowlist "$root/upstream.allowlist" --patches "$root/patches"
}
harness::register_failure "a base that resolves but is not the commit it names" \
    row_ambiguous_base "unmeasurable" "refusing to report a delta against an ambiguous base"

# Unmeasurable: an absent checkout is a refusal, never a skip.
row_absent_checkout() {
    local root="$TMP/absent"
    build_fixture "$root" >/dev/null
    env ASTRO_CHROMIUM_SRC="$root/does-not-exist" "$GATE" \
        --chromium-src "$root/does-not-exist" --base "$FIXTURE_BASE" \
        --allowlist "$root/upstream.allowlist" --patches "$root/patches"
}
harness::register_failure "an absent Chromium checkout" \
    row_absent_checkout "unmeasurable" "Chromium checkout not found"

# Unmeasurable: a base commit the checkout does not carry means the report
# would be about a different browser.
row_unknown_base() {
    local root="$TMP/unknownbase"
    build_fixture "$root" >/dev/null
    env ASTRO_CHROMIUM_SRC="$root/chromium-src" "$GATE" \
        --chromium-src "$root/chromium-src" \
        --base "0000000000000000000000000000000000000000" \
        --allowlist "$root/upstream.allowlist" --patches "$root/patches"
}
harness::register_failure "a base commit the checkout does not carry" \
    row_unknown_base "unmeasurable" "cannot resolve the locked commit"

# An entry with no owner is not an exception, it is a leak.
row_ownerless_entry() {
    local root="$TMP/ownerless"
    build_fixture "$root" >/dev/null
    printf 'call-hook chrome/browser/foo.cc issue=7 max-added=1\n' \
        >> "$root/upstream.allowlist"
    run_gate "$root"
}
harness::register_failure "an entry with no owner" \
    row_ownerless_entry "unmeasurable" "entries require owner="

# A cap is mandatory: without one, "a small call" is aspirational.
row_capless_entry() {
    local root="$TMP/capless"
    build_fixture "$root" >/dev/null
    printf 'call-hook chrome/browser/foo.cc owner=test issue=7\n' \
        >> "$root/upstream.allowlist"
    run_gate "$root"
}
harness::register_failure "an entry with no cap" \
    row_capless_entry "unmeasurable" "entries require max-added="

harness::run_failure_table 17

# --------------------------------------------------------------------------
# 3. --report lists without rejecting
#
# #7 asks for a check that "lists or rejects". The same tool must do both from
# the SAME measurement, or the listing and the verdict can disagree.
# --------------------------------------------------------------------------

REPORTED="$TMP/reported"
harness::setup_run build_fixture "$REPORTED"
printf '  // undeclared\n' >> "$REPORTED/chromium-src/chrome/browser/about_flags.cc"

harness::run run_gate "$REPORTED" --report
harness::assert_status 0 "--report exits 0 whatever the verdict"
harness::assert_output_contains "[undeclared]" "--report still names the violation"
harness::assert_output_contains "chrome/browser/about_flags.cc" "--report names the file"

# --------------------------------------------------------------------------
# 4. Mutation test: the undeclared-file rule is load-bearing
#
# A check that cannot distinguish success from failure is worse than no check.
# The rule is REMOVED from a COPY of the driver — the real file is never
# touched, so there is nothing to restore and no chance of a `git checkout`
# reverting uncommitted work alongside the mutation — and the same bad fixture
# is measured again. If the mutant still refuses, the row above was passing for
# some other reason and proves nothing about this rule.
# --------------------------------------------------------------------------

MUTANT_DIR="$TMP/mutant"
mkdir -p "$MUTANT_DIR"
MUTANT="$MUTANT_DIR/upstream_delta.py"

python3 - "$ASTRO_ROOT/tools/lib/upstream_delta.py" "$MUTANT" <<'PY'
import sys

source, destination = sys.argv[1:3]
with open(source, encoding="utf-8") as handle:
    text = handle.read()

# The mutation: make an undeclared file pass. `judge()` reaches the undeclared
# branch through `entries.get(path)` returning None; short-circuiting that to a
# skip is the smallest change that removes exactly this rule and nothing else.
needle = "        if entry is None:\n"
replacement = "        if entry is None:\n            continue\n"
if needle not in text:
    sys.exit("mutation point not found; the driver was restructured")
text = text.replace(needle, replacement, 1)

# Its vacuity floor would otherwise catch the mutant for a different reason,
# which would make the mutation look effective when it was not.
with open(destination, "w", encoding="utf-8") as handle:
    handle.write(text)
PY

MUTANT_FIXTURE="$TMP/mutant-fixture"
harness::setup_run build_fixture "$MUTANT_FIXTURE"
printf '  // undeclared\n' >> "$MUTANT_FIXTURE/chromium-src/chrome/browser/about_flags.cc"

# The unmutated driver refuses this fixture and names the file.
harness::run run_gate "$MUTANT_FIXTURE"
harness::assert_nonzero_status "unmutated driver refuses the undeclared file"
harness::assert_output_contains "chrome/browser/about_flags.cc" "unmutated driver names the file"

# The mutant does not. If this assertion fails, the refusal above was not being
# produced by the rule this case claims to test.
harness::run python3 "$MUTANT" \
    --chromium-src "$MUTANT_FIXTURE/chromium-src" \
    --base "$FIXTURE_BASE" \
    --allowlist "$MUTANT_FIXTURE/upstream.allowlist" \
    --patches "$MUTANT_FIXTURE/patches" \
    --overlay-allowlist "$MUTANT_FIXTURE/overlay.allowlist"
harness::assert_status 0 "the mutant accepts the undeclared file"
harness::assert_output_lacks "[undeclared]" "the mutant no longer reports the rule"

# --------------------------------------------------------------------------
# 5. The repository's own allowlist parses, and declares the real hooks
#
# A committed allowlist that no longer parses would take the whole gate down to
# `unmeasurable`, and a repository-level input is exactly the kind that nobody
# runs until CI does.
# --------------------------------------------------------------------------

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
python3 - "$ASTRO_ROOT/tools/lib/upstream_delta.py" "$ASTRO_ROOT/tools/upstream.allowlist" <<'PY' \
    || harness::fail "tools/upstream.allowlist does not parse"
import importlib.util, sys
from pathlib import Path

driver, allowlist = sys.argv[1:3]
spec = importlib.util.spec_from_file_location("upstream_delta", driver)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

entries = module.load_allowlist(Path(allowlist))
live = {path for path, entry in entries.items() if not entry.planned}

# A vacuity floor on the assertion itself: a parser that silently returned an
# empty mapping would satisfy any "no unexpected entries" check.
assert len(entries) >= 8, len(entries)
for required in (
    "chrome/browser/BUILD.gn",
    "chrome/browser/DEPS",
    "chrome/browser/chrome_browser_main.cc",
):
    assert required in live, required
for entry in entries.values():
    assert entry.owner and entry.issue, entry.path
    assert entry.max_added >= 1, entry.path
PY

harness::pass
