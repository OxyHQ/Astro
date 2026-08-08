#!/usr/bin/env bash
# generate-provenance.sh — record exactly what a build was made from.
#
# Provenance is read from WHAT IS ON DISK, never from browser.lock.json. The
# two can disagree — that disagreement is the interesting fact, and this script
# reports it rather than smoothing it over. A provenance file generated from
# the lock would only ever restate the lock, and would certify a stale runner
# as correct.
#
# Usage:
#   tools/generate-provenance.sh [options]
#
#   --output FILE     Where to write (default: build/reports/provenance.json)
#   --gn-args FILE    GN args file used for this build
#   --platform NAME   Target platform (linux, windows, macos, android, ...)
#   --build-type NAME Release or Debug
#   --overlay-manifest FILE
#                     Manifest written by tools/sync-overlay.sh, which records
#                     whether the overlay came from the commit being built
#                     (default: build/reports/overlay-manifest.json)
#   --require-match   Exit non-zero if any on-disk revision differs from the
#                     lock, or if the overlay did not come from a commit.
#                     Release builds use this.

ASTRO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ASTRO_ROOT
# shellcheck source=tools/lib/astro-common.sh
source "$ASTRO_ROOT/tools/lib/astro-common.sh"

LOCK_FILE="$ASTRO_ROOT/browser.lock.json"
OUTPUT=""
GN_ARGS_FILE=""
PLATFORM="unknown"
BUILD_TYPE="unknown"
REQUIRE_MATCH=0
CHROMIUM_SRC_OPT=""
DEPOT_TOOLS_DIR="$ASTRO_ROOT/depot_tools"
UNGOOGLED_DIR="$ASTRO_ROOT/.ungoogled-chromium"
OVERLAY_MANIFEST="$ASTRO_REPORT_DIR/overlay-manifest.json"

while [ $# -gt 0 ]; do
    case "$1" in
        --output)        shift; OUTPUT="${1:?--output needs a file}" ;;
        --gn-args)       shift; GN_ARGS_FILE="${1:?--gn-args needs a file}" ;;
        --platform)      shift; PLATFORM="${1:?--platform needs a name}" ;;
        --build-type)    shift; BUILD_TYPE="${1:?--build-type needs a name}" ;;
        --lock)          shift; LOCK_FILE="${1:?--lock needs a file}" ;;
        --chromium-src)  shift; CHROMIUM_SRC_OPT="${1:?--chromium-src needs a directory}" ;;
        --depot-tools)   shift; DEPOT_TOOLS_DIR="${1:?--depot-tools needs a directory}" ;;
        --ungoogled)     shift; UNGOOGLED_DIR="${1:?--ungoogled needs a directory}" ;;
        --overlay-manifest) shift; OVERLAY_MANIFEST="${1:?--overlay-manifest needs a file}" ;;
        --require-match) REQUIRE_MATCH=1 ;;
        -h|--help)
            sed -n '2,27p' "${BASH_SOURCE[0]}" >&2
            exit 0
            ;;
        *) astro::die "Unknown argument: $1" ;;
    esac
    shift
done

astro::require_cmd git python3
astro::require_file "$LOCK_FILE" "lock file"

if [ -z "$OUTPUT" ]; then
    OUTPUT="$(astro::report_dir)/provenance.json"
fi

astro::resolve_chromium_src "$CHROMIUM_SRC_OPT"
CHROMIUM_SRC="$ASTRO_RESOLVED_CHROMIUM_SRC"

# --------------------------------------------------------------------------
# On-disk revisions
# --------------------------------------------------------------------------

# Echoes "<commit> <dirty|clean>" for a checkout, or "absent absent".
disk_revision() {
    local dir="$1"
    if [ ! -d "$dir/.git" ]; then
        printf 'absent absent\n'
        return 0
    fi
    local commit state
    commit="$(git -C "$dir" rev-parse HEAD)"
    if [ -n "$(git -C "$dir" status --porcelain --untracked-files=no)" ]; then
        state="dirty"
    else
        state="clean"
    fi
    printf '%s %s\n' "$commit" "$state"
}

read -r CHROMIUM_DISK CHROMIUM_STATE <<< "$(disk_revision "$CHROMIUM_SRC")"
read -r DEPOT_DISK DEPOT_STATE <<< "$(disk_revision "$DEPOT_TOOLS_DIR")"
read -r UNGOOGLED_DISK UNGOOGLED_STATE <<< "$(disk_revision "$UNGOOGLED_DIR")"
read -r ASTRO_DISK ASTRO_STATE <<< "$(disk_revision "$ASTRO_ROOT")"

# --------------------------------------------------------------------------
# Toolchain identity
#
# The compiler is part of the build's identity: the same sources with a
# different clang produce a different binary.
# --------------------------------------------------------------------------

COMPILER_PATH="$CHROMIUM_SRC/third_party/llvm-build/Release+Asserts/bin/clang++"
if [ -x "$COMPILER_PATH" ]; then
    COMPILER_VERSION="$("$COMPILER_PATH" --version | head -1)"
elif command -v clang++ >/dev/null; then
    COMPILER_PATH="$(command -v clang++)"
    COMPILER_VERSION="$(clang++ --version | head -1)"
    astro::warn "optional:hermetic-compiler" \
        "Chromium's bundled clang not found; recording the system compiler at $COMPILER_PATH"
else
    COMPILER_PATH="unknown"
    COMPILER_VERSION="unknown"
    astro::warn "optional:hermetic-compiler" "no clang++ found; compiler identity is unknown"
fi

HOST_ARCH="$(uname -m)"
HOST_OS="$(uname -s)"

# --------------------------------------------------------------------------
# Emit
# --------------------------------------------------------------------------

mkdir -p "$(dirname "$OUTPUT")"

python3 - \
    "$OUTPUT" "$LOCK_FILE" "$ASTRO_ROOT/tools/lib/lock.py" \
    "$CHROMIUM_SRC" "$CHROMIUM_DISK" "$CHROMIUM_STATE" \
    "$DEPOT_DISK" "$DEPOT_STATE" \
    "$UNGOOGLED_DISK" "$UNGOOGLED_STATE" \
    "$ASTRO_DISK" "$ASTRO_STATE" \
    "$PLATFORM" "$BUILD_TYPE" "$GN_ARGS_FILE" \
    "$COMPILER_PATH" "$COMPILER_VERSION" "$HOST_OS" "$HOST_ARCH" \
    "$REQUIRE_MATCH" "$OVERLAY_MANIFEST" <<'PY'
import hashlib
import importlib.util
import json
import os
import sys

(output, lock_path, lock_module_path, chromium_src, chromium_disk,
 chromium_state, depot_disk, depot_state, ungoogled_disk, ungoogled_state,
 astro_disk, astro_state, platform, build_type, gn_args_file, compiler_path,
 compiler_version, host_os, host_arch, require_match,
 overlay_manifest_path) = sys.argv[1:22]

spec = importlib.util.spec_from_file_location("astro_lock", lock_module_path)
lock_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lock_module)

lock = lock_module.load_validated(
    __import__("pathlib").Path(lock_path),
    __import__("pathlib").Path(lock_path).parent / "browser.lock.schema.json",
)

def locked(name):
    entry = lock.get(name)
    return entry["commit"] if entry else None

sources = {
    "chromium": {
        "locked": locked("chromium"),
        "on_disk": chromium_disk,
        "worktree": chromium_state,
        "version": lock["chromium"]["version"],
        "path": chromium_src,
    },
    "depot_tools": {
        "locked": locked("depot_tools"),
        "on_disk": depot_disk,
        "worktree": depot_state,
    },
    "ungoogled_chromium": {
        "locked": locked("ungoogled_chromium"),
        "on_disk": ungoogled_disk,
        "worktree": ungoogled_state,
    },
    # Astro's own revision is resolved here rather than recorded in the lock:
    # a file cannot contain the hash of the commit that contains it.
    "astro": {
        "locked": None,
        "on_disk": astro_disk,
        "worktree": astro_state,
    },
}

third_party = {}
for name, entry in lock.get("third_party", {}).items():
    third_party[name] = {
        "pinned": entry.get("pinned", False),
        "commit": entry.get("commit"),
        "reason": entry.get("reason"),
    }

drift = [
    f"{name}: locked {info['locked']}, on disk {info['on_disk']}"
    for name, info in sources.items()
    if info["locked"] and info["on_disk"] != info["locked"]
]
dirty = [name for name, info in sources.items() if info["worktree"] == "dirty"]

# --------------------------------------------------------------------------
# Overlay state
#
# The overlay is Astro's own contribution to the build, and it is COPIED from
# the working tree rather than checked out, so the Astro revision recorded
# above does not describe it: an untracked file under src/ is invisible to
# `git status --untracked-files=no`, and an ignored one is invisible to git
# status entirely, yet both are copied into Chromium.
#
# tools/sync-overlay.sh measures it and records the verdict; this reads that
# record. A missing or unreadable manifest is reported as "unmeasured", never
# as "clean" — a check whose pass and whose nothing-was-measured look the same
# certifies nothing.
# --------------------------------------------------------------------------

overlay = {
    "manifest": overlay_manifest_path,
    "state": "unmeasured",
    "clean": False,
    "revision": None,
    "override": False,
    "reason": (
        f"no overlay manifest at {overlay_manifest_path}; "
        "tools/sync-overlay.sh did not run for this build"
    ),
    "differences": [],
}

try:
    with open(overlay_manifest_path, encoding="utf-8") as handle:
        overlay_manifest = json.load(handle)
except FileNotFoundError:
    pass
except (json.JSONDecodeError, OSError) as error:
    overlay["reason"] = f"overlay manifest {overlay_manifest_path} is unreadable: {error}"
else:
    recorded = overlay_manifest.get("source_state")
    if not isinstance(recorded, dict):
        overlay["reason"] = (
            f"{overlay_manifest_path} records no source_state; it was written by an "
            "older tools/sync-overlay.sh"
        )
    else:
        overlay.update(
            {
                "state": recorded.get("state", "unmeasured"),
                "clean": bool(recorded.get("clean")),
                "revision": recorded.get("revision"),
                "override": bool(recorded.get("override")),
                "reason": recorded.get("reason"),
                "differences": recorded.get("differences", []),
            }
        )

not_reproducible = []
not_reproducible += [f"source drift — {line}" for line in drift]
not_reproducible += [f"dirty worktree — {name} has uncommitted changes" for name in dirty]

if overlay["state"] == "dirty":
    listed = ", ".join(
        f"{entry.get('overlay_path')} ({entry.get('classification')})"
        for entry in overlay["differences"]
    )
    not_reproducible.append(
        f"dirty overlay — {len(overlay['differences'])} overlay path(s) differ from "
        f"HEAD {overlay['revision']}: {listed}"
    )
elif overlay["state"] != "clean":
    not_reproducible.append(f"overlay {overlay['state']} — {overlay['reason']}")

gn_args = None
if gn_args_file and os.path.isfile(gn_args_file):
    with open(gn_args_file, encoding="utf-8") as handle:
        content = handle.read()
    gn_args = {
        "path": gn_args_file,
        "sha256": hashlib.sha256(content.encode("utf-8")).hexdigest(),
        # The literal args, not just a hash: a hash proves two builds match but
        # does not tell anyone what either was built with.
        "args": [
            line.strip() for line in content.splitlines()
            if line.strip() and not line.strip().startswith("#")
        ],
    }

document = {
    "schema": "astro-provenance/1",
    "sources": sources,
    "third_party": third_party,
    "target": {"platform": platform, "build_type": build_type},
    "host": {"os": host_os, "arch": host_arch},
    "toolchain": {"compiler": compiler_path, "compiler_version": compiler_version},
    "gn_args": gn_args,
    # Timestamps are deliberately excluded from the build inputs: embedding a
    # wall-clock time makes two builds of identical sources differ, which
    # defeats the reproducibility this file exists to record. CI's own run
    # metadata below carries the "when" instead.
    "timestamp_policy": "excluded-from-build-inputs",
    "ci": {
        "workflow": os.environ.get("GITHUB_WORKFLOW"),
        "run_id": os.environ.get("GITHUB_RUN_ID"),
        "run_attempt": os.environ.get("GITHUB_RUN_ATTEMPT"),
        "sha": os.environ.get("GITHUB_SHA"),
        "ref": os.environ.get("GITHUB_REF"),
    } if os.environ.get("GITHUB_RUN_ID") else None,
    "drift": drift,
    "dirty_worktrees": dirty,
    "overlay": overlay,
    # A single machine-readable verdict, plus the reasons behind it in the
    # same document. tools/package-release.sh reads these rather than
    # re-deriving them, so one place decides what "reproducible" means.
    "reproducible": not not_reproducible,
    "not_reproducible_because": not_reproducible,
}

with open(output, "w", encoding="utf-8") as handle:
    json.dump(document, handle, indent=2, sort_keys=True)
    handle.write("\n")

for line in drift:
    print(f"DRIFT {line}", file=sys.stderr)
for name in dirty:
    print(f"DIRTY {name} has uncommitted changes", file=sys.stderr)
for line in not_reproducible:
    print(f"NOT-REPRODUCIBLE {line}", file=sys.stderr)

if require_match == "1" and not_reproducible:
    print("\nERROR --require-match: this build is not reproducible.", file=sys.stderr)
    for line in not_reproducible:
        print(f"      {line}", file=sys.stderr)
    if drift or dirty:
        print(
            "      This build does not correspond to the lock. A release artifact must\n"
            "      record revisions that can be checked out again. Run\n"
            "      tools/sync-sources.sh, or commit the local changes.",
            file=sys.stderr,
        )
    if not overlay["clean"]:
        print(
            "      The overlay this build was made from did not come from a commit, so\n"
            "      the artifact cannot be reproduced from any revision. Commit the\n"
            "      overlay changes and rebuild.",
            file=sys.stderr,
        )
    sys.exit(1)
PY

astro::info "Provenance: $OUTPUT"
