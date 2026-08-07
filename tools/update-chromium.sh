#!/usr/bin/env bash
# update-chromium.sh — propose a Chromium revision update.
#
# Resolves a requested version to an exact commit at the origin, verifies the
# tag/commit relationship is consistent, updates browser.lock.json, and writes
# a change report. It never falls back to a nearby version.
#
# What it replaces (ASTRO-NEXT-002, issue #5): a script that exported
# CHROMIUM_VERSION and re-ran the fetch/sync/patch chain, in which
# sync-ungoogled.sh would silently accept a tag for a DIFFERENT Chromium major
# — or master — when the exact one did not exist. A "successful" update could
# therefore build against a patch set written for another browser version.
#
# Usage:
#   tools/update-chromium.sh <version>          Propose the update.
#   tools/update-chromium.sh <version> --apply  Also sync sources to it.
#
# The default is deliberately proposal-only: an update changes what the whole
# project compiles, so it lands as a reviewable lock diff plus a report, not as
# a side effect of running a script.

ASTRO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ASTRO_ROOT
# shellcheck source=tools/lib/astro-common.sh
source "$ASTRO_ROOT/tools/lib/astro-common.sh"

LOCK_FILE="$ASTRO_ROOT/browser.lock.json"
LOCK="$ASTRO_ROOT/tools/lib/lock.py"
NEW_VERSION=""
APPLY=0

while [ $# -gt 0 ]; do
    case "$1" in
        --apply) APPLY=1 ;;
        --lock)  shift; LOCK_FILE="${1:?--lock needs a file}" ;;
        -h|--help)
            printf 'Usage: %s <chromium-version> [--apply]\n' "$0" >&2
            printf 'Example: %s 147.0.7710.20\n' "$0" >&2
            exit 0
            ;;
        -*) astro::die "Unknown argument: $1" ;;
        *)  NEW_VERSION="$1" ;;
    esac
    shift
done

if [ -z "$NEW_VERSION" ]; then
    astro::die_with_hint \
        "No Chromium version given." \
        "Usage: tools/update-chromium.sh <chromium-version> [--apply]" \
        "Example: tools/update-chromium.sh 147.0.7710.20"
fi

if ! printf '%s' "$NEW_VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'; then
    astro::die_with_hint \
        "'$NEW_VERSION' is not a Chromium version." \
        "Expected four dot-separated numbers, e.g. 147.0.7710.20." \
        "A branch name or a partial version is not accepted: the update must" \
        "resolve to exactly one commit."
fi

astro::require_cmd git python3
astro::require_file "$LOCK_FILE" "lock file"

python3 "$LOCK" --validate "$LOCK_FILE" >&2

CURRENT_VERSION="$(python3 "$LOCK" --get chromium.version "$LOCK_FILE")"
CURRENT_COMMIT="$(python3 "$LOCK" --get chromium.commit "$LOCK_FILE")"
CHROMIUM_URL="$(python3 "$LOCK" --get chromium.url "$LOCK_FILE")"

astro::info "=== Chromium revision update ==="
astro::info "  current: $CURRENT_VERSION ($CURRENT_COMMIT)"
astro::info "  proposed: $NEW_VERSION"

if [ "$NEW_VERSION" = "$CURRENT_VERSION" ]; then
    astro::info "Already locked to $NEW_VERSION. Nothing to propose."
    exit 0
fi

# --------------------------------------------------------------------------
# Resolve the version to exactly one commit, or fail
# --------------------------------------------------------------------------

NEW_REF="refs/tags/$NEW_VERSION"
astro::info ">>> Resolving $NEW_REF at $CHROMIUM_URL"

LS_REMOTE="$(git ls-remote "$CHROMIUM_URL" "$NEW_REF" "$NEW_REF^{}")"

if [ -z "$LS_REMOTE" ]; then
    astro::die_with_hint \
        "Chromium $NEW_VERSION does not exist at $CHROMIUM_URL" \
        "" \
        "No nearby version is substituted. The previous implementation would" \
        "have fallen back to the newest tag sharing a major version, or to" \
        "master, and reported success — so a build could silently target a" \
        "different browser than the one requested." \
        "" \
        "Check the version at https://chromiumdash.appspot.com/releases"
fi

# An annotated tag advertises both the tag object and, as `^{}`, the commit it
# points at. The peeled value is the commit; comparing the unpeeled one gives a
# tag object SHA, which is not what any checkout would land on.
NEW_COMMIT="$(printf '%s\n' "$LS_REMOTE" | awk -v ref="$NEW_REF^{}" '$2 == ref {print $1}')"
TAG_OBJECT="$(printf '%s\n' "$LS_REMOTE" | awk -v ref="$NEW_REF" '$2 == ref {print $1}')"

if [ -z "$NEW_COMMIT" ]; then
    NEW_COMMIT="$TAG_OBJECT"
fi

if [ -z "$NEW_COMMIT" ]; then
    astro::die "Could not resolve $NEW_REF to a commit at $CHROMIUM_URL"
fi

if ! printf '%s' "$NEW_COMMIT" | grep -qE '^[0-9a-f]{40}$'; then
    astro::die "Resolved '$NEW_COMMIT' for $NEW_REF, which is not a commit SHA"
fi

# The tag/commit relationship must be internally consistent: an annotated tag
# whose peeled value is missing, or a ref advertising two different commits,
# means the remote is in a state no build should be pinned against.
COMMIT_COUNT="$(printf '%s\n' "$LS_REMOTE" | awk '{print $1}' | sort -u | wc -l | tr -d '[:space:]')"
if [ -n "$TAG_OBJECT" ] && [ "$TAG_OBJECT" != "$NEW_COMMIT" ] && [ "$COMMIT_COUNT" -gt 2 ]; then
    astro::die_with_hint \
        "$NEW_REF advertises an inconsistent set of objects at $CHROMIUM_URL:" \
        "$(printf '%s\n' "$LS_REMOTE" | sed 's/^/  /')"
fi

astro::info "  resolved: $NEW_COMMIT"

# --------------------------------------------------------------------------
# Update the lock and report the change
# --------------------------------------------------------------------------

REPORT_DIR="$(astro::report_dir)"
REPORT="$REPORT_DIR/chromium-update-$NEW_VERSION.json"

if astro::dry_run; then
    astro::plan "update $LOCK_FILE chromium to $NEW_VERSION ($NEW_COMMIT)"
    astro::plan "write $REPORT"
else
    python3 - "$LOCK_FILE" "$NEW_VERSION" "$NEW_COMMIT" "$NEW_REF" <<'PY'
import json, sys

lock_path, version, commit, ref = sys.argv[1:5]
with open(lock_path, encoding="utf-8") as handle:
    document = json.load(handle)

document["chromium"]["version"] = version
document["chromium"]["commit"] = commit
document["chromium"]["ref"] = ref

with open(lock_path, "w", encoding="utf-8") as handle:
    json.dump(document, handle, indent=2)
    handle.write("\n")
PY

    python3 "$LOCK" --validate "$LOCK_FILE" >&2

    python3 - "$REPORT" "$CURRENT_VERSION" "$CURRENT_COMMIT" \
             "$NEW_VERSION" "$NEW_COMMIT" "$CHROMIUM_URL" <<'PY'
import json, sys
report, old_version, old_commit, new_version, new_commit, url = sys.argv[1:7]
with open(report, "w", encoding="utf-8") as handle:
    json.dump({
        "kind": "chromium-update-proposal",
        "url": url,
        "from": {"version": old_version, "commit": old_commit},
        "to": {"version": new_version, "commit": new_commit},
        "compare": f"{url.removesuffix('.git')}/+log/{old_commit}..{new_commit}",
        "next_steps": [
            "Review the lock diff.",
            "Update ungoogled_chromium in the lock to the matching tag, and "
            "verify it exists — no nearby version is substituted.",
            "Run tools/sync-sources.sh to check out the new revision.",
            "Run tools/apply-patches.sh; patches that no longer apply exactly "
            "stop the run and are named in build/reports/patch-report.json.",
        ],
    }, handle, indent=2)
    handle.write("\n")
PY
    astro::info "Report: $REPORT"
fi

printf '\n=== Proposed update ===\n'
printf '  from  %s  %s\n' "$CURRENT_VERSION" "$CURRENT_COMMIT"
printf '  to    %s  %s\n' "$NEW_VERSION" "$NEW_COMMIT"
printf '=== end ===\n\n'

# --------------------------------------------------------------------------
# ungoogled-chromium must be updated deliberately, not guessed
# --------------------------------------------------------------------------

astro::warn "manual-step:ungoogled" \
    "ungoogled_chromium is still locked to its previous commit. Its tag for a new Chromium version is published separately and is NOT derivable from the Chromium version — update it in $LOCK_FILE and verify the tag exists."

if [ "$APPLY" = "1" ]; then
    astro::info ">>> --apply: syncing sources to the new revision"
    "$ASTRO_ROOT/tools/sync-sources.sh"
else
    astro::info "Proposal only. Review the lock diff, then run tools/sync-sources.sh."
fi
