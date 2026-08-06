#!/usr/bin/env bash
# A recorded `gclient revinfo` is only worth what checking it proves.
#
# tools/sync-sources.sh writes build/reports/deps-revinfo.json after every sync;
# tools/verify-deps.sh is what turns that record into a verdict. This case
# governs the verdict, so every fixture here is SYNTHETIC revinfo JSON written
# by the test. The real chromium/ checkout is never read: a case that depends on
# a 55 GB tree cannot run on a clean machine, and a case that would pass without
# the tree being correct proves nothing anyway.
#
# The failures that matter are the quiet ones: a record whose Chromium commit
# drifted from the lock, a dependency that moved while the Chromium commit
# stayed put, and a record that is simply absent — which must never read as
# "nothing to report".

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

VERIFY="$ASTRO_ROOT/tools/verify-deps.sh"
tmp="$(harness::tmpdir)"

harness::assert_file_exists "$VERIFY"

# --- A lock for the fixtures to be checked against ---------------------------
#
# Nothing is fetched here — verify-deps.sh reads chromium.commit and no more —
# but the lock still has to satisfy browser.lock.schema.json, so it is written
# through the same helper every other source-lock case uses.

LOCKED_SHA="1111111111111111111111111111111111111111"
OTHER_SHA="2222222222222222222222222222222222222222"
DEPOT_SHA="3333333333333333333333333333333333333333"
UNGOOGLED_SHA="4444444444444444444444444444444444444444"
SKIA_BEFORE="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
SKIA_AFTER="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
NESTED_SHA="cccccccccccccccccccccccccccccccccccccccc"

lock="$tmp/browser.lock.json"
cp "$ASTRO_ROOT/browser.lock.schema.json" "$tmp/browser.lock.schema.json"
harness::write_lock "$lock" \
    "file://$tmp/chromium" "$LOCKED_SHA" \
    "file://$tmp/depot_tools" "$DEPOT_SHA" \
    "file://$tmp/ungoogled" "$UNGOOGLED_SHA"

# --- Fixtures ----------------------------------------------------------------

# Writes a revinfo record in the shape `gclient revinfo --output-json` emits.
#
# The keys are written in DELIBERATELY jumbled order: the snapshot this tool
# records must be sorted, and a fixture that is already sorted cannot tell a
# sorting implementation from one that merely copies its input.
write_revinfo() {
    local path="$1" src_revision="$2" skia_revision="$3"
    python3 - "$path" "$src_revision" "$skia_revision" "$NESTED_SHA" <<'PY'
import json, sys

path, src_revision, skia_revision, nested_revision = sys.argv[1:5]

document = {
    "src/third_party/skia": f"https://skia.googlesource.com/skia.git@{skia_revision}",
    # A branch and a tag: both resolve to a different commit over time, which is
    # the hole in the lock's guarantee this tool has to make visible.
    "src/third_party/moving": "https://example.invalid/moving.git@refs/heads/main",
    "src": f"https://chromium.googlesource.com/chromium/src.git@{src_revision}",
    "src/third_party/tagged": "https://example.invalid/tagged.git@refs/tags/v1.2.3",
    # An entry carrying no revision at all must be counted as unpinned, not
    # silently dropped.
    "src/third_party/norevision": "https://example.invalid/norevision.git",
    # The nested-object shape, which some gclient versions emit.
    "src/third_party/nested": {
        "url": "https://example.invalid/nested.git",
        "rev": nested_revision,
    },
}

with open(path, "w", encoding="utf-8") as handle:
    json.dump(document, handle, indent=2)
    handle.write("\n")
PY
}

matching="$tmp/matching.json"
mismatched="$tmp/mismatched.json"
moved="$tmp/moved.json"
write_revinfo "$matching" "$LOCKED_SHA" "$SKIA_BEFORE"
write_revinfo "$mismatched" "$OTHER_SHA" "$SKIA_BEFORE"
write_revinfo "$moved" "$LOCKED_SHA" "$SKIA_AFTER"

verify() {
    harness::run "$VERIFY" --lock "$lock" "$@"
}

# --- A missing record must refuse, not report success ------------------------
#
# This is the fail-closed property. "No revinfo file" means nobody observed what
# DEPS resolved to; reporting success would certify a claim no evidence was ever
# produced for.

absent="$tmp/never-written/deps-revinfo.json"
unwritten="$tmp/must-not-be-written.tsv"

verify --revinfo "$absent" --record "$unwritten"
harness::assert_nonzero_status "a missing revinfo record"
harness::assert_output_contains "$absent" "names the file it could not find"
harness::assert_output_contains "tools/sync-sources.sh" "says how to produce one"
# A refusal that still writes its output file has produced an artifact nobody
# has evidence for.
harness::assert_file_missing "$unwritten"

# --- The Chromium commit is the point ----------------------------------------

verify --revinfo "$matching"
harness::assert_status 0 "a record whose src matches the lock"
harness::assert_output_contains "$LOCKED_SHA" "names the verified commit"
harness::assert_output_contains "VERIFIED" "states the verdict it reached"

verify --revinfo "$mismatched"
harness::assert_nonzero_status "a record whose src does not match the lock"
harness::assert_output_contains "does not match the lock" "reason for the refusal"
harness::assert_output_contains "$LOCKED_SHA" "prints the commit the lock records"
harness::assert_output_contains "$OTHER_SHA" "prints the commit gclient resolved"
harness::assert_output_lacks "VERIFIED" "a mismatch must not also read as verified"

# --- A record with no `src` entry cannot yield a verdict ---------------------

python3 - "$tmp/no-solution.json" <<'PY'
import json, sys
with open(sys.argv[1], "w", encoding="utf-8") as handle:
    json.dump({"src/third_party/skia": "https://example.invalid/skia.git@" + "a" * 40},
              handle, indent=2)
PY

verify --revinfo "$tmp/no-solution.json"
harness::assert_nonzero_status "a record with no src solution"
harness::assert_output_contains "solution is absent" "reason for the refusal"
harness::assert_output_contains "src/third_party/skia" "names what the record did hold"

# --- The recorded snapshot is deterministic ----------------------------------
#
# A snapshot that is not byte-stable makes every diff between two syncs noise,
# which is the same as having no diff at all.

first="$tmp/snapshot-1.tsv"
second="$tmp/snapshot-2.tsv"

verify --revinfo "$matching" --record "$first"
harness::assert_status 0 "first --record run"
harness::assert_file_exists "$first"

verify --revinfo "$matching" --record "$second"
harness::assert_status 0 "second --record run"
harness::assert_files_identical "$first" "$second"

# Determinism must not depend on the key order of the input, which JSON does not
# constrain and gclient does not promise.
python3 - "$matching" "$tmp/reordered.json" <<'PY'
import json, sys

source, destination = sys.argv[1:3]
with open(source, encoding="utf-8") as handle:
    document = json.load(handle)
with open(destination, "w", encoding="utf-8") as handle:
    json.dump({key: document[key] for key in sorted(document, reverse=True)},
              handle, indent=2)
PY

reordered="$tmp/snapshot-reordered.tsv"
verify --revinfo "$tmp/reordered.json" --record "$reordered"
harness::assert_status 0 "--record over a reordered input"
harness::assert_files_identical "$first" "$reordered"

# The snapshot is the diffable form, so its shape is part of the contract.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
python3 - "$first" "$LOCKED_SHA" <<'PY' || exit 1
import sys

path, locked = sys.argv[1:3]
with open(path, encoding="utf-8") as handle:
    lines = handle.read().splitlines()

assert lines, "the snapshot is empty"
paths = []
for line in lines:
    dependency, tab, value = line.partition("\t")
    assert tab, f"line is not TAB-separated: {line!r}"
    assert "@" in value, f"value is not url@revision: {value!r}"
    paths.append(dependency)

assert paths == sorted(paths), paths
assert "src" in paths, paths
assert any(line.endswith("@" + locked) for line in lines), lines
PY

# --- Non-SHA pins are counted and named --------------------------------------

verify --revinfo "$matching"
harness::assert_status 0 "summary run"
harness::assert_output_contains "not pinned to a commit SHA (3)" "counts the moving pins"
harness::assert_output_contains "src/third_party/moving" "names the branch-pinned dependency"
harness::assert_output_contains "refs/heads/main" "prints the branch it is pinned to"
harness::assert_output_contains "src/third_party/tagged" "names the tag-pinned dependency"
harness::assert_output_contains "refs/tags/v1.2.3" "prints the tag it is pinned to"
harness::assert_output_contains "src/third_party/norevision" "names the entry with no revision"
# The nested-object form must normalise into a real SHA pin rather than being
# counted as a hole or dropped.
harness::assert_output_contains "pinned to a commit SHA:  3" "counts the SHA pins, nested form included"

# --- Drift against a baseline ------------------------------------------------
#
# Same Chromium commit, moved dependency: the case no check that compares only
# the Chromium commit can see.

verify --revinfo "$moved" --baseline "$first"
harness::assert_status 0 "drift is reported without --fail-on-drift"
harness::assert_output_contains "CHANGED" "reports the change as a structured entry"
harness::assert_output_contains "src/third_party/skia" "names the dependency that moved"
harness::assert_output_contains "$SKIA_BEFORE" "prints the baseline revision"
harness::assert_output_contains "$SKIA_AFTER" "prints the current revision"
harness::assert_output_contains "same Chromium commit" "says why this drift is the interesting one"
harness::assert_output_contains "VERIFIED" "drift alone is not a lock mismatch"

verify --revinfo "$moved" --baseline "$first" --fail-on-drift
harness::assert_nonzero_status "--fail-on-drift against a moved dependency"
harness::assert_output_contains "--fail-on-drift" "reason for the refusal"
harness::assert_output_contains "src/third_party/skia" "still names the dependency that moved"

# A raw revinfo record is accepted as a baseline too: it is a thing a previous
# sync legitimately left behind.
verify --revinfo "$moved" --baseline "$matching"
harness::assert_status 0 "a raw revinfo JSON used as the baseline"
harness::assert_output_contains "src/third_party/skia" "diffs against a raw revinfo baseline"

# --- ...and the other direction: nothing changed means nothing reported ------
#
# A differ that always reports is worthless, and indistinguishable from one that
# works, unless this half is asserted too.

verify --revinfo "$matching" --baseline "$first"
harness::assert_status 0 "identical snapshots"
harness::assert_output_contains "no dependency revisions differ" "says the comparison ran"
harness::assert_output_lacks "CHANGED" "nothing moved, so nothing may be reported as changed"
harness::assert_output_lacks "$SKIA_AFTER" "the revision that did not appear must not be named"

verify --revinfo "$matching" --baseline "$first" --fail-on-drift
harness::assert_status 0 "--fail-on-drift with no drift"

# --- Unrecognised shapes fail with a reason, not a stack trace ---------------

printf 'this is not json at all\n' > "$tmp/broken.json"
verify --revinfo "$tmp/broken.json"
harness::assert_nonzero_status "a record that is not JSON"
harness::assert_output_contains "not valid JSON" "reason for the refusal"
harness::assert_output_lacks "Traceback" "a stack trace is not an error message"

printf '["src", "src/third_party/skia"]\n' > "$tmp/array.json"
verify --revinfo "$tmp/array.json"
harness::assert_nonzero_status "a record whose top level is an array"
harness::assert_output_contains "unrecognised revinfo shape" "reason for the refusal"
harness::assert_output_contains "top level is a list" "names the shape it found"
harness::assert_output_lacks "Traceback" "a stack trace is not an error message"

printf '{"src": 12345}\n' > "$tmp/number.json"
verify --revinfo "$tmp/number.json"
harness::assert_nonzero_status "a record whose entry is a number"
harness::assert_output_contains "unrecognised revinfo entry" "reason for the refusal"
harness::assert_output_contains "src" "names the offending entry"
harness::assert_output_lacks "Traceback" "a stack trace is not an error message"

printf '{"src": {"repo": "x", "sha": "y"}}\n' > "$tmp/odd-object.json"
verify --revinfo "$tmp/odd-object.json"
harness::assert_nonzero_status "a nested entry with unrecognised keys"
harness::assert_output_contains "which field holds the revision" "reason for the refusal"
harness::assert_output_lacks "Traceback" "a stack trace is not an error message"

# A baseline in neither accepted form must say so rather than compare against
# whatever it managed to parse.
printf 'src https://example.invalid/src.git@%s\n' "$LOCKED_SHA" > "$tmp/bad-baseline.tsv"
verify --revinfo "$matching" --baseline "$tmp/bad-baseline.tsv"
harness::assert_nonzero_status "a baseline that is neither a snapshot nor revinfo JSON"
harness::assert_output_contains "unrecognised baseline line" "reason for the refusal"

# --- A dry run writes nothing ------------------------------------------------

planned="$tmp/dry-run-snapshot.tsv"
verify --revinfo "$matching" --record "$planned" --dry-run
harness::assert_status 0 "dry run over a matching record"
harness::assert_output_contains "PLAN" "the planned write is announced"
harness::assert_output_contains "$planned" "the plan names the file it would write"
harness::assert_file_missing "$planned"

harness::pass
