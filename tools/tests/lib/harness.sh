#!/usr/bin/env bash
# harness.sh — assertions and fixtures for the Astro build-safety test suite.
#
# Deliberately dependency-free (no bats, no npm): the suite has to run on a
# clean machine and inside CI without an install step.
#
# Every case script must end with `harness::pass`, which prints a token the
# runner requires. A case that exits 0 early — because an assertion was
# skipped, a helper silently returned, or someone deleted the body — fails for
# lack of the token rather than passing vacuously.

set -Euo pipefail

HARNESS_PASS_TOKEN="ASTRO_TEST_CASE_PASSED"

ASTRO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
export ASTRO_ROOT

HARNESS_TMPDIR=""
HARNESS_ASSERTIONS=0

harness::setup() {
    HARNESS_TMPDIR="$(mktemp -d "${TMPDIR:-/tmp}/astro-test.XXXXXXXX")"
    # Reports must land in the fixture, never in the repository under test.
    # Without this a case that exercises a success path writes a real
    # build/reports/*.json into the working tree.
    export ASTRO_REPORT_DIR="$HARNESS_TMPDIR/reports"
    # Keep the fixtures out of any enclosing repository's reach and give git a
    # deterministic identity so `git commit` works on a bare CI machine.
    export GIT_CONFIG_GLOBAL="$HARNESS_TMPDIR/gitconfig"
    export GIT_CONFIG_NOSYSTEM=1
    cat > "$GIT_CONFIG_GLOBAL" <<'EOF'
[user]
    name = Astro Test
    email = astro-test@invalid
[init]
    defaultBranch = main
[commit]
    gpgsign = false
EOF
    trap 'harness::teardown' EXIT
}

harness::teardown() {
    if [ -n "$HARNESS_TMPDIR" ] && [ -d "$HARNESS_TMPDIR" ]; then
        rm -rf "$HARNESS_TMPDIR"
    fi
}

harness::tmpdir() {
    printf '%s\n' "$HARNESS_TMPDIR"
}

harness::fail() {
    printf 'ASSERTION FAILED: %s\n' "$*" >&2
    if [ -n "${RUN_STDERR:-}" ] && [ -f "${RUN_STDERR:-}" ]; then
        printf -- '--- captured stderr ---\n' >&2
        cat "$RUN_STDERR" >&2
        printf -- '--- end stderr ---\n' >&2
    fi
    if [ -n "${RUN_STDOUT:-}" ] && [ -f "${RUN_STDOUT:-}" ]; then
        printf -- '--- captured stdout ---\n' >&2
        cat "$RUN_STDOUT" >&2
        printf -- '--- end stdout ---\n' >&2
    fi
    exit 1
}

harness::pass() {
    if [ "$HARNESS_ASSERTIONS" -eq 0 ]; then
        harness::fail "case made no assertions (vacuity floor)"
    fi
    printf '%s (%s assertions)\n' "$HARNESS_PASS_TOKEN" "$HARNESS_ASSERTIONS"
}

# --------------------------------------------------------------------------
# Running commands under test
# --------------------------------------------------------------------------

# harness::run <command> [args...]
# Sets RUN_STATUS, and points RUN_STDOUT / RUN_STDERR at capture files.
harness::run() {
    RUN_STDOUT="$HARNESS_TMPDIR/last-stdout"
    RUN_STDERR="$HARNESS_TMPDIR/last-stderr"
    RUN_STATUS=0
    "$@" >"$RUN_STDOUT" 2>"$RUN_STDERR" || RUN_STATUS=$?
}

# harness::setup_run <command> [args...]
#
# Fixture preparation runs OUTSIDE harness::run, so a failure in it produces no
# captured output and no status anyone looks at. Without this wrapper a case
# whose fixture was never built goes on to assert a message against nothing and
# fails somewhere else entirely, which is the wrong-reason failure the
# required-failure tables exist to make impossible.
harness::setup_run() {
    local log="$HARNESS_TMPDIR/setup.log"
    local status=0
    "$@" >"$log" 2>&1 || status=$?
    if [ "$status" -ne 0 ]; then
        printf -- '--- setup output ---\n' >&2
        cat "$log" >&2
        harness::fail "fixture setup failed (exit $status): $*"
    fi
}

harness::assert_status() {
    local expected="$1" what="$2"
    HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
    if [ "$RUN_STATUS" != "$expected" ]; then
        harness::fail "$what: expected exit $expected, got $RUN_STATUS"
    fi
}

harness::assert_nonzero_status() {
    local what="$1"
    HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
    if [ "$RUN_STATUS" = "0" ]; then
        harness::fail "$what: expected a non-zero exit, got 0"
    fi
}

# Asserts the failure was the one intended. A case that only checks "exit != 0"
# keeps passing when the script starts failing for an unrelated reason.
harness::assert_output_contains() {
    local needle="$1" what="${2:-output}"
    HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
    if ! grep -qF -- "$needle" "$RUN_STDERR" "$RUN_STDOUT"; then
        harness::fail "$what: expected output to contain: $needle"
    fi
}

harness::assert_output_lacks() {
    local needle="$1" what="${2:-output}"
    HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
    if grep -qF -- "$needle" "$RUN_STDERR" "$RUN_STDOUT"; then
        harness::fail "$what: expected output NOT to contain: $needle"
    fi
}

# --------------------------------------------------------------------------
# Filesystem assertions
# --------------------------------------------------------------------------

harness::assert_file_exists() {
    local path="$1"
    HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
    [ -f "$path" ] || harness::fail "expected file to exist: $path"
}

harness::assert_file_missing() {
    local path="$1"
    HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
    [ ! -e "$path" ] || harness::fail "expected path NOT to exist: $path"
}

harness::assert_files_identical() {
    local a="$1" b="$2"
    HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
    cmp -s "$a" "$b" || harness::fail "expected identical files: $a and $b"
}

# A recursive content+path manifest, used to prove a dry run changed nothing.
harness::manifest() {
    local root="$1"
    ( cd "$root" && find . -path ./.git -prune -o -type f -print0 \
        | sort -z \
        | xargs -0 -r sha256sum )
}

harness::assert_tree_unchanged() {
    local root="$1" before="$2"
    HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
    local after
    after="$(harness::manifest "$root")"
    if [ "$after" != "$before" ]; then
        # diff exits 1 when the inputs differ, which is precisely the case
        # being reported; capture the status rather than discarding it.
        local diff_status=0
        printf -- '--- tree diff ---\n' >&2
        diff <(printf '%s\n' "$before") <(printf '%s\n' "$after") >&2 || diff_status=$?
        if [ "$diff_status" -gt 1 ]; then
            printf 'diff itself failed (exit %s)\n' "$diff_status" >&2
        fi
        harness::fail "expected tree to be unchanged: $root"
    fi
}

# --------------------------------------------------------------------------
# Required-failure tables
#
# A case proving "every required step that fails exits non-zero" enumerates its
# failure modes as rows rather than as prose, so adding a guard is one line and
# a guard that quietly stops failing cannot hide between cases.
#
# The mechanism lives here because more than one case owns rows — the build
# pipeline's required inputs and the source-lock gates are separate layers of
# the same property, and they ship on separate branches. Two copies of this
# loop would drift, and a fix to one would silently miss the other; that is
# precisely the failure mode the table exists to prevent, so it is not
# reproduced per case. Each case still declares its OWN vacuity floor, by
# passing its own minimum row count to harness::run_failure_table.
# --------------------------------------------------------------------------

declare -a HARNESS_CASE_DESC=() HARNESS_CASE_RUN=() HARNESS_CASE_NEEDLES=()

# harness::register_failure <description> <runner-function> <expected-fragment>...
#
# At least one fragment is mandatory: a row that named no reason would assert
# only that something went wrong, which is the assertion the table replaces.
# Every row asserts WHY the command failed as well as that it did. A row
# checking only "exit != 0" keeps passing once the script starts failing for an
# unrelated reason — a fixture that was never built, a renamed flag, a typo in
# an argument — and that is how a suite goes green while the guarantee
# underneath it is gone.
harness::register_failure() {
    local description="$1" runner="$2"
    shift 2
    if [ "$#" -lt 1 ]; then
        harness::fail "row '$description' declares no expected message fragment"
    fi
    HARNESS_CASE_DESC+=("$description")
    HARNESS_CASE_RUN+=("$runner")
    HARNESS_CASE_NEEDLES+=("$(printf '%s\n' "$@")")
}

# harness::run_failure_table <minimum rows>
#
# The floor comes first: a truncated table, a mis-registered row or a broken
# loop would otherwise report a green case having asserted almost nothing.
harness::run_failure_table() {
    local minimum="$1"

    HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 2))
    if [ "${#HARNESS_CASE_DESC[@]}" -lt "$minimum" ]; then
        harness::fail "table has ${#HARNESS_CASE_DESC[@]} row(s), below the floor of $minimum"
    fi
    if [ "${#HARNESS_CASE_RUN[@]}" != "${#HARNESS_CASE_DESC[@]}" ] \
       || [ "${#HARNESS_CASE_NEEDLES[@]}" != "${#HARNESS_CASE_DESC[@]}" ]; then
        harness::fail "table arrays disagree: ${#HARNESS_CASE_DESC[@]} descriptions, ${#HARNESS_CASE_RUN[@]} runners, ${#HARNESS_CASE_NEEDLES[@]} needle sets"
    fi

    printf 'Required failure modes under test: %s\n' "${#HARNESS_CASE_DESC[@]}"

    local index description needle
    for index in "${!HARNESS_CASE_DESC[@]}"; do
        description="${HARNESS_CASE_DESC[$index]}"
        harness::run "${HARNESS_CASE_RUN[$index]}"
        harness::assert_nonzero_status "$description"
        while IFS= read -r needle; do
            [ -n "$needle" ] || continue
            harness::assert_output_contains "$needle" "$description"
        done <<< "${HARNESS_CASE_NEEDLES[$index]}"
    done
}

# --------------------------------------------------------------------------
# Real-checkout shell hazards
#
# Two constructs a synthetic fixture never punishes and a 400,000-file Chromium
# checkout punishes every time. The demonstrations that each hazard is REAL
# live in the case that owns them; what lives here is the machinery for
# scanning a list of scripts for them.
#
# The patterns are here because more than one case scans with them, over
# different file lists that exist at different layers: the build pipeline's
# scripts and the baseline harness's scripts ship on separate branches. Two
# copies of a regex is how one gets tightened and the other does not. Each case
# supplies its own file list and its own vacuity floor.
# --------------------------------------------------------------------------

# `find` must be a command word — the trailing whitespace requirement is what
# keeps `security find-identity … | head -1` out, which is a different program
# and not this hazard. `head` may sit anywhere downstream: an intermediate stage
# such as `sort` takes the SIGPIPE instead of find, which changes which process
# dies, not whether pipefail surfaces 141.
#
# Executable lines only. These scripts describe the hazard in prose — a script
# the construct was removed from carries a comment quoting the very shape it no
# longer runs — and a raw grep would flag its own documentation.
HARNESS_FIND_INTO_HEAD='^([^#]*[^[:alnum:]_./-])?find[[:space:]][^#]*\|[^#]*[[:space:]]head([[:space:]]|$)'

# An artifact hunt must ask git which files are untracked. A find-by-name walk
# cannot tell upstream content from leftover state, and pays 400,000 stat calls
# to get the wrong answer.
HARNESS_FIND_ARTIFACT_HUNT='^([^#]*[^[:alnum:]_./-])?find[[:space:]][^#]*-name[^#]*(rej|orig)'

# harness::assert_pattern_hits <pattern> <file> <expected count> <what>
harness::assert_pattern_hits() {
    local pattern="$1" file="$2" expected="$3" what="$4"
    local hits status=0
    hits="$(grep -cE "$pattern" "$file")" || status=$?
    HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
    if [ "$status" -gt 1 ]; then
        harness::fail "$what: grep itself failed (exit $status)"
    fi
    if [ "$hits" != "$expected" ]; then
        harness::fail "$what: expected $expected matching line(s), got $hits"
    fi
}

# harness::assert_hazard_patterns_fire
#
# Mutation support for the two patterns: a regex that stopped matching would
# report every list clean, which is indistinguishable from every list actually
# being clean. Any case that scans with them must call this first, so a
# tightened-into-uselessness regex fails in the case that relies on it rather
# than only in the case that happens to own the probe.
harness::assert_hazard_patterns_fire() {
    local probe_dir="$HARNESS_TMPDIR/hazard-probes"
    mkdir -p "$probe_dir"

    cat > "$probe_dir/find-head-hazardous.sh" <<'PROBE'
find "$BUILD_DIR" -name "*.apk" | head -10
paths="$(find "$root" -type f | head -5)"
find "$src" -type f | sort | head -1
PROBE
    harness::assert_pattern_hits "$HARNESS_FIND_INTO_HEAD" \
        "$probe_dir/find-head-hazardous.sh" 3 \
        "the find-into-head pattern must match every hazardous shape"

    cat > "$probe_dir/find-head-benign.sh" <<'PROBE'
# `find … | head` raises under pipefail once head has what it needs.
IDENTITY="$(security find-identity -v -p codesigning "$KEYCHAIN" | head -1)"
BUILD_TOOLS="$(find "$sdk/build-tools" -maxdepth 1 -type d | sort -V | tail -1)"
head -20 "$listing"
PROBE
    harness::assert_pattern_hits "$HARNESS_FIND_INTO_HEAD" \
        "$probe_dir/find-head-benign.sh" 0 \
        "the find-into-head pattern must ignore prose, a different program, and tail"

    cat > "$probe_dir/artifact-hunt-hazardous.sh" <<'PROBE'
find "$src" -name '*.rej' -print
find "$CHROMIUM_SRC" \( -name "*.rej" -o -name "*.orig" \) -print
PROBE
    harness::assert_pattern_hits "$HARNESS_FIND_ARTIFACT_HUNT" \
        "$probe_dir/artifact-hunt-hazardous.sh" 2 \
        "the artifact-hunt pattern must match a find-by-name walk"

    cat > "$probe_dir/artifact-hunt-benign.sh" <<'PROBE'
# A find-based check condemns a pristine upstream checkout: 181 tracked .orig.
git -C "$dir" status --porcelain --untracked-files=all | grep -E '\.(rej|orig)$'
find "$BUILD_DIR" -name "*.apk" -print
PROBE
    harness::assert_pattern_hits "$HARNESS_FIND_ARTIFACT_HUNT" \
        "$probe_dir/artifact-hunt-benign.sh" 0 \
        "the artifact-hunt pattern must ignore prose, the git form, and unrelated find calls"
}

# harness::assert_no_lines_matching <pattern> <what> <file>...
#
# Reports every offending line in full. A truncated capture group reads the same
# whether the rule caught something fatal or something harmless.
harness::assert_no_lines_matching() {
    local pattern="$1" what="$2"
    shift 2
    local hits status=0
    hits="$(grep -nE "$pattern" "$@")" || status=$?
    HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
    if [ "$status" -gt 1 ]; then
        harness::fail "$what: grep itself failed (exit $status)"
    fi
    if [ -n "$hits" ]; then
        harness::fail "$what
$hits"
    fi
}

# harness::assert_script_list <minimum> <required basename>... -- <path>...
#
# The vacuity floor every hazard scan needs, in the one shape that survives a
# list which legitimately changes size between layers. Three separate failures
# are caught: an unexpanded glob (its own pattern is left in the array and is
# not a file), a list that silently narrowed (the count floor), and a list that
# is large but no longer contains the scripts the scan exists for (the
# membership floor, which a count alone cannot see).
harness::assert_script_list() {
    local minimum="$1"
    shift

    local required=()
    while [ "$#" -gt 0 ] && [ "$1" != "--" ]; do
        required+=("$1")
        shift
    done
    if [ "${1:-}" != "--" ]; then
        harness::fail "harness::assert_script_list called without a -- separator"
    fi
    shift

    local path count=0
    for path in "$@"; do
        HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
        if [ ! -f "$path" ]; then
            harness::fail "script list contains a non-file (an unexpanded glob?): $path"
        fi
        count=$((count + 1))
    done

    HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
    if [ "$count" -lt "$minimum" ]; then
        harness::fail "only $count script(s) matched, below the floor of $minimum; the globs are broken"
    fi

    local wanted found
    for wanted in "${required[@]}"; do
        found=0
        for path in "$@"; do
            if [ "$(basename "$path")" = "$wanted" ]; then
                found=1
                break
            fi
        done
        HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
        if [ "$found" != "1" ]; then
            harness::fail "the script list does not contain $wanted; it is not scanning what this case exists to scan"
        fi
    done
}

# --------------------------------------------------------------------------
# Fixtures
# --------------------------------------------------------------------------

# Creates a synthetic Chromium checkout that passes every sentinel check, plus
# sentinel files whose survival proves the overlay step deletes nothing.
#
# The real 55 GB tree is never touched by a test.
harness::make_chromium_fixture() {
    local dir="$1"
    mkdir -p "$dir"

    # Sentinels astro::resolve_chromium_src requires.
    printf 'buildconfig = "//build/config/BUILDCONFIG.gn"\n' > "$dir/.gn"
    mkdir -p "$dir/chrome" "$dir/base" "$dir/build/config"
    printf 'MAJOR=146\nMINOR=0\nBUILD=7680\nPATCH=177\n' > "$dir/chrome/VERSION"
    printf 'group("base") {}\n' > "$dir/base/BUILD.gn"
    printf '# BUILDCONFIG\n' > "$dir/build/config/BUILDCONFIG.gn"

    # Upstream files an `rsync --delete` would have removed, because the
    # overlay does not provide them. third_party is the realistic casualty:
    # gclient fetches it into the same tree the overlay is copied over.
    mkdir -p "$dir/third_party/somedep" "$dir/chrome/browser/ui/webui" "$dir/net"
    printf 'DO NOT DELETE - gclient dependency\n' > "$dir/third_party/somedep/README.chromium"
    printf 'DO NOT DELETE - upstream sentinel\n' > "$dir/SENTINEL-UPSTREAM.txt"
    printf 'namespace net {}\n' > "$dir/net/net_util.cc"
    # An upstream-tracked file the overlay overwrites wholesale.
    printf '// upstream chrome_web_ui_configs.cc\nvoid RegisterChromeWebUIConfigs() {}\n' \
        > "$dir/chrome/browser/ui/webui/chrome_web_ui_configs.cc"

    git -C "$dir" init --quiet
    git -C "$dir" add -A
    git -C "$dir" commit --quiet -m "upstream chromium fixture"
}

# harness::add_submodule_fixture <superproject> <path> <file> <content>
#
# A REAL git submodule inside a fixture checkout, carrying one tracked file.
#
# The last line is what makes this fixture worth building rather than faking:
# gclient writes `diff.ignoreSubmodules = dirty` into chromium/src/.git/config,
# and with it a plain `git status --porcelain` prints NOTHING over a submodule
# holding modified content. A fixture without that config would pass a case the
# real checkout fails, which is the only way this test could be worse than
# useless.
#
# `protocol.file.allow=always` is required because git refuses `file://`
# submodule transport by default since CVE-2022-39253; the origin here is a
# throwaway repository in the case's own tmpdir.
HARNESS_SUBMODULE_ORIGINS=0

harness::add_submodule_fixture() {
    local superproject="$1" path="$2" file="$3" content="$4"
    # One origin repository per call, never per submodule path: a case that
    # builds two fixtures at the same path would otherwise re-init an existing
    # origin, find nothing to commit, and fail somewhere else entirely.
    HARNESS_SUBMODULE_ORIGINS=$((HARNESS_SUBMODULE_ORIGINS + 1))
    local origin="$HARNESS_TMPDIR/submodule-origins/$HARNESS_SUBMODULE_ORIGINS"

    mkdir -p "$origin/$(dirname "$file")"
    printf '%s\n' "$content" > "$origin/$file"
    harness::setup_run git -C "$origin" init --quiet
    harness::setup_run git -C "$origin" add -A
    harness::setup_run git -C "$origin" commit --quiet -m "submodule fixture"

    harness::setup_run git -C "$superproject" -c protocol.file.allow=always \
        submodule add --quiet "$origin" "$path"
    harness::setup_run git -C "$superproject" commit --quiet -m "add submodule $path"
    harness::setup_run git -C "$superproject" config diff.ignoreSubmodules dirty
}

# Creates an overlay + matching allowlist mirroring the real repository layout.
harness::make_overlay_fixture() {
    local dir="$1" allowlist="$2"
    mkdir -p "$dir/chrome/browser/oxy/webui" "$dir/chrome/app/vector_icons" \
             "$dir/chrome/browser/ui/webui"

    printf '// astro service\n' > "$dir/chrome/browser/oxy/oxy_auth_service.cc"
    printf '// astro webui\n'   > "$dir/chrome/browser/oxy/webui/astro_ntp_ui.cc"
    printf 'CANVAS_DIMENSIONS, 16,\n' > "$dir/chrome/app/vector_icons/alia_spark.icon"
    printf '// astro copy of chrome_web_ui_configs.cc\n' \
        > "$dir/chrome/browser/ui/webui/chrome_web_ui_configs.cc"

    cat > "$allowlist" <<'EOF'
dir       chrome/browser/oxy
file      chrome/app/vector_icons/alia_spark.icon
overwrite chrome/browser/ui/webui/chrome_web_ui_configs.cc owner=test issue=4
EOF
}

# harness::make_overlay_repo <repo dir> <allowlist path>
#
# A committed Astro-shaped repository whose overlay lives in a SUBDIRECTORY,
# src/, exactly as it does in Astro — so the path-scoping the derive-from-HEAD
# gate depends on is the scoping under test rather than something the fixture
# flattened away.
#
# It also carries one file OUTSIDE the overlay, so a case can prove the gate is
# scoped to the copied paths and not to the repository's cleanliness in
# general, and an ignore rule, so a case can cover the one shape `git status`
# can never see.
#
# Echoes the commit the overlay was committed at.
harness::make_overlay_repo() {
    local repo="$1" allowlist="$2"

    mkdir -p "$repo"
    git -C "$repo" init --quiet
    harness::make_overlay_fixture "$repo/src" "$allowlist"
    printf 'unrelated repository content\n' > "$repo/README.md"
    printf '*.gen.cc\n' > "$repo/.gitignore"
    git -C "$repo" add -A
    git -C "$repo" commit --quiet -m "astro fixture: committed overlay"
    git -C "$repo" rev-parse HEAD
}

# A patch series directory the patch runner can consume.
harness::make_patch_fixture() {
    local dir="$1"
    mkdir -p "$dir"
}

# Writes a unified diff that applies exactly against the fixture content.
harness::write_patch() {
    local path="$1" target="$2" old="$3" new="$4"
    cat > "$path" <<EOF
diff --git a/$target b/$target
--- a/$target
+++ b/$target
@@ -1 +1 @@
-$old
+$new
EOF
}

# Creates a miniature Astro repository for tools/build.sh to run against, so
# the real webui/ and gn_args/ are never touched and no case can depend on
# another's damage.
#
# Everything a `--dry-run` REQUIRES is here and nothing else. In particular the
# source lock is not: the revision gate is a separate layer with its own
# script, its own lock file and its own checkouts to inspect, and a case that
# exercises it adds those on top of this fixture. Building them here would make
# every build-input case depend on tooling it does not test.
harness::make_build_root() {
    local root="$1" chromium="$2"

    harness::make_chromium_fixture "$chromium"

    # The vendored Rust crate the overlay's ad blocker links against. build.sh
    # requires it as an input, so a fixture without it would fail every build
    # case for a reason none of them is asserting — and one WITH it but with no
    # overlay-side dependency to derive would make that check vacuous, passing
    # whether or not the crate is there. Both halves are therefore present, and
    # the case that owns this check removes one of them to prove it fires.
    #
    # Committed rather than left untracked, unlike the real thing, so the
    # fixture checkout stays clean for the attribution guard; what is being
    # exercised here is build.sh's input check, not the attribution layer.
    mkdir -p "$chromium/third_party/rust/adblock/v0_9"
    printf 'rust_static_library("lib") {\n  crate_name = "adblock"\n}\n' \
        > "$chromium/third_party/rust/adblock/v0_9/BUILD.gn"
    harness::setup_run git -C "$chromium" add -A
    harness::setup_run git -C "$chromium" commit --quiet -m "vendored rust crate fixture"
    harness::setup_run git -C "$chromium" checkout --quiet --detach HEAD

    mkdir -p "$root/tools/lib" "$root/gn_args" "$root/depot_tools" "$root/patches" \
             "$root/src/chrome/browser/oxy/adblock/resources" \
             "$root/src/chrome/browser/oxy/adblock/rs"
    printf 'rust_static_library("adblock_engine_ffi") {\n  deps = [\n    "//third_party/rust/adblock/v0_9:lib",\n  ]\n}\n' \
        > "$root/src/chrome/browser/oxy/adblock/rs/BUILD.gn"
    # What build.sh runs rather than requires, so it cannot be derived below.
    harness::setup_run cp "$ASTRO_ROOT/tools/build.sh" \
       "$ASTRO_ROOT/tools/sync-overlay.sh" \
       "$ASTRO_ROOT/tools/overlay.allowlist" "$root/tools/"

    # Everything build.sh REQUIRES out of tools/, read from build.sh itself
    # rather than listed here. A hand-maintained list breaks the moment build.sh
    # requires one more input, and it breaks QUIETLY: this function runs under
    # `set -Euo pipefail` with no -e, so a `cp` whose source does not exist
    # prints to stderr and every case carries on and passes. Measured, not
    # supposed — a fixture built where build.sh does not carry the outcome
    # verifier printed `cp: cannot stat …/verify-build-outcome.sh` and all four
    # build cases still exited 0.
    #
    # Deriving it keeps the fixture layer-following in both directions: a
    # build.sh that never asks for a script does not drag that script in from a
    # later layer, and a build.sh that does ask fails HERE, named, if it is
    # missing. tools/lib/ requirements need no entry — the whole library is
    # copied below.
    local required required_count=0
    while IFS= read -r required; do
        [ -n "$required" ] || continue
        harness::setup_run cp "$ASTRO_ROOT/tools/$required" "$root/tools/"
        required_count=$((required_count + 1))
    # The pattern deliberately does not name the variable build.sh expands: it
    # matches any path ending in /tools/<file>, so it keeps working if that
    # variable is ever renamed, and it carries no literal `$` for a linter to
    # mistake for a failed expansion. The character class excludes `/`, which is
    # what leaves tools/lib/ requirements to the whole-library copy below.
    done < <(grep -oE 'astro::require_file "[^"]*/tools/[A-Za-z0-9_.-]+"' \
                 "$ASTRO_ROOT/tools/build.sh" | sed 's|.*/tools/||; s|"$||' | sort -u)

    # A derivation that matched nothing would build a fixture missing every
    # required input, and each case would then fail on whichever input it was
    # not testing. Every build.sh carries at least the gn check baseline.
    if [ "$required_count" -eq 0 ]; then
        harness::fail "no required tools/ inputs derived from build.sh; the fixture would be missing all of them"
    fi

    # The whole library, not a name list. A name list means every tool added to
    # tools/lib/ silently breaks this fixture, and the build then fails for a
    # reason that has nothing to do with what the test is asserting — which is
    # exactly how gn_args_drift.py first surfaced here.
    cp -R "$ASTRO_ROOT/tools/lib/." "$root/tools/lib/"

    printf 'is_debug = false\n' > "$root/gn_args/linux.gn"
    printf '! filter list\n' > "$root/src/chrome/browser/oxy/adblock/resources/easylist.txt"

    # The Astro WebUI app, and no per-page `dist` beside it. Those existed
    # while build.sh staged each page's bundle to a directory beside the
    # executable; the app is an input the BUILD consumes instead — a GN action
    # runs Vite in it and packs the result into a .pak. So the fixture provides
    # what build.sh checks — the source directory, the committed resource
    # manifest, and the installed dependencies the offline GN action cannot
    # install for itself.
    mkdir -p "$root/webui/app/node_modules"
    printf '{"name":"astro-webui-app","private":true}\n' > "$root/webui/app/package.json"
    printf '{"builds":{"app":{"out_dir":"dist/app","entry":"index.html","files":["index.html"]}}}\n' \
        > "$root/webui/app/manifest.json"

    # gn, autoninja and bun must RESOLVE — build.sh requires all three — but
    # none of them may run during a dry run, so they announce themselves and
    # fail loudly. bun lives here rather than being taken from the machine so
    # the build cases measure build.sh on a runner without it installed; the
    # build-safety workflow is one.
    printf '#!/usr/bin/env bash\necho "gn was executed during a dry run" >&2\nexit 99\n' \
        > "$root/depot_tools/gn"
    cp "$root/depot_tools/gn" "$root/depot_tools/autoninja"
    printf '#!/usr/bin/env bash\necho "bun was executed during a dry run" >&2\nexit 99\n' \
        > "$root/depot_tools/bun"
    chmod +x "$root/depot_tools/gn" "$root/depot_tools/autoninja" "$root/depot_tools/bun"
}

# --------------------------------------------------------------------------
# Source-lock fixtures (ASTRO-NEXT-002)
# --------------------------------------------------------------------------

# Creates a source repository with three commits and a `main` branch, plus an
# annotated tag on the second. Echoes the three commit SHAs, oldest first.
#
# The tag is ANNOTATED on purpose: `git ls-remote` reports an annotated tag as
# the tag OBJECT, and only `refs/tags/X^{}` as the commit. Comparing against
# the unpeeled value reports permanent bogus drift, which is a real trap this
# repository hit against ungoogled-chromium's own tag.
harness::make_source_repo() {
    local dir="$1" name="${2:-fixture}" with_sentinels="${3:-no}"
    mkdir -p "$dir"
    git -C "$dir" init --quiet --initial-branch=main

    # Chromium's sentinel files exist at every real commit, so a fixture
    # standing in for Chromium must carry them from the first commit onward.
    # Adding them only at the tip makes every earlier commit unrecognisable to
    # astro::resolve_chromium_src, which then blocks the very correction the
    # sync is supposed to perform.
    if [ "$with_sentinels" = "sentinels" ]; then
        mkdir -p "$dir/chrome" "$dir/base" "$dir/build/config"
        printf 'buildconfig = "//build/config/BUILDCONFIG.gn"\n' > "$dir/.gn"
        printf 'MAJOR=146\nMINOR=0\nBUILD=7680\nPATCH=177\n' > "$dir/chrome/VERSION"
        printf 'group("base") {}\n' > "$dir/base/BUILD.gn"
        printf '# BUILDCONFIG\n' > "$dir/build/config/BUILDCONFIG.gn"
    fi

    local shas=()
    local index
    for index in 1 2 3; do
        printf '%s commit %s\n' "$name" "$index" > "$dir/content.txt"
        git -C "$dir" add -A
        git -C "$dir" commit --quiet -m "$name $index"
        shas+=("$(git -C "$dir" rev-parse HEAD)")
        if [ "$index" -eq 2 ]; then
            git -C "$dir" tag -a "v$index" -m "annotated v$index"
        fi
    done
    printf '%s\n' "${shas[@]}"
}

# harness::write_build_lock <build root> <chromium> <chromium commit>
#
# The lock a fixture Astro root is built against, naming that root's own
# depot_tools and ungoogled checkouts.
harness::write_build_lock() {
    local root="$1" chromium="$2" chromium_commit="$3"
    harness::write_lock "$root/browser.lock.json" \
        "file://$chromium" "$chromium_commit" \
        "file://$root/depot_tools" "$(git -C "$root/depot_tools" rev-parse HEAD)" \
        "file://$root/.ungoogled-chromium" "$(git -C "$root/.ungoogled-chromium" rev-parse HEAD)"
}

# harness::make_locked_build_root <build root> <chromium>
#
# The lock layer on top of harness::make_build_root: the gate's own inputs —
# the script that enforces it, the schema it is validated against, the
# provenance writer a real build would run, and the depot_tools/ungoogled
# checkouts --verify-only inspects — plus a lock naming each fixture's own
# HEAD, so a case starts from a checkout that satisfies the gate and then
# breaks exactly one thing.
#
# This belongs to the source-lock layer and must not be called from a case that
# ships below it: the files it copies do not exist there. It lives here rather
# than in one of the two cases that need it so a change lands in both.
harness::make_locked_build_root() {
    local root="$1" chromium="$2"

    harness::make_build_root "$root" "$chromium"

    cp "$ASTRO_ROOT/tools/sync-sources.sh" "$ASTRO_ROOT/tools/generate-provenance.sh" \
       "$ASTRO_ROOT/tools/gclient.template" "$root/tools/"
    cp "$ASTRO_ROOT/browser.lock.schema.json" "$root/"

    # The lock gate inspects every locked source, so depot_tools and ungoogled
    # have to be real checkouts sitting detached at the commits the lock names.
    harness::setup_run git -C "$root/depot_tools" init --quiet --initial-branch=main
    harness::setup_run git -C "$root/depot_tools" add -A
    harness::setup_run git -C "$root/depot_tools" commit --quiet -m "depot_tools fixture"
    harness::setup_run git -C "$root/depot_tools" checkout --quiet --detach HEAD

    mkdir -p "$root/.ungoogled-chromium"
    printf 'patches\n' > "$root/.ungoogled-chromium/README"
    harness::setup_run git -C "$root/.ungoogled-chromium" init --quiet --initial-branch=main
    harness::setup_run git -C "$root/.ungoogled-chromium" add -A
    harness::setup_run git -C "$root/.ungoogled-chromium" commit --quiet -m "ungoogled fixture"
    harness::setup_run git -C "$root/.ungoogled-chromium" checkout --quiet --detach HEAD

    harness::write_build_lock "$root" "$chromium" "$(git -C "$chromium" rev-parse HEAD)"
}

# Writes a lock file pointing at local fixture repositories.
harness::write_lock() {
    local path="$1" chromium_url="$2" chromium_commit="$3" \
          depot_url="$4" depot_commit="$5" \
          ungoogled_url="$6" ungoogled_commit="$7" chromium_ref="${8:-}"

    python3 - "$path" "$chromium_url" "$chromium_commit" "$depot_url" \
                "$depot_commit" "$ungoogled_url" "$ungoogled_commit" \
                "$chromium_ref" <<'PY'
import json, sys

(path, chromium_url, chromium_commit, depot_url, depot_commit,
 ungoogled_url, ungoogled_commit, chromium_ref) = sys.argv[1:9]

document = {
    "lockfile_version": 1,
    "chromium": {
        "version": "146.0.7680.177",
        "commit": chromium_commit,
        "url": chromium_url,
    },
    "depot_tools": {"commit": depot_commit, "url": depot_url},
    "ungoogled_chromium": {
        "version": "146.0.7680.177-1",
        "commit": ungoogled_commit,
        "url": ungoogled_url,
        "legacy": True,
    },
}
if chromium_ref:
    document["chromium"]["ref"] = chromium_ref

with open(path, "w", encoding="utf-8") as handle:
    json.dump(document, handle, indent=2)
    handle.write("\n")
PY
}
