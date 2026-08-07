#!/usr/bin/env bash
# Two defects that only a real Chromium checkout exposed, and that every
# synthetic fixture in this suite hid:
#
#   * `find … | head` dies of SIGPIPE under pipefail. A fixture holding a dozen
#     files never reproduces it, because find finishes writing before head
#     closes the pipe; 400,000 files reproduce it every time.
#   * a tracked `.orig` is upstream CONTENT, not a patch artifact. cargo vendor
#     writes `Cargo.toml.orig` beside every vendored crate, so the real
#     tree carries 181 tracked `.orig` and 0 untracked — a find-by-name artifact
#     hunt condemns a pristine checkout on sight.
#
# A third hazard of the same kind — a failed `git fetch` keeps nothing, so
# telling a user their retry resumes is a promise git does not make — belongs
# to the source-fetching layer and lives in real-checkout-lock-hazards.sh. It
# is a separate case because the script it is about does not exist at this
# layer; everything here runs against the build pipeline alone.
#
# Each hazard gets a static guard AND a demonstration that the hazard is real,
# because a style rule nobody can justify is a style rule somebody deletes.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

tmp="$(harness::tmpdir)"

# The production scripts. tools/tests/ is deliberately excluded: this case runs
# the banned `find | head` itself, to prove the failure before banning it, and a
# check that swept in its own evidence would delete its own justification.
PRODUCTION_SCRIPTS=(
    "$ASTRO_ROOT"/tools/*.sh
    "$ASTRO_ROOT"/tools/lib/*.sh
    "$ASTRO_ROOT"/tools/baseline/*.sh
)

# Vacuity floor. An unmatched glob leaves its own pattern in the array, and grep
# over a nonexistent path exits 2 — which `if grep -q` reads as "no match", i.e.
# as a pass. Both failure shapes are caught here instead.
scanned=0
for script in "${PRODUCTION_SCRIPTS[@]}"; do
    HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
    if [ ! -f "$script" ]; then
        harness::fail "production script list contains a non-file: $script"
    fi
    scanned=$((scanned + 1))
done

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ "$scanned" -lt 20 ]; then
    harness::fail "only $scanned production scripts matched; the globs are broken"
fi

# Reports every offending line in full. A truncated capture group reads the same
# whether the rule caught something fatal or something harmless.
assert_no_production_line_matching() {
    local pattern="$1" what="$2"
    local hits status=0
    hits="$(grep -nE "$pattern" "${PRODUCTION_SCRIPTS[@]}")" || status=$?
    HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
    if [ "$status" -gt 1 ]; then
        harness::fail "$what: grep itself failed (exit $status)"
    fi
    if [ -n "$hits" ]; then
        harness::fail "$what
$hits"
    fi
}

# Mutation support for the two static patterns below: a regex that stopped
# matching would report the whole tree clean, which is indistinguishable from
# the tree actually being clean.
assert_pattern_hits() {
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

# --------------------------------------------------------------------------
# Hazard 1 — `find … | head` under pipefail
# --------------------------------------------------------------------------

# The pipe capacity is 64 KiB on Linux. Below it, find writes its whole listing
# into the buffer and exits before head closes the read end, so the hazard does
# not fire — which is exactly why every fixture in this suite missed it. The
# listing is therefore sized well past that boundary and the size is ASSERTED
# below, so a shrunken fixture fails loudly instead of turning the proof
# vacuous.
PIPE_CAPACITY_BYTES=65536
big="$tmp/wide-tree"
mkdir -p "$big"

long_name="$(printf 'p%.0s' {1..180})"
seq 1 2000 | sed "s|^|$big/$long_name-|" | tr '\n' '\0' | xargs -0 touch

listing="$tmp/wide-tree.listing"
find "$big" -type f > "$listing"

listing_bytes="$(wc -c < "$listing")"
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ "$listing_bytes" -le "$PIPE_CAPACITY_BYTES" ]; then
    harness::fail "fixture listing is only $listing_bytes bytes; under the ${PIPE_CAPACITY_BYTES}-byte pipe capacity the hazard cannot fire and the proof below is vacuous"
fi

cat > "$tmp/pipefail-hazard.sh" <<'PROBE'
#!/usr/bin/env bash
set -o pipefail
find "$1" -type f | head -1 > /dev/null
PROBE

harness::run bash "$tmp/pipefail-hazard.sh" "$big"
harness::assert_nonzero_status "find piped into head, over a tree larger than the pipe buffer"

# 141 = 128 + SIGPIPE(13). Asserting the exact status is what makes this a proof
# of the mechanism rather than of some unrelated failure in the probe.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ "$RUN_STATUS" != "141" ]; then
    harness::fail "expected SIGPIPE (exit 141) from find; got $RUN_STATUS"
fi

cat > "$tmp/pipefail-safe.sh" <<'PROBE'
#!/usr/bin/env bash
set -o pipefail
# Materialise the listing first: head then reads a file rather than a pipe, so
# there is no read end for it to close and no stage left to kill.
find "$1" -type f > "$2"
head -1 "$2" > /dev/null
PROBE

harness::run bash "$tmp/pipefail-safe.sh" "$big" "$tmp/safe.listing"
harness::assert_status 0 "the same listing, read from a file instead of a pipe"

# `find` must be a command word — the trailing whitespace requirement is what
# keeps `security find-identity … | head -1` out, which is a different program
# and not this hazard. `head` may sit anywhere downstream: an intermediate stage
# such as `sort` takes the SIGPIPE instead of find, which changes which process
# dies, not whether pipefail surfaces 141.
FIND_INTO_HEAD='^([^#]*[^[:alnum:]_./-])?find[[:space:]][^#]*\|[^#]*[[:space:]]head([[:space:]]|$)'

# Executable lines only. These scripts describe the hazard in prose — the script
# the construct was removed from carries a comment quoting the very shape it no
# longer runs — and a raw grep would flag its own documentation.
cat > "$tmp/probe-find-head-hazardous.sh" <<'PROBE'
find "$BUILD_DIR" -name "*.apk" | head -10
paths="$(find "$root" -type f | head -5)"
find "$src" -type f | sort | head -1
PROBE
assert_pattern_hits "$FIND_INTO_HEAD" "$tmp/probe-find-head-hazardous.sh" 3 \
    "the find-into-head pattern must match every hazardous shape"

cat > "$tmp/probe-find-head-benign.sh" <<'PROBE'
# `find … | head` raises under pipefail once head has what it needs.
IDENTITY="$(security find-identity -v -p codesigning "$KEYCHAIN" | head -1)"
BUILD_TOOLS="$(find "$sdk/build-tools" -maxdepth 1 -type d | sort -V | tail -1)"
head -20 "$listing"
PROBE
assert_pattern_hits "$FIND_INTO_HEAD" "$tmp/probe-find-head-benign.sh" 0 \
    "the find-into-head pattern must ignore prose, a different program, and tail"

assert_no_production_line_matching "$FIND_INTO_HEAD" \
    "a production script pipes find into head; on a real checkout head closes the pipe and pipefail surfaces exit 141"

# --------------------------------------------------------------------------
# Hazard 2 — a tracked .orig is upstream content, not a patch artifact
# --------------------------------------------------------------------------

# One fixture carries BOTH shapes, so neither a check that always fires nor one
# that never fires can pass: it has to name the untracked artifact and stay
# silent about the tracked one.
src="$tmp/chromium-vendored"
harness::make_chromium_fixture "$src"
printf 'alpha\n' > "$src/net/net_util.cc"

# What cargo vendor leaves beside every vendored crate. The real tree has 181.
mkdir -p "$src/third_party/rust/adblock/v0_9"
printf '[package]\nname = "adblock"\n' \
    > "$src/third_party/rust/adblock/v0_9/Cargo.toml.orig"
git -C "$src" add -A
git -C "$src" commit --quiet -m "upstream: vendored crate ships a tracked .orig"

# What a partially applied patch leaves: an UNTRACKED reject file.
printf '***rejected hunk***\n' > "$src/net/net_util.cc.rej"

patches="$tmp/patches"
mkdir -p "$patches"
harness::write_patch "$patches/001-net.patch" "net/net_util.cc" "alpha" "bravo"
printf '001-net.patch\n' > "$patches/series"

# The override is what carries execution past the pristine guard and into the
# artifact scan, so this exercises the artifact scan itself rather than assuming
# the earlier guard covers the same ground.
harness::run env ASTRO_CHROMIUM_SRC="$src" ASTRO_PATCH_REPORT="$tmp/artifacts.json" \
    ASTRO_ALLOW_DIRTY_CHROMIUM=1 \
    "$ASTRO_ROOT/tools/apply-patches.sh" astro --dest "$src" --astro-patches "$patches"

harness::assert_nonzero_status "a checkout carrying an untracked .rej"
harness::assert_output_contains "Patch artifacts found" "the artifact scan is what refused"
harness::assert_output_contains "net/net_util.cc.rej" "names the untracked artifact"
harness::assert_output_lacks "Cargo.toml.orig" \
    "a tracked upstream .orig must never be reported as a patch artifact"

# The static half: an artifact hunt must ask git which files are untracked. A
# find-by-name walk cannot tell upstream content from leftover state, and pays
# 400,000 stat calls to get the wrong answer.
FIND_ARTIFACT_HUNT='^([^#]*[^[:alnum:]_./-])?find[[:space:]][^#]*-name[^#]*(rej|orig)'

cat > "$tmp/probe-artifact-hunt-hazardous.sh" <<'PROBE'
find "$src" -name '*.rej' -print
find "$CHROMIUM_SRC" \( -name "*.rej" -o -name "*.orig" \) -print
PROBE
assert_pattern_hits "$FIND_ARTIFACT_HUNT" "$tmp/probe-artifact-hunt-hazardous.sh" 2 \
    "the artifact-hunt pattern must match a find-by-name walk"

cat > "$tmp/probe-artifact-hunt-benign.sh" <<'PROBE'
# A find-based check condemns a pristine upstream checkout: 181 tracked .orig.
git -C "$dir" status --porcelain --untracked-files=all | grep -E '\.(rej|orig)$'
find "$BUILD_DIR" -name "*.apk" -print
PROBE
assert_pattern_hits "$FIND_ARTIFACT_HUNT" "$tmp/probe-artifact-hunt-benign.sh" 0 \
    "the artifact-hunt pattern must ignore prose, the git form, and unrelated find calls"

assert_no_production_line_matching "$FIND_ARTIFACT_HUNT" \
    "a production script hunts patch artifacts with find-by-name; it must ask git for untracked files, because upstream ships 181 tracked .orig files"

harness::pass
