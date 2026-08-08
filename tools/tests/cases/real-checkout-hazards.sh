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
# Each hazard gets a static guard AND a demonstration that the hazard is real,
# because a style rule nobody can justify is a style rule somebody deletes.
# The demonstrations are here and are not repeated elsewhere: the mechanism is
# a property of the shell and of git, not of any one script, so proving it once
# is enough. What every scanning case does need is proof that its REGEX still
# fires, which is harness::assert_hazard_patterns_fire.
#
# Two sibling cases scan the same way over lists that do not exist at this
# layer, and are separate files for exactly that reason:
#
#   * real-checkout-lock-hazards.sh — a failed `git fetch` keeps nothing, which
#     is a fact about the script that fetches the locked sources.
#   * baseline-harness-hazards.sh — the same two patterns over the product
#     baseline's own harness scripts.
#
# The list below therefore covers tools/ and tools/lib/ only. Both are
# directories that exist at every layer, so the glob adapts as scripts arrive.
# The baseline harness's directory does not, and an unexpanded glob here is a
# hard failure rather than a silent "nothing to check".

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

tmp="$(harness::tmpdir)"

# The production scripts. tools/tests/ is deliberately excluded: this case runs
# the banned `find | head` itself, to prove the failure before banning it, and a
# check that swept in its own evidence would delete its own justification.
PRODUCTION_SCRIPTS=(
    "$ASTRO_ROOT"/tools/*.sh
    "$ASTRO_ROOT"/tools/lib/*.sh
)

# Vacuity floor. The count is deliberately well below what any layer carries —
# measured at 18 where this case is earliest carried and 21 where it currently
# sits — because the list legitimately grows layer by layer and a floor pinned
# to today's tree would fail on the earliest branch for no reason. A count
# alone would not notice a list that stayed large while losing the scripts the
# scan exists for, so four that exist at every layer are named outright.
harness::assert_script_list 15 \
    build.sh sync-overlay.sh apply-patches.sh astro-common.sh \
    -- "${PRODUCTION_SCRIPTS[@]}"

# The regexes still fire. Without this a pattern tightened into uselessness
# would report the whole tree clean, which is indistinguishable from the tree
# actually being clean.
harness::assert_hazard_patterns_fire

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

# The hazard has TWO manifestations, decided by the findutils build, and both
# are the same mechanism: head closes the pipe, find cannot write. Older find
# dies of the signal — 141 = 128 + SIGPIPE(13). Newer GNU findutils handles
# EPIPE itself and exits 1 after printing "write error" (measured on the CI
# runner, 2026-08-08, while the same probe exits 141 on Debian 13). Accepting
# exit 1 ONLY alongside find's own write-error diagnostic is what keeps this a
# proof of the mechanism rather than of some unrelated failure in the probe.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ "$RUN_STATUS" = "141" ]; then
    : # killed by SIGPIPE — the classic shape
elif [ "$RUN_STATUS" = "1" ] && grep -q "write error" "$RUN_STDERR"; then
    : # findutils caught EPIPE itself — same hazard, reported by find instead
else
    harness::fail "expected the find|head hazard (exit 141, or exit 1 with find's 'write error'); got $RUN_STATUS with stderr: $(sed -n '1p' "$RUN_STDERR")"
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

harness::assert_no_lines_matching "$HARNESS_FIND_INTO_HEAD" \
    "a production script pipes find into head; on a real checkout head closes the pipe and pipefail surfaces exit 141" \
    "${PRODUCTION_SCRIPTS[@]}"

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

harness::assert_no_lines_matching "$HARNESS_FIND_ARTIFACT_HUNT" \
    "a production script hunts patch artifacts with find-by-name; it must ask git for untracked files, because upstream ships 181 tracked .orig files" \
    "${PRODUCTION_SCRIPTS[@]}"

harness::pass
