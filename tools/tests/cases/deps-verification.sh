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
    # No revision and no digest in the name: the record does not say how this is
    # pinned, which is neither a pass nor a finding.
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

# The four pin shapes a REAL `gclient revinfo` carries, transcribed from
# build/reports/deps-revinfo.json (234 entries, Chromium fully synced). Three of
# the four are not 40-hex and are nonetheless immutable — classifying on "is it
# a SHA" called 75 of those 234 holes in the lock when the true number is 10.
#
# `managed: False` in tools/gclient.template means gclient does not select the
# solution's revision, so the real record's `src` entry carries rev: null. That
# is the designed state, and it must not read as a failure OR as a pass.
write_real_shapes() {
    local path="$1" solution_revision="$2" updater_revision="$3"
    python3 - "$path" "$solution_revision" "$updater_revision" <<'PY'
import json, sys

path, solution_revision, updater_revision = sys.argv[1:4]

document = {
    # The solution. `null` when gclient did not select it; a string when it did.
    "src": {
        "url": "https://chromium.googlesource.com/chromium/src.git",
        "rev": None if solution_revision == "null" else solution_revision,
    },
    # A plain git dependency: 159 of the real record's entries are this.
    "src/net/third_party/quiche/src": {
        "url": "https://quiche.googlesource.com/quiche.git",
        "rev": "24430cb4103438f3cd1680f8f89d7c9e4288d5ca",
    },
    # A CIPD package pinned by a commit SHA wearing a tag prefix. Commit-pinned,
    # not a moving ref.
    "src/tools/luci-go:infra/tools/luci/cas/${platform}": {
        "url": "https://chrome-infra-packages.appspot.com/infra/tools/luci/cas/${platform}",
        "rev": "git_revision:072101cbfec3372b812ff510df8547d7b4187bea",
    },
    # A CIPD instance id: base64url content hash, ending in the algorithm byte.
    # Stronger than a git SHA — it names the built artifact.
    "src/third_party/updater/chrome_linux64_sans_iid/cipd:chromium/third_party/updater/chrome_linux64": {
        "url": "https://chrome-infra-packages.appspot.com/chromium/third_party/updater/chrome_linux64",
        "rev": updater_revision,
    },
    # A GCS object named after its own SHA-256. No revision field at all.
    "src/third_party/test_fonts/test_fonts:a28b222b79851716f8358d2800157d9ffe117b3545031ae51f69b7e1e1b9a969": {
        "url": "gs://chromium-fonts/a28b222b79851716f8358d2800157d9ffe117b3545031ae51f69b7e1e1b9a969",
        "rev": None,
    },
    # A GCS object whose name embeds a 40-char git hash among other tokens.
    "src/third_party/rust-toolchain": {
        "url": "gs://chromium-browser-clang/Linux_x64/rust-toolchain-7d8ebe3128fc87f3da1ad64240e63ccf07b8f0bd-3-llvmorg-23-init-2224-g5bd8dadb.tar.xz",
        "rev": None,
    },
    # A GCS object whose name carries only an ABBREVIATED hash (g5bd8dadb) and a
    # build number. The record does not establish how it is pinned, and an
    # 8-character hash must not be mistaken for a content address.
    "src/third_party/llvm-build/Release+Asserts:Linux_x64/clang-llvmorg-23-init-2224-g5bd8dadb-3.tar.xz": {
        "url": "gs://chromium-browser-clang/Linux_x64/clang-llvmorg-23-init-2224-g5bd8dadb-3.tar.xz",
        "rev": None,
    },
    # A CIPD tag. THIS is the real hole: a tag is resolved at sync time and can
    # be repointed at a different package instance.
    "src/third_party/updater/chrome_linux64/cipd:chromium/third_party/updater/chrome_linux64": {
        "url": "https://chrome-infra-packages.appspot.com/chromium/third_party/updater/chrome_linux64",
        "rev": "version:2",
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

# --- Moving refs are the finding; other pins are not -------------------------

verify --revinfo "$matching"
harness::assert_status 0 "summary run"
harness::assert_output_contains "pinned to a moving ref (2)" "counts only what can move"
harness::assert_output_contains "src/third_party/moving" "names the branch-pinned dependency"
harness::assert_output_contains "refs/heads/main" "prints the branch it is pinned to"
harness::assert_output_contains "src/third_party/tagged" "names the tag-pinned dependency"
harness::assert_output_contains "refs/tags/v1.2.3" "prints the tag it is pinned to"
# The nested-object form must normalise into a real commit pin rather than being
# counted as a hole or dropped.
harness::assert_output_contains "commit-pinned:           2" "counts commit pins, nested form included"
# No revision and no digest: the record does not say, and saying so is neither a
# pass nor a finding.
harness::assert_output_contains "not classifiable from this record (1)" "counts what it cannot classify"
harness::assert_output_contains "src/third_party/norevision" "names the entry with no revision"

# --- The four pin shapes a real record actually carries ----------------------
#
# Three of the four are not 40-hex and are immutable anyway. Only the CIPD tag
# may be reported, or this tool reports 75 findings against a correct checkout
# and gets ignored within a week.

real="$tmp/real-shapes.json"
write_real_shapes "$real" "null" "ytJ0UbU9gMLUMLRQlmqQpGpOy1dYswI3rOJ0ILnIFbUC"

verify --revinfo "$real"
harness::assert_status 0 "a record in the shape a real gclient sync produces"

harness::assert_output_contains "commit-pinned:           2" "counts both spellings of a commit pin"
harness::assert_output_contains "content-addressed:       3" "counts CIPD instance ids and digest-named GCS objects"
harness::assert_output_contains "moving-ref:              1" "counts only the CIPD tag"
harness::assert_output_contains "unclassified:            1" "counts the object it cannot classify"

# A commit SHA wearing a CIPD tag prefix is a commit pin, not a moving ref.
harness::assert_output_lacks "git_revision:072101cbfec3372b812ff510df8547d7b4187bea" \
    "git_revision: is a commit pin and must not be reported as a hole"
# A CIPD instance id is a content address — stronger than a git SHA.
harness::assert_output_lacks "ytJ0UbU9gMLUMLRQlmqQpGpOy1dYswI3rOJ0ILnIFbUC" \
    "a CIPD instance id must not be reported as a hole"
# A GCS object named after its own digest cannot be repointed.
harness::assert_output_lacks "gs://chromium-fonts" \
    "a digest-named GCS object must not be reported as a hole"

# The one real hole is named, with the tag it is pinned to.
harness::assert_output_contains "pinned to a moving ref (1)" "reports exactly one hole"
harness::assert_output_contains "MOVING-REF" "reports it as a structured finding"
harness::assert_output_contains "version:2" "prints the tag that can move"

# An 8-character hash inside a build-numbered tarball name is not a content
# address, and must not be counted as one.
harness::assert_output_contains "clang-llvmorg-23-init-2224-g5bd8dadb-3.tar.xz" \
    "names the object whose pin the record does not establish"

# --- A solution with no revision is the designed state, not a fault ----------
#
# tools/gclient.template sets managed: False, so gclient does not select the
# solution's revision — tools/sync-sources.sh does, and verifies HEAD against
# the lock afterwards. Failing here would mean this tool can never pass on a
# correct checkout; claiming a verification would be worse.

harness::assert_output_contains "DEFERRED" "says the solution revision was not established here"
harness::assert_output_contains "managed: False" "names why the record carries no solution revision"
harness::assert_output_contains "tools/sync-sources.sh --verify-only" "points at the check that does establish it"
harness::assert_output_contains "$LOCKED_SHA" "still prints the commit the lock records"
harness::assert_output_lacks "VERIFIED" "a deferred check must never read as a verified one"

# The solution being ABSENT is still a failure: "no entry" and "an entry with no
# revision" are different facts and only one of them is designed.
python3 - "$tmp/no-solution-real.json" <<'PY'
import json, sys
with open(sys.argv[1], "w", encoding="utf-8") as handle:
    json.dump({"src/net/third_party/quiche/src": {
        "url": "https://quiche.googlesource.com/quiche.git", "rev": "a" * 40}},
        handle, indent=2)
PY
verify --revinfo "$tmp/no-solution-real.json"
harness::assert_nonzero_status "a record with no src entry at all"
harness::assert_output_contains "solution is absent" "reason for the refusal"

# --- The mismatch check is not weakened by any of the above ------------------

write_real_shapes "$tmp/real-mismatch.json" "$OTHER_SHA" "ytJ0UbU9gMLUMLRQlmqQpGpOy1dYswI3rOJ0ILnIFbUC"
verify --revinfo "$tmp/real-mismatch.json"
harness::assert_nonzero_status "a recorded solution revision that disagrees with the lock"
harness::assert_output_contains "does not match the lock" "reason for the refusal"
harness::assert_output_contains "$LOCKED_SHA" "prints the commit the lock records"
harness::assert_output_contains "$OTHER_SHA" "prints the commit the record carries"

write_real_shapes "$tmp/real-match.json" "$LOCKED_SHA" "ytJ0UbU9gMLUMLRQlmqQpGpOy1dYswI3rOJ0ILnIFbUC"
verify --revinfo "$tmp/real-match.json"
harness::assert_status 0 "a recorded solution revision that agrees with the lock"
harness::assert_output_contains "VERIFIED" "a recorded, matching revision IS verified here"

# --- Only moving refs may gate ------------------------------------------------

# A record whose only non-SHA pins are content-addressed must pass the gate.
python3 - "$tmp/content-only.json" "$LOCKED_SHA" <<'PY'
import json, sys

path, solution_revision = sys.argv[1:3]
with open(path, "w", encoding="utf-8") as handle:
    json.dump({
        "src": {"url": "https://chromium.googlesource.com/chromium/src.git",
                "rev": solution_revision},
        "src/third_party/updater/chrome_linux64_sans_iid/cipd:chromium/third_party/updater/chrome_linux64": {
            "url": "https://chrome-infra-packages.appspot.com/chromium/third_party/updater/chrome_linux64",
            "rev": "ytJ0UbU9gMLUMLRQlmqQpGpOy1dYswI3rOJ0ILnIFbUC"},
        "src/third_party/test_fonts/test_fonts:a28b222b79851716f8358d2800157d9ffe117b3545031ae51f69b7e1e1b9a969": {
            "url": "gs://chromium-fonts/a28b222b79851716f8358d2800157d9ffe117b3545031ae51f69b7e1e1b9a969",
            "rev": None},
        "src/tools/luci-go:infra/tools/luci/cas/${platform}": {
            "url": "https://chrome-infra-packages.appspot.com/infra/tools/luci/cas/${platform}",
            "rev": "git_revision:072101cbfec3372b812ff510df8547d7b4187bea"},
    }, handle, indent=2)
PY

verify --revinfo "$tmp/content-only.json" --fail-on-moving-ref
harness::assert_status 0 "--fail-on-moving-ref over content-addressed and commit pins only"
harness::assert_output_contains "moving-ref:              0" "counts no holes"
harness::assert_output_lacks "MOVING-REF" "nothing may be reported as a moving ref"

# ...and the same gate must fire on a version:N tag.
verify --revinfo "$real" --fail-on-moving-ref
harness::assert_nonzero_status "--fail-on-moving-ref over a record containing a CIPD tag"
harness::assert_output_contains "--fail-on-moving-ref" "reason for the refusal"
harness::assert_output_contains "version:2" "names the tag that can move"

# Off by default: upstream Chromium ships these and Astro cannot fix them, so a
# default failure would fail every correct build.
verify --revinfo "$real"
harness::assert_status 0 "a moving ref alone does not fail the run by default"

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
