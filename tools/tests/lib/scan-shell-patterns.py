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

A genuine, reviewed exception carries a marker naming the ONE rule it
suppresses, plus a justification, in a REAL comment:

    rsync -a --delete "$SRC/" "$DEST/"   # astro-allow:rsync-delete reason here

The marker must be a comment (not a string literal, not executable code), must
sit on the offending line or on a pure-comment line directly above it, must
name a known rule id, and must justify itself. Every one of those conditions is
load-bearing: the marker used to be a bare substring test against the raw line,
so `echo "astro-allow: hi"` on the line above a banned command disabled the
whole check, and a single unqualified marker switched off every rule at once.

Usage:
    scan-shell-patterns.py FILE [FILE...]

Prints one "path:line: rule: text" per violation and exits 1 if any were found.
Exits 2 if no files were scanned, so a broken invocation cannot read as a pass.
"""

from __future__ import annotations

import re
import sys

ALLOW_MARKER = "astro-allow:"

# A justification floor. The point of an exception is that a reviewer reads a
# reason, so "astro-allow:rsync-delete x" is not one. Short enough that every
# genuine reason in this repository clears it comfortably.
MIN_JUSTIFICATION_CHARS = 8

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

# Derived from the tables rather than written out again, so a new rule becomes
# markable automatically and a typo in a marker cannot name a rule that does
# not exist.
ALL_RULE_IDS = frozenset(
    name for name, _pattern, _reason in RULES + SOURCE_RULES + WORKFLOW_RULES
)

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


def comment_start(line: str, *, escapes: bool) -> int | None:
    """Index at which a real comment begins, or None if the line has none.

    Quoting is respected, so a `#` inside a string literal is not a comment.
    That is what stops `echo "# astro-allow:rsync-delete ..."` from reading as
    a reviewed exception. `escapes` selects the shell reading of a backslash
    inside double quotes; YAML has no equivalent here.

    Deliberately reports the POSITION rather than the stripped line: both the
    strippers below and the marker reader need the same scan, and the marker
    reader needs the half the strippers throw away.
    """
    index, _quote = _scan_quotes(line, escapes=escapes)
    return index


def _scan_quotes(line: str, *, escapes: bool) -> tuple[int | None, str | None]:
    """(comment index, quote still open at the end) for one physical line.

    One scan answers both questions, and they are answered together on purpose:
    a comment can only begin OUTSIDE a string, so the two states are the same
    state read at different moments.
    """
    quote: str | None = None
    for index, char in enumerate(line):
        if quote:
            if escapes and char == "\\" and quote == '"':
                continue
            if char == quote:
                quote = None
            continue
        if char in ("'", '"'):
            quote = char
            continue
        if char == "#" and (index == 0 or line[index - 1].isspace()):
            # A comment runs to the newline, so nothing after it can leave a
            # quote open.
            return index, None
    return None, quote


def quote_open_at_end(text: str, *, escapes: bool) -> bool:
    """True when `text` ends inside an unterminated string.

    A quote continues a logical line with no backslash involved, and until this
    existed that shape hid everything after it exactly as the backslash shape
    did:

        astro::info "a message spanning
        two lines with no backslash" && rm -f /tmp/x || true

    reported nothing. Joining on a backslash alone closes one instance of the
    defect; joining on either closes the class.
    """
    _index, quote = _scan_quotes(text, escapes=escapes)
    return quote is not None


def strip_comments_only(line: str) -> str:
    """Drop a trailing shell comment but KEEP string contents.

    The source-pinning rules match paths and arguments that are normally
    quoted — `[ ! -d "chromium/src/.git" ]`, for instance. strip_noncode
    removes quoted text, so those rules would never fire on real code while
    still firing on the prose in a comment: exactly backwards.

    Comments are still removed, which is what keeps a script's own description
    of the shape it removed from tripping the check.
    """
    index = comment_start(line, escapes=True)
    return line if index is None else line[:index]


def strip_yaml_noncode(line: str) -> str:
    """Drop a YAML comment. Workflow files embed shell in `run:` blocks, so the
    shell rules apply, but the shell tokenizer's heredoc and quoting rules do
    not map onto YAML block scalars."""
    index = comment_start(line, escapes=False)
    return line if index is None else line[:index]


def comment_text(line: str, *, escapes: bool) -> str:
    """The comment part of a line, or "" when the line carries no comment."""
    index = comment_start(line, escapes=escapes)
    return "" if index is None else line[index:]


def is_pure_comment_line(line: str) -> bool:
    """True when the line is nothing but a comment.

    A marker on the line ABOVE only counts when that line carries no code, so
    that an executable line cannot hand an exception to its neighbour.
    """
    return line.lstrip().startswith("#")


def parse_allow_markers(comment: str) -> tuple[set[str], list[str]]:
    """Read `astro-allow:<rule-id> <justification>` markers out of a comment.

    Returns the rule ids granted and, separately, complaints about markers that
    look like exceptions but are not honoured. A marker grants exactly the rule
    it names — never every rule on the line — and only when it justifies
    itself, so neither a bare marker nor one naming some other rule can wave a
    finding through.
    """
    granted: set[str] = set()
    complaints: list[str] = []

    # Splitting on the marker bounds each justification at the next marker, so
    # a line violating two rules can carry one marker per rule.
    for segment in comment.split(ALLOW_MARKER)[1:]:
        words = segment.split(None, 1)
        if not words:
            complaints.append("marker names no rule id")
            continue

        rule = words[0]
        justification = words[1].strip() if len(words) > 1 else ""

        if rule not in ALL_RULE_IDS:
            complaints.append(f"marker names unknown rule {rule!r}")
        elif len(justification) < MIN_JUSTIFICATION_CHARS or not any(
            char.isalpha() for char in justification
        ):
            complaints.append(f"marker for {rule} carries no justification")
        else:
            granted.add(rule)

    return granted, complaints


def continues_onto_next_line(text: str, *, escapes: bool) -> bool:
    """True when this text continues onto the following physical line.

    Scanning physical lines was a bypass needing no marker at all. A string
    opened on one physical line and closed on the next left the closing quote
    reading as an OPENING one, so everything after it — `|| true` included —
    counted as quoted text and was never scanned:

        astro::info "a message that spans \\
            two physical lines" && rm -f /tmp/x || true

    reported nothing. Any banned pattern on a continued logical line was
    invisible, which disarmed the epic's central rule silently and for free.

    Two shapes are NOT continuations, and both are tested:
      * a trailing backslash inside a COMMENT is ordinary text — a comment ends
        at the newline and cannot be continued;
      * an ESCAPED backslash (`\\\\`) ends the line, so trailing backslashes are
        counted and only an odd number continues.
    """
    index = comment_start(text, escapes=escapes)
    code = text if index is None else text[:index]
    if not code.endswith("\\"):
        return False
    return (len(code) - len(code.rstrip("\\"))) % 2 == 1


def scan(path: str) -> tuple[list[tuple[int, str, str]], list[tuple[int, str]]]:
    violations: list[tuple[int, str, str]] = []
    notes: list[tuple[int, str]] = []
    heredoc_terminator: str | None = None
    # Rule ids a marker on the PREVIOUS line granted to this one.
    inherited: set[str] = set()
    is_workflow = path.endswith((".yml", ".yaml"))
    rules = (SOURCE_RULES + WORKFLOW_RULES) if is_workflow else RULES + SOURCE_RULES
    source_rule_names = {name for name, _p, _r in SOURCE_RULES}

    with open(path, encoding="utf-8") as handle:
        physical = [line.rstrip("\n") for line in handle]

    # Physical lines are walked by index rather than iterated, because a
    # logical line consumes an unbounded number of them and a heredoc body is
    # consumed physically regardless of any backslash inside it.
    position = 0
    while position < len(physical):
        number = position + 1
        raw = physical[position]

        if not is_workflow and heredoc_terminator is not None:
            if raw.strip() == heredoc_terminator:
                heredoc_terminator = None
            # A heredoc body is data. It never grants an exception to the line
            # that follows it, and a backslash in it continues nothing.
            inherited = set()
            position += 1
            continue

        # Join continuations into one logical line. The accumulated text is
        # what decides whether to keep going, so quote state carries across the
        # join — which is the entire point.
        first_number = number
        while position + 1 < len(physical):
            if continues_onto_next_line(raw, escapes=not is_workflow):
                # Shell removes the backslash-newline entirely, so the two
                # halves are glued with nothing between them.
                position += 1
                raw = raw[: raw.rindex("\\")] + physical[position]
            elif quote_open_at_end(raw, escapes=not is_workflow):
                # A newline inside a string is content, not a separator; a
                # space keeps the joined text on one line so the rules' `$`
                # anchors mean what they mean everywhere else.
                position += 1
                raw = raw + " " + physical[position]
            else:
                break

        number = first_number
        # `raw` is now the logical line; everything below reads it unchanged.
        position += 1

        if is_workflow:
            code = strip_yaml_noncode(raw)
            source_code = code
        else:
            code = strip_noncode(raw)
            source_code = strip_comments_only(raw)

        # An exception must be a real comment. Reading the marker out of the
        # comment rather than the raw line is the whole fix: a string literal
        # or an executable line mentioning it grants nothing.
        granted, complaints = parse_allow_markers(
            comment_text(raw, escapes=not is_workflow)
        )
        notes.extend((number, complaint) for complaint in complaints)

        allowed = granted | inherited
        for rule, pattern, _reason in rules:
            if rule in allowed:
                continue
            if rule == "suppressed-stderr" and PROBE.search(code):
                continue
            target = source_code if rule in source_rule_names else code
            if pattern.search(target):
                violations.append((number, rule, raw.strip()))

        # A marker is inherited by the next line only from a pure comment
        # line, so the association stays immediate and unambiguous.
        inherited = granted if is_pure_comment_line(raw) else set()

        # Matched against the RAW line: the terminator is usually quoted
        # (`<< 'EOF'`), and strip_noncode removes quoted text, so scanning
        # the stripped line never sees a heredoc start and every generated
        # script body gets scanned as if it were this script's own code.
        if not is_workflow:
            match = HEREDOC_START.search(raw)
            if match:
                heredoc_terminator = match.group(2)

    return violations, notes


def main(argv: list[str]) -> int:
    paths = argv[1:]
    if not paths:
        print("no files to scan", file=sys.stderr)
        return 2

    total = 0
    for path in paths:
        violations, notes = scan(path)
        for number, rule, text in violations:
            print(f"{path}:{number}: {rule}: {text}")
            total += 1
        # A marker that looks like an exception and is not honoured is the one
        # state a developer cannot diagnose from the finding alone, so say so.
        for number, note in notes:
            print(f"{path}:{number}: ignored {note}", file=sys.stderr)

    if total:
        print(f"\n{total} banned pattern(s) found.", file=sys.stderr)
        print("Reasons:", file=sys.stderr)
        for rule, _pattern, reason in RULES + SOURCE_RULES + WORKFLOW_RULES:
            print(f"  {rule}: {reason}", file=sys.stderr)
        print(
            f"\nA reviewed exception is a COMMENT reading "
            f"'# {ALLOW_MARKER}<rule-id> <justification>', on the offending line "
            f"or on a pure-comment line directly above it. It suppresses only "
            f"the rule it names. Rule ids: {', '.join(sorted(ALL_RULE_IDS))}.",
            file=sys.stderr,
        )
        return 1

    print(f"scanned {len(paths)} file(s), no banned patterns")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
