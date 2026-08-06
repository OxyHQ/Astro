#!/usr/bin/env bash
# sync-sources.sh — bring every source tree to exactly the revision
# browser.lock.json declares, or fail saying which one disagrees.
#
# This is the ONE synchronization command. Documentation and CI both run it,
# so there is no second implementation that can drift from the documented one.
#
# What it replaces (ASTRO-NEXT-002, issue #5):
#
#   * `cd depot_tools && git pull` — an unconstrained pull of the tool that
#     resolves every other revision, so it silently changed what every other
#     pin meant.
#   * `git checkout "tags/$VERSION" -B "astro-$VERSION"` — created a BRANCH,
#     so the checkout could drift away from the tag afterwards and nothing
#     would notice. The locked commit is now checked out detached.
#   * CI's `if [ ! -d chromium/src/.git ]; then fetch; else echo cached; fi` —
#     a self-hosted runner that had ever fetched Chromium compiled whatever
#     commit it happened to hold, forever, unvalidated.
#
# Usage:
#   tools/sync-sources.sh [options]
#
#   (no options)     Bring every tree to the locked revision.
#   --verify-only    Never write. Fail if anything differs from the lock.
#                    This is what CI runs before every build.
#   --dry-run        Print the plan; change nothing.
#   --no-deps        Check out sources but do not run `gclient sync`.
#
# A second invocation does no work beyond verification.

ASTRO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ASTRO_ROOT
# shellcheck source=tools/lib/astro-common.sh
source "$ASTRO_ROOT/tools/lib/astro-common.sh"

LOCK_FILE="$ASTRO_ROOT/browser.lock.json"
# ASTRO_CHROMIUM_SRC is honoured here as well as in
# astro::resolve_chromium_src: two defaults that can disagree is a bug waiting
# for whoever exports the variable.
CHROMIUM_SRC="${ASTRO_CHROMIUM_SRC:-$ASTRO_ROOT/chromium/src}"
CHROMIUM_DIR="$(dirname "$CHROMIUM_SRC")"
DEPOT_TOOLS_DIR="$ASTRO_ROOT/depot_tools"
UNGOOGLED_DIR="$ASTRO_ROOT/.ungoogled-chromium"
GCLIENT_TEMPLATE="$ASTRO_ROOT/tools/gclient.template"

VERIFY_ONLY=0
RUN_DEPS=1
TARGET_OS_LIST="${CROSS_TARGETS:-linux}"

usage() {
    cat >&2 <<'EOF'
Usage: tools/sync-sources.sh [options]

  --verify-only        Never write; fail if anything differs from the lock.
  --dry-run            Print the plan; change nothing.
  --no-deps            Check out sources but skip `gclient sync`.
  --lock FILE          Lock file (default: browser.lock.json)
  --chromium-src DIR   Chromium checkout (default: <repo>/chromium/src)
  --depot-tools DIR    depot_tools checkout
  --ungoogled DIR      ungoogled-chromium checkout
  --targets LIST       Space-separated gclient target_os (default: linux)
  -h, --help

Environment:
  ASTRO_ALLOW_DIRTY_CHROMIUM=1   Developer-only override for the unrelated
                                 local-changes guard. Never set in CI.
EOF
}

while [ $# -gt 0 ]; do
    case "$1" in
        --verify-only)   VERIFY_ONLY=1 ;;
        --dry-run)       ASTRO_DRY_RUN=1 ;;
        --no-deps)       RUN_DEPS=0 ;;
        --lock)          shift; LOCK_FILE="${1:?--lock needs a file}" ;;
        --chromium-src)  shift; CHROMIUM_SRC="${1:?--chromium-src needs a directory}"
                         CHROMIUM_DIR="$(dirname "$CHROMIUM_SRC")" ;;
        --depot-tools)   shift; DEPOT_TOOLS_DIR="${1:?--depot-tools needs a directory}" ;;
        --ungoogled)     shift; UNGOOGLED_DIR="${1:?--ungoogled needs a directory}" ;;
        --targets)       shift; TARGET_OS_LIST="${1:?--targets needs a list}" ;;
        -h|--help)       usage; exit 0 ;;
        *)               usage; astro::die "Unknown argument: $1" ;;
    esac
    shift
done

astro::require_cmd git python3

LOCK="$ASTRO_ROOT/tools/lib/lock.py"
astro::require_file "$LOCK" "lock reader"
astro::require_file "$LOCK_FILE" "lock file"

# --------------------------------------------------------------------------
# The lock is validated before anything else looks at it. An invalid lock is
# not a thing to partially act on.
# --------------------------------------------------------------------------

astro::info "=== Astro source sync ==="
if astro::dry_run; then
    astro::info "Mode: DRY RUN (no filesystem changes)"
elif [ "$VERIFY_ONLY" = "1" ]; then
    astro::info "Mode: VERIFY ONLY (no filesystem changes; differences are fatal)"
fi

python3 "$LOCK" --validate "$LOCK_FILE" >&2

lock_get() {
    python3 "$LOCK" --get "$1" "$LOCK_FILE"
}

# `ref` is optional: depot_tools is pinned to a commit on a moving branch and
# has no stable ref to record. A missing optional field is not an error.
lock_get_optional() {
    python3 "$LOCK" --get-optional "$1" "$LOCK_FILE"
}

CHROMIUM_COMMIT="$(lock_get chromium.commit)"
CHROMIUM_VERSION="$(lock_get chromium.version)"
CHROMIUM_URL="$(lock_get chromium.url)"
CHROMIUM_REF="$(lock_get_optional chromium.ref)"
DEPOT_TOOLS_COMMIT="$(lock_get depot_tools.commit)"
DEPOT_TOOLS_URL="$(lock_get depot_tools.url)"
UNGOOGLED_COMMIT="$(lock_get ungoogled_chromium.commit)"
UNGOOGLED_URL="$(lock_get ungoogled_chromium.url)"
UNGOOGLED_REF="$(lock_get_optional ungoogled_chromium.ref)"

# --------------------------------------------------------------------------
# Bringing one repository to a locked commit
# --------------------------------------------------------------------------

# Rejects the states a cached self-hosted runner accumulates. Each is reported
# separately: "something is wrong with the checkout" is not actionable.
assert_checkout_is_clean_enough() {
    local dir="$1" name="$2"
    local problems=""

    local dirty
    dirty="$(git -C "$dir" status --porcelain --untracked-files=all)"
    if [ -n "$dirty" ]; then
        local count
        count="$(printf '%s\n' "$dirty" | wc -l | tr -d '[:space:]')"
        problems="$problems
  $count uncommitted change(s) or untracked file(s)"
    fi

    local artifacts
    artifacts="$(find "$dir" -maxdepth 6 \( -name '*.rej' -o -name '*.orig' \) -print | head -5)"
    if [ -n "$artifacts" ]; then
        problems="$problems
  leftover patch artifacts: $(printf '%s' "$artifacts" | tr '\n' ' ')"
    fi

    # grep -c exits 1 when the count is zero, which cannot happen here (a
    # checkout always lists itself) but must not be swallowed if it ever does.
    local worktrees grep_status=0
    worktrees="$(git -C "$dir" worktree list --porcelain | grep -c '^worktree ')" || grep_status=$?
    if [ "$grep_status" -gt 1 ]; then
        astro::die "could not enumerate worktrees of $dir (grep exit $grep_status)"
    fi
    if [ "$worktrees" -gt 1 ]; then
        problems="$problems
  $worktrees linked worktrees; a shared checkout must not be mutated by several jobs"
    fi

    if [ -z "$problems" ]; then
        return 0
    fi

    if [ "${ASTRO_ALLOW_DIRTY_CHROMIUM:-0}" = "1" ] && [ "$VERIFY_ONLY" != "1" ]; then
        astro::warn "override:dirty-chromium" \
            "$name has local state, continuing because ASTRO_ALLOW_DIRTY_CHROMIUM=1:$problems"
        return 0
    fi

    astro::die_with_hint \
        "$name is not in a state this command may act on:$problems" \
        "" \
        "Astro preserves developer work by default, and a build must not start" \
        "from a tree nobody can describe." \
        "" \
        "Recovery steps: docs/recovery.mdx" \
        "Developer override: ASTRO_ALLOW_DIRTY_CHROMIUM=1 (never set in CI)"
}

# Reports the branch state a locked checkout must not be in. A branch can be
# advanced after the sync; a detached HEAD at a recorded SHA cannot.
report_head_state() {
    local dir="$1" name="$2"
    # symbolic-ref exits 1 on a detached HEAD, which is the desired state, so
    # the status is captured rather than swallowed; anything above 1 is a real
    # git failure and must not read as "detached".
    local branch status=0
    branch="$(git -C "$dir" symbolic-ref --quiet --short HEAD)" || status=$?
    if [ "$status" -gt 1 ]; then
        astro::die "could not read HEAD state of $dir (git exit $status)"
    fi
    if [ -n "$branch" ]; then
        astro::warn "checkout-on-branch" \
            "$name is on branch '$branch' rather than detached; it will be detached at the locked commit"
    fi
}

# Ensures <dir> is a git checkout of <url> sitting detached at <commit>.
sync_repository() {
    local dir="$1" url="$2" commit="$3" ref="$4" name="$5"

    if [ ! -d "$dir/.git" ]; then
        if [ "$VERIFY_ONLY" = "1" ]; then
            astro::die_with_hint \
                "$name is not present at $dir" \
                "--verify-only never creates a checkout." \
                "Run tools/sync-sources.sh without --verify-only to bootstrap it."
        fi
        if astro::dry_run; then
            astro::plan "clone $url -> $dir"
            astro::plan "checkout --detach $commit in $dir"
            return 0
        fi
        astro::info "  $name: cloning $url"
        git clone --quiet "$url" "$dir"
    fi

    local head
    head="$(git -C "$dir" rev-parse HEAD)"

    if [ "$head" = "$commit" ]; then
        # Right commit is not enough. A fresh clone lands on a BRANCH at the
        # same commit, and a branch can be advanced afterwards — by a stray
        # `git pull`, by another job, by gclient — with nothing noticing that
        # the build stopped being pinned. Detached HEAD at a recorded SHA
        # cannot move without an explicit checkout.
        assert_checkout_is_clean_enough "$dir" "$name"

        local branch status=0
        branch="$(git -C "$dir" symbolic-ref --quiet --short HEAD)" || status=$?
        if [ "$status" -gt 1 ]; then
            astro::die "could not read HEAD state of $dir (git exit $status)"
        fi

        if [ -z "$branch" ]; then
            astro::info "  $name: already at $commit (detached)"
            return 0
        fi

        if [ "$VERIFY_ONLY" = "1" ]; then
            astro::die_with_hint \
                "$name is at the locked commit but on branch '$branch', not detached." \
                "A branch can be advanced after the sync, so the checkout is not" \
                "actually pinned. Run tools/sync-sources.sh to detach it."
        fi
        if astro::dry_run; then
            astro::plan "detach $name at $commit (currently on branch $branch)"
            return 0
        fi
        astro::info "  $name: at $commit, detaching from branch '$branch'"
        git -C "$dir" checkout --quiet --detach "$commit"
        return 0
    fi

    if [ "$VERIFY_ONLY" = "1" ]; then
        astro::die_with_hint \
            "$name is at the wrong commit." \
            "  on disk: $head" \
            "  locked:  $commit" \
            "" \
            "This is the check a stale self-hosted runner must not pass. Run" \
            "tools/sync-sources.sh (without --verify-only) to correct it."
    fi

    assert_checkout_is_clean_enough "$dir" "$name"
    report_head_state "$dir" "$name"

    if astro::dry_run; then
        astro::plan "fetch $ref from $url in $dir"
        astro::plan "checkout --detach $commit in $dir (currently $head)"
        return 0
    fi

    # Fetch WITHOUT changing what is checked out. `git fetch` updates remote
    # refs only; the working tree moves in the explicit checkout below.
    astro::info "  $name: fetching"
    if [ -n "$ref" ]; then
        git -C "$dir" fetch --quiet --tags origin "+$ref:refs/astro-locked/$name"
    else
        git -C "$dir" fetch --quiet --tags origin
    fi

    # --verify --quiet suppresses only git's own "not a valid object" note,
    # natively, rather than redirecting stderr and hiding real failures too.
    if ! git -C "$dir" rev-parse --verify --quiet "${commit}^{commit}" >/dev/null; then
        astro::die_with_hint \
            "$name: locked commit $commit does not exist after fetching from $url" \
            "The lock records a commit the origin does not have. Either the lock is" \
            "wrong, or the commit was removed upstream." \
            "Nothing nearby is substituted: an approximate source is not a source."
    fi

    astro::info "  $name: checking out $commit (detached)"
    git -C "$dir" checkout --quiet --detach "$commit"

    local now
    now="$(git -C "$dir" rev-parse HEAD)"
    if [ "$now" != "$commit" ]; then
        astro::die "$name: checkout did not land on $commit (HEAD is $now)"
    fi
}

# --------------------------------------------------------------------------
# depot_tools FIRST — it resolves every other revision
# --------------------------------------------------------------------------

astro::info ">>> depot_tools"
sync_repository "$DEPOT_TOOLS_DIR" "$DEPOT_TOOLS_URL" "$DEPOT_TOOLS_COMMIT" "" "depot_tools"
export PATH="$DEPOT_TOOLS_DIR:$PATH"

# --------------------------------------------------------------------------
# Chromium
# --------------------------------------------------------------------------

astro::info ">>> Chromium $CHROMIUM_VERSION"

if [ -d "$CHROMIUM_SRC/.git" ]; then
    # Reuse #4's destination verification: the path must be its own git work
    # tree carrying Chromium's sentinels, so a directory holding only the
    # overlay can never be mistaken for a checkout.
    ASTRO_CHROMIUM_SRC="$CHROMIUM_SRC" astro::resolve_chromium_src "$CHROMIUM_SRC"
fi

sync_repository "$CHROMIUM_SRC" "$CHROMIUM_URL" "$CHROMIUM_COMMIT" "$CHROMIUM_REF" "chromium"

# --------------------------------------------------------------------------
# .gclient — written from committed configuration, never string-built per run
# --------------------------------------------------------------------------

astro::require_file "$GCLIENT_TEMPLATE" "gclient template"

render_gclient() {
    local target_os_literal=""
    local target
    for target in $TARGET_OS_LIST; do
        case "$target" in
            linux|win|android|mac) target_os_literal="$target_os_literal\"$target\", " ;;
            *) astro::die "Unknown target_os '$target' (expected linux, win, android or mac)" ;;
        esac
    done
    target_os_literal="${target_os_literal%, }"

    python3 - "$GCLIENT_TEMPLATE" "$CHROMIUM_URL" "$target_os_literal" <<'PY'
import sys
template_path, url, target_os = sys.argv[1:4]
with open(template_path, encoding="utf-8") as handle:
    template = handle.read()
sys.stdout.write(
    template.replace("@CHROMIUM_URL@", url).replace("@TARGET_OS@", target_os)
)
PY
}

GCLIENT_PATH="$CHROMIUM_DIR/.gclient"
# .gclient is rendered and verified even under --no-deps: it is committed
# configuration, not DEPS execution, and a checkout whose .gclient does not
# match the template is configured differently from what the repository says.
if astro::dry_run || [ "$VERIFY_ONLY" = "1" ]; then
    if [ -f "$GCLIENT_PATH" ] && [ "$(render_gclient)" = "$(cat "$GCLIENT_PATH")" ]; then
        astro::info "  .gclient matches the committed template"
    elif [ "$VERIFY_ONLY" = "1" ]; then
        astro::die_with_hint \
            ".gclient does not match the committed template" \
            "Template: $GCLIENT_TEMPLATE" \
            "On disk:  $GCLIENT_PATH" \
            "Run tools/sync-sources.sh to regenerate it."
    else
        astro::plan "write $GCLIENT_PATH from $GCLIENT_TEMPLATE"
    fi
else
    render_gclient > "$GCLIENT_PATH"
    astro::info "  .gclient written from $GCLIENT_TEMPLATE (target_os: $TARGET_OS_LIST)"
fi

# --------------------------------------------------------------------------
# DEPS
# --------------------------------------------------------------------------

if [ "$RUN_DEPS" = "0" ]; then
    astro::warn "optional:skip-deps" "--no-deps given: DEPS were NOT synced, so this tree is not buildable"
elif [ "$VERIFY_ONLY" = "1" ]; then
    astro::info "  --verify-only: not running gclient sync"
elif astro::dry_run; then
    astro::plan "gclient sync --revision src@$CHROMIUM_COMMIT --with_branch_heads --with_tags -D"
    astro::plan "gclient runhooks"
else
    astro::require_cmd gclient
    astro::info ">>> gclient sync (anchored to src@$CHROMIUM_COMMIT)"
    ( cd "$CHROMIUM_DIR" && gclient sync --revision "src@$CHROMIUM_COMMIT" \
        --with_branch_heads --with_tags -D )

    # gclient sync can move src; the locked commit is what must be built.
    head_after="$(git -C "$CHROMIUM_SRC" rev-parse HEAD)"
    if [ "$head_after" != "$CHROMIUM_COMMIT" ]; then
        astro::die_with_hint \
            "gclient sync moved the Chromium checkout off the locked commit." \
            "  locked:  $CHROMIUM_COMMIT" \
            "  on disk: $head_after"
    fi

    astro::info ">>> gclient runhooks"
    ( cd "$CHROMIUM_DIR" && gclient runhooks )

    # Record what DEPS actually resolved to. This is the input to provenance
    # and the only way to notice a DEPS-level change between two syncs of the
    # same Chromium commit.
    report_dir="$(astro::report_dir)"
    ( cd "$CHROMIUM_DIR" && gclient revinfo --output-json="$report_dir/deps-revinfo.json" )
    astro::info "  DEPS revisions recorded: $report_dir/deps-revinfo.json"
fi

# --------------------------------------------------------------------------
# ungoogled-chromium (legacy; removed with the patch system in #8)
# --------------------------------------------------------------------------

astro::info ">>> ungoogled-chromium (legacy)"
sync_repository "$UNGOOGLED_DIR" "$UNGOOGLED_URL" "$UNGOOGLED_COMMIT" "$UNGOOGLED_REF" "ungoogled_chromium"

# --------------------------------------------------------------------------
# Final report — every selected revision, at completion as well as at startup
# --------------------------------------------------------------------------

printf '\n=== Source revisions ===\n'
python3 "$LOCK" --revisions "$LOCK_FILE" | while IFS=$'\t' read -r name revision; do
    printf '  %-26s %s\n' "$name" "$revision"
done

if ! astro::dry_run; then
    printf -- '--- verified on disk ---\n'
    printf '  %-26s %s\n' "depot_tools" "$(git -C "$DEPOT_TOOLS_DIR" rev-parse HEAD)"
    printf '  %-26s %s\n' "chromium" "$(git -C "$CHROMIUM_SRC" rev-parse HEAD)"
    printf '  %-26s %s\n' "ungoogled_chromium" "$(git -C "$UNGOOGLED_DIR" rev-parse HEAD)"
fi
printf '=== end ===\n\n'

astro::info "=== Source sync complete ==="
