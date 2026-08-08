#!/usr/bin/env bash
# Every worktree that shares a file must agree about its contents.
#
# This exists because the failure it catches is invisible to everything else.
# Twice in one session, two worktrees were each internally consistent, each had
# `tools/tests/run.sh` green, and disagreed about a file's bytes — and no gate
# could see it, because every gate reasons about ONE tree. The drift checker
# compares a C++ header against a manifest; it has no opinion about a second
# copy of that manifest somewhere else.
#
# Both instances were caused by the same thing: an integrator copying files
# between worktrees to place work on the right branch, and overwriting a newer
# version with an older one. The suite stayed green across the overwrite in
# both directions, so "green" never meant "these agree".
#
# One instance is worth stating because it shows why this is not bookkeeping: a
# document's rule numbering was corrected, verified, and then silently reverted
# by a later copy — while `scheme_constants.py`'s user-facing failure message
# cites "rule 9" by number. An ambiguous citation that LOOKS precise is worse
# than no citation, because the reader stops looking.
#
# The check needs no understanding of any file. It compares bytes.
#
# Usage:
#   tools/check-worktree-agreement.sh [--worktree DIR]...
#
# With no arguments it discovers every worktree git knows about.

ASTRO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ASTRO_ROOT
# shellcheck source=tools/lib/astro-common.sh
source "$ASTRO_ROOT/tools/lib/astro-common.sh"

WORKTREES=()

usage() {
    cat >&2 <<'EOF'
Usage: tools/check-worktree-agreement.sh [--worktree DIR]...

Compares the bytes of every file shared by two or more worktrees and fails when
any pair disagrees. With no --worktree arguments, every worktree git reports is
compared.

A disagreement is not automatically wrong — two branches legitimately differ.
It is reported so that a difference is a DECISION somebody made rather than the
residue of a copy that went the wrong way.

Environment:
  ASTRO_WORKTREE_COMPARE_PATHS   Space-separated path prefixes to compare
                                 (default: docs tools)
EOF
}

while [ $# -gt 0 ]; do
    case "$1" in
        --worktree) shift; WORKTREES+=("${1:?--worktree needs a directory}") ;;
        -h|--help)  usage; exit 0 ;;
        *)          usage; astro::die "Unknown argument: $1" ;;
    esac
    shift
done

if [ "${#WORKTREES[@]}" -eq 0 ]; then
    while IFS= read -r line; do
        case "$line" in
            worktree\ *) WORKTREES+=("${line#worktree }") ;;
        esac
    done < <(git -C "$ASTRO_ROOT" worktree list --porcelain)
fi

# A comparison over fewer than two trees compares nothing, and "nothing to
# compare" must not read as "they agree".
if [ "${#WORKTREES[@]}" -lt 2 ]; then
    astro::die_with_hint \
        "Only ${#WORKTREES[@]} worktree(s) found; there is nothing to compare." \
        "This check is vacuous with fewer than two trees, and a vacuous pass is" \
        "indistinguishable from a real one. Pass --worktree explicitly if you" \
        "meant to compare specific directories."
fi

COMPARE_PATHS="${ASTRO_WORKTREE_COMPARE_PATHS:-docs tools}"

astro::info "=== Worktree agreement ==="
for tree in "${WORKTREES[@]}"; do
    astro::info "  $tree"
done

python3 - "$COMPARE_PATHS" "${WORKTREES[@]}" <<'PY' || astro::die "worktrees disagree about shared files"
import hashlib
import pathlib
import sys

compare_paths = sys.argv[1].split()
trees = [pathlib.Path(p) for p in sys.argv[2:]]


def digest(path: pathlib.Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(1 << 20):
            hasher.update(chunk)
    return hasher.hexdigest()


# relative path -> {digest: [trees carrying it]}
seen: dict[str, dict[str, list[str]]] = {}
compared = 0

for tree in trees:
    if not tree.is_dir():
        print(f"      not a directory, skipped: {tree}")
        continue
    for prefix in compare_paths:
        root = tree / prefix
        if not root.is_dir():
            continue
        for path in root.rglob("*"):
            if not path.is_file() or path.is_symlink():
                continue
            # Bytecode and caches are regenerated per run and disagree by
            # design; comparing them would report noise every time and get the
            # check switched off, which is worse than not having it.
            if "__pycache__" in path.parts or path.suffix == ".pyc":
                continue
            relative = str(path.relative_to(tree))
            seen.setdefault(relative, {}).setdefault(digest(path), []).append(str(tree))

shared = {rel: by_digest for rel, by_digest in seen.items()
          if sum(len(v) for v in by_digest.values()) > 1}
compared = len(shared)

# The vacuity floor. A glob that stopped matching, a renamed directory or a
# wrong prefix would otherwise report "no disagreements" — which is the same
# output as success.
if compared == 0:
    print("      no file is shared by two or more worktrees.")
    print("      That is possible, but it is also what a broken traversal looks")
    print("      like, so it is reported rather than passed.")
    raise SystemExit(1)

disagreements = {rel: by_digest for rel, by_digest in shared.items() if len(by_digest) > 1}

print(f"      {compared} shared file(s) compared across {len(trees)} worktree(s).")

if not disagreements:
    raise SystemExit(0)

print(f"      {len(disagreements)} file(s) DISAGREE:")
for relative, by_digest in sorted(disagreements.items()):
    print(f"        {relative}")
    for value, owners in sorted(by_digest.items()):
        for owner in owners:
            print(f"          {value[:12]}  {owner}")
print()
print("      Two branches may legitimately differ. This is reported so the")
print("      difference is a decision somebody made, rather than the residue of")
print("      a copy that went the wrong way — which is how it arose both times")
print("      it has happened here.")
raise SystemExit(1)
PY

astro::info "=== Worktrees agree ==="
