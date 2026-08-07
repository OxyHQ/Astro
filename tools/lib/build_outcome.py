#!/usr/bin/env python3
"""Decide whether a build succeeded, from the BUILD's own status and its log.

The defect this exists to make impossible, observed on this repository: a build
was run through a wrapper, the wrapper exited 0, and a success was very nearly
reported on that basis. The build inside it had failed, and said so in its own
words:

    1 error generated.
    17m46.20s Build Failure: 28148 done, 1 failed, 1787 remaining
    1 steps failed: exit=1

Two separate things went wrong and both have to be closed, because either alone
still lets a green run mean nothing:

  * the status that reached the decision was the WRAPPER's, not the compile's.
    A `tee`, a pipeline, a background runner or a notification hook all sit
    between the build and whoever reads the result, and every one of them has
    its own exit status;
  * nothing looked at the log, so a status that disagreed with the build tool's
    own report went unnoticed. A wrapper that lies about status is exactly the
    case under test, which is why the log is a VETO here rather than a
    tie-breaker: evidence of failure in the log outranks any claim of success.

THREE VERDICTS, NOT TWO — the same discipline tools/check-merge-base.sh and
astro::require_astro_overlay already apply:

    0  succeeded     measured, and the answer is yes
    1  failed        measured, and the answer is no
    2  unmeasurable  nothing on disk can decide it — a REFUSAL, never a pass

The third is the one carrying the weight. A build that produced no log and no
status has not been measured, and "I could not measure it" must not become "it
is probably fine". It must not silently become "it failed" either: a wrong log
path, a truncated capture and a genuinely broken build would then all produce
the same verdict, which is the same as having no check.

Anything outside {0, 1, 2} is a CRASH, not a verdict. Callers must treat it as
unmeasurable; tools/verify-build-outcome.sh does.

The decision table, in full:

    log evidence   status known   status   verdict
    -------------  ------------   ------   ------------
    yes            either         either   failed        <- the wrapper-lies case
    no             no             -        unmeasurable
    no             yes            != 0     failed
    no             yes            == 0     unmeasurable  <- if the log is missing or empty
    no             yes            == 0     succeeded

A status of 0 with no usable log is deliberately NOT a pass. A bare status is
precisely the thing the wrapper got wrong, and without the log there is nothing
to check it against.

Usage:
    build_outcome.py evaluate --label L [--log PATH] [--status N|unknown]
    build_outcome.py record --file RECORD --label L [--log PATH]
                            [--status N|unknown] [--command TEXT] [--reset]
    build_outcome.py verify --file RECORD [--require-step LABEL]...
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time

SUCCEEDED = 0
FAILED = 1
UNMEASURABLE = 2

VERDICT_NAME = {SUCCEEDED: "succeeded", FAILED: "failed", UNMEASURABLE: "unmeasurable"}

# The build tools' own failure vocabulary.
#
# Every pattern is anchored the way the tool that emits it anchors, and none of
# them matches the corresponding SUCCESS line — which is the direction a
# vocabulary list gets wrong. siso reports a good build as
# "Build Succeeded: 28148 done, 0 failed, 0 remaining", so a bare "failed" or a
# bare "Build" would condemn every successful build in the tree; "0 failed"
# there is why the step counter requires the word "step".
#
# Deliberately NOT included: gn's "ERROR at //path/BUILD.gn". gn gen's own exit
# status is captured directly at the call site and is not the laundered value
# this scan exists to second-guess, and the string is common enough in a
# compile log's diagnostics to cost more in false condemnations than it buys.
FAILURE_VOCABULARY: list[tuple[str, re.Pattern[str]]] = [
    # ninja names the step it could not build, at column 0.
    ("ninja-failed-step", re.compile(r"^FAILED: ")),
    ("ninja-build-stopped", re.compile(r"^ninja: build stopped")),
    # siso's summary line, prefixed with elapsed time.
    ("siso-build-failure", re.compile(r"\bBuild Failure\b")),
    ("siso-steps-failed", re.compile(r"\b\d+ steps? failed\b")),
    # clang's own tally, at column 0. "1 warning generated." must not match,
    # which is why "error" is spelled out rather than matched loosely.
    ("compiler-errors-generated", re.compile(r"^\s*\d+ errors? generated\.")),
]

# How many matched lines are quoted in the report. The TOTAL is always printed,
# so a cap can never read as "that was all of it".
MAX_QUOTED_EVIDENCE = 20


class Evidence:
    """What a log scan found, and whether the log could be scanned at all."""

    def __init__(self, path: str | None) -> None:
        self.path = path
        self.readable = False
        self.non_empty = False
        self.lines: list[tuple[int, str, str]] = []
        self.total = 0
        self.problem: str | None = None

    @property
    def usable(self) -> bool:
        """A log that exists, could be read, and holds something."""
        return self.readable and self.non_empty

    def summary(self) -> list[str]:
        if self.path is None:
            return ["log:      (none given)"]
        if not self.readable:
            return [f"log:      {self.path} ({self.problem})"]
        if not self.non_empty:
            return [f"log:      {self.path} (empty)"]
        found = f"{self.total} line(s) matching the build tools' failure vocabulary"
        out = [f"log:      {self.path} ({found})"]
        for number, rule, text in self.lines[:MAX_QUOTED_EVIDENCE]:
            out.append(f"          {self.path}:{number}: [{rule}] {text}")
        if self.total > len(self.lines):
            out.append(
                f"          ... {self.total - len(self.lines)} further matching "
                "line(s) not quoted"
            )
        return out


def scan_log(path: str | None) -> Evidence:
    """Read a build log and collect every line the build tool used to say it failed.

    Streamed rather than slurped: a Chromium compile log runs to hundreds of
    megabytes, and a scanner that needs it all in memory is a scanner that gets
    skipped on the one build that matters.
    """
    evidence = Evidence(path)
    if path is None:
        return evidence

    try:
        with open(path, encoding="utf-8", errors="replace") as handle:
            for number, raw in enumerate(handle, start=1):
                line = raw.rstrip("\n")
                if line.strip():
                    evidence.non_empty = True
                for rule, pattern in FAILURE_VOCABULARY:
                    if pattern.search(line):
                        evidence.total += 1
                        if len(evidence.lines) < MAX_QUOTED_EVIDENCE:
                            evidence.lines.append((number, rule, line.strip()))
                        break
            evidence.readable = True
    except FileNotFoundError:
        evidence.problem = "no such file"
    except OSError as error:
        evidence.problem = f"unreadable: {error}"

    return evidence


def decide(status: int | None, evidence: Evidence) -> tuple[int, str]:
    """The decision table from the module docstring, and nothing else.

    Kept free of I/O so the ordering — log evidence FIRST, before any status is
    consulted — is one readable block. That order is the whole guard: a status
    of 0 must not be able to overrule the build tool's own report of failure.
    """
    if evidence.total:
        return FAILED, (
            f"the log records {evidence.total} line(s) of the build tools' own "
            "failure vocabulary"
            + (
                f", and the reported status was {status}"
                if status == 0
                else ""
            )
        )

    if status is None:
        return UNMEASURABLE, (
            "no exit status was recorded for the build, so there is nothing to "
            "read but the log, and the log carries no verdict either"
        )

    if status != 0:
        return FAILED, f"the build exited {status}"

    if not evidence.usable:
        detail = "no log was given" if evidence.path is None else (
            evidence.problem or "the log is empty"
        )
        return UNMEASURABLE, (
            f"the build reported exit 0 but {detail}, so the claim is "
            "uncorroborated; a bare status is exactly what a wrapper gets wrong"
        )

    return SUCCEEDED, "the build exited 0 and its log carries no failure report"


def report(label: str, status: int | None, evidence: Evidence,
           verdict: int, reason: str) -> None:
    print(f"build outcome [{label}]: {VERDICT_NAME[verdict]}")
    print(f"  status:   {'(not recorded)' if status is None else status}")
    for line in evidence.summary():
        print(f"  {line}")
    print(f"  because:  {reason}")


def parse_status(text: str | None) -> int | None:
    if text is None or text == "" or text.lower() == "unknown":
        return None
    try:
        return int(text)
    except ValueError:
        print(f"--status must be an integer or 'unknown', got {text!r}", file=sys.stderr)
        raise SystemExit(2) from None


def evaluate(label: str, log: str | None, status: int | None) -> tuple[int, dict]:
    evidence = scan_log(log)
    verdict, reason = decide(status, evidence)
    report(label, status, evidence, verdict, reason)
    entry = {
        "label": label,
        "status": status,
        "log": os.path.abspath(log) if log else None,
        "log_readable": evidence.readable,
        "log_non_empty": evidence.non_empty,
        "evidence_count": evidence.total,
        "evidence": [
            {"line": number, "rule": rule, "text": text}
            for number, rule, text in evidence.lines
        ],
        "verdict": VERDICT_NAME[verdict],
        "reason": reason,
    }
    return verdict, entry


def load_record(path: str) -> dict | None:
    try:
        with open(path, encoding="utf-8") as handle:
            return json.load(handle)
    except FileNotFoundError:
        return None
    except (OSError, json.JSONDecodeError) as error:
        print(f"build outcome record is unreadable: {path}: {error}", file=sys.stderr)
        raise SystemExit(UNMEASURABLE) from None


def command_record(arguments: argparse.Namespace) -> int:
    status = parse_status(arguments.status)
    verdict, entry = evaluate(arguments.label, arguments.log, status)
    entry["command"] = arguments.command
    entry["recorded_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    document = None if arguments.reset else load_record(arguments.file)
    if not isinstance(document, dict) or not isinstance(document.get("steps"), list):
        document = {"steps": []}
    document["steps"].append(entry)

    os.makedirs(os.path.dirname(os.path.abspath(arguments.file)), exist_ok=True)
    with open(arguments.file, "w", encoding="utf-8") as handle:
        json.dump(document, handle, indent=2)
        handle.write("\n")

    print(f"  recorded: {arguments.file} ({len(document['steps'])} step(s))")
    return verdict


def command_verify(arguments: argparse.Namespace) -> int:
    document = load_record(arguments.file)
    if document is None:
        print(
            f"build outcome: unmeasurable\n"
            f"  no build outcome record at {arguments.file}\n"
            f"  Nothing recorded what the build's own exit status was, so there is "
            f"no\n  status to read but the caller's — which is the value under "
            f"suspicion."
        )
        return UNMEASURABLE

    steps = document.get("steps")
    if not isinstance(steps, list) or not steps:
        # The vacuity floor. A record holding no steps parses, reads as
        # "nothing failed", and means the build never recorded anything at all.
        print(
            f"build outcome: unmeasurable\n"
            f"  the record at {arguments.file} contains no steps\n"
            f"  A record with nothing in it is not a clean run; it is a run that "
            f"measured nothing."
        )
        return UNMEASURABLE

    worst = SUCCEEDED
    seen: set[str] = set()
    for step in steps:
        if not isinstance(step, dict):
            print(f"build outcome: unmeasurable\n  malformed step in {arguments.file}")
            return UNMEASURABLE
        label = str(step.get("label", "(unlabelled)"))
        seen.add(label)

        # Re-derived from the primary evidence — the recorded status and the log
        # on disk — never taken from the record's own `verdict` field. A record
        # is a claim; the log is the thing that cannot be talked into agreeing.
        status = step.get("status")
        if status is not None and not isinstance(status, int):
            status = None
        verdict, _entry = evaluate(label, step.get("log"), status)

        stored = step.get("verdict")
        if stored != VERDICT_NAME[verdict]:
            print(
                f"  MISMATCH: the record claims '{stored}' for this step but the "
                f"evidence on disk says '{VERDICT_NAME[verdict]}'."
            )
            print("  A record that disagrees with its own log has been edited or "
                  "overwritten; refusing either answer.")
            worst = max(worst, UNMEASURABLE)

        worst = max(worst, verdict)

    missing = [label for label in arguments.require_step if label not in seen]
    if missing:
        print(
            "build outcome: unmeasurable\n"
            f"  the record has no step named: {', '.join(missing)}\n"
            f"  It recorded {sorted(seen)}. A build whose compile step was never "
            "recorded\n  has not been measured, however clean the rest of the "
            "record looks."
        )
        worst = max(worst, UNMEASURABLE)

    print(
        f"build outcome: {VERDICT_NAME[worst]} "
        f"({len(steps)} step(s) re-derived from {arguments.file})"
    )
    return worst


def command_evaluate(arguments: argparse.Namespace) -> int:
    verdict, _entry = evaluate(arguments.label, arguments.log, parse_status(arguments.status))
    return verdict


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="mode", required=True)

    def add_common(target: argparse.ArgumentParser) -> None:
        target.add_argument("--label", default="build")
        target.add_argument("--log", default=None)
        target.add_argument("--status", default=None)

    evaluate_parser = subparsers.add_parser("evaluate")
    add_common(evaluate_parser)
    evaluate_parser.set_defaults(handler=command_evaluate)

    record_parser = subparsers.add_parser("record")
    add_common(record_parser)
    record_parser.add_argument("--file", required=True)
    record_parser.add_argument("--command", default=None)
    record_parser.add_argument("--reset", action="store_true")
    record_parser.set_defaults(handler=command_record)

    verify_parser = subparsers.add_parser("verify")
    verify_parser.add_argument("--file", required=True)
    verify_parser.add_argument("--require-step", action="append", default=[])
    verify_parser.set_defaults(handler=command_verify)

    arguments = parser.parse_args(argv[1:])
    return arguments.handler(arguments)


if __name__ == "__main__":
    sys.exit(main(sys.argv))
