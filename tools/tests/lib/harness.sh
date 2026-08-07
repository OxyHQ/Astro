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
    harness::setup_run git -C "$chromium" checkout --quiet --detach HEAD

    mkdir -p "$root/tools/lib" "$root/gn_args" "$root/depot_tools" "$root/patches" \
             "$root/src/chrome/browser/oxy/adblock/resources"
    cp "$ASTRO_ROOT/tools/build.sh" "$ASTRO_ROOT/tools/sync-overlay.sh" \
       "$ASTRO_ROOT/tools/overlay.allowlist" \
       "$ASTRO_ROOT/tools/gn-check-baseline.json" "$root/tools/"
    # The whole library, not a name list. A name list means every tool added to
    # tools/lib/ silently breaks this fixture, and the build then fails for a
    # reason that has nothing to do with what the test is asserting — which is
    # exactly how gn_args_drift.py first surfaced here.
    cp -R "$ASTRO_ROOT/tools/lib/." "$root/tools/lib/"

    printf 'is_debug = false\n' > "$root/gn_args/linux.gn"
    printf '! filter list\n' > "$root/src/chrome/browser/oxy/adblock/resources/easylist.txt"

    local page
    for page in ntp alia settings whats-new error; do
        mkdir -p "$root/webui/$page/dist"
        printf '<!doctype html><title>%s</title>\n' "$page" > "$root/webui/$page/dist/index.html"
    done

    # gn and autoninja must RESOLVE — build.sh requires them — but must never
    # run during a dry run, so they announce themselves and fail loudly.
    printf '#!/usr/bin/env bash\necho "gn was executed during a dry run" >&2\nexit 99\n' \
        > "$root/depot_tools/gn"
    cp "$root/depot_tools/gn" "$root/depot_tools/autoninja"
    chmod +x "$root/depot_tools/gn" "$root/depot_tools/autoninja"
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
