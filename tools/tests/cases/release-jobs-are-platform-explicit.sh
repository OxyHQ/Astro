#!/usr/bin/env bash
# Every release build job must name the gclient target_os it synchronises for.
#
# Until this was fixed each job invoked tools/sync-sources.sh with no --targets,
# so all five synced with the default (linux) and the Windows, macOS and Android
# jobs were configured by whatever that runner's checkout had last been set to.
# That is the same "the runner decides what gets built" defect the source lock
# exists to remove, one level down in the dependency graph: the lock pins WHICH
# commit is compiled, and nothing pinned what it is configured to compile FOR.
#
# The fix is one --targets argument per invocation, which nothing enforces. A
# new job, or a copy-pasted one, silently reintroduces the defect. This case is
# the enforcement.
#
# The --verify-only invocation is checked against its job's sync invocation
# rather than only against the job: a verify naming a different target_os would
# confirm a configuration nobody synced, which is worse than not verifying.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

WORKFLOW="$ASTRO_ROOT/.github/workflows/release.yml"
SYNC_SCRIPT="$ASTRO_ROOT/tools/sync-sources.sh"
tmp="$(harness::tmpdir)"

harness::assert_file_exists "$WORKFLOW"
harness::assert_file_exists "$SYNC_SCRIPT"

# The checker lives in the fixture rather than in tools/, because the same code
# has to read the real workflow AND the deliberately broken copies below. A
# checker only ever pointed at a file that passes is indistinguishable from one
# that cannot fail.
CHECKER="$tmp/platform-targets.py"
cat > "$CHECKER" <<'PY'
#!/usr/bin/env python3
"""Assert every build job in a release workflow names its gclient target_os.

Stdlib only: PyYAML is not present on a clean machine or a self-hosted runner,
and a gate that needs an install step is a gate somebody skips. A workflow is
line-oriented enough for this question, which is the same parse the rest of
this repository's checks use.

Usage:
    platform-targets.py check  <workflow.yml> <sync-sources.sh>
    platform-targets.py mutate <workflow.yml> <job> <mode> [value]

The mutate modes exist so the test can prove this checker discriminates:
drop-targets, retarget-sync, retarget-verify, retarget-all, drop-job and
clone-without-sync.
"""

from __future__ import annotations

import re
import sys
from collections import namedtuple

SYNC = "tools/sync-sources.sh"
BUILD = "tools/build.sh"

# What each tools/build.sh platform has to be synced as. Not an identity map,
# and that is the whole point: Windows ARM64 is cross-compiled on a Windows x64
# runner, so both Windows jobs need gclient's `win`.
PLATFORM_TARGET = {
    "linux": "linux",
    "windows": "win",
    "windows-arm64": "win",
    "macos": "mac",
    "android": "android",
}

# A parser that finds nothing must not report success over an empty set.
MIN_BUILD_JOBS = 5
MIN_INVOCATIONS = 10

TARGETS = re.compile(r"--targets(?:=|\s+)(\"[^\"]*\"|'[^']*'|\S+)")
JOB_HEADER = re.compile(r"^  ([A-Za-z0-9_.-]+):\s*$")

# tools/sync-sources.sh validates target_os in exactly one `case` arm. Reading
# it here rather than restating the list keeps the two from drifting apart.
TARGET_CASE_ARM = re.compile(r"^\s*([a-z][a-z0-9|_-]*)\)\s*target_os_literal=")

Invocation = namedtuple("Invocation", "line verify target")


def die(message: str) -> None:
    print(message, file=sys.stderr)
    raise SystemExit(2)


def read_lines(path: str) -> list[str]:
    with open(path, encoding="utf-8") as handle:
        return handle.read().splitlines()


def strip_yaml_comment(line: str) -> str:
    """Drop a trailing YAML comment, keeping quoted text.

    Load-bearing rather than cosmetic: release.yml names tools/sync-sources.sh
    in five prose comments, and counting those as invocations would report five
    phantom missing --targets on a correct file.
    """
    quote = None
    for index, char in enumerate(line):
        if quote:
            if char == quote:
                quote = None
            continue
        if char in ("'", '"'):
            quote = char
            continue
        if char == "#" and (index == 0 or line[index - 1].isspace()):
            return line[:index]
    return line


def accepted_targets(path: str) -> set[str]:
    found = [
        match.group(1)
        for match in (TARGET_CASE_ARM.match(line) for line in read_lines(path))
        if match
    ]
    if len(found) != 1:
        die(f"expected exactly one target_os case arm in {path}, found {len(found)}")
    return set(found[0].split("|"))


def split_jobs(lines: list[str]) -> list[tuple[str, int, int]]:
    """Return (name, start, end) index ranges for each entry under `jobs:`."""
    jobs: list[tuple[str, int, int]] = []
    in_jobs = False
    name = None
    start = 0

    for index, raw in enumerate(lines):
        code = strip_yaml_comment(raw)
        if not code.strip():
            continue
        if not code[0].isspace():
            if name is not None:
                jobs.append((name, start, index))
                name = None
            in_jobs = code.split(":", 1)[0].strip() == "jobs"
            continue
        if not in_jobs:
            continue
        match = JOB_HEADER.match(code)
        if match:
            if name is not None:
                jobs.append((name, start, index))
            name = match.group(1)
            start = index

    if name is not None:
        jobs.append((name, start, len(lines)))
    return jobs


def invocations_in(lines: list[str], start: int, end: int) -> list[Invocation]:
    found = []
    for index in range(start, end):
        code = strip_yaml_comment(lines[index])
        if SYNC not in code:
            continue
        match = TARGETS.search(code)
        target = match.group(1).strip("\"'") if match else None
        found.append(Invocation(index + 1, "--verify-only" in code, target))
    return found


def build_platforms_in(lines: list[str], start: int, end: int) -> list[tuple[int, str]]:
    """Every tools/build.sh invocation in the range, with the platform it names.

    The platform is taken from the argument rather than the job name, so what
    is asserted is that a job syncs for what it actually builds.
    """
    found = []
    for index in range(start, end):
        code = strip_yaml_comment(lines[index])
        position = code.find(BUILD)
        if position < 0:
            continue
        arguments = code[position + len(BUILD):].split()
        known = [argument for argument in arguments if argument in PLATFORM_TARGET]
        found.append((index + 1, known[0] if len(known) == 1 else None))
    return found


def check(workflow_path: str, sync_path: str) -> int:
    lines = read_lines(workflow_path)
    accepted = accepted_targets(sync_path)
    required = set(PLATFORM_TARGET.values())
    errors: list[str] = []

    # A partial or misdirected parse of the case arm would silently narrow what
    # counts as a valid target; this is the floor under it.
    unsupported = required - accepted
    if unsupported:
        errors.append(
            f"{SYNC} no longer accepts {', '.join(sorted(unsupported))}; "
            "the job-to-target_os map in this checker needs revisiting"
        )

    jobs = split_jobs(lines)
    build_jobs = 0
    covered: set[str] = set()

    for name, start, end in jobs:
        builds = build_platforms_in(lines, start, end)
        if not builds:
            # A job that compiles nothing (the publish job) has no platform to
            # be explicit about. Its invocations, if any, are still counted by
            # the file-wide check below.
            continue

        build_jobs += 1
        platforms = {platform for _line, platform in builds}
        if None in platforms:
            errors.append(
                f"job {name}: invokes {BUILD} with no recognised platform argument"
            )
            continue
        if len(platforms) > 1:
            named = ", ".join(sorted(platforms))
            errors.append(
                f"job {name}: builds several platforms ({named}), "
                "so no single --targets can be right for all of them"
            )
            continue

        platform = platforms.pop()
        expected = PLATFORM_TARGET[platform]
        invocations = invocations_in(lines, start, end)
        syncs = [item for item in invocations if not item.verify]
        verifies = [item for item in invocations if item.verify]

        if not syncs:
            errors.append(f"job {name}: builds {platform} but never invokes {SYNC}")
        if not verifies:
            errors.append(
                f"job {name}: never invokes {SYNC} --verify-only, so nothing "
                "confirms the tree it is about to build"
            )

        for item in invocations:
            kind = "--verify-only" if item.verify else "sync"
            if item.target is None:
                errors.append(
                    f"job {name}: line {item.line}: the {kind} invocation carries "
                    "no --targets, so it syncs with the default target_os and the "
                    "runner decides what gets built"
                )
                continue
            if item.target not in accepted:
                allowed = ", ".join(sorted(accepted))
                errors.append(
                    f"job {name}: line {item.line}: --targets \"{item.target}\" is "
                    f"not a target_os {SYNC} accepts ({allowed})"
                )
                continue
            covered.add(item.target)

        for item in syncs:
            if item.target in accepted and item.target != expected:
                errors.append(
                    f"job {name}: builds {platform} but syncs with "
                    f"--targets \"{item.target}\" (expected \"{expected}\")"
                )

        # With no sync at all — already reported above — there is nothing for
        # the verify to agree with, so the platform stands in as the reference.
        reference = {item.target for item in syncs if item.target} or {expected}
        for item in verifies:
            if item.target in accepted and item.target not in reference:
                synced = ", ".join(sorted(reference))
                errors.append(
                    f"job {name}: line {item.line}: --verify-only uses "
                    f"--targets \"{item.target}\" but the sync uses \"{synced}\"; "
                    "it would verify a different configuration from the one synced"
                )

        print(
            f"job {name}: builds {platform}, "
            f"sync {[item.target for item in syncs]}, "
            f"verify {[item.target for item in verifies]}"
        )

    every = invocations_in(lines, 0, len(lines))
    explicit = [item for item in every if item.target is not None]
    if len(explicit) != len(every):
        bare = ", ".join(str(item.line) for item in every if item.target is None)
        errors.append(
            f"{len(every)} {SYNC} invocation(s) but only {len(explicit)} carry "
            f"--targets; line(s) without: {bare}"
        )

    uncovered = required - covered
    if uncovered:
        errors.append(
            f"no build job syncs with target_os {', '.join(sorted(uncovered))}; "
            "a dropped platform must not go unnoticed"
        )

    if build_jobs < MIN_BUILD_JOBS:
        errors.append(
            f"vacuity floor: found {build_jobs} build job(s), expected at least "
            f"{MIN_BUILD_JOBS}"
        )
    if len(every) < MIN_INVOCATIONS:
        errors.append(
            f"vacuity floor: found {len(every)} {SYNC} invocation(s), expected at "
            f"least {MIN_INVOCATIONS}"
        )

    print(f"accepted target_os (read from {sync_path}): {', '.join(sorted(accepted))}")
    print(f"platform coverage: {', '.join(sorted(covered))}")

    if errors:
        for error in errors:
            print(f"FAIL: {error}")
        print(f"\n{len(errors)} problem(s) in {workflow_path}", file=sys.stderr)
        return 1

    print(
        f"OK: {build_jobs} build job(s), {len(every)} {SYNC} invocation(s), "
        f"{len(explicit)} carrying --targets"
    )
    return 0


def mutate(workflow_path: str, job: str, mode: str, value: str) -> list[str]:
    lines = read_lines(workflow_path)
    ranges = {name: (start, end) for name, start, end in split_jobs(lines)}
    if job not in ranges:
        die(f"no job named {job} in {workflow_path}")
    start, end = ranges[job]

    if mode == "drop-job":
        return lines[:start] + lines[end:]

    if mode == "clone-without-sync":
        # The regression this case exists to catch: a job copy-pasted from a
        # working one, minus the steps that pin what it builds for.
        block = [
            line for line in lines[start:end] if SYNC not in strip_yaml_comment(line)
        ]
        if len(block) == end - start:
            die(f"job {job} has no {SYNC} invocation to leave out")
        block[0] = f"  {value}:"
        return lines[:end] + block + lines[end:]

    out = list(lines)
    changed = 0
    for index in range(start, end):
        code = strip_yaml_comment(out[index])
        if SYNC not in code:
            continue
        verify = "--verify-only" in code
        if verify and mode in ("drop-targets", "retarget-sync"):
            continue
        if not verify and mode == "retarget-verify":
            continue
        if mode == "drop-targets":
            rewritten = TARGETS.sub("", out[index]).rstrip()
        else:
            rewritten = TARGETS.sub(lambda _match: f"--targets \"{value}\"", out[index])
        if rewritten != out[index]:
            out[index] = rewritten
            changed += 1

    if changed == 0:
        die(f"mutation {mode} changed nothing in job {job}")
    return out


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        die(__doc__ or "usage: platform-targets.py check|mutate ...")

    if argv[1] == "check":
        if len(argv) != 4:
            die("usage: platform-targets.py check <workflow.yml> <sync-sources.sh>")
        return check(argv[2], argv[3])

    if argv[1] == "mutate":
        if len(argv) < 5:
            die("usage: platform-targets.py mutate <workflow.yml> <job> <mode> [value]")
        value = argv[5] if len(argv) > 5 else ""
        if (argv[4].startswith("retarget") or argv[4] == "clone-without-sync") and not value:
            die(f"mode {argv[4]} needs a value")
        for line in mutate(argv[2], argv[3], argv[4], value):
            print(line)
        return 0

    die(f"unknown command: {argv[1]}")
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
PY

# --- The committed workflow satisfies every property -------------------------

harness::run python3 "$CHECKER" check "$WORKFLOW" "$SYNC_SCRIPT"
harness::assert_status 0 ".github/workflows/release.yml"
harness::assert_output_contains "OK: " "the checker reached its success line"
harness::assert_output_contains "carrying --targets" "every invocation is explicit"

# The four values are read out of tools/sync-sources.sh, so this also pins the
# list the workflow is being judged against: if the script stops accepting one,
# the job map above is wrong and this fails rather than quietly narrowing.
harness::assert_output_contains "accepted target_os" "the accepted list is reported"
harness::assert_output_contains "android, linux, mac, win" "all four are accepted"
harness::assert_output_contains "platform coverage: android, linux, mac, win" \
    "every platform is covered by a job"

# Read back what the checker actually saw. The floors also live in the checker,
# where the mutants inherit them; these are the numbers a reader wants in the
# failure output when a job is added or removed.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
found_jobs="$(grep -oE 'OK: [0-9]+ build job' "$RUN_STDOUT" | grep -oE '[0-9]+')"
if [ "${found_jobs:-0}" -lt 5 ]; then
    harness::fail "only ${found_jobs:-0} build job(s) found; the workflow parse is broken"
fi

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
found_invocations="$(grep -oE '[0-9]+ tools/sync-sources.sh invocation' "$RUN_STDOUT" \
    | grep -oE '^[0-9]+')"
if [ "${found_invocations:-0}" -lt 10 ]; then
    harness::fail "only ${found_invocations:-0} sync invocation(s) found; the parse is broken"
fi

# --- Mutation: the checker must reject what it exists to catch ---------------
#
# Without this section a checker that always exits 0 looks exactly like a
# passing gate.

# Writes a broken copy of the workflow. A mutation that changed nothing proves
# nothing, so a no-op is a failure here rather than silent evidence.
make_mutant() {
    local out="$1"
    shift
    local status=0
    python3 "$CHECKER" mutate "$WORKFLOW" "$@" > "$out" || status=$?

    HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
    if [ "$status" -ne 0 ]; then
        harness::fail "mutation ($*) failed: python3 exited $status"
    fi

    HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
    if cmp -s "$WORKFLOW" "$out"; then
        harness::fail "mutation ($*) left the workflow unchanged"
    fi
}

# A job whose sync invocation lost its --targets: back to the default target_os,
# which is the exact regression this case exists to prevent.
make_mutant "$tmp/no-targets.yml" android drop-targets
harness::run python3 "$CHECKER" check "$tmp/no-targets.yml" "$SYNC_SCRIPT"
harness::assert_nonzero_status "a sync invocation with no --targets"
harness::assert_output_contains "job android:" "the offending job is named"
harness::assert_output_contains "no --targets" "the reason is named"
harness::assert_output_contains "only 9 carry --targets" "the count mismatch is reported"

# A Windows job synced as linux. Both its invocations are moved together, so
# the failure is the job/target mismatch on its own rather than a disagreement
# between sync and verify.
make_mutant "$tmp/wrong-target.yml" windows-x64 retarget-all linux
harness::run python3 "$CHECKER" check "$tmp/wrong-target.yml" "$SYNC_SCRIPT"
harness::assert_nonzero_status "a Windows job syncing with target_os linux"
harness::assert_output_contains "job windows-x64:" "the offending job is named"
harness::assert_output_contains 'builds windows but syncs with --targets "linux"' \
    "the mismatch is named"
harness::assert_output_contains 'expected "win"' "the correct value is named"

# Only the --verify-only invocation is moved, so the sync/verify agreement
# check is the one that has to fire. Proving it fires alone is what keeps it
# from being an assertion nobody has ever seen work.
make_mutant "$tmp/split-target.yml" linux retarget-verify mac
harness::run python3 "$CHECKER" check "$tmp/split-target.yml" "$SYNC_SCRIPT"
harness::assert_nonzero_status "a verify invocation naming a different target_os"
harness::assert_output_contains "job linux:" "the offending job is named"
harness::assert_output_contains "verify a different configuration from the one synced" \
    "the agreement check is what fired"

# A build job copy-pasted from a working one, minus the sync steps. Coverage
# and both floors are still satisfied, so the only thing left to notice it is
# the requirement that a job which builds must also sync and verify.
make_mutant "$tmp/copy-pasted-job.yml" macos clone-without-sync macos-copy
harness::run python3 "$CHECKER" check "$tmp/copy-pasted-job.yml" "$SYNC_SCRIPT"
harness::assert_nonzero_status "a build job that never synchronises at all"
harness::assert_output_contains \
    "job macos-copy: builds macos but never invokes tools/sync-sources.sh" \
    "the job that never syncs is named"
harness::assert_output_contains "never invokes tools/sync-sources.sh --verify-only" \
    "the missing verification is named"

# A whole platform dropped. The coverage assertion and both vacuity floors are
# the only things standing between this and a green run.
make_mutant "$tmp/dropped-job.yml" android drop-job
harness::run python3 "$CHECKER" check "$tmp/dropped-job.yml" "$SYNC_SCRIPT"
harness::assert_nonzero_status "a workflow that stopped building a platform"
harness::assert_output_contains "no build job syncs with target_os android" \
    "the dropped platform is named"
harness::assert_output_contains "vacuity floor: found 4 build job(s)" "the job floor fires"
harness::assert_output_contains "vacuity floor: found 8" "the invocation floor fires"

harness::pass
