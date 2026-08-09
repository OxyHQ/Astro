"""Read repository content as it is COMMITTED, never as the working tree has it.

Every document under `docs/astro-next/baseline/` and every fixture under
`test/astro-next/fixtures/` is generated, committed, and re-generated in CI by
`generate-all.sh --check`, which fails on any diff. That check is only worth
running if the generators are a function of something CI also has. They were
not: they read the working tree, so a baseline generated on a machine carrying
uncommitted work described a repository nobody else has, and a clean checkout
regenerated different documents.

The failure was silent in the worst way — the documents looked right, the check
passed on the machine that produced them, and it would have failed for everyone
else with a diff naming content they had never seen. So every read that feeds a
committed artefact goes through this module, which reads `HEAD` and fails loudly
if it cannot. There is deliberately no fall-back to the filesystem: falling back
silently is precisely how the bug happened.

`HEAD`, not the index and not the working tree, because `HEAD` is what a fresh
clone has. The workflow consequence is real and is documented in the baseline
README: commit the sources first, then regenerate and commit the documents.

Working-tree differences are not ignored — they are reported SEPARATELY, via
`working_tree_observations()`, to stderr and into the gitignored JSON under
`build/reports/`. They are never merged into a committed artefact.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from typing import Iterable, Sequence

REPO_ROOT = Path(__file__).resolve().parents[2]

# The revision every committed artefact is derived from. A constant rather than
# an option: a generator that can be pointed at an arbitrary revision produces
# documents whose provenance is an invocation detail nobody records. It stays
# the symbolic name in messages; git is asked about the commit it resolved to.
REVISION = "HEAD"

# The commit `REVISION` named the first time anybody asked, for the rest of the
# process.
#
# WHY THIS IS PINNED. Every read below is its own `git` invocation, so a run
# that asks for "HEAD" repeatedly is asking a question whose answer can change
# underneath it — and in this repository it does: several agents commit to one
# checkout in the same minute, and a generator takes seconds. Two reads landing
# on either side of somebody else's commit produce a document assembled from
# two different trees, which is worse than either, and reports a
# non-reproducing failure whose cause is gone by the time anyone looks. Pinning
# makes a run atomic against that, and costs one `rev-parse`.
_PINNED_COMMIT: str | None = None


class CommittedStateError(SystemExit):
    """Fatal, and always loud. Never caught to fall back to the working tree."""


def _git(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["git", "-C", str(REPO_ROOT), *args], capture_output=True, check=False
    )


def _rev() -> str:
    """The pinned commit — resolving and pinning it if nobody has yet.

    Lazy rather than import-time so importing this module never shells out,
    and so a caller that reads before calling `require_repository` is pinned
    too rather than silently left on a moving `HEAD`.
    """
    global _PINNED_COMMIT
    if _PINNED_COMMIT is None:
        _PINNED_COMMIT = require_repository()
    return _PINNED_COMMIT


def _fail(message: str, *hints: str) -> "CommittedStateError":
    lines = [f"ERROR {message}"]
    lines += [f"      {hint}" for hint in hints]
    return CommittedStateError("\n".join(lines))


def relative(path: Path | str) -> str:
    """A repository-relative POSIX path, which is what git addresses."""
    candidate = Path(path)
    if candidate.is_absolute():
        try:
            candidate = candidate.relative_to(REPO_ROOT)
        except ValueError as error:
            raise _fail(
                f"{path} is outside the repository, so it has no committed form",
                "Only paths inside the repository can feed a committed document.",
            ) from error
    return candidate.as_posix()


def require_repository() -> str:
    """The resolved commit, or a loud failure naming what is missing.

    Checked once up front so a generator run against a tarball, a shallow
    export or a repository with no commits says so in one line rather than
    failing later on whichever file it happened to read first.
    """
    result = _git("rev-parse", "--verify", f"{REVISION}^{{commit}}")
    if result.returncode != 0:
        raise _fail(
            f"cannot resolve {REVISION} in {REPO_ROOT}",
            "The baseline generators derive every committed artefact from",
            f"committed content ({REVISION}), so they need a git repository with",
            "at least one commit. They will not read the working tree instead.",
            result.stderr.decode("utf-8", "replace").strip(),
        )
    return result.stdout.decode("ascii").strip()


def exists(path: Path | str) -> bool:
    return _git("cat-file", "-e", f"{_rev()}:{relative(path)}").returncode == 0


def read_bytes(path: Path | str) -> bytes:
    name = relative(path)
    result = _git("show", f"{_rev()}:{name}")
    if result.returncode != 0:
        raise _fail(
            f"{name} is not present at {REVISION}",
            "This generator reads committed content only — it does not fall back",
            "to the working tree, because a baseline derived from uncommitted work",
            "cannot be reproduced by anyone else.",
            "If the file is new, commit it first; if it moved, update the tool.",
        )
    return result.stdout


def read_text(path: Path | str) -> str:
    return read_bytes(path).decode("utf-8", "replace")


def list_files(prefix: Path | str, suffixes: Sequence[str] | None = None) -> list[str]:
    """Every committed file under `prefix`, sorted, repository-relative.

    `git ls-tree HEAD` rather than `git ls-files`: `ls-files` reports the INDEX,
    which carries staged-but-uncommitted additions and removals, so a listing
    taken from it is not what a fresh clone sees either.
    """
    name = relative(prefix)
    result = _git("ls-tree", "-r", "--name-only", "-z", _rev(), "--", name)
    if result.returncode != 0:
        raise _fail(
            f"cannot list committed files under {name}",
            result.stderr.decode("utf-8", "replace").strip(),
        )
    paths = [
        entry
        for entry in result.stdout.decode("utf-8", "surrogateescape").split("\0")
        if entry
    ]
    if suffixes is not None:
        paths = [p for p in paths if Path(p).suffix in suffixes]
    return sorted(paths)


def file_sizes(prefix: Path | str) -> dict[str, int]:
    """Committed blob sizes under `prefix`, in one git call rather than one per file."""
    name = relative(prefix)
    result = _git("ls-tree", "-r", "--long", "-z", _rev(), "--", name)
    if result.returncode != 0:
        raise _fail(
            f"cannot size committed files under {name}",
            result.stderr.decode("utf-8", "replace").strip(),
        )
    sizes: dict[str, int] = {}
    for entry in result.stdout.decode("utf-8", "surrogateescape").split("\0"):
        if not entry:
            continue
        # "<mode> <type> <object> <size>\t<path>", size right-aligned with spaces.
        header, _, path = entry.partition("\t")
        fields = header.split()
        if len(fields) != 4 or fields[1] != "blob":
            continue
        sizes[path] = int(fields[3])
    return sizes


# ---------------------------------------------------------------------------
# Working-tree observations — reported, never merged into a committed artefact
# ---------------------------------------------------------------------------

_STATUS_TEXT = {
    "M": "modified",
    "T": "type changed",
    "A": "added, not committed",
    "D": "deleted",
    "R": "renamed",
    "C": "copied",
    "U": "unmerged",
    "?": "untracked",
}


# Which side of the set difference a status code puts a path on.
_ONLY_IN_WORKTREE = "only-in-worktree"
_ONLY_IN_HEAD = "only-in-head"
_DIFFERING = "differing-content"


def _line_deltas(names: Sequence[str]) -> dict[str, tuple[int | None, int | None]]:
    """Added/removed line counts per tracked path, `(None, None)` for binary."""
    result = _git("diff", "--numstat", "-z", _rev(), "--", *names)
    if result.returncode != 0:
        return {}
    fields = result.stdout.decode("utf-8", "surrogateescape").split("\0")
    deltas: dict[str, tuple[int | None, int | None]] = {}
    index = 0
    while index < len(fields):
        entry = fields[index]
        index += 1
        if not entry:
            continue
        parts = entry.split("\t")
        if len(parts) < 3:
            continue
        added, removed, path = parts[0], parts[1], parts[2]
        # A rename emits an empty path here, followed by the old and new names.
        if not path:
            if index + 1 >= len(fields):
                break
            path = fields[index + 1]
            index += 2
        deltas[path] = (
            None if added == "-" else int(added),
            None if removed == "-" else int(removed),
        )
    return deltas


def working_tree_observations(prefixes: Iterable[Path | str]) -> list[dict]:
    """The set difference between `HEAD` and the working tree, under `prefixes`.

    This is the half of the old behaviour worth keeping. An uncommitted overlay
    file is copied into Chromium by a local build and absent from a fresh clone,
    so two people building "the same" revision get different browsers — worth
    saying out loud. It just must not reach a committed document.

    Each entry records which side of the difference the path is on and, for
    content that exists on both sides, how much of it moved. A bare count would
    say a tree is dirty; this says what would change in the baseline if the work
    landed, which is the question anyone reading the report actually has.
    """
    names = [relative(prefix) for prefix in prefixes]
    result = _git(
        "status", "--porcelain=v1", "-z", "--untracked-files=all", "--", *names
    )
    if result.returncode != 0:
        raise _fail(
            "cannot read the working-tree status",
            result.stderr.decode("utf-8", "replace").strip(),
        )

    deltas = _line_deltas(names)
    fields = result.stdout.decode("utf-8", "surrogateescape").split("\0")
    observations: list[dict] = []
    index = 0
    while index < len(fields):
        entry = fields[index]
        index += 1
        if not entry:
            continue
        codes, path = entry[:2], entry[3:]
        # A rename or copy is followed by its origin path in its own field.
        if "R" in codes or "C" in codes:
            index += 1
        code = codes.replace(" ", "")[:1] or "?"
        if code in ("?", "A"):
            side = _ONLY_IN_WORKTREE
        elif code == "D":
            side = _ONLY_IN_HEAD
        else:
            side = _DIFFERING
        added, removed = deltas.get(path, (None, None))
        observations.append(
            {
                "path": path,
                "status": codes,
                "side": side,
                "description": _STATUS_TEXT.get(code, "differs from HEAD"),
                "lines_added": added,
                "lines_removed": removed,
            }
        )
    return sorted(observations, key=lambda entry: entry["path"])


def report_working_tree_observations(
    tool: str, observations: Sequence[dict], stream=sys.stderr
) -> None:
    """Render the set difference under a heading that cannot be read as baseline output."""
    if not observations:
        return

    print(
        f"WORKING-TREE DELTA vs {REVISION} ({len(observations)} path(s)) "
        f"— NOT part of the baseline.\n"
        f"          {tool} derives every committed artefact from {REVISION}. The paths\n"
        f"          below differ here, so a build or a reading taken from this tree does\n"
        f"          not match one from a clean checkout of the same revision. They are\n"
        f"          listed so it is visible which baseline findings would change if this\n"
        f"          work landed.",
        file=stream,
    )

    for side, heading in (
        (_ONLY_IN_WORKTREE, f"present in the working tree, absent from {REVISION}"),
        (_ONLY_IN_HEAD, f"present in {REVISION}, deleted from the working tree"),
        (_DIFFERING, f"present in both, content differs from {REVISION}"),
    ):
        group = [entry for entry in observations if entry["side"] == side]
        if not group:
            continue
        print(f"\n          {heading} ({len(group)}):", file=stream)
        for entry in group:
            if entry["lines_added"] is None:
                measure = ""
            else:
                measure = "+%d -%d" % (entry["lines_added"], entry["lines_removed"])
            print(f"            {measure:>10}  {entry['path']}", file=stream)
