#!/usr/bin/env python3
"""Measure Astro's downstream delta against Chromium-owned files, and judge it.

`tools/upstream.allowlist` declares which Chromium-owned files the //astro
integration may modify and the shape each change may take. This module is what
turns that declaration into a measurement and a verdict; `tools/check-upstream-
delta.sh` is the gate that runs it.

WHAT IS MEASURED, AND WHY IT IS NOT THE RAW DIFF
------------------------------------------------
The obvious measurement — `git diff <locked-commit>` — is the wrong one, and
measuring it first is what makes that visible. Against the real checkout it
reports 691 modified files, 3,220 deleted files and thousands of removed lines,
because the tree carries the whole legacy patch stack (112 ungoogled + 54 Astro
patches, plus ungoogled's binary pruning) on top of the locked commit. An
allowlist of 691 entries would ratify the legacy system rather than bound the
new one, and "zero deletions" would be false on arrival.

So the delta is measured by SUBTRACTION, and every subtrahend is a committed,
reviewed declaration rather than a heuristic:

    integration delta = tree delta
                      - what patches/{ungoogled,astro}/series declare
                      - what patches/ungoogled/pruning.list declares
                      - what tools/overlay.allowlist declares

Whatever survives that subtraction is Astro's live integration with Chromium,
and it is what tools/upstream.allowlist governs. The property that makes this
fail-closed is the direction of the residual: anything new, anything nobody
declared, and anything a declaration does not cover lands IN the delta and
needs an allowlist entry. A broken subtrahend makes the delta larger, never
smaller.

Line matching is a multiset difference on exact line content, per file. Hunk
adjacency is deliberately not used to attribute lines: `git diff -U0` splits
hunks tightly, so an added hook two lines away from a removal would land in a
different hunk and the removal would be attributed to the hook's owner or to
nobody depending on the diff's shape. Content matching does not care where in
the file a line moved to.

Whitespace-only residual lines are counted and reported separately, and are
excluded from caps and from the removal rule. Patch application legitimately
shifts blank lines when hunks abut, and a blank line can neither express a hook
nor strip a feature. The counts are printed so the exclusion is visible.

REMOVED LINES, AND THE TWO WAYS ONE MAY BE ACCOUNTED FOR
--------------------------------------------------------
No shape permits removing an upstream line and no attribute can grant one; that
is unchanged. What the allowlist can now carry is a declaration of the
exception, one line at a time:

* `substitute` declares a literal and the macro it was recomposed into. It
  accounts for a removed line only when applying that replacement yields a line
  ACTUALLY PRESENT among the added lines, so it pairs a removal with its
  recomposed form rather than blessing it — a removal that merely deleted the
  literal matches nothing and is refused exactly as before. Its `guard` line,
  the `#define` giving the macro its default, must be among the additions too.
  A paired addition does not count against max-added: a recomposed upstream
  line is the same line, not new surface.
* `remove` blesses one exact line, matched on content in a multiset, for the
  removals no substitution can pair — an assertion or a literal branch replaced
  by a generic test.

Both are joined in both directions, so neither can rot into a permission nobody
is using, and both require a live entry for the same path.

The one permissive edge of content matching, stated rather than left to be
discovered: if a DECLARED patch is not actually applied, and the integration
independently adds a line byte-identical to one that patch declares for the same
file, the subtraction absorbs it and the line is not reported. Measured
instance, and it is the harmless shape: 025-astro-scheme-register.patch is not
applied in the current tree, and the blank line it declares for
chrome/common/chrome_content_client.cc absorbs the blank line inside that file's
astro hook — so the file reads +2 here against a raw diff of +3. A
NON-whitespace instance would need the integration to reproduce a specific
unapplied patch line exactly; the guard against it is not here but upstream, in
tools/apply-patches.sh, which applies every declared patch exactly or stops.

WHAT IS NOT MEASURED, SAID PLAINLY
----------------------------------
* Behavioural equivalence. A two-line hook that calls into //astro and thereby
  changes what Chromium does is inside every rule here. This bounds the
  SURFACE.
* //astro itself. It is a separate checkout gclient places at src/astro and
  never appears in the Chromium repository's diff. Its internal layering is
  tools/check-module-layering.sh's subject.
* GN args. gn_args/*.gn is Astro-owned and outside the Chromium repository, yet
  one value there changes the browser more than any hook here.
  tools/lib/gn_args_drift.py already covers it.
"""

from __future__ import annotations

import argparse
import collections
import json
import re
import subprocess
import sys
from pathlib import Path

# Shapes a live allowlist entry may declare, and whether every added line must
# name the //astro module.
#
# `embedder-hook` is the one shape that does not require it, and the exemption
# is the point of the shape rather than a concession: content/ must stay
# embedder-agnostic, so a generic extension point there names no Astro symbol.
# It is bounded by max-added and by the removal rule alone, which makes it the
# weakest shape in the file.
LIVE_SHAPES = {
    "gn-append": True,
    "include-rule": True,
    "call-hook": True,
    "embedder-hook": False,
}
PLANNED_SHAPE = "planned"
REQUIRED_ATTRIBUTES = ("owner", "issue", "max-added")

# The two directives that DECLARE a removal, and the attributes each requires.
#
# A removal is the one thing no shape may express, and that stays true: these do
# not relax the rule, they name the exceptions one line at a time so that an
# UNDECLARED removal still fails. `remove` blesses one exact upstream line;
# `substitute` blesses none, and instead PROVES that every line it accounts for
# reappears among the added lines with a literal replaced by a macro — a
# mechanical behaviour-preservation argument rather than an asserted one.
REMOVE_DIRECTIVE = "remove"
SUBSTITUTE_DIRECTIVE = "substitute"
DIRECTIVES = (REMOVE_DIRECTIVE, SUBSTITUTE_DIRECTIVE)

# Everything after the first `|` on a directive line is the upstream line, byte
# for byte: no comment stripping, no whitespace trimming. Upstream C++ contains
# `#`, `"`, leading indentation and trailing `;`, and a declaration that cannot
# hold them exactly is a declaration that matches the wrong line.
VERBATIM_MARKER = "|"

# The continuation lines a `substitute` record carries, in this order. Fixed
# rather than free-form so a record cannot be half-written: a `from` with no
# `to` would substitute a literal for nothing.
SUBSTITUTE_FIELDS = ("from", "to", "guard")

# A reference to the //astro module, in any of the four syntaxes the hooks use:
# a GN label (//astro:x or //astro/x), a C++ include path ("astro/...), a call
# into the astro:: namespace, and a checkdeps include rule ("+astro").
#
# Deliberately does NOT match `oxy::` or `chrome/browser/oxy`, though the design
# note permits it: those are the overlay-era shape that #7 exists to remove, and
# they are governed by tools/overlay.allowlist. Matching them here would let an
# overlay-era hook pass as an integration hook.
#
# It must also NOT match a bare "astro" string literal — patch
# 025-astro-scheme-register.patch adds `schemes->standard_schemes.push_back(
# "astro");`, which is legacy patch content and not a module reference.
ASTRO_MODULE_REFERENCE = re.compile(r'(?://astro[:/]|"astro/|\bastro::|"\+astro")')

# Per-shape syntax the added lines must have. These are the checks that make a
# shape mean something beyond its cap: a `call-hook` that starts appending GN
# labels, or an `include-rule` that grows a key other than include_rules, is not
# the change that was reviewed.
SHAPE_SYNTAX = {
    # A checkdeps include rule and nothing else.
    "include-rule": re.compile(r'^\s*"\+[A-Za-z0-9_./-]+",?\s*$'),
    # A GN list element, or the import()/list syntax around one.
    "gn-append": re.compile(r'^\s*(?:"[^"]*",?|import\("[^"]*"\)|\S+\s*\+?=\s*\[|\]\s*,?)\s*$'),
}

# A LINE COMMENT, per shape's own language. Exempt from the syntax check and
# from the per-line module-reference requirement, for the same reason a
# whitespace-only line is exempt from the cap: a comment can neither express a
# hook nor strip a feature. Unlike whitespace it still COUNTS against
# max-added, because 200 lines of commentary in an upstream file is surface
# somebody has to maintain, and the cap is what bounds surface.
#
# Written per shape rather than as one pattern because C++'s `#` is the
# PREPROCESSOR: a single `^\s*#` rule would classify `#include "astro/..."` —
# the most load-bearing line a call-hook has — as a comment and stop checking
# it. GN has no preprocessor, so `#` there is unambiguous.
SHAPE_COMMENT = {
    "include-rule": re.compile(r"^\s*#"),
    "gn-append": re.compile(r"^\s*#"),
    "call-hook": re.compile(r"^\s*//"),
    "embedder-hook": re.compile(r"^\s*//"),
}

# What a `call-hook` may add besides a reference to //astro.
#
# The per-line "every added line must name //astro" rule fitted the two-line
# hook it was written for — an #include plus a call — and nothing else. An
# override of an upstream virtual cannot satisfy it: the signature upstream
# dictates, the parameter it takes and the brace that closes it name no Astro
# symbol, and never can. Declaring such a file `embedder-hook` to escape the
# rule would be worse, because that shape has no per-line rule at all.
#
# So the rule moves from every line to the BLOCK — at least one added line must
# name //astro, which is checked separately and is what stops a `call-hook`
# from becoming a licence to add scaffolding to a Chromium file — and the
# remaining lines must be scaffolding in this narrow sense: punctuation, a
# `return` of a literal, or a fragment of a function signature. Deliberately no
# statement, no condition, no call, no string literal; `LOG(WARNING) << "..."`,
# `std::string all;` and `if (i != data_sources_.end())` are all rejected by it,
# which was checked rather than assumed.
CALL_HOOK_SCAFFOLD = re.compile(
    r"^\s*(?:"
    r"[{}()\[\];,]+"                                    # punctuation alone
    r"|return\s+(?:true|false|nullptr);"                # the value a hook returns
    r"|(?:[A-Za-z_][\w:]*[\s*&]+)*[A-Za-z_][\w:]*\("    # `void Class::Method(`
    r"|[A-Za-z_][\w:<>,*&\[\]\s]*\)\s*(?:const\s*)?(?:override\s*)?[;{]"  # `Type* p) override;`
    r")\s*$"
)


class DeltaError(Exception):
    """An input problem, phrased for whoever has to fix it.

    Distinct from a violation: a violation is a measurement that came out bad,
    while this means no measurement was taken at all.
    """


# ---------------------------------------------------------------------------
# git
# ---------------------------------------------------------------------------


def git(src: Path, *arguments: str) -> bytes:
    """Run git in `src`, or raise. Never returns partial output on failure.

    stderr is captured and reported rather than discarded: a required step's
    failure reason is the whole value of running it.
    """
    result = subprocess.run(
        ["git", "-C", str(src), "-c", "core.quotePath=false", *arguments],
        capture_output=True,
    )
    if result.returncode != 0:
        raise DeltaError(
            "git {} failed (exit {}) in {}: {}".format(
                " ".join(arguments),
                result.returncode,
                src,
                result.stderr.decode("utf-8", "replace").strip(),
            )
        )
    return result.stdout


def decode(raw: bytes) -> str:
    return raw.decode("utf-8", "surrogateescape")


def name_status(src: Path, base: str, status_filter: str) -> list[str]:
    """Paths at `status_filter` between `base` and the working tree.

    -z is not optional here: a NUL-separated stream is the only form that
    cannot be corrupted by a path containing whitespace, and Chromium has
    400,000 of them.

    `--ignore-submodules=dirty` is passed EXPLICITLY, and it is the opposite of
    an oversight. A gitlink whose commit moved is a change to this tree and is
    reported here; a submodule whose work tree is dirty is measured by
    descending into it (`submodule_scan` below), because only that yields the
    file-level paths every declaration in this repository is written in. Saying
    so on the command line also stops the answer depending on the
    `diff.ignoreSubmodules = dirty` that gclient writes into the checkout's own
    config — a guard whose verdict is configurable by the thing it guards is
    not a guard, and inheriting that value is exactly how this measurement came
    to report zero over a tree carrying the last run's patches.
    """
    fields = git(
        src, "diff", "--name-status", "-z", "--no-renames",
        "--ignore-submodules=dirty",
        "--diff-filter=" + status_filter, base,
    ).split(b"\0")
    paths: list[str] = []
    index = 0
    while index + 1 < len(fields):
        if fields[index]:
            paths.append(decode(fields[index + 1]))
        index += 2
    return paths


def untracked_paths(src: Path) -> list[str]:
    """Paths git reports as untracked.

    `git diff` never reports untracked files — not as `A`, not at all — so a
    delta report built only from `git diff` is blind to a new Chromium-owned
    file being added, which is precisely one of the things it must refuse.
    Directories arrive with a trailing slash and are normalised here.
    """
    records = git(
        src, "status", "--porcelain=v1", "-z", "--untracked-files=normal"
    ).split(b"\0")
    return [
        decode(record)[3:].rstrip("/")
        for record in records
        if record.startswith(b"?? ")
    ]


def modified_line_counters(
    src: Path, base: str, paths: list[str]
) -> dict[str, tuple[collections.Counter, collections.Counter]]:
    """Added and removed line multisets per path, from ONE diff invocation.

    One `git diff` rather than one per file: 691 subprocess spawns against a
    real checkout is minutes of wall clock for a measurement that is a single
    stream.

    -U0 keeps context lines out of the stream entirely, so a context line can
    never be miscounted as a change. The current file is tracked from the
    `+++ b/<path>` header rather than from `diff --git`, because the latter is
    ambiguous for paths containing spaces while the former is not.
    """
    if not paths:
        return {}
    counters: dict[str, tuple[collections.Counter, collections.Counter]] = {}
    stream = decode(
        git(src, "diff", "--no-renames", "--no-color", "-U0", base, "--", *paths)
    )
    current: str | None = None
    in_hunk = False
    for line in stream.split("\n"):
        if line.startswith("+++ "):
            target = line[4:].split("\t")[0]
            current = None if target == "/dev/null" else target[2:]
            if current is not None:
                counters.setdefault(
                    current, (collections.Counter(), collections.Counter())
                )
            in_hunk = False
        elif line.startswith("--- ") or line.startswith("diff --git "):
            in_hunk = False
        elif line.startswith("@@"):
            in_hunk = True
        elif in_hunk and current is not None:
            if line.startswith("+"):
                counters[current][0][line[1:]] += 1
            elif line.startswith("-"):
                counters[current][1][line[1:]] += 1
    return counters


class SubmoduleScan:
    """What one descent into a submodule contributed, already re-rooted."""

    def __init__(self) -> None:
        self.roots: list[str] = []
        self.modified: list[str] = []
        self.deleted: list[str] = []
        self.untracked: list[str] = []
        self.counters: dict[str, tuple[collections.Counter, collections.Counter]] = {}

    def absorb(self, other: "SubmoduleScan") -> None:
        self.roots.extend(other.roots)
        self.modified.extend(other.modified)
        self.deleted.extend(other.deleted)
        self.untracked.extend(other.untracked)
        self.counters.update(other.counters)


def dirty_submodules(src: Path) -> list[str]:
    """Submodule paths whose work tree differs from what they check out to.

    The superproject cannot answer what changed INSIDE one of them, and with
    gclient's `diff.ignoreSubmodules = dirty` it does not even say that one
    did. porcelain=v2 carries the flags in field 2 — `S<c><m><u>`, each letter
    present when set — so `m` (modified content) and `u` (untracked content)
    are readable, and `c` (the gitlink moved) is deliberately not among the
    triggers here: `name_status` already reports that one against the base.
    """
    records = git(
        src, "status", "--porcelain=v2", "-z",
        "--untracked-files=all", "--ignore-submodules=none",
    ).split(b"\0")
    paths: list[str] = []
    index = 0
    while index < len(records):
        record = records[index]
        index += 1
        if not record or record[:1] not in (b"1", b"2"):
            continue
        fields = record.split(b" ", 8 if record[:1] == b"1" else 9)
        if record[:1] == b"2" and index < len(records) and records[index]:
            index += 1  # the rename's origin path, a bare extra field
        submodule_field = decode(fields[2])
        if not submodule_field.startswith("S"):
            continue
        if submodule_field[2] != "." or submodule_field[3] != ".":
            paths.append(decode(fields[-1]))
    return paths


def submodule_scan(src: Path, base: str, prefix: str = "") -> SubmoduleScan:
    """The same measurement, taken inside every dirty submodule.

    Thirteen of the files the declared series patches live in two submodules,
    and 9,171 of the 12,392 files pruning deletes live in fifty-two of them. A
    measurement that stops at the superproject boundary therefore reports a
    fraction of what the tree carries — and reports it as the whole thing.

    Each submodule is measured against the commit the LOCKED BASE records for
    it, not against its own HEAD, so the answer is "how does this tree differ
    from the browser we pinned" all the way down. Results are re-rooted onto
    the superproject, which puts them in the vocabulary `pruning.list`, the
    patch series and the overlay allowlist already use: nothing here needs a
    list of which submodule paths Astro is allowed to write, because the
    declarations that answer that for every other file answer it for these too.
    """
    scan = SubmoduleScan()
    for submodule in dirty_submodules(src):
        sub_src = src / submodule
        sub_prefix = prefix + submodule + "/"
        try:
            sub_base = decode(git(src, "rev-parse", "{}:{}".format(base, submodule))).strip()
        except DeltaError:
            # The submodule is not in the locked commit at all, so there is no
            # base to measure it against. Reported as a new path rather than
            # skipped: an entire subtree nobody declared is the loudest version
            # of the thing this tool refuses.
            scan.roots.append(prefix + submodule)
            scan.untracked.append(prefix + submodule)
            continue

        scan.roots.append(prefix + submodule)
        sub_modified = name_status(sub_src, sub_base, "M")
        scan.modified.extend(sub_prefix + path for path in sub_modified)
        scan.deleted.extend(
            sub_prefix + path for path in name_status(sub_src, sub_base, "D")
        )
        scan.untracked.extend(
            sub_prefix + path for path in untracked_paths(sub_src)
        )
        scan.counters.update(
            {
                sub_prefix + path: counter
                for path, counter in modified_line_counters(
                    sub_src, sub_base, sub_modified
                ).items()
            }
        )
        scan.absorb(submodule_scan(sub_src, sub_base, sub_prefix))
    return scan


# ---------------------------------------------------------------------------
# The declared subtrahends
# ---------------------------------------------------------------------------


class PatchSeries:
    """What the declared patch series says it adds, removes and creates.

    Read from the `series` files rather than from a glob of `*.patch`. The two
    happen to agree today — tools/apply-patches.sh asserts they do before
    applying anything — but they are not the same statement: a glob would let a
    patch file that nobody applies excuse a change in the tree, which is the
    permissive direction and therefore the wrong one to be careless about.
    """

    def __init__(self) -> None:
        self.added: dict[str, collections.Counter] = collections.defaultdict(
            collections.Counter
        )
        self.removed: dict[str, collections.Counter] = collections.defaultdict(
            collections.Counter
        )
        self.created: set[str] = set()
        self.files: set[str] = set()
        self.patch_count = 0

    @staticmethod
    def _read_series(series_file: Path) -> list[str]:
        if not series_file.is_file():
            raise DeltaError("patch series file not found: {}".format(series_file))
        entries = [
            line.split("#", 1)[0].strip()
            for line in series_file.read_text(encoding="utf-8").splitlines()
        ]
        return [entry for entry in entries if entry]

    def load(self, patches_root: Path) -> None:
        for subdirectory in ("ungoogled", "astro"):
            directory = patches_root / subdirectory
            for relative in self._read_series(directory / "series"):
                patch = directory / relative
                if not patch.is_file():
                    raise DeltaError(
                        "{}/series declares a patch that does not exist: {}".format(
                            subdirectory, patch
                        )
                    )
                self._absorb(patch)
                self.patch_count += 1

        if self.patch_count == 0:
            raise DeltaError(
                "the declared patch series is empty; refusing to treat the entire "
                "patched tree as an undeclared integration delta"
            )

    def _absorb(self, patch: Path) -> None:
        previous_source: str | None = None
        current: str | None = None
        for raw in patch.read_text(
            encoding="utf-8", errors="surrogateescape"
        ).splitlines():
            if raw.startswith("--- "):
                previous_source = raw[4:].split("\t")[0].strip()
                current = None
            elif raw.startswith("+++ "):
                target = raw[4:].split("\t")[0].strip()
                current = target[2:] if target.startswith("b/") else target
                self.files.add(current)
                if previous_source == "/dev/null":
                    self.created.add(current)
                previous_source = None
            elif raw.startswith("@@") or raw.startswith("diff "):
                continue
            elif current is None:
                continue
            elif raw.startswith("+"):
                self.added[current][raw[1:]] += 1
            elif raw.startswith("-"):
                self.removed[current][raw[1:]] += 1


def read_pruning_list(patches_root: Path) -> set[str]:
    """The files ungoogled's binary pruning removes.

    Deleted FILES are a different fact from deleted LINES, and conflating them
    is how a report ends up claiming thousands of deletions in a delta whose
    integration part removes nothing. Every deletion in the tree must appear
    here; one that does not is unattributed and fails.
    """
    pruning_list = patches_root / "ungoogled" / "pruning.list"
    if not pruning_list.is_file():
        raise DeltaError("pruning list not found: {}".format(pruning_list))
    entries = {
        line.strip()
        for line in pruning_list.read_text(
            encoding="utf-8", errors="surrogateescape"
        ).splitlines()
        if line.strip()
    }
    if not entries:
        raise DeltaError("{} declares no files".format(pruning_list))
    return entries


def read_overlay_destinations(overlay_allowlist: Path) -> list[str]:
    """Destination paths tools/overlay.allowlist declares.

    Consulted so an overlay-written file is not reported as an undeclared
    Chromium-owned addition. It is a different allowlist answering a different
    question, and this tool reads it rather than duplicating its contents.
    """
    if not overlay_allowlist.is_file():
        raise DeltaError("overlay allowlist not found: {}".format(overlay_allowlist))
    destinations = []
    for line in overlay_allowlist.read_text(encoding="utf-8").splitlines():
        stripped = line.split("#", 1)[0].strip()
        if not stripped:
            continue
        fields = stripped.split()
        if len(fields) >= 2:
            destinations.append(fields[1].rstrip("/"))
    if not destinations:
        raise DeltaError("{} declares no destinations".format(overlay_allowlist))
    return destinations


# ---------------------------------------------------------------------------
# tools/upstream.allowlist
# ---------------------------------------------------------------------------


class Entry:
    def __init__(self, shape: str, path: str, attributes: dict[str, str], line: int):
        self.shape = shape
        self.path = path
        self.attributes = attributes
        self.line = line
        self.owner = attributes["owner"]
        self.issue = attributes["issue"]
        self.max_added = int(attributes["max-added"])

    @property
    def planned(self) -> bool:
        return self.shape == PLANNED_SHAPE

    @property
    def requires_module_reference(self) -> bool:
        return LIVE_SHAPES.get(self.shape, False)


class Removal:
    """One exact upstream line the integration is permitted to remove.

    The line is held verbatim and matched by exact content, in a multiset:
    declaring a line once permits it to be removed once. Anything else would
    let one declaration cover a whole family of similar lines, and "similar" is
    precisely the judgement this file exists to take away from whoever is in a
    hurry.
    """

    def __init__(self, path: str, line: str, attributes: dict[str, str], number: int):
        self.path = path
        self.line = line
        self.reason = attributes["reason"]
        self.issue = attributes["issue"]
        self.number = number


class Substitution:
    """A literal replaced by a macro, and the proof that nothing else changed.

    `from` and `to` are held verbatim. A removed line is accounted for by this
    record only when replacing `from` with `to` in it yields a line that is
    ACTUALLY PRESENT among the added lines — so the record cannot bless a
    removal on its own, only pair one with its recomposed form.

    `guard` is the `#define` that gives the macro its default. It must appear
    among the added lines, which is what separates "the literal moved behind a
    macro that still expands to it" from "the literal left the file and the
    macro is supplied from somewhere else entirely".
    """

    def __init__(
        self, path: str, fields: dict[str, str], attributes: dict[str, str], number: int
    ):
        self.path = path
        self.source = fields["from"]
        self.target = fields["to"]
        self.guard = fields["guard"]
        self.reason = attributes["reason"]
        self.issue = attributes["issue"]
        self.number = number
        self.matched = 0

    @property
    def macro(self) -> str:
        """The macro name `to` introduces, for reporting."""
        return self.target.strip().split()[0] if self.target.strip() else self.target


class Allowlist:
    """tools/upstream.allowlist, parsed: entries plus the removal declarations."""

    def __init__(self) -> None:
        self.entries: dict[str, Entry] = {}
        self.removals: dict[str, list[Removal]] = collections.defaultdict(list)
        self.substitutions: dict[str, list[Substitution]] = collections.defaultdict(list)

    def substitutions_for(self, path: str) -> list[Substitution]:
        """Longest `from` first, so overlapping literals cannot mis-apply.

        `u"chrome://` and `"chrome://` both match the same text; applying the
        shorter one first turns `u"chrome://about/"` into
        `uCHROME_UI_URL_PREFIX "about/"`, which matches no added line and would
        report a real refactor as an undeclared removal. Length order makes the
        result independent of the order somebody wrote the records in.
        """
        return sorted(
            self.substitutions.get(path, []), key=lambda item: -len(item.source)
        )

    def substitute(self, path: str, line: str) -> str:
        for substitution in self.substitutions_for(path):
            line = line.replace(substitution.source, substitution.target)
        return line


def parse_verbatim(path: Path, number: int, raw: str) -> tuple[list[str], str]:
    """Split a directive line into its tokens and its verbatim tail.

    Comments are NOT stripped here, and the tail is not trimmed. The tail is an
    upstream source line; `#`, quotes, indentation and trailing semicolons are
    its content, not syntax this file gets to interpret.
    """
    if VERBATIM_MARKER not in raw:
        raise DeltaError(
            "{}:{}: a {} record needs a '{}' followed by the exact upstream "
            "line".format(path, number, raw.split()[0], VERBATIM_MARKER)
        )
    head, _, tail = raw.partition(VERBATIM_MARKER)
    return head.split(), tail


def parse_attributes(
    path: Path, number: int, label: str, tokens: list[str], required: tuple[str, ...]
) -> dict[str, str]:
    """Parse `key=value` tokens, naming the record's own kind on failure.

    `label` is the shape or directive the line declares. It is in the message
    because "entries require owner=" tells the reader which line to look at in a
    file where four different record kinds require different attributes.
    """
    attributes: dict[str, str] = {}
    for token in tokens:
        if "=" not in token:
            raise DeltaError(
                "{}:{}: attribute '{}' is not key=value".format(path, number, token)
            )
        key, value = token.split("=", 1)
        attributes[key] = value
    for name in required:
        if not attributes.get(name):
            raise DeltaError(
                "{}:{}: {} entries require {}=<value>".format(
                    path, number, label, name
                )
            )
    return attributes


def parse_directive(
    path: Path, number: int, lines: list[str], allowlist: Allowlist
) -> int:
    """Read one `remove` or `substitute` record. Returns the next line index.

    `number` is the record's own 1-based line number, which is also the 0-based
    index of the line after it — the continuation lines a `substitute` record
    needs are read from there.
    """
    raw = lines[number - 1]
    # A `remove` record carries the upstream line on this same line; a
    # `substitute` header carries none, because its literals need three lines of
    # their own. Only the first is read verbatim, so a header that has acquired
    # a stray `|` is a parse error rather than a silently truncated record.
    if raw.strip().split(" ", 1)[0] == REMOVE_DIRECTIVE:
        tokens, verbatim = parse_verbatim(path, number, raw)
    else:
        tokens, verbatim = raw.split(), ""
    directive, target, rest = tokens[0], (tokens[1] if len(tokens) > 1 else ""), tokens[2:]

    if not target or target.startswith("/") or ".." in target.split("/"):
        raise DeltaError(
            "{}:{}: {} needs a relative path free of '..', got {!r}".format(
                path, number, directive, target
            )
        )

    if directive == REMOVE_DIRECTIVE:
        attributes = parse_attributes(path, number, directive, rest, ("issue", "reason"))
        if not verbatim.strip():
            raise DeltaError(
                "{}:{}: this remove record declares a blank line. Whitespace is "
                "already excluded from the removal rule; a record for it would "
                "match nothing and go stale immediately.".format(path, number)
            )
        allowlist.removals[target].append(
            Removal(target, verbatim, attributes, number)
        )
        return number

    attributes = parse_attributes(path, number, directive, rest, ("issue", "reason"))
    if VERBATIM_MARKER in raw:
        raise DeltaError(
            "{}:{}: a substitute header carries no verbatim text; its literals "
            "go on the {} continuation lines below it.".format(
                path, number, "/".join(SUBSTITUTE_FIELDS)
            )
        )

    fields: dict[str, str] = {}
    index = number
    for expected in SUBSTITUTE_FIELDS:
        if index >= len(lines):
            raise DeltaError(
                "{}:{}: the substitute record ends before its `{}` line".format(
                    path, number, expected
                )
            )
        continuation = lines[index]
        index += 1
        keyword = continuation.strip().split(VERBATIM_MARKER, 1)[0].strip()
        if keyword != expected:
            raise DeltaError(
                "{}:{}: expected a `{}` line here, got {!r}. A substitute record "
                "is {} in this order, so a half-written one cannot parse.".format(
                    path, index, expected, continuation.strip()[:60],
                    "/".join(SUBSTITUTE_FIELDS),
                )
            )
        _, literal = parse_verbatim(path, index, continuation)
        if not literal:
            raise DeltaError(
                "{}:{}: the `{}` literal is empty".format(path, index, expected)
            )
        fields[expected] = literal

    if fields["from"] == fields["to"]:
        raise DeltaError(
            "{}:{}: this substitution replaces a literal with itself, so it "
            "proves nothing".format(path, number)
        )
    allowlist.substitutions[target].append(
        Substitution(target, fields, attributes, number)
    )
    return index


def load_allowlist(path: Path) -> Allowlist:
    """Parse tools/upstream.allowlist, or die naming the offending line.

    Every rejection here is one the overlay allowlist's parser already makes,
    for the same reasons: an unknown shape, an absolute or escaping path, and a
    missing owner or issue. An exception with no owner is not an exception, it
    is a leak.
    """
    if not path.is_file():
        raise DeltaError("upstream allowlist not found: {}".format(path))

    allowlist = Allowlist()
    entries = allowlist.entries
    lines = path.read_text(encoding="utf-8").splitlines()
    number = 0
    while number < len(lines):
        raw = lines[number]
        number += 1

        # Directive lines are read BEFORE comment stripping, because their tail
        # is an upstream source line and `#` is content there.
        directive = raw.strip().split(" ", 1)[0] if raw.strip() else ""
        if directive in DIRECTIVES:
            number = parse_directive(path, number, lines, allowlist)
            continue

        line = raw.split("#", 1)[0].strip()
        if not line:
            continue
        fields = line.split()
        if len(fields) < 2:
            raise DeltaError("{}:{}: entry has no path".format(path, number))
        shape, target, rest = fields[0], fields[1], fields[2:]

        if shape not in LIVE_SHAPES and shape != PLANNED_SHAPE:
            raise DeltaError(
                "{}:{}: unknown shape '{}' (expected one of: {}, {})".format(
                    path, number, shape, ", ".join(sorted(LIVE_SHAPES)), PLANNED_SHAPE
                )
            )
        if target.startswith("/") or ".." in target.split("/"):
            raise DeltaError(
                "{}:{}: path must be relative and free of '..': {}".format(
                    path, number, target
                )
            )
        if target in entries:
            raise DeltaError(
                "{}:{}: duplicate entry for {} (first declared at line {})".format(
                    path, number, target, entries[target].line
                )
            )

        attributes = parse_attributes(path, number, shape, rest, REQUIRED_ATTRIBUTES)
        if not attributes["max-added"].isdigit():
            raise DeltaError(
                "{}:{}: max-added must be a non-negative integer, got '{}'".format(
                    path, number, attributes["max-added"]
                )
            )
        entries[target] = Entry(shape, target, attributes, number)

    if not entries:
        raise DeltaError(
            "{} declares no entries. An empty allowlist is a failure, not a "
            "permissive default: without this the gate reports 'no violations' "
            "for a file it never managed to read.".format(path)
        )

    # A removal declaration attached to nothing is how the mechanism would
    # become a second, weaker allowlist: it would permit a removal in a file
    # whose additions nobody capped, whose owner nobody named and whose shape
    # nobody reviewed. So it must sit beside a LIVE entry for the same path.
    for declarations in (allowlist.removals, allowlist.substitutions):
        for target, records in declarations.items():
            entry = entries.get(target)
            if entry is None or entry.planned:
                raise DeltaError(
                    "{}:{}: {} declares a removal in {}, which has {} in this "
                    "file. A removal is only reviewable beside the entry that "
                    "caps and owns the file's additions.".format(
                        path,
                        records[0].number,
                        records[0].__class__.__name__.lower(),
                        target,
                        "no entry" if entry is None else "only a `planned` entry",
                    )
                )

    # A substitution whose replacement contains another's pattern would make
    # the result depend on the order the two were applied in, and the order is
    # not something a reader of this file should have to simulate.
    for target, records in allowlist.substitutions.items():
        for record in records:
            for other in records:
                if other.source and other.source in record.target:
                    raise DeltaError(
                        "{}:{}: the replacement for {!r} contains {!r}, which "
                        "another substitution for {} also replaces. Substitution "
                        "would not be confluent.".format(
                            path, record.number, record.source, other.source, target
                        )
                    )

    return allowlist


# ---------------------------------------------------------------------------
# Measurement
# ---------------------------------------------------------------------------


class FileDelta:
    def __init__(self, path: str):
        self.path = path
        self.added: list[str] = []
        self.removed: list[str] = []
        self.whitespace_added = 0
        self.whitespace_removed = 0
        # Filled in by judge(): the lines a declared substitution paired off,
        # which are excluded from the cap because a recomposed upstream line is
        # the SAME line, not new surface. Reported so the exclusion is visible
        # rather than silent, exactly as the whitespace counts are.
        self.substituted = 0
        self.counted_added = len(self.added)

    @property
    def has_delta(self) -> bool:
        return bool(self.added or self.removed)

    def as_dict(self) -> dict:
        return {
            "path": self.path,
            "added": len(self.added),
            "removed": len(self.removed),
            "counted_added": self.counted_added,
            "substituted": self.substituted,
            "whitespace_added": self.whitespace_added,
            "whitespace_removed": self.whitespace_removed,
            "added_lines": self.added,
            "removed_lines": self.removed,
        }


class Measurement:
    def __init__(self) -> None:
        self.base = ""
        self.head = ""
        self.chromium_src = ""
        self.modified_count = 0
        self.deleted_count = 0
        self.untracked_count = 0
        self.patch_count = 0
        self.deltas: dict[str, FileDelta] = {}
        self.unattributed_deletions: list[str] = []
        self.unattributed_untracked: list[str] = []
        self.parse_mismatch: list[str] = []
        self.submodules_scanned: list[str] = []


def measure(
    src: Path,
    base: str,
    patches_root: Path,
    overlay_allowlist: Path,
) -> Measurement:
    measurement = Measurement()
    measurement.chromium_src = str(src)
    measurement.base = base

    # A base commit the checkout does not carry means the report would be about
    # a different browser. That is unmeasurable, not clean.
    try:
        measurement.head = decode(git(src, "rev-parse", "HEAD")).strip()
        resolved = decode(git(src, "rev-parse", "--verify", base + "^{commit}")).strip()
    except DeltaError as error:
        raise DeltaError(
            "cannot resolve the locked commit {} in {}: {}".format(base, src, error)
        )
    if resolved != base:
        raise DeltaError(
            "the locked commit {} resolved to {}; refusing to report a delta "
            "against an ambiguous base".format(base, resolved)
        )

    series = PatchSeries()
    series.load(patches_root)
    measurement.patch_count = series.patch_count
    pruned = read_pruning_list(patches_root)
    overlay_destinations = read_overlay_destinations(overlay_allowlist)

    # Everything below the superproject boundary, measured the same way and
    # re-rooted, so the three enumerations that follow each cover the whole
    # tree rather than the part git will talk about without being asked twice.
    submodules = submodule_scan(src, base)
    measurement.submodules_scanned = sorted(submodules.roots)

    # --- modified files ----------------------------------------------------
    #
    # The line counters are taken per work tree and merged, never by handing a
    # submodule-prefixed path to the superproject's `git diff`: that path names
    # nothing git will diff there, and it produces no output rather than an
    # error — a file that reads as "no delta" for a reason nobody would see.
    superproject_modified = name_status(src, base, "M")
    modified = superproject_modified + submodules.modified
    measurement.modified_count = len(modified)
    counters = modified_line_counters(src, base, superproject_modified)
    counters.update(submodules.counters)

    # A path git listed as modified but whose diff never appeared is a parse
    # failure, and a parse failure that reads as "no delta for that file" is
    # exactly the shape this whole tool exists to refuse.
    measurement.parse_mismatch = sorted(set(modified) - set(counters))

    for path in modified:
        added, removed = counters.get(
            path, (collections.Counter(), collections.Counter())
        )
        residual_added = added - series.added.get(path, collections.Counter())
        residual_removed = removed - series.removed.get(path, collections.Counter())

        delta = FileDelta(path)
        for line, count in residual_added.items():
            if line.strip():
                delta.added.extend([line] * count)
            else:
                delta.whitespace_added += count
        for line, count in residual_removed.items():
            if line.strip():
                delta.removed.extend([line] * count)
            else:
                delta.whitespace_removed += count
        if delta.has_delta:
            measurement.deltas[path] = delta

    # --- deleted files -----------------------------------------------------
    deleted = name_status(src, base, "D") + submodules.deleted
    measurement.deleted_count = len(deleted)
    measurement.unattributed_deletions = sorted(
        path for path in deleted if path not in pruned
    )

    # --- untracked files ---------------------------------------------------
    untracked = untracked_paths(src) + submodules.untracked
    measurement.untracked_count = len(untracked)
    for path in untracked:
        if path == "astro":
            continue  # the //astro module root; a separate checkout by design
        if any(
            path == destination or path.startswith(destination + "/")
            or destination.startswith(path + "/")
            for destination in overlay_destinations
        ):
            continue
        if path in series.created or any(
            created.startswith(path + "/") for created in series.created
        ):
            continue
        measurement.unattributed_untracked.append(path)
    measurement.unattributed_untracked.sort()

    return measurement


# ---------------------------------------------------------------------------
# Verdict
# ---------------------------------------------------------------------------


class Violation:
    def __init__(self, rule: str, path: str, detail: list[str]):
        self.rule = rule
        self.path = path
        self.detail = detail

    def as_dict(self) -> dict:
        return {"rule": self.rule, "path": self.path, "detail": self.detail}


# Every floor names the failure it exists for. A check whose pass and whose
# nothing-was-measured look identical is worse than no check: `gn gen` failing
# and `gn check` then reporting "0 errors" is the same shape, and is finding §7.
def vacuity_floors(measurement: Measurement, allowlist: Allowlist) -> list[Violation]:
    violations: list[Violation] = []
    live = [entry for entry in allowlist.entries.values() if not entry.planned]

    if not live:
        violations.append(
            Violation(
                "vacuity",
                "tools/upstream.allowlist",
                [
                    "the allowlist declares no LIVE entries, only planned ones.",
                    "Nothing could have been judged against it.",
                ],
            )
        )
    if measurement.modified_count == 0:
        violations.append(
            Violation(
                "vacuity",
                measurement.chromium_src,
                [
                    "zero Chromium-owned files differ from the locked commit.",
                    "A wrong path, a moved checkout or a base that is not the one",
                    "the tree was built from all look like this. It is not 'no delta'.",
                ],
            )
        )
    if not measurement.deltas:
        violations.append(
            Violation(
                "vacuity",
                measurement.chromium_src,
                [
                    "the integration delta covers zero files.",
                    "Either every //astro hook has vanished from the tree, or the",
                    "subtraction over-matched and swallowed the delta it was measuring.",
                    "Both are failures; neither is a pass.",
                ],
            )
        )
    if measurement.parse_mismatch:
        violations.append(
            Violation(
                "vacuity",
                measurement.chromium_src,
                [
                    "{} path(s) git reported as modified produced no diff text:".format(
                        len(measurement.parse_mismatch)
                    )
                ]
                + ["  " + path for path in measurement.parse_mismatch[:10]]
                + ["A file whose diff was not parsed reads as 'no delta' and must not."],
            )
        )
    return violations


def pair_substitutions(
    allowlist: Allowlist, delta: FileDelta
) -> tuple[list[str], collections.Counter, list[Substitution]]:
    """Pair each removed line with its recomposed form among the added lines.

    Returns the removals nothing accounted for, the added lines that were NOT
    the image of one, and the substitutions that fired.

    The pairing is what makes this a proof rather than a permission. A record
    accounts for a removal only when the substituted line is present as an
    addition, so a removal that simply DELETED the literal — the shape the
    whole rule exists to catch — matches nothing and is reported exactly as if
    no record existed.
    """
    records = allowlist.substitutions_for(delta.path)
    available = collections.Counter(delta.added)
    unpaired: list[str] = []
    fired: list[Substitution] = []

    for line in delta.removed:
        image = line
        used: list[Substitution] = []
        for record in records:
            if record.source in image:
                image = image.replace(record.source, record.target)
                used.append(record)
        if used and image != line and available[image] > 0:
            available[image] -= 1
            for record in used:
                record.matched += 1
                if record not in fired:
                    fired.append(record)
        else:
            unpaired.append(line)

    return unpaired, available, fired


def offending_added_lines(entry: Entry, added: list[str]) -> list[str]:
    """Added lines that do not have the shape the entry declares.

    Line comments are exempt (they express nothing), and `call-hook` judges the
    block rather than each line — see CALL_HOOK_SCAFFOLD for why an override of
    an upstream virtual cannot satisfy a per-line rule.
    """
    comment = SHAPE_COMMENT.get(entry.shape)
    syntax = SHAPE_SYNTAX.get(entry.shape)
    offending: list[str] = []

    for line in added:
        if comment is not None and comment.match(line):
            continue
        if entry.shape == "call-hook":
            if ASTRO_MODULE_REFERENCE.search(line) or CALL_HOOK_SCAFFOLD.match(line):
                continue
            offending.append(line)
            continue
        if entry.requires_module_reference and not ASTRO_MODULE_REFERENCE.search(line):
            offending.append(line)
            continue
        if syntax is not None and syntax.match(line) is None:
            offending.append(line)
    return offending


def judge(measurement: Measurement, allowlist: Allowlist) -> list[Violation]:
    entries = allowlist.entries
    violations = vacuity_floors(measurement, allowlist)

    for path, delta in sorted(measurement.deltas.items()):
        entry = entries.get(path)

        if entry is None:
            violations.append(
                Violation(
                    "undeclared",
                    path,
                    [
                        "modified by the //astro integration with no entry in "
                        "tools/upstream.allowlist.",
                        "+{} / -{} line(s) that no patch in the declared series "
                        "accounts for.".format(len(delta.added), len(delta.removed)),
                        "Declare it with an owner, an issue and a cap, or stop "
                        "modifying it.",
                    ]
                    + ["  + " + line for line in delta.added[:8]]
                    + ["  - " + line for line in delta.removed[:8]],
                )
            )
            continue

        if entry.planned:
            violations.append(
                Violation(
                    "planned-hook-landed",
                    path,
                    [
                        "declared `planned` for issue #{} and now carries an "
                        "integration delta of +{} / -{}.".format(
                            entry.issue, len(delta.added), len(delta.removed)
                        ),
                        "A planned entry grants nothing. Promote it to a live shape "
                        "in tools/upstream.allowlist:{} and confirm its cap.".format(
                            entry.line
                        ),
                    ],
                )
            )
            continue

        # A removal is never permitted by a SHAPE, and no attribute can grant
        # one. 007-oxy-auth-build-hook.patch was 7 added lines against 36
        # removed, and what those 36 removed was Safe Browsing notification
        # content detection, accessibility, Screen AI and the dangerous-download
        # UI. It would have passed a path-only allowlist without comment.
        #
        # The two ways a removal may be accounted for are declarations of the
        # exact line, one at a time, reviewed beside the entry that owns the
        # file: `substitute`, which pairs the removal with its recomposed form
        # among the additions, and `remove`, which blesses one line outright.
        # Neither widens a shape; both are subtracted here and whatever is left
        # is the same refusal as before.
        unpaired, remaining_added, fired = pair_substitutions(allowlist, delta)
        delta.substituted = len(delta.removed) - len(unpaired)
        counted_added = sorted(remaining_added.elements())
        delta.counted_added = len(counted_added)

        declared = collections.Counter(
            record.line for record in allowlist.removals.get(path, [])
        )
        undeclared_removed = sorted((collections.Counter(unpaired) - declared).elements())
        unused_declarations = collections.Counter(declared) - collections.Counter(unpaired)

        if undeclared_removed:
            violations.append(
                Violation(
                    "removal",
                    path,
                    [
                        "{} upstream line(s) removed that nothing declares. No "
                        "shape permits this, and no attribute can grant it.".format(
                            len(undeclared_removed)
                        ),
                        "Owner: {}, issue #{}.".format(entry.owner, entry.issue),
                        "Declare each one in tools/upstream.allowlist with a "
                        "`remove` record carrying its reason, or with a "
                        "`substitute` record that pairs it with the line it was "
                        "recomposed into.",
                    ]
                    + ["  - " + line for line in undeclared_removed],
                )
            )

        # The other direction. A removal declaration whose line is no longer
        # removed is a standing permission nobody is using, and it would silently
        # pre-authorise that line's removal for whoever touches the file next.
        if unused_declarations:
            violations.append(
                Violation(
                    "stale-removal",
                    path,
                    [
                        "{} `remove` declaration(s) name a line the integration "
                        "no longer removes:".format(sum(unused_declarations.values())),
                    ]
                    + ["  - " + line for line in sorted(unused_declarations.elements())]
                    + [
                        "Delete the declaration in the same change that stopped "
                        "removing the line."
                    ],
                )
            )

        for record in allowlist.substitutions.get(path, []):
            if record not in fired:
                violations.append(
                    Violation(
                        "stale-substitution",
                        path,
                        [
                            "the substitution declared at "
                            "tools/upstream.allowlist:{} paired nothing.".format(
                                record.number
                            ),
                            "  from |{}".format(record.source),
                            "  to   |{}".format(record.target),
                            "Either the refactor was undone, or the recomposed "
                            "lines are not in the file it names. A record that "
                            "matches nothing checks nothing.",
                        ],
                    )
                )
                continue
            if record.guard not in delta.added:
                violations.append(
                    Violation(
                        "substitution-guard",
                        path,
                        [
                            "{} accounted for {} removed line(s), but the "
                            "`#define` giving {} its default is not among the "
                            "added lines:".format(
                                "the substitution at tools/upstream.allowlist:{}".format(
                                    record.number
                                ),
                                record.matched,
                                record.macro,
                            ),
                            "  guard |{}".format(record.guard),
                            "Without it the literal has left the file and the "
                            "macro is supplied from somewhere else entirely, "
                            "which is a behaviour change and not a refactor.",
                        ],
                    )
                )

        if delta.counted_added > entry.max_added:
            violations.append(
                Violation(
                    "cap",
                    path,
                    [
                        "{} added line(s) against a declared max-added of {}.".format(
                            delta.counted_added, entry.max_added
                        ),
                        "Owner: {}, issue #{}, declared at "
                        "tools/upstream.allowlist:{}.".format(
                            entry.owner, entry.issue, entry.line
                        ),
                        "Raising the cap is a reviewed change to that file.",
                    ],
                )
            )

        # The block-level floor, and it is new. Every shape that claims to bound
        # a hook must actually contain one: comments are exempt from the
        # per-line rule below, so without this an entry whose whole delta is
        # commentary — or, for a call-hook, scaffolding — passes the shape check
        # having referenced //astro nowhere.
        if entry.requires_module_reference and counted_added and not any(
            ASTRO_MODULE_REFERENCE.search(line) for line in counted_added
        ):
            violations.append(
                Violation(
                    "shape",
                    path,
                    [
                        "declared `{}`, but not one of its {} added line(s) names "
                        "the //astro module.".format(entry.shape, len(counted_added)),
                        "A hook that references nothing is not a hook, and this "
                        "shape exists to bound one.",
                    ]
                    + ["  + " + line for line in counted_added[:8]],
                )
            )

        offending = offending_added_lines(entry, counted_added)
        if offending:
            violations.append(
                Violation(
                    "shape",
                    path,
                    [
                        "declared `{}`, but {} added line(s) do not have that "
                        "shape:".format(entry.shape, len(offending))
                    ]
                    + ["  + " + line for line in offending[:8]]
                    + [
                        "A `{}` may only add lines that name the //astro module "
                        "in that syntax.".format(entry.shape)
                    ],
                )
            )

    # A permission nobody uses is a permission nobody reviews, and it silently
    # pre-authorises whatever lands there next. Planned entries are exempt by
    # construction: having no delta is what `planned` means.
    for path, entry in sorted(entries.items()):
        if entry.planned or path in measurement.deltas:
            continue
        violations.append(
            Violation(
                "stale",
                path,
                [
                    "declared at tools/upstream.allowlist:{} but the integration "
                    "modifies nothing in it.".format(entry.line),
                    "Remove the entry, or demote it to `planned` if the hook is "
                    "still expected.",
                ],
            )
        )

    if measurement.unattributed_deletions:
        violations.append(
            Violation(
                "deleted-file",
                measurement.chromium_src,
                [
                    "{} file(s) deleted from the Chromium tree that "
                    "patches/ungoogled/pruning.list does not declare:".format(
                        len(measurement.unattributed_deletions)
                    )
                ]
                + ["  " + path for path in measurement.unattributed_deletions[:20]],
            )
        )

    if measurement.unattributed_untracked:
        violations.append(
            Violation(
                "new-file",
                measurement.chromium_src,
                [
                    "{} new path(s) in the Chromium tree that neither the patch "
                    "series nor tools/overlay.allowlist declares:".format(
                        len(measurement.unattributed_untracked)
                    )
                ]
                + ["  " + path for path in measurement.unattributed_untracked[:20]]
                + [
                    "Astro source belongs in //astro, which is a separate checkout "
                    "at src/astro."
                ],
            )
        )

    return violations


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------


def render(measurement: Measurement, allowlist: Allowlist, violations: list[Violation]) -> str:
    entries = allowlist.entries
    out: list[str] = []
    out.append("=== Astro downstream delta ===")
    out.append("Chromium checkout : {}".format(measurement.chromium_src))
    out.append("Locked base       : {}".format(measurement.base))
    out.append("Checkout HEAD     : {}".format(measurement.head))
    out.append("")
    out.append("Tree against the locked commit:")
    out.append("  modified files      {}".format(measurement.modified_count))
    out.append("  deleted files       {}  (declared by pruning.list: {})".format(
        measurement.deleted_count,
        measurement.deleted_count - len(measurement.unattributed_deletions),
    ))
    out.append("  new untracked paths {}".format(measurement.untracked_count))
    out.append("  patches subtracted  {}".format(measurement.patch_count))
    # Printed even when zero. The counts above used to be superproject-only and
    # said nothing about it, so a tree whose submodules carried the last run's
    # patches produced a report that looked complete.
    out.append("  submodules descended into {}".format(
        len(measurement.submodules_scanned)
    ))
    out.append("")

    added = sum(len(delta.added) for delta in measurement.deltas.values())
    removed = sum(len(delta.removed) for delta in measurement.deltas.values())
    whitespace = sum(
        delta.whitespace_added + delta.whitespace_removed
        for delta in measurement.deltas.values()
    )

    out.append("//astro integration delta — what no declaration accounts for:")
    out.append("")
    # `+` is what the cap judges — added lines that are not the recomposed form
    # of a removed one. `~` is how many removals a declared substitution paired
    # off. Showing the raw addition count in the capped column would report a
    # file as enormous for lines that are the same lines it also removed.
    out.append("  {:<52} {:>7} {:>7} {:>5}  {:<14} {:<12} {}".format(
        "FILE", "+", "-", "~", "SHAPE", "OWNER", "CAP"))
    for path, delta in sorted(measurement.deltas.items()):
        entry = entries.get(path)
        out.append("  {:<52} {:>7} {:>7} {:>5}  {:<14} {:<12} {}".format(
            path,
            delta.counted_added,
            len(delta.removed),
            delta.substituted,
            entry.shape if entry else "UNDECLARED",
            entry.owner if entry else "-",
            entry.max_added if entry else "-",
        ))
    out.append("")
    # The total-removed line is printed even though the gate forbids removals,
    # because a reader should be able to confirm it is 0 rather than infer it
    # from a rule.
    out.append("  files {}    added {}    removed {}".format(
        len(measurement.deltas), added, removed))
    out.append("  whitespace-only lines excluded from caps and the removal rule: {}".format(
        whitespace))
    # Printed unconditionally, including as zero: a reader must be able to see
    # that nothing was excused rather than infer it from the absence of a line.
    out.append("  removals paired with their recomposed line by a declared "
               "substitution: {}".format(
                   sum(delta.substituted for delta in measurement.deltas.values())))
    out.append("  removals blessed one line at a time by a `remove` record: {}".format(
        sum(len(records) for records in allowlist.removals.values())))

    planned = [entry for entry in entries.values() if entry.planned]
    if planned:
        out.append("")
        out.append("Planned hooks (declared, capped, granting nothing):")
        for entry in sorted(planned, key=lambda item: item.path):
            out.append("  {:<52} issue #{:<4} cap {}".format(
                entry.path, entry.issue, entry.max_added))

    out.append("")
    if violations:
        out.append("=== {} violation(s) ===".format(len(violations)))
        for violation in violations:
            out.append("")
            out.append("[{}] {}".format(violation.rule, violation.path))
            for line in violation.detail:
                out.append("    " + line)
    else:
        out.append("=== no violations ===")
    return "\n".join(out)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--chromium-src", required=True)
    parser.add_argument("--base", required=True)
    parser.add_argument("--allowlist", required=True)
    parser.add_argument("--patches", required=True)
    parser.add_argument("--overlay-allowlist", required=True)
    parser.add_argument("--json", default="")
    parser.add_argument(
        "--report",
        action="store_true",
        help="print the delta and exit 0 whatever the verdict",
    )
    arguments = parser.parse_args(argv)

    try:
        allowlist = load_allowlist(Path(arguments.allowlist))
        measurement = measure(
            Path(arguments.chromium_src),
            arguments.base,
            Path(arguments.patches),
            Path(arguments.overlay_allowlist),
        )
    except DeltaError as error:
        sys.stderr.write("unmeasurable: {}\n".format(error))
        return 2

    violations = judge(measurement, allowlist)
    sys.stdout.write(render(measurement, allowlist, violations) + "\n")

    if arguments.json:
        document = {
            "tool": "tools/lib/upstream_delta.py",
            "chromium_src": measurement.chromium_src,
            "base": measurement.base,
            "head": measurement.head,
            "tree": {
                "modified_files": measurement.modified_count,
                "deleted_files": measurement.deleted_count,
                "untracked_paths": measurement.untracked_count,
                "patches_subtracted": measurement.patch_count,
                "submodules_scanned": measurement.submodules_scanned,
            },
            "integration_delta": [
                delta.as_dict() for _, delta in sorted(measurement.deltas.items())
            ],
            "violations": [violation.as_dict() for violation in violations],
            "verdict": "clean" if not violations else "violations",
        }
        Path(arguments.json).write_text(
            json.dumps(document, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )

    if arguments.report:
        return 0
    return 1 if violations else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
