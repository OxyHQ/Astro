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
#   4. Which dependencies are pinned to a tag, branch or other moving ref rather
#      than to a commit SHA. Each one is a hole in the lock's guarantee, so they
#      are counted and named rather than left implicit.
#
# It never invents a verdict. With no revinfo file on disk it refuses and says
# how to produce one.
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
    "$RECORD_ARG" "$BASELINE_FILE" "$FAIL_ON_DRIFT" <<'PY' || analysis_status=$?
import json
import os
import re
import sys

(revinfo_path, lock_path, lock_commit, solution, record_path, baseline_path,
 fail_on_drift) = sys.argv[1:8]

SHA = re.compile(r"^[0-9a-f]{40}$")
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

not_sha = sorted(
    (dependency, revision)
    for dependency, (_url, revision) in current.items()
    if not SHA.match(revision)
)
sha_pinned = len(current) - len(not_sha)

print("=== DEPS verification ===")
print(f"  revinfo:                 {revinfo_path}")
print(f"  lock:                    {lock_path}")
print(f"  solution:                {solution}")
print(f"  dependencies:            {len(current)}")
print(f"  pinned to a commit SHA:  {sha_pinned}")
print(f"  pinned to a moving ref:  {len(not_sha)}")
if record_path:
    print(f"  snapshot recorded:       {record_path}")

if not_sha:
    print(f"--- not pinned to a commit SHA ({len(not_sha)}) ---")
    for dependency, revision in not_sha:
        print(f"  NON-SHA  {dependency}  {revision or NO_REVISION}")
    print("  A dependency resolved to a tag, branch or other moving ref is a hole in")
    print("  the lock's guarantee: the same Chromium commit can resolve it to")
    print("  different sources on a later sync, with nothing in this repository")
    print("  changing. Listed so the hole is visible rather than implicit.")

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

if resolved != lock_commit:
    die(
        "the Chromium solution does not match the lock.",
        f"  solution:           {solution}  ({resolved_url})",
        f"  browser.lock.json:  {lock_commit}",
        f"  gclient revinfo:    {resolved or NO_REVISION}",
        "",
        "The tree that was synced is not the tree this repository declares it "
        "builds. Anything produced from it is unattributable.",
        "Run tools/sync-sources.sh to bring the checkout to the locked commit, "
        "or change the lock deliberately if the new revision is intended.",
    )

print(f"  VERIFIED  {solution} resolves to {resolved}, the commit browser.lock.json records")

if drift and fail_on_drift == "1":
    die(
        f"--fail-on-drift: {drift} dependency difference(s) against "
        f"{baseline_path}.",
        "The differences are listed above. They are not automatically wrong — "
        "they are a change to the build's inputs that nobody has approved yet.",
        "Re-record the baseline once the change is deliberate.",
    )
PY

if [ "$analysis_status" -ne 0 ]; then
    astro::die_with_hint \
        "DEPS verification failed (exit $analysis_status)." \
        "The reason is printed above. Nothing here may be treated as verified:" \
        "the recorded DEPS revisions do not support the claim that this checkout" \
        "corresponds to browser.lock.json."
fi

astro::info "DEPS revisions verified against $LOCK_FILE"
