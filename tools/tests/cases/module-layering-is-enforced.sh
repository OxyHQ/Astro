#!/usr/bin/env bash
# `//astro`'s DEPS files are enforced, and the gate that enforces them can fail.
#
# The module declares its layering in `include_rules`: the root grants
# Chromium's public API and subtracts `-chrome`, `browser/DEPS` re-grants the
# ONE `chrome/` header the integration hook needs, and `common/DEPS` restates
# the subtraction. Nothing read any of it. `gn check` — which tools/build.sh
# does run — validates GN dependency EDGES and never opens a DEPS file, and
# `grep -rn checkdeps tools/ .github/` returned nothing at all. Every rule in
# `//astro` was therefore a rule that could not fail.
#
# The placement of the `chrome/` grant is the specific thing at stake, and it is
# invisible to review: checkdeps INHERITS a grant into every subdirectory
# (buildtools/checkdeps/README.md documents opting OUT of that inheritance,
# which is how you know inheriting is the default). A grant written at the
# module root reads as one concession and behaves as one per layer. That is
# demonstrated below in both directions rather than described: the SAME file,
# with the SAME include, fails with the grant in `browser/DEPS` and passes with
# it moved up to the module root.
#
# Everything here drives synthetic fixtures. The real 55 GB checkout is read
# for exactly one thing — checkdeps itself, which ships inside it — because a
# hand-written stand-in for the tool would make this case prove that a stub
# behaves like a stub. Where that tool is unavailable the semantic tier is
# reported as NOT EXERCISED, by name, with the command that would exercise it;
# it is never quietly dropped.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

GATE="$ASTRO_ROOT/tools/check-module-layering.sh"
DRIVER="$ASTRO_ROOT/tools/lib/module_layering.py"
REPO_SCOPE="$ASTRO_ROOT/tools/astro-module.scope"
tmp="$(harness::tmpdir)"

# Chromium's own checkdeps. Overridable so a checkout kept somewhere else can
# still exercise the semantic tier.
CHECKDEPS_DIR="${ASTRO_CHECKDEPS_DIR:-$ASTRO_ROOT/chromium/src/buildtools/checkdeps}"

# The modules checkdeps.py imports by bare name. Named individually rather than
# copied by glob: a partial copy imports and then checks nothing, which is the
# failure this case exists to make impossible.
CHECKDEPS_MODULES=(
    checkdeps.py
    builddeps.py
    rules.py
    results.py
    cpp_checker.py
    java_checker.py
    proto_checker.py
)

# --------------------------------------------------------------------------
# Fixtures
# --------------------------------------------------------------------------

# layering::make_chromium <dir> [--with-checkdeps]
#
# A Chromium checkout that astro::resolve_chromium_src accepts, carrying the
# root `include_rules` that `//astro` inherits. Only the grants that matter
# here: `+base` is what a layer whose own DEPS grants nothing still keeps, and
# is why the "grants nothing" scenario below has to reach for something the
# module root alone provides.
layering::make_chromium() {
    local dir="$1" with_checkdeps="${2:-}"
    harness::make_chromium_fixture "$dir"

    cat > "$dir/DEPS" <<'EOF'
include_rules = [
  '+base',
  '+build',
  '+testing',
  '+url',
]
EOF

    if [ "$with_checkdeps" = "--with-checkdeps" ]; then
        mkdir -p "$dir/buildtools/checkdeps"
        local module
        for module in "${CHECKDEPS_MODULES[@]}"; do
            cp "$CHECKDEPS_DIR/$module" "$dir/buildtools/checkdeps/$module"
        done
    fi

    git -C "$dir" add -A
    git -C "$dir" commit --quiet -m "chromium fixture: root include_rules"
}

# layering::make_module <chromium dir>
#
# `//astro` at <chromium>/astro, as its own git repository — which is how
# gclient places it and why the driver passes `--extra-repos`. The DEPS files
# mirror the real ones' SHAPE, because a fixture that simplified the shape would
# stop exercising the inheritance this case is about.
#
# It carries `src/`, the pre-module tree that legitimately reaches into
# `chrome/`, so every scenario below also proves the scan is scoped rather than
# blanket.
layering::make_module() {
    local chromium="$1" module="$1/astro"
    mkdir -p "$module/browser" "$module/common" "$module/src"

    cat > "$module/DEPS" <<'EOF'
include_rules = [
  "+base",
  "+build",
  "+content/public/browser",
  "+ui/base",
  "+url",
  "-chrome",
]
EOF
    printf 'group("astro") { deps = [ "//astro/browser" ] }\n' > "$module/BUILD.gn"

    cat > "$module/browser/DEPS" <<'EOF'
include_rules = [
  "+chrome/browser/chrome_browser_main_extra_parts.h",
]
EOF
    cat > "$module/common/DEPS" <<'EOF'
include_rules = [
  "-chrome",
  "-content/public/browser",
]
EOF

    # The hook's implementation: the one file granted a chrome/ header.
    cat > "$module/browser/astro_browser_main_extra_parts.cc" <<'EOF'
#include "astro/browser/astro_browser_main_extra_parts.h"

#include "base/logging.h"
#include "chrome/browser/chrome_browser_main_extra_parts.h"
#include "content/public/browser/browser_context.h"
EOF
    printf '#include "base/macros.h"\n' > "$module/browser/astro_browser_main_extra_parts.h"
    printf '#include "base/feature_list.h"\n' > "$module/common/features.cc"

    # The pre-module tree. Reaching into chrome/ is what it is FOR.
    printf '#include "chrome/browser/browser_process.h"\n' > "$module/src/legacy_overlay.cc"

    git -C "$module" init --quiet
    git -C "$module" add -A
    git -C "$module" commit --quiet -m "//astro fixture"
}

# The declaration the fixtures are checked against: the same two kinds the
# repository's own tools/astro-module.scope uses.
layering::write_scope() {
    cat > "$1" <<'EOF'
layer    common
layer    browser
excluded src  owner=8
EOF
}

# A fresh, independent copy of a built fixture. Every scenario mutates its own
# copy: a scenario that edited a shared tree would leave the next one measuring
# the previous one's damage.
layering::clone() {
    cp -a "$1" "$2"
}

layering::commit() {
    git -C "$1" add -A
    git -C "$1" commit --quiet -m "$2"
}

# --------------------------------------------------------------------------
# The gate's own inputs
# --------------------------------------------------------------------------

harness::assert_file_exists "$GATE"
harness::assert_file_exists "$DRIVER"
# Without this the gate has nothing to scope to, and every scenario below would
# be measuring a declaration the repository does not actually carry.
harness::assert_file_exists "$REPO_SCOPE"

# --------------------------------------------------------------------------
# It refuses what it cannot measure
#
# checkdeps ships INSIDE the Chromium checkout. Every one of these is a shape
# where the plain tool reports `SUCCESS` and exits 0 having looked at nothing.
# --------------------------------------------------------------------------

harness::run env ASTRO_CHROMIUM_SRC="$tmp/no-such-checkout" "$GATE"
harness::assert_nonzero_status "no Chromium checkout at all"
harness::assert_output_contains "unmeasurable" "says the verdict was not reached"
harness::assert_output_contains "Chromium checkout not found" "names what is missing"
harness::assert_output_lacks "OK:" "must never report a clean module it did not look at"

no_module="$tmp/chromium-no-module"
layering::make_chromium "$no_module"
harness::run env ASTRO_CHROMIUM_SRC="$no_module" "$GATE"
harness::assert_nonzero_status "a Chromium checkout with no //astro in it"
harness::assert_output_contains "unmeasurable" "an absent module is not a clean module"
harness::assert_output_contains "no //astro module at" "names the path it expected"

no_tool="$tmp/chromium-no-tool"
layering::make_chromium "$no_tool"
layering::make_module "$no_tool"
harness::run env ASTRO_CHROMIUM_SRC="$no_tool" "$GATE"
harness::assert_nonzero_status "checkdeps missing from the checkout"
harness::assert_output_contains "unmeasurable" "a moved tool is not a clean module"
harness::assert_output_contains "checkdeps is not at" "names the tool it could not find"

# --------------------------------------------------------------------------
# The scope declaration is validated before anything is scanned
#
# It answers "which directories are //astro", so a malformed one silently
# changes what gets checked rather than failing.
# --------------------------------------------------------------------------

scope_bad="$tmp/scope"
mkdir -p "$scope_bad"

printf 'layer common\nmaybe browser\n' > "$scope_bad/unknown-kind"
harness::run env ASTRO_CHROMIUM_SRC="$no_tool" "$GATE" --scope "$scope_bad/unknown-kind"
harness::assert_nonzero_status "a scope entry with an unrecognised kind"
harness::assert_output_contains "unknown kind 'maybe'" "names the kind it rejected"

printf 'layer common\nlayer browser\nexcluded src\n' > "$scope_bad/unowned"
harness::run env ASTRO_CHROMIUM_SRC="$no_tool" "$GATE" --scope "$scope_bad/unowned"
harness::assert_nonzero_status "an exclusion with no owning issue"
harness::assert_output_contains "needs owner=" "says what an exclusion must carry"

printf 'excluded src owner=8\n' > "$scope_bad/no-layers"
harness::run env ASTRO_CHROMIUM_SRC="$no_tool" "$GATE" --scope "$scope_bad/no-layers"
harness::assert_nonzero_status "a scope that declares no layers"
harness::assert_output_contains "declares no layers" "refuses to run a check over nothing"

printf 'layer common\nlayer browser/webui\n' > "$scope_bad/nested"
harness::run env ASTRO_CHROMIUM_SRC="$no_tool" "$GATE" --scope "$scope_bad/nested"
harness::assert_nonzero_status "a nested path where a top-level directory belongs"
harness::assert_output_contains "single top-level directory" "says what the field means"

printf 'layer common\nlayer browser\nlayer common\n' > "$scope_bad/duplicate"
harness::run env ASTRO_CHROMIUM_SRC="$no_tool" "$GATE" --scope "$scope_bad/duplicate"
harness::assert_nonzero_status "the same directory declared twice"
harness::assert_output_contains "already declared at line" "names the earlier line"

# --------------------------------------------------------------------------
# Layering semantics — the tier that needs the real checkdeps
# --------------------------------------------------------------------------

LAYERING_SEMANTICS="not-exercised"
if [ -f "$CHECKDEPS_DIR/checkdeps.py" ]; then
    LAYERING_SEMANTICS="exercised"

    base="$tmp/base"
    layering::make_chromium "$base" --with-checkdeps
    layering::make_module "$base"
    scope="$tmp/scope/module.scope"
    layering::write_scope "$scope"

    run_gate() {
        harness::run env ASTRO_CHROMIUM_SRC="$1" "$GATE" --scope "${2:-$scope}"
    }

    # ---- a module that obeys its DEPS passes -----------------------------
    run_gate "$base"
    harness::assert_status 0 "a module whose includes obey its DEPS"
    harness::assert_output_contains "OK:" "reports the clean verdict"
    harness::assert_output_contains "3 file(s) across 2 layer(s)" \
        "says how much it measured, so a run that measured nothing cannot look like this one"

    # The same run is the "granted where it is declared" direction: browser/
    # carries the chrome/ include and is clean, because browser/DEPS grants it.
    # Asserted as "browser was walked AND is clean", not merely as the absence
    # of a complaint — a layer nothing looked at also produces no complaint.
    harness::assert_output_contains "layer  browser    2 file(s) considered" \
        "browser/ was walked, with the chrome/ include its DEPS grants"
    harness::assert_output_lacks "chrome_browser_main_extra_parts.h" \
        "and the granted include is not reported against it"

    # ...and the exclusion is real: src/ reaches into chrome/ and is not scanned.
    harness::assert_output_lacks "legacy_overlay.cc" \
        "a declared exclusion is skipped rather than reported"
    harness::assert_output_contains "not scanned  (owner=8)" \
        "the exclusion is printed with its owning issue, so it cannot be forgotten"

    # ---- the same include, one layer down, is refused ---------------------
    # This is the defect the DEPS split fixed, reproduced: `common/` is the
    # bottom layer and is granted nothing in `chrome/`.
    lower="$tmp/lower-layer"
    layering::clone "$base" "$lower"
    cat > "$lower/astro/common/features.cc" <<'EOF'
#include "base/feature_list.h"

#include "chrome/browser/chrome_browser_main_extra_parts.h"
EOF
    layering::commit "$lower/astro" "common/ reaches back into chrome/"
    run_gate "$lower"
    harness::assert_nonzero_status "a lower layer including a chrome/ header it is not granted"
    harness::assert_output_contains "common/features.cc" "names the offending file"
    harness::assert_output_contains "Illegal include: \"chrome/browser/chrome_browser_main_extra_parts.h\"" \
        "names the include"
    harness::assert_output_contains "Because of \"-chrome\"" "names the rule that forbids it"
    harness::assert_output_contains "astro/common's include_rules" \
        "names the DEPS file the rule came from"
    harness::assert_output_lacks "OK:" "a violation is never also a pass"

    # ---- and it is the PLACEMENT of the grant that decides ----------------
    # A layer that has not written its own DEPS yet — every layer //astro will
    # add — inherits the module root's rules and nothing else.
    inherit="$tmp/inheritance"
    layering::clone "$base" "$inherit"
    mkdir -p "$inherit/astro/ui"
    cat > "$inherit/astro/ui/astro_toolbar.cc" <<'EOF'
#include "base/logging.h"

#include "chrome/browser/chrome_browser_main_extra_parts.h"
EOF
    layering::commit "$inherit/astro" "a new layer with no DEPS of its own"
    printf 'layer common\nlayer browser\nlayer ui\nexcluded src  owner=8\n' \
        > "$tmp/scope/with-ui"

    harness::run env ASTRO_CHROMIUM_SRC="$inherit" "$GATE" --scope "$tmp/scope/with-ui"
    harness::assert_nonzero_status "with the grant confined to browser/DEPS, a new layer is refused"
    harness::assert_output_contains "ui/astro_toolbar.cc" "names the file in the ungranted layer"
    harness::assert_output_contains "from astro's include_rules" \
        "the module root's own subtraction is what caught it"

    # The mirror image, and the whole reason browser/DEPS exists: move that one
    # grant up to the module root and the SAME file, unchanged, passes.
    cat > "$inherit/astro/DEPS" <<'EOF'
include_rules = [
  "+base",
  "+build",
  "+content/public/browser",
  "+ui/base",
  "+url",
  "-chrome",
  "+chrome/browser/chrome_browser_main_extra_parts.h",
]
EOF
    layering::commit "$inherit/astro" "the grant moved up to the module root"
    harness::run env ASTRO_CHROMIUM_SRC="$inherit" "$GATE" --scope "$tmp/scope/with-ui"
    harness::assert_status 0 "the same file passes once the grant is inherited from the root"
    harness::assert_output_contains "OK:" "which is exactly why the grant does not live there"

    # ---- a DEPS that grants nothing --------------------------------------
    # `+content/public/browser` exists only in the module root's own rules, so
    # emptying them is what an include of it has to fail on. `+base` would not
    # do: Chromium's root DEPS grants it, and the module inherits that.
    ungranted="$tmp/grants-nothing"
    layering::clone "$base" "$ungranted"
    printf 'include_rules = [\n]\n' > "$ungranted/astro/DEPS"
    layering::commit "$ungranted/astro" "a DEPS that grants nothing"
    run_gate "$ungranted"
    harness::assert_nonzero_status "a module DEPS granting nothing at all"
    harness::assert_output_contains "browser/astro_browser_main_extra_parts.cc" \
        "names the file whose include is no longer permitted"
    harness::assert_output_contains "Illegal include: \"content/public/browser/browser_context.h\"" \
        "names the include the empty rule set stopped allowing"
    harness::assert_output_contains "no rule applying" "names the absent rule"

    # ---- the vacuity floor -----------------------------------------------
    # checkdeps walks git-tracked directories. A module whose files are not
    # committed is walked entirely, finds nothing, prints SUCCESS and exits 0 —
    # indistinguishable, to the plain tool, from a module that obeys every rule.
    untracked="$tmp/nothing-committed"
    layering::clone "$base" "$untracked"
    rm -rf "${untracked:?}/astro/.git"
    git -C "$untracked/astro" init --quiet
    run_gate "$untracked"
    harness::assert_nonzero_status "a module with nothing committed"
    harness::assert_output_contains "unmeasurable" "zero files scanned is a failure, not a pass"
    harness::assert_output_contains "considered 0 files" "says exactly what it measured"
    harness::assert_output_lacks "OK:" "and never reports the module clean"

    # The sharper floor: the module is committed and mostly walked, but one
    # declared layer is skipped. A total-count floor cannot see this — the other
    # layer keeps the total non-zero — so the check is per layer, against what
    # git tracks there.
    swallowed="$tmp/layer-swallowed"
    layering::clone "$base" "$swallowed"
    cat > "$swallowed/astro/DEPS" <<'EOF'
include_rules = [
  "+base",
  "+build",
  "+content/public/browser",
  "+ui/base",
  "+url",
  "-chrome",
]

skip_child_includes = [ "common" ]
EOF
    layering::commit "$swallowed/astro" "skip_child_includes swallows a declared layer"
    run_gate "$swallowed"
    harness::assert_nonzero_status "a declared layer that checkdeps never walked"
    harness::assert_output_contains "did not consider 1 of the 1 source file(s)" \
        "counts what was missed against what git tracks"
    harness::assert_output_contains "common/features.cc" "names the file nothing checked"
    harness::assert_output_lacks "OK:" "an unwalked layer is never a clean layer"

    # ---- the declaration against the tree, in both directions ------------
    printf 'layer common\nlayer browser\n' > "$tmp/scope/no-exclusion"
    run_gate "$base" "$tmp/scope/no-exclusion"
    harness::assert_nonzero_status "a directory holding source that the scope does not account for"
    harness::assert_output_contains "src/legacy_overlay.cc" "names the unaccounted-for source"
    harness::assert_output_contains "nothing checks them" "says what the consequence is"

    printf 'layer common\nlayer browser\nlayer ui\nexcluded src  owner=8\n' \
        > "$tmp/scope/ghost-layer"
    run_gate "$base" "$tmp/scope/ghost-layer"
    harness::assert_nonzero_status "a declared layer that is not a directory in the module"
    harness::assert_output_contains "'ui' is declared in" "names the stale declaration"

    stray="$tmp/loose-root-file"
    layering::clone "$base" "$stray"
    printf '#include "chrome/browser/browser_process.h"\n' > "$stray/astro/astro_stray.cc"
    layering::commit "$stray/astro" "a source file loose at the module root"
    run_gate "$stray"
    harness::assert_nonzero_status "a source file directly at the module root"
    harness::assert_output_contains "the module root holds 1 source file(s)" \
        "per-layer scans never reach it, so it is caught by the join instead"
    harness::assert_output_contains "astro_stray.cc" "names it"
fi

# --------------------------------------------------------------------------
# The repository's own module, if it is checked out
#
# Everything above proves the gate can fail. This is the only assertion that
# says the real `//astro` currently passes.
# --------------------------------------------------------------------------

REAL_MODULE="not-exercised"
if [ -f "$CHECKDEPS_DIR/checkdeps.py" ] && [ -d "$ASTRO_ROOT/chromium/src/astro" ]; then
    REAL_MODULE="exercised"
    harness::run "$GATE"
    harness::assert_status 0 "the repository's own //astro against its own scope declaration"
    harness::assert_output_contains "OK:" "reports a verdict rather than a skip"
    harness::assert_output_lacks "0 file(s) across" "and measured something while reaching it"
fi

# --------------------------------------------------------------------------
# Verdict
#
# This case does not end in harness::pass, and the reason is the runner: on a
# PASS it prints only the text following the token, so anything not on that line
# is invisible. A case with a tier that can go unexercised has to say so THERE
# or not at all. The vacuity floor harness::pass would have applied is replaced
# by a stricter one — the tool-free tier alone makes 24 assertions, so a floor
# of 20 catches a case that silently degraded to a handful, which "more than
# zero" would not.
# --------------------------------------------------------------------------

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ "$HARNESS_ASSERTIONS" -lt 20 ]; then
    harness::fail "only $HARNESS_ASSERTIONS assertions ran; the tier that needs no Chromium checkout is worth more than that on its own"
fi

if [ "$LAYERING_SEMANTICS" != "exercised" ]; then
    printf 'NOT EXERCISED: layering semantics. checkdeps was not found at %s.\n' "$CHECKDEPS_DIR" >&2
    printf '  It ships inside the Chromium checkout and has no stand-in: a hand-written\n' >&2
    printf '  one would only prove that a stub behaves like a stub. To exercise this tier:\n' >&2
    printf '      tools/sync-sources.sh && tools/tests/run.sh module-layering\n' >&2
    printf '  or point at an existing checkout:\n' >&2
    printf '      ASTRO_CHECKDEPS_DIR=/path/to/src/buildtools/checkdeps tools/tests/run.sh\n' >&2
fi
if [ "$REAL_MODULE" != "exercised" ]; then
    printf 'NOT EXERCISED: the repository own //astro module at %s/chromium/src/astro.\n' "$ASTRO_ROOT" >&2
    printf '  The fixtures above still prove the gate fails on a violation.\n' >&2
fi

printf '%s (%s assertions; semantics %s, real //astro %s)\n' \
    "$HARNESS_PASS_TOKEN" "$HARNESS_ASSERTIONS" "$LAYERING_SEMANTICS" "$REAL_MODULE"
