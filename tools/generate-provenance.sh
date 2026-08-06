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
#   --require-match   Exit non-zero if any on-disk revision differs from the
#                     lock. Release builds use this.

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
        --require-match) REQUIRE_MATCH=1 ;;
        -h|--help)
            sed -n '2,22p' "${BASH_SOURCE[0]}" >&2
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
    "$REQUIRE_MATCH" <<'PY'
import hashlib
import importlib.util
import json
import os
import sys

(output, lock_path, lock_module_path, chromium_src, chromium_disk,
 chromium_state, depot_disk, depot_state, ungoogled_disk, ungoogled_state,
 astro_disk, astro_state, platform, build_type, gn_args_file, compiler_path,
 compiler_version, host_os, host_arch, require_match) = sys.argv[1:21]

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
    "reproducible": not drift and not dirty,
}

with open(output, "w", encoding="utf-8") as handle:
    json.dump(document, handle, indent=2, sort_keys=True)
    handle.write("\n")

for line in drift:
    print(f"DRIFT {line}", file=sys.stderr)
for name in dirty:
    print(f"DIRTY {name} has uncommitted changes", file=sys.stderr)

if require_match == "1" and (drift or dirty):
    print(
        "\nERROR --require-match: this build does not correspond to the lock.\n"
        "      A release artifact must record revisions that can be checked out\n"
        "      again. Run tools/sync-sources.sh, or commit the local changes.",
        file=sys.stderr,
    )
    sys.exit(1)
PY

astro::info "Provenance: $OUTPUT"
