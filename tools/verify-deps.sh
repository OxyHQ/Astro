#!/usr/bin/env bash
# verify-deps.sh — turn a recorded `gclient revinfo` into a verdict.
#
# tools/sync-sources.sh writes build/reports/deps-revinfo.json after every sync.
# Recording it proves nothing on its own: a file nobody validates is a file that
# quietly goes wrong. This is the check (ASTRO-NEXT-002, issue #5; evidence for
# issue #4).
#
# What it establishes, in order of importance:
#
#   1. The Chromium solution gclient actually resolved is EXACTLY the commit
#      browser.lock.json declares. A mismatch means the tree that was synced is
#      not the tree the repository says it builds, and it is fatal.
#   2. What every other dependency resolved to, normalised into a stable,
#      diffable snapshot (--record), so two syncs can be compared at all.
#   3. Whether anything moved since a previously recorded snapshot (--baseline).
#      The same Chromium commit with different DEPS revisions is the drift worth
#      catching: no check that only compares the Chromium commit can see it.
#   4. Which dependencies are pinned to something that can MOVE. This is a
#      classification, not a hex-digit test, because most of Chromium's non-git
#      pins are content-addressed and therefore stronger than a commit SHA, not
#      weaker (see classify() below). Calling all 75 of them holes, as an
#      earlier version of this file did against the real 234-entry record, is
#      the cry-wolf failure: a report nobody believes is a report nobody reads.
#
# It never invents a verdict. With no revinfo file on disk it refuses and says
# how to produce one, and it does not claim to have verified the solution
# revision when the record does not carry one.
#
# Usage:
#   tools/verify-deps.sh [options]

ASTRO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ASTRO_ROOT
# shellcheck source=tools/lib/astro-common.sh
source "$ASTRO_ROOT/tools/lib/astro-common.sh"

LOCK_FILE="$ASTRO_ROOT/browser.lock.json"
# ASTRO_REPORT_DIR is where tools/sync-sources.sh writes the record, so the
# default here is derived from the same variable rather than restated: two
# defaults that can disagree is a bug waiting for whoever exports it.
REVINFO_FILE="$ASTRO_REPORT_DIR/deps-revinfo.json"
BASELINE_FILE=""
RECORD_FILE=""
FAIL_ON_DRIFT=0
FAIL_ON_MOVING_REF=0

# The gclient solution holding Chromium. Fixed rather than configurable because
# tools/gclient.template names it, and a mismatch between the two would mean
# this command verified a solution nobody syncs.
SOLUTION="src"

usage() {
    cat >&2 <<'EOF'
Usage: tools/verify-deps.sh [options]

  --revinfo FILE     gclient revinfo --output-json record to verify
                     (default: build/reports/deps-revinfo.json)
  --lock FILE        Lock file (default: browser.lock.json)
  --record FILE      Write a normalised, byte-stable snapshot of the record.
                     Two runs over the same input produce identical output.
  --baseline FILE    A previously recorded snapshot (or a raw revinfo JSON) to
                     diff against. Every dependency whose revision moved is
                     reported.
  --fail-on-drift    Exit non-zero when the baseline diff is non-empty. CI uses
                     this; a human reading the report does not have to.
  --fail-on-moving-ref
                     Exit non-zero when any dependency is pinned to a ref or tag
                     that can be moved. Off by default: upstream Chromium ships
                     a handful of these and Astro cannot fix them today, so
                     failing on them by default would fail every correct build.
  --dry-run          Print the plan; write nothing.
  -h, --help
EOF
}

while [ $# -gt 0 ]; do
    case "$1" in
        --revinfo)        shift; REVINFO_FILE="${1:?--revinfo needs a file}" ;;
        --lock)           shift; LOCK_FILE="${1:?--lock needs a file}" ;;
        --record)         shift; RECORD_FILE="${1:?--record needs a file}" ;;
        --baseline)       shift; BASELINE_FILE="${1:?--baseline needs a file}" ;;
        --fail-on-drift)  FAIL_ON_DRIFT=1 ;;
        --fail-on-moving-ref) FAIL_ON_MOVING_REF=1 ;;
        --dry-run)        ASTRO_DRY_RUN=1 ;;
        -h|--help)        usage; exit 0 ;;
        *)                usage; astro::die "Unknown argument: $1" ;;
    esac
    shift
done

astro::require_cmd python3

LOCK="$ASTRO_ROOT/tools/lib/lock.py"
astro::require_file "$LOCK" "lock reader"
astro::require_file "$LOCK_FILE" "lock file"

# --------------------------------------------------------------------------
# Fail closed on a missing record
#
# The absence of a revinfo file is not "nothing to check": it means nobody has
# observed what DEPS resolved to. Reporting success here would certify a claim
# no evidence was ever produced for.
# --------------------------------------------------------------------------

if [ ! -f "$REVINFO_FILE" ]; then
    astro::die_with_hint \
        "DEPS revision record not found: $REVINFO_FILE" \
        "" \
        "Nothing is assumed in its absence. A verdict about DEPS revisions can" \
        "only come from a real record of what gclient resolved." \
        "" \
        "Run tools/sync-sources.sh first: it writes this file with" \
        "'gclient revinfo --output-json' once the sync completes." \
        "" \
        "To check a record kept elsewhere: tools/verify-deps.sh --revinfo FILE"
fi

if [ -n "$BASELINE_FILE" ]; then
    astro::require_file "$BASELINE_FILE" "baseline snapshot"
fi

# --------------------------------------------------------------------------
# What the lock declares
#
# lock.py validates against browser.lock.schema.json before returning a value,
# so a malformed lock fails here rather than producing a comparison against a
# field nobody checked.
# --------------------------------------------------------------------------

CHROMIUM_COMMIT="$(python3 "$LOCK" --get chromium.commit "$LOCK_FILE")"

RECORD_ARG="$RECORD_FILE"
if astro::dry_run && [ -n "$RECORD_FILE" ]; then
    astro::plan "write normalised DEPS snapshot: $RECORD_FILE"
    RECORD_ARG=""
fi

# --------------------------------------------------------------------------
# The analysis itself
#
# python3 stdlib only: this has to run on a clean machine and on a CI runner
# with nothing installed, exactly like tools/lib/lock.py.
# --------------------------------------------------------------------------

analysis_status=0
python3 - \
    "$REVINFO_FILE" "$LOCK_FILE" "$CHROMIUM_COMMIT" "$SOLUTION" \
    "$RECORD_ARG" "$BASELINE_FILE" "$FAIL_ON_DRIFT" \
    "$FAIL_ON_MOVING_REF" <<'PY' || analysis_status=$?
import collections
import json
import os
import re
import sys

(revinfo_path, lock_path, lock_commit, solution, record_path, baseline_path,
 fail_on_drift, fail_on_moving_ref) = sys.argv[1:9]

NO_REVISION = "<no revision recorded>"


def die(message, *lines):
    """Fatal, phrased for whoever has to fix it.

    SystemExit is not reported as a traceback, which matters here: a stack
    trace tells the reader where this file broke, not what is wrong with their
    checkout.
    """
    print(f"ERROR {message}", file=sys.stderr)
    for line in lines:
        print(f"      {line}", file=sys.stderr)
    raise SystemExit(1)


def read_json(path, what):
    try:
        with open(path, encoding="utf-8") as handle:
            return json.load(handle)
    except json.JSONDecodeError as error:
        die(
            f"{what} is not valid JSON: {path}",
            str(error),
            "'gclient revinfo --output-json' writes this file. A truncated or "
            "hand-edited record is not evidence of anything.",
        )


def normalise_entry(dependency, value, source):
    """One revinfo entry as (url, revision).

    gclient writes 'url@revision' strings. Some versions, and some
    post-processed records, carry a nested object instead. Both are accepted;
    anything else is refused rather than guessed at, because a guess here
    silently produces a revision nobody resolved.
    """
    if isinstance(value, str):
        # Split on the LAST '@': a revision may be a ref such as
        # refs/heads/main, which contains no '@' but does contain '/'.
        url, separator, revision = value.rpartition("@")
        if not separator:
            return value, ""
        return url, revision

    if isinstance(value, dict):
        url = value.get("url")
        revision = value.get("rev")
        if revision is None:
            revision = value.get("revision")
        if isinstance(url, str) and isinstance(revision, str):
            return url, revision
        if isinstance(url, str) and revision is None:
            # A nested entry whose url still carries the revision.
            return normalise_entry(dependency, url, source)
        die(
            f"unrecognised revinfo entry for '{dependency}' in {source}: an "
            f"object with keys {sorted(value)}.",
            "A nested entry must carry a string 'url' and a string 'rev' (or "
            "'revision').",
            "Refusing to guess which field holds the revision.",
        )

    die(
        f"unrecognised revinfo entry for '{dependency}' in {source}: expected a "
        f"'url@revision' string or an object, got {type(value).__name__}.",
        "Refusing to guess at a shape this tool does not recognise: a guessed "
        "revision is worse than no revision, because it reads as verified.",
    )


def normalise(document, source):
    if not isinstance(document, dict):
        die(
            f"unrecognised revinfo shape in {source}: the top level is a "
            f"{type(document).__name__}, not an object.",
            "'gclient revinfo --output-json' writes an object mapping every "
            "dependency path to its resolved 'url@revision'.",
            "Refusing to guess at a shape this tool does not recognise.",
        )
    return {
        dependency: normalise_entry(dependency, value, source)
        for dependency, value in document.items()
    }


def render(entries):
    """The normalised snapshot: sorted 'path<TAB>url@revision' lines.

    Deterministic by construction — sorted keys, no timestamp, no host or path
    of the machine that produced it — so two runs over the same input are
    byte-identical and a diff between two snapshots is signal only.
    """
    return "".join(
        f"{dependency}\t{entries[dependency][0]}@{entries[dependency][1]}\n"
        for dependency in sorted(entries)
    )


def read_snapshot(path):
    """A --record snapshot, or a raw revinfo JSON, as normalised entries.

    Both are accepted because both are things a previous run legitimately left
    behind. The two are told apart by their first character rather than by a
    filename convention, and an unrecognised line is refused.
    """
    with open(path, encoding="utf-8") as handle:
        text = handle.read()

    if text.lstrip()[:1] in ("{", "["):
        return normalise(read_json(path, "baseline"), path)

    entries = {}
    for number, line in enumerate(text.splitlines(), start=1):
        if not line.strip():
            continue
        dependency, tab, value = line.partition("\t")
        if not tab:
            die(
                f"unrecognised baseline line {number} in {path}: {line!r}",
                "A recorded snapshot is TAB-separated 'path<TAB>url@revision' "
                "lines, as written by --record.",
                "Pass a --record snapshot or a raw gclient revinfo JSON.",
            )
        entries[dependency] = normalise_entry(dependency, value, path)
    return entries


# --- How a dependency is pinned ---------------------------------------------
#
# These patterns are derived from a real 234-entry record of a fully synced
# Chromium checkout, not from what a pin "looks like". Counting anything that is
# not a 40-character hex string as unpinned called 75 of those 234 holes in the
# lock, when the true number is 10.

COMMIT_PINNED = "commit-pinned"
CONTENT_ADDRESSED = "content-addressed"
MOVING_REF = "moving-ref"
UNCLASSIFIED = "unclassified"

SHA40 = re.compile(r"^[0-9a-f]{40}$")

# A CIPD package pinned by `git_revision:<sha>` IS commit-pinned; the prefix is
# CIPD tag syntax, not a weaker pin. Six of the real record's entries — gn,
# siso, three luci-go tools and resultdb — are this shape.
GIT_REVISION = re.compile(r"^git_revision:[0-9a-f]{40}$")

# A CIPD instance id: base64url of the package content's hash plus a trailing
# byte naming the hash algorithm, which is why it ends in 'C'. This is a
# content address — strictly stronger than a git SHA, since it names the built
# artifact rather than the source it was built from. All ten in the real record
# are exactly 44 characters.
CIPD_INSTANCE = re.compile(r"^[A-Za-z0-9_-]{43}C$")

# A full git (40) or SHA-256 (64) digest inside a GCS object name. Bounded on
# both sides so an abbreviated hash embedded in a longer token — the `g5bd8dadb`
# in a clang tarball name — does not read as a content address.
EMBEDDED_DIGEST = re.compile(
    r"(?<![0-9a-fA-F])(?:[0-9a-f]{40}|[0-9a-f]{64})(?![0-9a-fA-F])"
)


def classify(url, revision):
    """How strongly this dependency is pinned.

    One question decides it: can this resolve to different bytes on a later
    sync, with nothing in this repository changing?

      commit-pinned      no — a commit SHA, however it is spelled
      content-addressed  no — the name IS the content's hash, so a different
                         object is a different name
      moving-ref         YES — a CIPD ref or tag (version:2, latest) or a git
                         ref (refs/heads/main, refs/tags/x), resolved at sync
                         time. Only this is a finding.
      unclassified       unknown — this record does not say. Not folded into
                         either answer: guessing in either direction is how a
                         check stops being believed.
    """
    if not revision:
        # A GCS object is pinned by its name, and Chromium names most of them
        # after the object's own digest.
        if url.startswith("gs://") and EMBEDDED_DIGEST.search(url):
            return CONTENT_ADDRESSED
        return UNCLASSIFIED
    if SHA40.match(revision) or GIT_REVISION.match(revision):
        return COMMIT_PINNED
    if CIPD_INSTANCE.match(revision):
        return CONTENT_ADDRESSED
    return MOVING_REF


current = normalise(read_json(revinfo_path, "revinfo record"), revinfo_path)

# --- Evidence is written before any verdict, so a failing run still leaves a
# --- comparable record of what it saw.

if record_path:
    directory = os.path.dirname(record_path)
    if directory:
        os.makedirs(directory, exist_ok=True)
    with open(record_path, "w", encoding="utf-8") as handle:
        handle.write(render(current))

# --- Summary ----------------------------------------------------------------

# The solution is excluded from the pin classification and reported on its own:
# it is not pinned by DEPS at all, and counting it as unpinned would put a
# permanent false finding in every report.
kinds = {
    dependency: classify(url, revision)
    for dependency, (url, revision) in current.items()
    if dependency != solution
}
counts = collections.Counter(kinds.values())

moving = sorted(d for d, kind in kinds.items() if kind == MOVING_REF)
unclassified = sorted(d for d, kind in kinds.items() if kind == UNCLASSIFIED)

print("=== DEPS verification ===")
print(f"  revinfo:                 {revinfo_path}")
print(f"  lock:                    {lock_path}")
print(f"  solution:                {solution}")
print(f"  dependencies:            {len(current)}")
print(f"  solution entry:          {1 if solution in current else 0}")
print(f"  commit-pinned:           {counts[COMMIT_PINNED]}")
print(f"  content-addressed:       {counts[CONTENT_ADDRESSED]}")
print(f"  moving-ref:              {counts[MOVING_REF]}")
print(f"  unclassified:            {counts[UNCLASSIFIED]}")
if record_path:
    print(f"  snapshot recorded:       {record_path}")

if moving:
    print(f"--- pinned to a moving ref ({len(moving)}) ---")
    for dependency in moving:
        _url, revision = current[dependency]
        print(f"  MOVING-REF  {dependency}  {revision}")
    print("  A ref or tag is resolved at sync time, so the same Chromium commit can")
    print("  resolve these to different bytes on a later sync with nothing in this")
    print("  repository changing. This is the hole in the lock's guarantee.")
    print("  A commit SHA, a CIPD instance id and a digest-named GCS object cannot")
    print("  move, and are deliberately not listed here.")

if unclassified:
    print(f"--- not classifiable from this record ({len(unclassified)}) ---")
    for dependency in unclassified:
        url, revision = current[dependency]
        print(f"  UNKNOWN-PIN  {dependency}  {revision or NO_REVISION}  {url}")
    print("  These carry no revision in this record and no digest in their name, so")
    print("  the record does not say how they are pinned. A checksum a DEPS entry")
    print("  may declare for such an object is not written into revinfo, so it")
    print("  cannot be read here. Reported rather than assumed either way, and NOT")
    print("  counted as a moving ref.")

# --- Drift against a previously recorded snapshot ---------------------------

drift = 0
if baseline_path:
    baseline = read_snapshot(baseline_path)

    changed = [
        (dependency, baseline[dependency], current[dependency])
        for dependency in sorted(set(baseline) & set(current))
        if baseline[dependency] != current[dependency]
    ]
    added = sorted(set(current) - set(baseline))
    removed = sorted(set(baseline) - set(current))
    drift = len(changed) + len(added) + len(removed)

    print(f"--- baseline: {baseline_path} ---")
    if drift:
        print(
            f"--- DEPS drift ({len(changed)} changed, {len(added)} added, "
            f"{len(removed)} removed) ---"
        )
        for dependency, (was_url, was_revision), (now_url, now_revision) in changed:
            print(f"  CHANGED  {dependency}")
            print(f"             baseline  {was_url}@{was_revision}")
            print(f"             current   {now_url}@{now_revision}")
        for dependency in added:
            url, revision = current[dependency]
            print(f"  ADDED    {dependency}")
            print(f"             current   {url}@{revision}")
        for dependency in removed:
            url, revision = baseline[dependency]
            print(f"  REMOVED  {dependency}")
            print(f"             baseline  {url}@{revision}")

        was_solution = baseline.get(solution)
        now_solution = current.get(solution)
        if was_solution and now_solution and was_solution[1] == now_solution[1]:
            print("  NOTE  Both snapshots record the same Chromium commit")
            print(f"        ({now_solution[1]}), yet the dependency revisions above")
            print("        differ. Two syncs of one Chromium commit therefore produced")
            print("        different sources. This is precisely the drift a recorded")
            print("        revinfo exists to catch, and it is invisible to any check")
            print("        that compares only the Chromium commit.")
    else:
        print(
            f"  no dependency revisions differ "
            f"({len(current)} dependencies compared)"
        )

# --- The verdict ------------------------------------------------------------

if solution not in current:
    listed = sorted(current)
    die(
        f"the '{solution}' solution is absent from {revinfo_path}.",
        f"That record holds {len(current)} entries; the first few are: "
        f"{', '.join(listed[:5]) or '(none)'}",
        "Without it there is nothing to compare the locked Chromium commit "
        "against, and this command will not report a verdict it did not reach.",
        "Check that the record came from a sync of tools/gclient.template, "
        f"whose solution is named '{solution}'.",
    )

resolved_url, resolved = current[solution]

if not resolved:
    # tools/gclient.template sets managed: False precisely so gclient does not
    # select the solution's revision, so a null rev here is the designed state
    # and not a fault. Saying so is not the same as verifying it: the check that
    # does verify it lives in tools/sync-sources.sh, and this says where.
    print(f"  DEFERRED  '{solution}' carries no revision in this record.")
    print("            tools/gclient.template sets managed: False, so gclient does not")
    print("            select the solution's revision — tools/sync-sources.sh does, and")
    print("            it compares `git rev-parse HEAD` against the lock after the sync.")
    print(f"            Locked commit:  {lock_commit}")
    print("            Re-check the checkout itself with:")
    print("              tools/sync-sources.sh --verify-only")
    print("            This record does not establish the solution revision, and this")
    print("            command does not claim it does.")
    print(
        f"  CONCLUSION  {len(kinds)} dependencies classified against "
        f"{lock_path}; the solution revision is NOT established here."
    )
elif resolved != lock_commit:
    die(
        "the Chromium solution does not match the lock.",
        f"  solution:           {solution}  ({resolved_url})",
        f"  browser.lock.json:  {lock_commit}",
        f"  gclient revinfo:    {resolved}",
        "",
        "The tree that was synced is not the tree this repository declares it "
        "builds. Anything produced from it is unattributable.",
        "Run tools/sync-sources.sh to bring the checkout to the locked commit, "
        "or change the lock deliberately if the new revision is intended.",
    )
else:
    print(
        f"  VERIFIED  {solution} resolves to {resolved}, the commit "
        f"browser.lock.json records"
    )
    print(
        f"  CONCLUSION  {len(kinds)} dependencies classified; the solution "
        f"matches {lock_path}."
    )

if drift and fail_on_drift == "1":
    die(
        f"--fail-on-drift: {drift} dependency difference(s) against "
        f"{baseline_path}.",
        "The differences are listed above. They are not automatically wrong — "
        "they are a change to the build's inputs that nobody has approved yet.",
        "Re-record the baseline once the change is deliberate.",
    )

if moving and fail_on_moving_ref == "1":
    die(
        f"--fail-on-moving-ref: {len(moving)} dependency(ies) pinned to a ref "
        "or tag that can be moved.",
        "They are listed above. Each can resolve to different bytes on a later "
        "sync with nothing in this repository changing.",
        "Content-addressed and commit-pinned dependencies are not counted here: "
        "this failure names only what can actually move.",
    )
PY

if [ "$analysis_status" -ne 0 ]; then
    astro::die_with_hint \
        "DEPS verification failed (exit $analysis_status)." \
        "The reason is printed above. Nothing here may be treated as verified:" \
        "the recorded DEPS revisions do not support the claim that this checkout" \
        "corresponds to browser.lock.json."
fi

# Deliberately not "verified": what this record establishes is printed above as
# a CONCLUSION line, and it differs depending on whether the record carries a
# solution revision at all. A blanket "verified" here would overwrite that
# distinction with the reassuring reading.
astro::info "DEPS record checked: $REVINFO_FILE"
