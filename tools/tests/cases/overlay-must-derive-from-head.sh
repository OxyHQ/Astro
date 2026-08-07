#!/usr/bin/env bash
# The overlay copied into Chromium must be the one the commit being built
# carries — not whatever happens to be in the working tree.
#
# The old sync copied src/ as it stood. An untracked whole-file overlay copy of
# chrome/browser/ui/webui/chrome_web_ui_configs.cc was therefore compiled into
# Chromium, pulling Astro headers into an upstream translation unit and breaking
# the build; nothing in any artifact recorded that the tree differed from every
# commit. A binary produced that way cannot be reproduced from any revision, and
# nothing said so.
#
# The gate is tested in BOTH directions. A refusal-only gate is easy to write
# and worthless: an overlay that matches HEAD must sync, and a change OUTSIDE
# the overlay must not block anything, or the check is measuring the wrong thing.
#
# Covered here, end to end: refusal for modified / untracked / ignored / deleted
# overlay paths; that every differing path is named and classified; that nothing
# at all is copied when it refuses and nothing of the developer's is touched;
# that the explicit developer override lets the copy through and records what it
# found; and that no CI workflow sets that override.
#
# What the override COSTS — the build being recorded as not reproducible, and
# packaging then refusing it — is a separate layer, because it is written and
# read by the provenance generator, which does not exist here. It is asserted in
# dirty-overlay-is-recorded-and-refused.sh.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

SYNC="$ASTRO_ROOT/tools/sync-overlay.sh"

tmp="$(harness::tmpdir)"
chromium="$tmp/chromium-src"
repo="$tmp/astro"
overlay="$repo/src"
allowlist="$tmp/overlay.allowlist"
patches="$tmp/patches"
mkdir -p "$patches"

harness::make_chromium_fixture "$chromium"
OVERLAY_HEAD="$(harness::make_overlay_repo "$repo" "$allowlist")"

# Committed content of the two files this case moves around. Restored with
# printf rather than `git checkout`, so the fixture is never repaired by the
# same tool the gate consults.
SERVICE_REL="chrome/browser/oxy/oxy_auth_service.cc"
SERVICE_COMMITTED='// astro service'
ICON_REL="chrome/app/vector_icons/alia_spark.icon"
ICON_COMMITTED='CANVAS_DIMENSIONS, 16,'
UNTRACKED_REL="chrome/browser/oxy/oxy_untracked_wip.cc"

# Any arguments are passed to env as additional VAR=VALUE settings.
sync_overlay() {
    harness::run env ASTRO_CHROMIUM_SRC="$chromium" "$@" "$SYNC" \
        --source "$overlay" --dest "$chromium" --allowlist "$allowlist" \
        --patches "$patches"
}

# A path must be named on a line that also classifies it. Asserting only that
# the path appears somewhere would pass on an unrelated mention of it.
assert_classified() {
    local classification="$1" path="$2"
    HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
    local pattern="^[[:space:]]*${classification}[[:space:]]+${path//./\\.}$"
    if ! grep -qE -- "$pattern" "$RUN_STDERR" "$RUN_STDOUT"; then
        harness::fail "expected a line classifying $path as $classification"
    fi
}

# ==========================================================================
# Direction 1: an overlay that matches HEAD syncs
# ==========================================================================

sync_overlay
harness::assert_status 0 "overlay matching HEAD"
harness::assert_output_contains "matches HEAD ($OVERLAY_HEAD)" "records the revision it verified"
harness::assert_files_identical "$overlay/$SERVICE_REL" "$chromium/$SERVICE_REL"

manifest="$ASTRO_REPORT_DIR/overlay-manifest.json"
harness::assert_file_exists "$manifest"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
python3 - "$manifest" "$OVERLAY_HEAD" <<'PY' || exit 1
import json, sys
path, head = sys.argv[1:3]
with open(path, encoding="utf-8") as handle:
    state = json.load(handle)["source_state"]
assert state["state"] == "clean", state
assert state["clean"] is True, state
assert state["revision"] == head, state
assert state["override"] is False, state
assert state["differences"] == [], state
PY

# A change OUTSIDE the overlay must not block the sync: the gate is scoped to
# the paths that are copied, not to the repository's cleanliness in general.
printf 'edited after the commit\n' >> "$repo/README.md"

sync_overlay
harness::assert_status 0 "a change outside the overlay does not block the sync"
harness::assert_output_contains "matches HEAD" "still verified against the commit"

# ==========================================================================
# Direction 2: a MODIFIED overlay file refuses, and copies nothing
# ==========================================================================

printf '// LOCAL EDIT, never committed\n' > "$overlay/$SERVICE_REL"
before="$(harness::manifest "$chromium")"

sync_overlay
harness::assert_nonzero_status "overlay modified relative to HEAD"
harness::assert_output_contains "differ from HEAD" "refusal reason"
harness::assert_output_contains "$OVERLAY_HEAD" "names the commit it compared against"
assert_classified "modified" "src/$SERVICE_REL"
harness::assert_output_contains "ASTRO_ALLOW_DIRTY_OVERLAY=1" "names the override"

# Nothing was copied. The destination still holds the committed content from
# the successful sync above, which is the proof that matters: an exit status
# alone would also be produced by a gate that refused after copying.
harness::assert_tree_unchanged "$chromium" "$before"
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if ! grep -qF -- "$SERVICE_COMMITTED" "$chromium/$SERVICE_REL"; then
    harness::fail "the destination no longer holds the committed content: $chromium/$SERVICE_REL"
fi
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if grep -qF -- "LOCAL EDIT" "$chromium/$SERVICE_REL"; then
    harness::fail "the uncommitted overlay content reached Chromium anyway"
fi

# The developer's own file is untouched: this gate detects, it never repairs.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if ! grep -qF -- "LOCAL EDIT" "$overlay/$SERVICE_REL"; then
    harness::fail "the gate modified the developer's working tree"
fi

# --dry-run validates the same input, so it must refuse too — otherwise the
# documented way to check a build before running it reports a clean bill.
harness::run env ASTRO_CHROMIUM_SRC="$chromium" "$SYNC" --dry-run \
    --source "$overlay" --dest "$chromium" --allowlist "$allowlist" \
    --patches "$patches"
harness::assert_nonzero_status "dry run against a modified overlay"

# ==========================================================================
# Direction 3: an UNTRACKED overlay file refuses
#
# This is the shape that caused the real failure, so it is asserted on its own
# rather than assumed to follow from the modified case.
# ==========================================================================

printf '%s\n' "$SERVICE_COMMITTED" > "$overlay/$SERVICE_REL"
printf '// work in progress, never committed\n' > "$overlay/$UNTRACKED_REL"
before="$(harness::manifest "$chromium")"

sync_overlay
harness::assert_nonzero_status "untracked file under the overlay"
assert_classified "untracked" "src/$UNTRACKED_REL"
harness::assert_tree_unchanged "$chromium" "$before"
harness::assert_file_missing "$chromium/$UNTRACKED_REL"

rm "$overlay/$UNTRACKED_REL"

# --- and an IGNORED file, which no git status would ever show ----------------
#
# The copy is a filesystem operation, so .gitignore does not apply to it: an
# ignored file under the overlay is copied into Chromium like any other. It is
# reported by NEITHER `git status --untracked-files=all` NOR `git diff HEAD`,
# which is asserted here rather than assumed — it is the whole reason this gate
# compares against HEAD's tree instead of reading git status, and a future
# rewrite to the obvious `git status` implementation must fail this case.

IGNORED_REL="chrome/browser/oxy/oxy_generated.gen.cc"
printf '// generated, ignored, never committed\n' > "$overlay/$IGNORED_REL"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ -n "$(git -C "$repo" status --porcelain --untracked-files=all -- src)" ]; then
    harness::fail "the fixture's ignored file is visible to git status; this case
      is no longer testing the shape it exists for"
fi

before="$(harness::manifest "$chromium")"

sync_overlay
harness::assert_nonzero_status "ignored file under the overlay"
# Classified as ignored, not untracked: being sent to a `git status` that
# prints nothing is worse than not being told at all.
assert_classified "ignored" "src/$IGNORED_REL"
harness::assert_tree_unchanged "$chromium" "$before"
harness::assert_file_missing "$chromium/$IGNORED_REL"

rm "$overlay/$IGNORED_REL"

# ==========================================================================
# Direction 4: a DELETED tracked overlay file refuses
#
# A deletion is invisible to any check that only looks at the files present on
# disk, and it changes what the build contains just as much as an addition.
# ==========================================================================

rm "$overlay/$ICON_REL"
before="$(harness::manifest "$chromium")"

sync_overlay
harness::assert_nonzero_status "tracked overlay file deleted locally"
assert_classified "deleted" "src/$ICON_REL"
harness::assert_tree_unchanged "$chromium" "$before"

printf '%s\n' "$ICON_COMMITTED" > "$overlay/$ICON_REL"

# ==========================================================================
# EVERY differing path is named, and each is classified
#
# The four directions above each present the gate with ONE difference, which
# cannot distinguish a report that names every path from one that stops at the
# first and calls it a day. A developer given a partial list fixes what they
# were told about, re-runs, and is refused again for the next one — so all
# three shapes are presented at once here, and all three must appear.
# ==========================================================================

printf '// LOCAL EDIT, never committed\n' > "$overlay/$SERVICE_REL"
rm "$overlay/$ICON_REL"
printf '// work in progress, never committed\n' > "$overlay/$UNTRACKED_REL"
before="$(harness::manifest "$chromium")"

sync_overlay
harness::assert_nonzero_status "three differing overlay paths at once"
harness::assert_output_contains "has 3 path(s) that differ from HEAD" "reports the full count"
assert_classified "modified" "src/$SERVICE_REL"
assert_classified "deleted" "src/$ICON_REL"
assert_classified "untracked" "src/$UNTRACKED_REL"

# The refusal must SAY what it did, not merely have done it. A developer who is
# not told the copy was skipped has to go and look, and the reasonable guess —
# that a half-finished copy was left behind — is the one that leads them to
# delete things.
harness::assert_output_contains "Nothing has been copied and nothing of yours has been touched." \
    "the refusal states that it copied nothing and touched nothing"

harness::assert_tree_unchanged "$chromium" "$before"
harness::assert_file_missing "$chromium/$UNTRACKED_REL"

rm "$overlay/$UNTRACKED_REL"
printf '%s\n' "$ICON_COMMITTED" > "$overlay/$ICON_REL"

# ==========================================================================
# The override is real, scoped, and recorded
# ==========================================================================

printf '// LOCAL EDIT, never committed\n' > "$overlay/$SERVICE_REL"

sync_overlay ASTRO_ALLOW_DIRTY_OVERLAY=1
harness::assert_status 0 "explicit developer override"
harness::assert_output_contains "override:dirty-overlay" "structured override warning"
harness::assert_output_contains "NOT reproducible" "says what the override costs"
assert_classified "modified" "src/$SERVICE_REL"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if ! grep -qF -- "LOCAL EDIT" "$chromium/$SERVICE_REL"; then
    harness::fail "the override did not copy the working-tree content"
fi

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
python3 - "$manifest" "src/$SERVICE_REL" <<'PY' || exit 1
import json, sys
path, changed = sys.argv[1:3]
with open(path, encoding="utf-8") as handle:
    state = json.load(handle)["source_state"]
assert state["state"] == "dirty", state
assert state["clean"] is False, state
assert state["override"] is True, state
differences = {entry["overlay_path"]: entry["classification"] for entry in state["differences"]}
assert differences == {changed: "modified"}, differences
PY

# ==========================================================================
# CI must never set the override
#
# The scan matches a workflow SETTING the override — a YAML `env:` entry or a
# shell assignment — rather than the name appearing at all. That distinction is
# what lets the scan read every file under .github/ with no exclusions, which
# matters more than it looks: the previous form excluded build-safety.yml by
# name, because the guard living there mentions the override, and an
# exclusion-by-filename is a hole that grows. Anything excluded by name stops
# being checked, including the day someone adds `ASTRO_ALLOW_DIRTY_OVERLAY: 1`
# to the very file that was excluded for carrying the guard.
#
# Comment lines are excluded, on the same principle applied everywhere else
# here: the workflows describe the override in prose, and a check that flags its
# own documentation is a check somebody disables.
# ==========================================================================

CI_SETS_OVERRIDE='^[^#]*ASTRO_ALLOW_DIRTY_OVERLAY[A-Z_]*[[:space:]]*[:=]'

ci_hits=""
ci_status=0
ci_hits="$(grep -rnE "$CI_SETS_OVERRIDE" "$ASTRO_ROOT/.github")" || ci_status=$?
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ "$ci_status" -gt 1 ]; then
    harness::fail "the CI override scan failed to run (grep exit $ci_status)"
fi
if [ -n "$ci_hits" ]; then
    harness::fail "a file under .github/ sets the dirty-overlay override:
$ci_hits"
fi

# Mutation support. A grep that matches nothing reads the same whether the tree
# is clean or the pattern is wrong, so the pattern is shown both a workflow that
# sets the override and one that merely names it inside a guard. Without the
# second probe, tightening the pattern until it also condemned the guard would
# go unnoticed until it condemned CI.
mkdir -p "$tmp/probe-github/workflows"
cat > "$tmp/probe-github/workflows/sets-it.yml" <<'PROBE'
name: probe
jobs:
  build:
    env:
      ASTRO_ALLOW_DIRTY_OVERLAY: 1
    steps:
      - run: ASTRO_ALLOW_DIRTY_OVERLAY_PACKAGE=1 tools/package-release.sh
PROBE
harness::assert_pattern_hits "$CI_SETS_OVERRIDE" "$tmp/probe-github/workflows/sets-it.yml" 2 \
    "the scan must match a workflow that sets the override, in env: and in shell form"

cat > "$tmp/probe-github/workflows/guards-it.yml" <<'PROBE'
# ASTRO_ALLOW_DIRTY_OVERLAY is developer-only and must never appear in CI.
name: probe
jobs:
  build:
    steps:
      - run: |
          for override in ASTRO_ALLOW_DIRTY_CHROMIUM ASTRO_ALLOW_DIRTY_OVERLAY; do
            if [ -n "${!override:-}" ]; then exit 1; fi
          done
PROBE
harness::assert_pattern_hits "$CI_SETS_OVERRIDE" "$tmp/probe-github/workflows/guards-it.yml" 0 \
    "the scan must ignore prose and a guard that only names the override"

harness::pass
