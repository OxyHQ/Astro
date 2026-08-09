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

    # A patched tree is the NORMAL state at build time: the pipeline itself put
    # 3,923 modifications there. So "is it unmodified" is the wrong question
    # once patches have been applied — the right one is "is every modification
    # one Astro made", which is what the patch report answers.
    #
    # This distinction only showed up against a real checkout: build.sh gates on
    # --verify-only, and a pristine requirement made a correctly patched tree
    # unbuildable.
    local dirty
    dirty="$(git -C "$dir" status --porcelain --untracked-files=all)"
    if [ -n "$dirty" ]; then
        local count
        count="$(printf '%s\n' "$dirty" | wc -l | tr -d '[:space:]')"
        if [ -f "$ASTRO_REPORT_DIR/patch-report.json" ]; then
            # Dies naming the paths if any are unaccounted for.
            astro::require_attributable_chromium \
                "$dir" "$ASTRO_ROOT/tools/overlay.allowlist" \
                "$ASTRO_REPORT_DIR/patch-report.json" \
                "$ASTRO_REPORT_DIR/overlay-manifest.json" \
                "$ASTRO_REPORT_DIR/vendor-report.json"
        else
            problems="$problems
  $count uncommitted change(s) or untracked file(s), and no patch report to attribute them to"
        fi
    fi

    # Only UNTRACKED .rej/.orig files are patch artifacts. Chromium itself ships
    # 181 tracked `.orig` files — cargo writes `Cargo.toml.orig` for every
    # vendored Rust crate — so a `find`-based check reports a pristine upstream
    # checkout as full of leftover artifacts. Measured on the real tree: 181
    # tracked `.orig`, 0 tracked `.rej`, 0 untracked of either.
    #
    # Asking git also avoids walking 400,000 files, and avoids the SIGPIPE that
    # `find … | head` raises under pipefail once head has what it needs.
    #
    # Tracked-or-untracked is exact for the crates Chromium ships and wrong for
    # the crates ASTRO vendors: tools/vendor-adblock-rust.sh fetches 49 crate
    # trees that upstream does not have, so every one of their `Cargo.toml.orig`
    # files is untracked and this scan condemned all of them — the documented
    # apply-patches → vendor → build sequence could not reach the build at all.
    # The paths are recorded in vendor-report.json, which the dirty-path check
    # above already honours, so the artifact scan asks the same question rather
    # than keeping a second, narrower answer to it.
    local artifacts
    artifacts="$(git -C "$dir" status --porcelain --untracked-files=all \
        | sed -n 's/^?? //p' | grep -E '\.(rej|orig|porig)$')" || true   # astro-allow:suppressed-failure grep finding nothing is the normal case
    if [ -n "$artifacts" ]; then
        artifacts="$(printf '%s\n' "$artifacts" | astro::unattributable_paths \
            "$ASTRO_ROOT/tools/overlay.allowlist" \
            "$ASTRO_REPORT_DIR/patch-report.json" \
            "$ASTRO_REPORT_DIR/overlay-manifest.json" \
            "$ASTRO_REPORT_DIR/vendor-report.json")"
    fi
    if [ -n "$artifacts" ]; then
        # Truncated for the message only. Filtering first and truncating second
        # is the whole point: `grep … | head -5` would let five attributable
        # `Cargo.toml.orig` files hide the sixth path, a real `.rej`.
        local artifact_count
        artifact_count="$(printf '%s\n' "$artifacts" | wc -l | tr -d '[:space:]')"
        problems="$problems
  leftover patch artifacts ($artifact_count): $(printf '%s\n' "$artifacts" | sed -n '1,5p' | tr '\n' ' ')"
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

# Astro's fetches are large enough that a transient network failure is a normal
# event rather than an exceptional one. Each attempt is announced and the final
# failure is fatal, so this is a retry, not a suppressed error.
ASTRO_FETCH_ATTEMPTS="${ASTRO_FETCH_ATTEMPTS:-5}"

# Depth of the initial fetch. Chromium's full history is tens of gigabytes over
# a single connection, and a transient TLS reset loses ALL of it — git streams a
# fetch into a temporary pack and discards it on failure, so a retry genuinely
# starts over. Measured here: five consecutive attempts left .git at 120 KB.
#
# Fetching the locked ref at depth 1 transfers one commit's tree instead of the
# whole history, which is a few gigabytes rather than tens, and is what makes
# the difference between a bootstrap that completes and one that cannot. The
# commit checked out is still exactly the one the lock names, so nothing about
# reproducibility changes; only the local ancestry is absent.
#
# Set ASTRO_FETCH_DEPTH= (empty) for full history, which `git fetch --unshallow`
# can also add later.
ASTRO_FETCH_DEPTH="${ASTRO_FETCH_DEPTH-1}"

# Partial-clone filter for the initial network fetch. `blob:none` transfers the
# commit and its trees but no file contents, turning one multi-gigabyte transfer
# that must survive intact into a small one plus many small on-demand batches
# during checkout — each of which fails and retries independently.
#
# On a link that dropped four times inside the first 220 MB, that is the
# difference between a bootstrap that completes and one that cannot. The commit
# is still exactly the one the lock names.
#
# The cost is real and worth stating: a blobless checkout needs network access
# during the build to fetch contents it has not seen. Set ASTRO_FETCH_FILTER=
# (empty) for a complete local copy.
ASTRO_FETCH_FILTER="${ASTRO_FETCH_FILTER-blob:none}"

fetch_with_retry() {
    local dir="$1" ref="$2" name="$3"
    local attempt=1 status=0
    local -a depth_args=()

    # Depth applies only to a NETWORK fetch into a still-empty repository.
    #
    # It exists to bound a transfer that can fail halfway, so it is meaningless
    # for a file:// origin — and actively wrong there: a local fixture has no
    # history worth truncating, and a shallow copy of one silently loses the
    # older commits a test needs to move between. Deepening an existing
    # checkout is a different operation and is never done implicitly.
    local origin_url
    origin_url="$(git -C "$dir" remote get-url origin)"
    if [ -n "$ASTRO_FETCH_DEPTH" ] \
       && [ -z "$(git -C "$dir" rev-list -n1 --all)" ] \
       && case "$origin_url" in http://*|https://*) true ;; *) false ;; esac
    then
        depth_args=(--depth "$ASTRO_FETCH_DEPTH")
        astro::info "  $name: initial fetch limited to depth $ASTRO_FETCH_DEPTH"
        if [ -n "$ASTRO_FETCH_FILTER" ]; then
            depth_args+=(--filter="$ASTRO_FETCH_FILTER")
            astro::info "  $name: partial clone filter $ASTRO_FETCH_FILTER (contents fetched on demand)"
        fi
    fi

    while [ "$attempt" -le "$ASTRO_FETCH_ATTEMPTS" ]; do
        astro::info "  $name: fetching (attempt $attempt/$ASTRO_FETCH_ATTEMPTS)"
        status=0
        if [ -n "$ref" ]; then
            git -C "$dir" fetch "${depth_args[@]+"${depth_args[@]}"}" \
                origin "+$ref:refs/astro-locked/$name" || status=$?
        else
            git -C "$dir" fetch "${depth_args[@]+"${depth_args[@]}"}" --tags origin || status=$?
        fi
        if [ "$status" -eq 0 ]; then
            return 0
        fi
        # Deliberately NOT claiming the partial transfer was kept: git discards
        # the temporary pack when a fetch fails, so each attempt starts over.
        astro::warn "retry:fetch" "$name fetch failed (exit $status); retrying from the start"
        attempt=$((attempt + 1))
    done

    astro::die_with_hint \
        "$name: fetch failed $ASTRO_FETCH_ATTEMPTS time(s)." \
        "" \
        "A failed git fetch discards its partial transfer, so every attempt starts" \
        "over — this is not a resumable operation." \
        "" \
        "If the connection is unreliable, reduce what has to arrive in one go:" \
        "  ASTRO_FETCH_DEPTH=1   fetch only the locked commit (the default)" \
        "  ASTRO_FETCH_ATTEMPTS  raise the retry count"
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
        # A directory that exists, is not a checkout, and is not empty is the
        # shape this repository was actually found in: chromium/src held only
        # the copied overlay (4.2 MB of chrome/) with no upstream tree and no
        # .git of its own. `git clone` into it fails with "destination path
        # already exists and is not an empty directory", which says nothing
        # about what the directory is or what to do with it — and the obvious
        # reflex, deleting it, can destroy work nobody has copied anywhere.
        if [ -d "$dir" ] && [ -n "$(ls -A "$dir")" ]; then
            local backup listing
            # Captured whole, then sliced with sed. Piping find into head sends
            # SIGPIPE up the pipeline once head has its ten lines, which
            # pipefail turns into exit 141 — the same hazard that killed
            # --verify-only against a real checkout. `sed -n '1,10p'` without
            # `q` reads to EOF, so nothing upstream is ever signalled.
            listing="$(find "$dir" -mindepth 1 -maxdepth 1 -printf '%f\n' | sort)"
            backup="${dir%/}.pre-sync.$(git -C "$ASTRO_ROOT" rev-parse --short HEAD)"
            astro::die_with_hint \
                "$name cannot be created at $dir: the directory already exists, is not a git checkout, and is not empty." \
                "" \
                "Contents:" \
                "$(printf '%s\n' "$listing" | sed -n '1,10s/^/  /p')" \
                "" \
                "Nothing is deleted automatically. This is the shape a half-populated" \
                "Astro tree takes — for example a chromium/src holding only the copied" \
                "overlay — and it may be the only copy of something." \
                "" \
                "Move it aside, then re-run:" \
                "  mv $dir \\" \
                "     $backup" \
                "  tools/sync-sources.sh" \
                "" \
                "Once the sync succeeds and you have confirmed nothing was lost:" \
                "  rm -rf $backup"
        fi

        if astro::dry_run; then
            astro::plan "clone $url -> $dir"
            astro::plan "checkout --detach $commit in $dir"
            return 0
        fi
        # `git clone` cannot resume. A Chromium clone moves tens of gigabytes
        # over a single connection, and one transient TLS reset — observed here
        # as "GnuTLS recv error (-110)" partway through — throws all of it away.
        # init + fetch is resumable: a retry continues against the objects
        # already in the local repository.
        astro::info "  $name: creating $dir"
        mkdir -p "$dir"
        git -C "$dir" init --quiet
        git -C "$dir" remote add origin "$url"
    fi

    if [ ! -d "$dir/.git" ]; then
        astro::die "$dir is not a git repository after initialisation"
    fi

    # A freshly initialised repository has no HEAD yet, so there is nothing to
    # compare against and nothing to keep clean — go straight to fetch and
    # checkout below.
    local head="" head_status=0
    head="$(git -C "$dir" rev-parse HEAD 2>/dev/null)" || head_status=$?   # astro-allow:suppressed-stderr an empty repository legitimately has no HEAD
    if [ "$head_status" -ne 0 ]; then
        head=""
    fi

    if [ -n "$head" ] && [ "$head" = "$commit" ]; then
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
            "  on disk: ${head:-<empty repository>}" \
            "  locked:  $commit" \
            "" \
            "This is the check a stale self-hosted runner must not pass. Run" \
            "tools/sync-sources.sh (without --verify-only) to correct it."
    fi

    if [ -n "$head" ]; then
        assert_checkout_is_clean_enough "$dir" "$name"
        report_head_state "$dir" "$name"
    fi

    if astro::dry_run; then
        astro::plan "fetch $ref from $url in $dir"
        astro::plan "checkout --detach $commit in $dir (currently $head)"
        return 0
    fi

    # Fetch WITHOUT changing what is checked out. `git fetch` updates remote
    # refs only; the working tree moves in the explicit checkout below.
    fetch_with_retry "$dir" "$ref" "$name"

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

    install_no_commit_hook "$dir" "$name"
}

# Refuses `git commit` inside a synced checkout.
#
# These trees are build artefacts, detached at a locked commit, and they are
# PERMANENTLY dirty: binary pruning deletes thousands of files and vendoring
# adds ~1,800 more. So a bare `git commit` there is harmless only because
# nothing is staged — `git add` or `git commit -a` first would put all of it
# onto the pinned revision and break every pristine-tree guard downstream,
# quietly. That is a near-miss this repository has already had: an interactive
# `git commit` ran in `chromium/src` because a `cd` from an earlier command was
# still in effect, and it failed safely by luck.
#
# `astro::resolve_chromium_src` guards the SCRIPTS; nothing guarded a human or
# an agent typing git by hand, and asking people to remember which directory
# they are in is not a guard. A hook is: it lives with the checkout, it fires
# regardless of how git was invoked, and re-running this script restores it if
# a re-clone dropped it.
install_no_commit_hook() {
    local dir="$1" name="$2"

    # The directory must be its OWN repository, not merely inside one. Without
    # this, `rev-parse --git-path` on a path that is not a work tree root
    # answers about the ENCLOSING repository — which is Astro's own, so the
    # hook lands there and refuses every legitimate commit in this repo. That
    # is not hypothetical: this function did exactly that on its first run,
    # and the failure it produces is total. Same reasoning as
    # `astro::resolve_chromium_src`, which requires the top level to BE the
    # path for the same class of reason.
    # Not tolerated silently: this runs immediately after a successful
    # checkout, so a $dir that is not a work tree at all means the checkout
    # did not produce what it reported.
    local toplevel
    if ! toplevel="$(git -C "$dir" rev-parse --show-toplevel)"; then
        astro::die "$name: $dir is not a git work tree after checkout"
    fi
    if [ "$(cd "$dir" && pwd -P)" != "$(cd "$toplevel" && pwd -P)" ]; then
        astro::die_with_hint \
            "$name: $dir is inside a repository rather than being one" \
            "Its top level is $toplevel. Installing a hook here would write into" \
            "that repository instead — for a path under this one, that means" \
            "refusing every legitimate commit in Astro itself."
    fi

    local hooks
    hooks="$(git -C "$dir" rev-parse --git-path hooks)"
    case "$hooks" in
        /*) ;;
        *) hooks="$dir/$hooks" ;;
    esac
    [ -d "$hooks" ] || mkdir -p "$hooks"
    cat > "$hooks/pre-commit" <<HOOK
#!/bin/sh
# Installed by tools/sync-sources.sh. See install_no_commit_hook there.
echo "astro: refusing to commit inside the $name checkout." >&2
echo "       It is detached at the revision browser.lock.json declares and is" >&2
echo "       EXPECTED to be dirty, so a commit here would land pruning and" >&2
echo "       vendoring output on the pinned revision." >&2
echo "       Did you mean: git -C $ASTRO_ROOT commit ...?" >&2
exit 1
HOOK
    chmod +x "$hooks/pre-commit"
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
