#!/usr/bin/env python3
"""Every repository path a committed script names must itself be committed.

This is the converse of tools/tests/cases/developer-wip-stays-untracked.sh.
That gate stops a file the repository decided NOT to track from being swept
into a commit. This one stops the opposite: a script going in while a file it
cannot run without stays behind on somebody's disk.

Both directions have happened here, and the suite was green for all four:

    tools/setup-win-sdk.sh   swept IN   (developer WIP)
    two .pyc files           swept IN   (build artifacts, onto five branches)
    tools/verify-build-outcome.sh  left OUT, while tools/build.sh — which
        requires it at line 151 and invokes it at 282 — went in. A clean
        checkout had a build script that died at its own required-input check.
    tools/policy/manifest.py       left OUT, while a committed case that runs
        it went in.

A working-tree test cannot see any of it: a path resolves whether or not git
has ever heard of the file behind it.

WHAT IS CHECKED. Everything is read out of the COMMIT — the scripts and the
tracked file set both — so the answer is a property of that commit and not of
the tree it is run from. Every literal $ASTRO_ROOT-rooted path a committed
shell script under tools/ names must be tracked at that commit, or be declared
in NOT_TRACKED below with the reason it is absent.

That is deliberately broader than "required or invoked": it covers
astro::require_file, astro::require_dir, a direct "$ASTRO_ROOT/tools/x.sh"
invocation, a python driver passed as an argument, and a data file read three
frames deep — without needing to recognise which is which. The cost is that a
path a script CREATES rather than reads (a packaging staging directory) has to
be declared too, which is a one-line declaration carrying a reason, in the same
shape as tools/overlay.allowlist.

WHAT IS NOT CHECKED, and why:

  * Paths built from a variable — "$ASTRO_ROOT/webui/$page/dist" — are
    discarded rather than truncated. A truncated path is a guess, and a guess
    that is wrong in the permissive direction is a finding nobody sees while a
    guess that is wrong in the strict direction is a false alarm that gets the
    check disabled.
  * Text that cannot expand, because the shell will not expand it. A
    SINGLE-quoted `'$ASTRO_ROOT/x'` is literal characters — an assertion
    needle, a grep pattern, a message — and never a path. So is the body of a
    heredoc whose delimiter is quoted (`<<'EOF'`), which is data written into
    some other file. Both exclusions are the shell's own reading, not a
    concession: without them a case that plants a deliberately-absent fixture
    path, and then asserts the scanner named it, reports itself. An UNQUOTED
    heredoc does expand, so its body is scanned.
  * .github/workflows/*.yml. CI already runs from a clean checkout of the
    commit, so a workflow naming an untracked script fails there loudly and
    immediately. A second check would add a way to be wrong, not a way to find
    out.
  * Python drivers. They take their paths as arguments from the shell scripts
    that are scanned.

Usage:
    scan-committed-inputs.py [--repo DIR] [--rev COMMIT]
    scan-committed-inputs.py [--repo DIR] [--rev COMMIT] --check-declarations

Exit status:
    0  every named path is tracked or declared
    1  a named path is neither
    2  nothing was scanned — a vacuous run must not read as a pass

The second form asks the other question: is the NOT_TRACKED table below still
an honest description of THIS repository. A declaration nothing names is
stale, and one covering tracked content is over-broad; either exits 2. It is a
separate invocation because it is a fact about one repository and the scan
itself is not — a fixture repository has every right to name none of Astro's
declared-absent paths, and a check that failed there could not be tested.
"""

from __future__ import annotations

import argparse
import importlib.util
import re
import subprocess
import sys
from pathlib import Path

# ONE implementation of "where does this line's comment begin". The sibling
# scanner already answers it quote-aware, and a second copy is how one of them
# gets tightened and the other does not. The import is by path because the file
# is hyphenated; it raises if the sibling is missing, which is the correct
# behaviour for a required input.
_SIBLING = Path(__file__).with_name("scan-shell-patterns.py")
_SPEC = importlib.util.spec_from_file_location("astro_scan_shell_patterns", _SIBLING)
if _SPEC is None or _SPEC.loader is None:
    raise SystemExit(f"cannot load required sibling scanner: {_SIBLING}")
_SHELL = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(_SHELL)


# Paths that are legitimately absent from every commit, each with the reason.
# An explicit declaration rather than a pattern: "anything that looks like a
# build directory" is the kind of rule that quietly grows to cover the next
# real defect.
#
# Both directions of the join are enforced below. A declaration matching
# nothing is stale and fails the run, so the list cannot become a dumping
# ground; a declaration that shadows tracked content is over-broad and fails
# too, so nobody can silence a finding by exempting its parent.
NOT_TRACKED: list[tuple[str, str]] = [
    ("chromium", "the Chromium checkout; fetched at the locked commit by tools/sync-sources.sh"),
    ("depot_tools", "fetched at the locked commit by tools/sync-sources.sh"),
    (".ungoogled-chromium", "the ungoogled patch set; fetched by tools/sync-ungoogled.sh"),
    ("releases", "packaging staging directories and release archives, produced by tools/package-*.sh"),
    ("build", "machine-readable reports written by tools/apply-patches.sh and tools/sync-overlay.sh"),
    ("win-sdk", "the Windows cross-compile toolchain, provisioned outside the repository"),
]

# The root every path is resolved against. Only this one: a script's own
# SCRIPT_DIR or a fixture root resolves somewhere that is not the repository,
# and a path checked against the wrong root is worse than one not checked.
ROOT_VARIABLE = "ASTRO_ROOT"

# NAME="$X/a/b", NAME=$X/a/b, NAME="$X" — one assignment, whole statement.
ASSIGNMENT = re.compile(
    r"""^[ \t]*(?:local[ \t]+|export[ \t]+|readonly[ \t]+)*
        (?P<name>[A-Za-z_][A-Za-z0-9_]*)=
        (?P<quote>["']?)
        (?P<value>\$\{?[A-Za-z_][A-Za-z0-9_]*\}?(?:/[A-Za-z0-9_.@+-]+)*/?)
        (?P=quote)[ \t]*$""",
    re.VERBOSE,
)

# $VAR or ${VAR}, then zero or more /components, then an optional trailing /.
REFERENCE = re.compile(
    r"\$\{?(?P<name>[A-Za-z_][A-Za-z0-9_]*)\}?"
    r"(?P<tail>(?:/[A-Za-z0-9_.@+-]+)*)(?P<slash>/?)"
)

# What may follow a reference for it to be a WHOLE path. Anything else — most
# importantly `$`, and a `/` that the component class refused, meaning the next
# component starts with a variable or a glob — means the literal was cut short.
TERMINATORS = set("\"' \t;|&)(<>,`:=") | {""}

MAX_RESOLUTION_DEPTH = 8


def git(repo: str, *args: str) -> str:
    return subprocess.run(
        ["git", "-C", repo, *args],
        capture_output=True,
        text=True,
        check=True,
    ).stdout


def tracked_at(repo: str, rev: str) -> tuple[set[str], set[str]]:
    """(tracked files, directories containing one) at `rev`."""
    files = {path for path in git(repo, "ls-tree", "-r", "--name-only", "-z", rev).split("\0") if path}
    directories: set[str] = set()
    for path in files:
        parts = path.split("/")
        for index in range(1, len(parts)):
            directories.add("/".join(parts[:index]))
    return files, directories


def shell_scripts(tracked: set[str]) -> list[str]:
    return sorted(
        path for path in tracked if path.startswith("tools/") and path.endswith(".sh")
    )


def variable_map(rows: list[tuple[int, str, str]]) -> dict[str, list[str]]:
    """Every literal assignment in the file, by name.

    Reassignments are all kept rather than resolved to one: a script that binds
    a name twice names two paths, and picking one of them silently drops the
    other from the scan.
    """
    found: dict[str, list[str]] = {}
    for _number, _raw, code in rows:
        match = ASSIGNMENT.match(code)
        if match:
            values = found.setdefault(match.group("name"), [])
            if match.group("value") not in values:
                values.append(match.group("value"))
    return found


def strip_comment(line: str) -> str:
    index = _SHELL.comment_start(line, escapes=True)
    return line if index is None else line[:index]


def strip_single_quoted(line: str, state: tuple[bool, bool]) -> tuple[str, tuple[bool, bool]]:
    """Blank out single-quoted spans. Returns (text, quote state after it).

    The sibling scanner has no function to borrow for this: its strip_noncode
    removes BOTH quote kinds, which would remove every path this scanner exists
    to find. What is shared with it is the comment reading and the heredoc
    regex, which is where the two agree.

    The DOUBLE-quote state is tracked too, and carried across lines with the
    single-quote state, because an apostrophe inside a double-quoted string
    ("don't") opens nothing — a scanner that thought it did would blank the
    rest of the file, and every finding after that point would disappear.
    """
    in_single, in_double = state
    out: list[str] = []
    index = 0
    while index < len(line):
        char = line[index]
        if in_single:
            if char == "'":
                in_single = False
            out.append(" ")
            index += 1
            continue
        if in_double:
            if char == "\\":
                out.append("  ")
                index += 2
                continue
            if char == '"':
                in_double = False
            out.append(char)
            index += 1
            continue
        if char == "'":
            in_single = True
            out.append(" ")
            index += 1
            continue
        if char == '"':
            in_double = True
        out.append(char)
        index += 1
    return "".join(out), (in_single, in_double)


def executable_lines(text: str) -> list[tuple[int, str, str]]:
    """[(line number, raw line, the part of it the shell would expand)].

    Comments go first, then the bodies of quoted heredocs, then single-quoted
    spans — in that order, because a `#` inside a heredoc is data and a heredoc
    delimiter inside a comment starts nothing.
    """
    rows: list[tuple[int, str, str]] = []
    state = (False, False)
    terminator: str | None = None

    for number, raw in enumerate(text.split("\n"), 1):
        if terminator is not None:
            if raw.strip() == terminator:
                terminator = None
            continue

        code = strip_comment(raw)
        code, state = strip_single_quoted(code, state)
        rows.append((number, raw, code))

        # Matched against the RAW line: the delimiter is normally quoted, and
        # the strippers above have already removed it from `code`.
        match = _SHELL.HEREDOC_START.search(raw)
        if match and match.group(1):
            terminator = match.group(2)

    return rows


def resolve(variables: dict[str, list[str]], name: str, tail: str, depth: int = 0) -> str | None:
    """The repository-relative path a `$name`+`tail` reference denotes, or None."""
    if depth > MAX_RESOLUTION_DEPTH:
        return None
    if name == ROOT_VARIABLE:
        return normalise(tail)
    for value in variables.get(name, []):
        match = re.match(r"^\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?(.*)$", value)
        if not match:
            continue
        resolved = resolve(variables, match.group(1), match.group(2) + tail, depth + 1)
        if resolved is not None:
            return resolved
    return None


def normalise(path: str) -> str | None:
    """Repository-relative form, or None when the path escapes or is the root.

    A trailing `/.` — as in `cp -a "$SRC/." "$DEST/"` — is a component in the
    raw text and not in the filesystem, so it is dropped here rather than
    reported as a missing file called `.`.
    """
    parts = [part for part in path.split("/") if part not in ("", ".")]
    if any(part == ".." for part in parts):
        return None
    return "/".join(parts) or None


def scan(text: str) -> dict[str, list[tuple[int, str]]]:
    """{repository-relative path: [(line number, whole line)]}."""
    rows = executable_lines(text)
    variables = variable_map(rows)
    found: dict[str, list[tuple[int, str]]] = {}

    for number, raw, code in rows:
        for match in REFERENCE.finditer(code):
            after = code[match.end() : match.end() + 1]
            if after not in TERMINATORS:
                continue
            path = resolve(variables, match.group("name"), match.group("tail") + match.group("slash"))
            if path is None:
                continue
            sites = found.setdefault(path, [])
            if not any(existing == number for existing, _text in sites):
                sites.append((number, raw.strip()))
    return found


def declared_absent(path: str) -> str | None:
    """The declaration covering `path`, or None."""
    for prefix, _reason in NOT_TRACKED:
        if path == prefix or path.startswith(prefix + "/"):
            return prefix
    return None


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", default=".", help="repository to read (default: .)")
    parser.add_argument("--rev", default="HEAD", help="commit to read (default: HEAD)")
    parser.add_argument(
        "--check-declarations",
        action="store_true",
        help="check the NOT_TRACKED table against this repository instead of scanning paths",
    )
    arguments = parser.parse_args(argv[1:])

    tracked, directories = tracked_at(arguments.repo, arguments.rev)
    scripts = shell_scripts(tracked)

    missing: dict[str, list[str]] = {}
    used: set[str] = set()
    candidates = 0

    for script in scripts:
        text = git(arguments.repo, "show", f"{arguments.rev}:{script}")
        for path, sites in scan(text).items():
            candidates += 1
            declaration = declared_absent(path)
            if declaration is not None:
                used.add(declaration)
                continue
            if path in tracked or path in directories:
                continue
            for number, line in sites:
                missing.setdefault(path, []).append(f"{script}:{number}: {line}")

    problems = 0
    if not arguments.check_declarations:
        for path in sorted(missing):
            print(f"{path}: named by a committed script but not tracked at {arguments.rev}")
            for site in missing[path]:
                print(f"    {site}")
            problems += 1

    print(
        f"scanned {len(scripts)} committed script(s), {candidates} candidate path(s), "
        f"{len(NOT_TRACKED)} declaration(s)"
    )

    # The floor comes before every verdict below. A broken git listing, a
    # narrowed file filter or a reference regex that stopped matching all
    # produce an empty scan, and an empty scan finds nothing wrong.
    if not scripts or not candidates:
        print("nothing was scanned; refusing to report a pass", file=sys.stderr)
        return 2

    if arguments.check_declarations:
        # Both directions of the join. A declaration nothing matches is stale,
        # and one covering tracked content would silence real findings.
        stale = [prefix for prefix, _reason in NOT_TRACKED if prefix not in used]
        overbroad = [
            prefix
            for prefix, _reason in NOT_TRACKED
            if prefix in tracked or prefix in directories
        ]
        for prefix in stale:
            print(
                f"stale declaration: {prefix!r} is declared not-tracked, and no "
                f"committed script names it. Delete the entry.",
                file=sys.stderr,
            )
        for prefix in overbroad:
            print(
                f"over-broad declaration: {prefix!r} is declared not-tracked, and the "
                f"commit tracks content there. Narrow it.",
                file=sys.stderr,
            )
        if stale or overbroad:
            return 2
        print(f"all {len(NOT_TRACKED)} declaration(s) are used and none shadows tracked content")
        return 0

    if problems:
        print(
            f"\n{problems} path(s) named by committed scripts are not in the commit.\n"
            "Commit them, or declare them in NOT_TRACKED in this file with the reason\n"
            "they are absent. A path left in neither state is a clean checkout that\n"
            "cannot run what this repository publishes.",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
