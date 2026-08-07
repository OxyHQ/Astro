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
    # An include of an astro/ header, or a statement naming the astro::
    # namespace. Checked in addition to the module-reference requirement, so a
    # call-hook cannot smuggle in a GN label that happens to say //astro.
    "call-hook": re.compile(r'^\s*(?:#include\s+"astro/[^"]*"|.*\bastro::.*)$'),
}


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
    """
    fields = git(
        src, "diff", "--name-status", "-z", "--no-renames",
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


def load_allowlist(path: Path) -> dict[str, Entry]:
    """Parse tools/upstream.allowlist, or die naming the offending line.

    Every rejection here is one the overlay allowlist's parser already makes,
    for the same reasons: an unknown shape, an absolute or escaping path, and a
    missing owner or issue. An exception with no owner is not an exception, it
    is a leak.
    """
    if not path.is_file():
        raise DeltaError("upstream allowlist not found: {}".format(path))

    entries: dict[str, Entry] = {}
    for number, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
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

        attributes: dict[str, str] = {}
        for token in rest:
            if "=" not in token:
                raise DeltaError(
                    "{}:{}: attribute '{}' is not key=value".format(path, number, token)
                )
            key, value = token.split("=", 1)
            attributes[key] = value
        for required in REQUIRED_ATTRIBUTES:
            if not attributes.get(required):
                raise DeltaError(
                    "{}:{}: {} entries require {}=<value>".format(
                        path, number, shape, required
                    )
                )
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
    return entries


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

    @property
    def has_delta(self) -> bool:
        return bool(self.added or self.removed)

    def as_dict(self) -> dict:
        return {
            "path": self.path,
            "added": len(self.added),
            "removed": len(self.removed),
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

    # --- modified files ----------------------------------------------------
    modified = name_status(src, base, "M")
    measurement.modified_count = len(modified)
    counters = modified_line_counters(src, base, modified)

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
    deleted = name_status(src, base, "D")
    measurement.deleted_count = len(deleted)
    measurement.unattributed_deletions = sorted(
        path for path in deleted if path not in pruned
    )

    # --- untracked files ---------------------------------------------------
    untracked = untracked_paths(src)
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
def vacuity_floors(measurement: Measurement, entries: dict[str, Entry]) -> list[Violation]:
    violations: list[Violation] = []
    live = [entry for entry in entries.values() if not entry.planned]

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


def judge(measurement: Measurement, entries: dict[str, Entry]) -> list[Violation]:
    violations = vacuity_floors(measurement, entries)

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

        # A removal is never permitted, by any shape, and no attribute can
        # grant one. 007-oxy-auth-build-hook.patch was 7 added lines against 36
        # removed, and what those 36 removed was Safe Browsing notification
        # content detection, accessibility, Screen AI and the dangerous-download
        # UI. It would have passed a path-only allowlist without comment.
        if delta.removed:
            violations.append(
                Violation(
                    "removal",
                    path,
                    [
                        "{} upstream line(s) removed. No shape permits this, and "
                        "no attribute can grant it.".format(len(delta.removed)),
                        "Owner: {}, issue #{}.".format(entry.owner, entry.issue),
                    ]
                    + ["  - " + line for line in delta.removed],
                )
            )

        if len(delta.added) > entry.max_added:
            violations.append(
                Violation(
                    "cap",
                    path,
                    [
                        "{} added line(s) against a declared max-added of {}.".format(
                            len(delta.added), entry.max_added
                        ),
                        "Owner: {}, issue #{}, declared at "
                        "tools/upstream.allowlist:{}.".format(
                            entry.owner, entry.issue, entry.line
                        ),
                        "Raising the cap is a reviewed change to that file.",
                    ],
                )
            )

        offending = [
            line
            for line in delta.added
            if entry.requires_module_reference
            and not ASTRO_MODULE_REFERENCE.search(line)
        ]
        syntax = SHAPE_SYNTAX.get(entry.shape)
        if syntax is not None:
            offending += [
                line
                for line in delta.added
                if syntax.match(line) is None and line not in offending
            ]
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


def render(measurement: Measurement, entries: dict[str, Entry], violations: list[Violation]) -> str:
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
    out.append("")

    added = sum(len(delta.added) for delta in measurement.deltas.values())
    removed = sum(len(delta.removed) for delta in measurement.deltas.values())
    whitespace = sum(
        delta.whitespace_added + delta.whitespace_removed
        for delta in measurement.deltas.values()
    )

    out.append("//astro integration delta — what no declaration accounts for:")
    out.append("")
    out.append("  {:<52} {:>7} {:>7}  {:<14} {:<12} {}".format(
        "FILE", "+", "-", "SHAPE", "OWNER", "CAP"))
    for path, delta in sorted(measurement.deltas.items()):
        entry = entries.get(path)
        out.append("  {:<52} {:>7} {:>7}  {:<14} {:<12} {}".format(
            path,
            len(delta.added),
            len(delta.removed),
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
        entries = load_allowlist(Path(arguments.allowlist))
        measurement = measure(
            Path(arguments.chromium_src),
            arguments.base,
            Path(arguments.patches),
            Path(arguments.overlay_allowlist),
        )
    except DeltaError as error:
        sys.stderr.write("unmeasurable: {}\n".format(error))
        return 2

    violations = judge(measurement, entries)
    sys.stdout.write(render(measurement, entries, violations) + "\n")

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
