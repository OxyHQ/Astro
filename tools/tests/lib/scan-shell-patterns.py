#!/usr/bin/env python3
"""Scan shell scripts for banned failure-suppression and destructive patterns.

The Astro Next epic (#3) forbids fuzzy patching, automatic three-way merges,
ignored failures and `rsync --delete` into the Chromium tree. Those rules are
only worth anything if something enforces them, so this is the enforcement.

Matching runs against CODE ONLY. Comments, quoted string literals and heredoc
bodies are stripped first, because the scripts legitimately *describe* the
patterns they removed — an error message that names `2>/dev/null` as the thing
that hid a defect must not itself trip the check. A naive grep cannot tell the
difference, and a check that cries wolf is a check somebody disables.

A genuine, reviewed exception carries an inline marker on the offending line:

    rsync -a --delete "$BUILD_DIR/" "$INSTALL_DIR/"   # astro-allow: reason

Usage:
    scan-shell-patterns.py FILE [FILE...]

Prints one "path:line: rule: text" per violation and exits 1 if any were found.
Exits 2 if no files were scanned, so a broken invocation cannot read as a pass.
"""

from __future__ import annotations

import re
import sys

ALLOW_MARKER = "astro-allow:"

RULES: list[tuple[str, re.Pattern[str], str]] = [
    (
        "rsync-delete",
        re.compile(r"(?:^|\s)--delete(?:=\S*)?(?:\s|$)"),
        "rsync --delete can remove upstream files; the Chromium tree must never "
        "be deleted from",
    ),
    (
        "git-apply-3way",
        re.compile(r"git\s+apply\b[^\n]*--3way"),
        "an automatic three-way merge produces a tree that is not the reviewed patch",
    ),
    (
        "fuzzy-patch",
        re.compile(r"\bpatch\b[^\n]*\s-F\s*[0-9]+"),
        "fuzzy patch application plants a hunk where its context no longer matches",
    ),
    (
        "suppressed-failure",
        re.compile(r"\|\|\s*(?:true|:)\s*(?:$|[;&)`])"),
        "a swallowed failure; classify the step with astro::optional instead",
    ),
    (
        "suppressed-stderr",
        re.compile(r"2>\s*/dev/null|&>\s*/dev/null|>&\s*/dev/null"),
        "discarded stderr hides the reason a required step failed",
    ),
]

# Applies to shell scripts AND to CI workflow files (ASTRO-NEXT-002, issue #5).
SOURCE_RULES: list[tuple[str, re.Pattern[str], str]] = [
    (
        "unconstrained-pull",
        re.compile(r"\bgit\s+(-C\s+\S+\s+)?pull\b"),
        "`git pull` takes whatever the remote's branch points at now; a build "
        "dependency must be checked out at a locked commit instead",
    ),
]

# Applies to CI workflow files ONLY, and the distinction is principled rather
# than a concession to false positives.
#
# tools/sync-sources.sh legitimately tests whether a checkout exists, because
# bootstrapping one is its job. A CI job has no such licence: it must invoke
# the sync command unconditionally and let that command decide. A workflow that
# branches on `.git` existence is deciding for itself whether to synchronise,
# which is precisely how a self-hosted runner ends up compiling whatever commit
# it happens to hold.
WORKFLOW_RULES: list[tuple[str, re.Pattern[str], str]] = [
    (
        "mutable-action-tag",
        re.compile(r"uses:\s*[A-Za-z0-9._-]+/[A-Za-z0-9._/-]+@(?![0-9a-f]{40}\b)\S+"),
        "a GitHub Action referenced by tag or branch instead of a full commit "
        "SHA lets upstream tag movement or a supply-chain compromise change what "
        "CI executes with no diff in this repository",
    ),
    (
        "cache-as-source-of-truth",
        re.compile(r"-d\s+[\"']?[^\"'\s]*\.git[\"']?\s*\]"),
        "a CI job deciding whether to synchronise by testing for an existing "
        ".git treats a cache as source-of-truth state, so a stale runner keeps "
        "compiling whatever commit it happens to hold",
    ),
]

HEREDOC_START = re.compile(r"<<-?\s*(['\"]?)([A-Za-z_][A-Za-z0-9_]*)\1")

# `command -v foo >/dev/null` is a presence probe, not a hidden failure: the
# exit status IS the answer being asked for, and the command has no diagnostic
# output worth keeping. Exempting it keeps the check credible; flagging it
# would bury the real findings under idiomatic noise.
PROBE = re.compile(r"\bcommand\s+-v\b")


def strip_noncode(line: str) -> str:
    """Return the line with quoted literals and the trailing comment removed.

    Command substitutions are kept as CODE even inside a double-quoted string,
    and quoting restarts within them. Without that, a line like

        branch="$(git symbolic-ref --short HEAD || true)"

    reads as one quoted literal — the inner `"` closes the outer one — and the
    `|| true` inside it disappears from the scan. That is a false negative, the
    dangerous direction for this check, and it was found in real code here.

    Nesting is tracked with a stack, so `"$(f "$(g)" || true)"` behaves too.
    """
    out: list[str] = []
    quote: str | None = None
    # Each entry is the quoting state to restore when a `$(` is closed.
    substitution_stack: list[str | None] = []
    index = 0

    while index < len(line):
        char = line[index]

        # A `$(` opens code, whatever the surrounding quoting — except inside
        # single quotes, where nothing expands.
        if quote != "'" and line.startswith("$(", index):
            substitution_stack.append(quote)
            quote = None
            out.append(" ")
            index += 2
            continue

        if substitution_stack and quote is None and char == ")":
            quote = substitution_stack.pop()
            out.append(" ")
            index += 1
            continue

        if quote:
            if char == "\\" and quote == '"':
                index += 2
                continue
            if char == quote:
                quote = None
            index += 1
            continue

        if char in ("'", '"'):
            quote = char
            out.append(" ")
            index += 1
            continue

        if char == "#":
            # A '#' only starts a comment at the start of a word, and never
            # inside a command substitution.
            if not substitution_stack and (not out or out[-1].isspace()):
                break
            out.append(char)
            index += 1
            continue

        if char == "\\":
            out.append(" ")
            index += 2
            continue

        out.append(char)
        index += 1

    return "".join(out)


def strip_comments_only(line: str) -> str:
    """Drop a trailing shell comment but KEEP string contents.

    The source-pinning rules match paths and arguments that are normally
    quoted — `[ ! -d "chromium/src/.git" ]`, for instance. strip_noncode
    removes quoted text, so those rules would never fire on real code while
    still firing on the prose in a comment: exactly backwards.

    Comments are still removed, which is what keeps a script's own description
    of the shape it removed from tripping the check.
    """
    quote: str | None = None
    for index, char in enumerate(line):
        if quote:
            if char == "\\" and quote == '"':
                continue
            if char == quote:
                quote = None
            continue
        if char in ("'", '"'):
            quote = char
            continue
        if char == "#" and (index == 0 or line[index - 1].isspace()):
            return line[:index]
    return line


def strip_yaml_noncode(line: str) -> str:
    """Drop a YAML comment. Workflow files embed shell in `run:` blocks, so the
    shell rules apply, but the shell tokenizer's heredoc and quoting rules do
    not map onto YAML block scalars."""
    quote: str | None = None
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


def scan(path: str) -> list[tuple[int, str, str]]:
    violations: list[tuple[int, str, str]] = []
    heredoc_terminator: str | None = None
    previous = ""
    is_workflow = path.endswith((".yml", ".yaml"))
    rules = (SOURCE_RULES + WORKFLOW_RULES) if is_workflow else RULES + SOURCE_RULES

    with open(path, encoding="utf-8") as handle:
        for number, raw in enumerate(handle, start=1):
            raw = raw.rstrip("\n")
            # The marker is accepted on the offending line or the one directly
            # above it, so a real justification can be written as a comment
            # block rather than crammed into a trailing comment.
            allowed = ALLOW_MARKER in raw or ALLOW_MARKER in previous
            previous = raw

            if is_workflow:
                code = strip_yaml_noncode(raw)
                source_code = code
            else:
                if heredoc_terminator is not None:
                    if raw.strip() == heredoc_terminator:
                        heredoc_terminator = None
                    continue
                code = strip_noncode(raw)
                source_code = strip_comments_only(raw)

            if not allowed:
                source_rule_names = {name for name, _p, _r in SOURCE_RULES}
                for rule, pattern, _reason in rules:
                    if rule == "suppressed-stderr" and PROBE.search(code):
                        continue
                    target = source_code if rule in source_rule_names else code
                    if pattern.search(target):
                        violations.append((number, rule, raw.strip()))

            # Matched against the RAW line: the terminator is usually quoted
            # (`<< 'EOF'`), and strip_noncode removes quoted text, so scanning
            # the stripped line never sees a heredoc start and every generated
            # script body gets scanned as if it were this script's own code.
            if not is_workflow:
                match = HEREDOC_START.search(raw)
                if match:
                    heredoc_terminator = match.group(2)

    return violations


def main(argv: list[str]) -> int:
    paths = argv[1:]
    if not paths:
        print("no files to scan", file=sys.stderr)
        return 2

    total = 0
    for path in paths:
        for number, rule, text in scan(path):
            print(f"{path}:{number}: {rule}: {text}")
            total += 1

    if total:
        print(f"\n{total} banned pattern(s) found.", file=sys.stderr)
        print("Reasons:", file=sys.stderr)
        for rule, _pattern, reason in RULES + SOURCE_RULES + WORKFLOW_RULES:
            print(f"  {rule}: {reason}", file=sys.stderr)
        print(
            f"\nA reviewed exception carries an inline '# {ALLOW_MARKER} reason' marker.",
            file=sys.stderr,
        )
        return 1

    print(f"scanned {len(paths)} file(s), no banned patterns")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
