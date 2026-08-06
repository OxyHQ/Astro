#!/usr/bin/env bash
# The epic's non-negotiable rules are only worth something if something
# enforces them. This case is that enforcement: no script in tools/ may
# reintroduce fuzzy patching, an automatic three-way merge, `rsync --delete`
# into the Chromium tree, or a swallowed failure.
#
# The scanner it drives is mutation-tested here as well: a check nobody has
# ever seen fail is indistinguishable from a check that cannot fail.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

SCANNER="$ASTRO_ROOT/tools/tests/lib/scan-shell-patterns.py"
tmp="$(harness::tmpdir)"

harness::assert_file_exists "$SCANNER"

# --- The real tree is clean --------------------------------------------------

# CI workflow files are scanned too: `git pull` for a build dependency and
# "skip synchronisation because .git exists" are ways a build stops being
# pinned, and both lived in .github/workflows/release.yml.
# shellcheck disable=SC2046  # deliberate word splitting over the file list
harness::run python3 "$SCANNER" $(printf '%s\n' \
    "$ASTRO_ROOT"/tools/*.sh "$ASTRO_ROOT"/tools/lib/*.sh \
    "$ASTRO_ROOT"/.github/workflows/*.yml)

harness::assert_status 0 "scan of tools/*.sh and .github/workflows/*.yml"
harness::assert_output_contains "no banned patterns" "clean result"

# A vacuity floor: the scan must actually have read a meaningful number of
# files. A broken glob would otherwise scan nothing and report success.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
scanned="$(grep -oE 'scanned [0-9]+' "$RUN_STDOUT" | grep -oE '[0-9]+')"
if [ "${scanned:-0}" -lt 15 ]; then
    harness::fail "scan covered only ${scanned:-0} files; expected the whole tools/ tree"
fi

# --- The COMMITTED tree is clean too ----------------------------------------
#
# The scan above reads the working tree. CI reads what is committed, and the
# two differ whenever anyone has uncommitted work — which is most of the time.
# This gap is not hypothetical: a local run of this suite passed while CI
# failed, because a script's committed version still carried three suppressions
# that an uncommitted local rewrite happened to remove.
#
# Scanning committed content here makes a green local run mean what it looks
# like it means.

committed="$tmp/committed"
mkdir -p "$committed"

tracked=0
while IFS= read -r tracked_path; do
    [ -n "$tracked_path" ] || continue
    mkdir -p "$committed/$(dirname "$tracked_path")"
    git -C "$ASTRO_ROOT" show "HEAD:$tracked_path" > "$committed/$tracked_path"
    tracked=$((tracked + 1))
# A git pathspec's `*` matches `/` too, so 'tools/*.sh' would sweep in
# tools/tests/**; the production scripts are tools/*.sh and tools/lib/*.sh
# only. The test suite is scanned separately and deliberately differently:
# patch-rejects-fuzz-and-3way.sh runs the banned constructs itself, to prove
# they would have applied the patch before asserting the runner refuses.
done < <(git -C "$ASTRO_ROOT" ls-files 'tools/*.sh' '.github/workflows/*.yml' \
             | grep -E '^(tools/(lib/)?[^/]+\.sh|\.github/workflows/[^/]+\.ya?ml)$')

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ "$tracked" -lt 15 ]; then
    harness::fail "only $tracked tracked scripts found; the git listing is broken"
fi

# shellcheck disable=SC2046  # deliberate word splitting over the file list
harness::run python3 "$SCANNER" $(find "$committed" \( -name '*.sh' -o -name '*.yml' \) | sort)
harness::assert_status 0 "scan of the COMMITTED tools/*.sh and workflows"

# --- An empty invocation must not read as a pass -----------------------------

harness::run python3 "$SCANNER"
harness::assert_status 2 "scanner invoked with no files"

# --- Mutation: each rule must actually fire ----------------------------------
#
# Every banned pattern is planted in a throwaway script and the scanner must
# name it. If a rule's regex ever stops matching, this fails instead of
# quietly passing everything.

assert_rule_fires() {
    local rule="$1" line="$2"
    local probe="$tmp/probe-$rule.sh"
    {
        printf '#!/usr/bin/env bash\n'
        printf '%s\n' "$line"
    } > "$probe"

    harness::run python3 "$SCANNER" "$probe"
    harness::assert_status 1 "rule $rule must reject: $line"
    harness::assert_output_contains "$rule" "rule name in the report for: $line"
}

# These are literal probe lines written into throwaway scripts, so the
# single quotes are deliberate and the "$var" text must not expand here.
# shellcheck disable=SC2016
{
    assert_rule_fires "rsync-delete"       'rsync -a --delete "$src/" "$dest/"'
    assert_rule_fires "git-apply-3way"     'git apply --3way "$patch"'
    assert_rule_fires "fuzzy-patch"        'patch -p1 --forward -F3 < "$patch"'
    assert_rule_fires "suppressed-failure" 'cp "$a" "$b" || true'
    assert_rule_fires "suppressed-stderr"  'ninja -C out/Release chrome 2>/dev/null'
    assert_rule_fires "unconstrained-pull" 'cd depot_tools && git pull'
}

# cache-as-source-of-truth is a workflow-only rule: a bootstrapping script may
# test whether a checkout exists, a CI job may not decide for itself whether to
# synchronise. Probe it with a workflow file, and assert a shell script with
# the same line is NOT flagged, so the scoping is deliberate and tested rather
# than an accident of the regex.
cat > "$tmp/probe-workflow.yml" <<'PROBE'
name: probe
jobs:
  build:
    steps:
      - run: |
          if [ ! -d "chromium/src/.git" ]; then
            tools/sync-sources.sh
          else
            echo "cached, skipping fetch"
          fi
PROBE
harness::run python3 "$SCANNER" "$tmp/probe-workflow.yml"
harness::assert_status 1 "a workflow branching on .git existence"
harness::assert_output_contains "cache-as-source-of-truth" "rule name"

cat > "$tmp/probe-bootstrap.sh" <<'PROBE'
#!/usr/bin/env bash
if [ ! -d "$dir/.git" ]; then
    git clone "$url" "$dir"
fi
PROBE
harness::run python3 "$SCANNER" "$tmp/probe-bootstrap.sh"
harness::assert_status 0 "a script bootstrapping a missing checkout is allowed"

# --- The scanner must not fire on descriptions of the patterns ---------------
#
# The scripts legitimately name these patterns in comments and error messages,
# because explaining what was removed is the point. A check that flags its own
# documentation gets disabled by whoever hits it next, so this is load-bearing.

cat > "$tmp/probe-prose.sh" <<'PROBE'
#!/usr/bin/env bash
# This script no longer runs rsync --delete or git apply --3way.
echo "the old runner used patch -F10 and hid errors with 2>/dev/null"
astro::die "the previous implementation ended in || true"
cat <<'INNER'
rsync -a --delete /a /b
INNER
PROBE

harness::run python3 "$SCANNER" "$tmp/probe-prose.sh"
harness::assert_status 0 "comments, strings and heredoc bodies must not trip the scanner"

# --- A reviewed exception is honoured, and must be explicit ------------------

cat > "$tmp/probe-allow.sh" <<'PROBE'
#!/usr/bin/env bash
# astro-allow: destination is the install directory under $HOME
rsync -a --delete "$BUILD_DIR/" "$INSTALL_DIR/"
PROBE

harness::run python3 "$SCANNER" "$tmp/probe-allow.sh"
harness::assert_status 0 "an explicitly marked exception is allowed"

cat > "$tmp/probe-unmarked.sh" <<'PROBE'
#!/usr/bin/env bash
rsync -a --delete "$BUILD_DIR/" "$INSTALL_DIR/"
PROBE

harness::run python3 "$SCANNER" "$tmp/probe-unmarked.sh"
harness::assert_status 1 "the same line without a marker is rejected"

# --- The specific regressions this issue exists to prevent -------------------

# Scoped to the production scripts. tools/tests/ is deliberately excluded:
# patch-rejects-fuzz-and-3way.sh runs `git apply --3way` and `patch -F3`
# itself, to prove the fallbacks WOULD have applied the patch before asserting
# that the runner refuses anyway. Those two invocations are the evidence the
# removal is real, so a check that banned them would delete its own proof.
#
# The patterns match executable lines only (`^[^#]*`), because every one of
# these scripts documents in prose the construct it removed — grepping raw
# text would flag its own changelog.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 3))
PRODUCTION_SCRIPTS=("$ASTRO_ROOT"/tools/*.sh "$ASTRO_ROOT"/tools/lib/*.sh)

if grep -qE '^[^#]*rsync[^#]*--delete' "$ASTRO_ROOT/tools/build.sh"; then
    harness::fail "tools/build.sh must never delete from the Chromium tree"
fi
if grep -qE '^[^#]*git apply[^#]*--3way' "${PRODUCTION_SCRIPTS[@]}"; then
    harness::fail "the three-way merge fallback must stay removed"
fi
if grep -qE '^[^#]*patch -p1[^#]*-F[0-9]' "${PRODUCTION_SCRIPTS[@]}"; then
    harness::fail "the fuzzy patch fallbacks must stay removed"
fi

# The two shapes ASTRO-NEXT-002 removed, checked by name so a reviewer sees
# what is being guarded rather than only a rule id.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 2))
if grep -rq 'skipping fetch' "$ASTRO_ROOT/.github/workflows/"; then
    harness::fail "CI must not skip source synchronisation because a cache exists"
fi
if grep -qE '^[^#]*git .*\bpull\b' "${PRODUCTION_SCRIPTS[@]}"; then
    harness::fail "no build dependency may be updated with an unconstrained git pull"
fi

harness::pass
