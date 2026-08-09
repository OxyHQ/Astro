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
    assert_rule_fires "blind-git-status"   'dirty="$(git -C "$src" status --porcelain)"'
}

# blind-git-status has two shapes that must NOT fire, and both are load-bearing
# rather than regex hygiene. The first is the fix itself: a call that states the
# value it means is exactly what the rule is asking for. The second is
# `git merge-base … || status=$?`, which contains the words `git` and `status`
# and is not an invocation of the subcommand — tools/check-merge-base.sh has
# three of them, and a rule that condemned those would have been switched off
# by whoever hit it next.
cat > "$tmp/probe-status-ok.sh" <<'PROBE'
#!/usr/bin/env bash
git -C "$src" status --porcelain --ignore-submodules=none
git -C "$src" status --short --ignore-submodules=untracked
status=0
git -C "$repo" merge-base --is-ancestor "$a" "$b" || status=$?
git -C "$dir" fetch --deepen=100 origin || status=$?
PROBE
harness::run python3 "$SCANNER" "$tmp/probe-status-ok.sh"
harness::assert_status 0 'an explicit --ignore-submodules, and a status=\$? capture, are allowed'

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
# astro-allow:rsync-delete destination is the install directory under $HOME
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

# --- The marker must not be forgeable ----------------------------------------
#
# The exception used to be a bare substring test against the RAW line:
#
#     allowed = ALLOW_MARKER in raw or ALLOW_MARKER in previous
#
# so a string literal, an executable line above, a marker naming no rule, one
# naming the WRONG rule, and one carrying no justification all waved a banned
# command straight through — and a single marker switched off every rule on the
# line at once. Each shape is planted below and must be reported.
#
# Every case asserts on the scanner's OUTPUT, not just its status: a fix that
# rejected every marker unconditionally would satisfy the exit codes while
# breaking the exceptions this repository legitimately relies on, so the
# well-formed cases at the end are as load-bearing as the forged ones.

# assert_scan_reports <probe> <rule> <line> <what>
assert_scan_reports() {
    local probe="$1" rule="$2" line="$3" what="$4"
    harness::run python3 "$SCANNER" "$probe"
    harness::assert_status 1 "$what"
    harness::assert_output_contains "$probe:$line: $rule:" "$what: reports $rule at line $line"
}

# assert_scan_clean <probe> <what>
assert_scan_clean() {
    local probe="$1" what="$2"
    harness::run python3 "$SCANNER" "$probe"
    harness::assert_status 0 "$what"
    harness::assert_output_contains "no banned patterns" "$what: reports a clean scan"
}

# A marker inside a STRING is not a comment, whether or not it carries a '#'.
cat > "$tmp/probe-forge-string.sh" <<'PROBE'
#!/usr/bin/env bash
echo "astro-allow:rsync-delete pretend" && rsync -a --delete "$src/" "$dst/"
echo "# astro-allow:rsync-delete looks like a comment" && rsync -a --delete "$a/" "$b/"
PROBE
assert_scan_reports "$tmp/probe-forge-string.sh" rsync-delete 2 \
    "a marker inside a string literal is not an exception"
assert_scan_reports "$tmp/probe-forge-string.sh" rsync-delete 3 \
    "a quoted '#' does not make a string a comment"

# An EXECUTABLE line above must not hand an exception to the line below, even
# when it carries a well-formed marker in a real trailing comment: the marker
# is associated with ITS line, not the next one.
cat > "$tmp/probe-forge-previous.sh" <<'PROBE'
#!/usr/bin/env bash
echo "astro-allow:rsync-delete pretend"
rsync -a --delete "$src/" "$dst/"
echo hello   # astro-allow:rsync-delete a real comment, but not a pure comment line
rsync -a --delete "$a/" "$b/"
PROBE
assert_scan_reports "$tmp/probe-forge-previous.sh" rsync-delete 3 \
    "executable code above does not grant an exception"
assert_scan_reports "$tmp/probe-forge-previous.sh" rsync-delete 5 \
    "a trailing marker on a code line does not carry to the next line"

# A marker must name the rule it suppresses, and justify itself.
cat > "$tmp/probe-forge-norule.sh" <<'PROBE'
#!/usr/bin/env bash
rsync -a --delete "$src/" "$dst/"   # astro-allow: no rule id at all
PROBE
assert_scan_reports "$tmp/probe-forge-norule.sh" rsync-delete 2 \
    "a marker naming no rule is not an exception"

cat > "$tmp/probe-forge-wrongrule.sh" <<'PROBE'
#!/usr/bin/env bash
rsync -a --delete "$src/" "$dst/"   # astro-allow:fuzzy-patch names a different rule entirely
PROBE
assert_scan_reports "$tmp/probe-forge-wrongrule.sh" rsync-delete 2 \
    "a marker naming a different rule does not suppress this one"

cat > "$tmp/probe-forge-nojustification.sh" <<'PROBE'
#!/usr/bin/env bash
rsync -a --delete "$src/" "$dst/"   # astro-allow:rsync-delete
PROBE
assert_scan_reports "$tmp/probe-forge-nojustification.sh" rsync-delete 2 \
    "a marker with a rule id but no justification is not an exception"

# One marker must suppress ONLY the rule it names. This line breaks three rules
# and excuses one, so the other two must still be reported.
cat > "$tmp/probe-scoped.sh" <<'PROBE'
#!/usr/bin/env bash
rsync -a --delete "$s/" "$d/" 2>/dev/null || true   # astro-allow:rsync-delete the destination is under $HOME
PROBE
assert_scan_reports "$tmp/probe-scoped.sh" suppressed-failure 2 \
    "a scoped marker leaves the other rules in force"
harness::assert_output_contains "$tmp/probe-scoped.sh:2: suppressed-stderr:" \
    "the scoped marker did not suppress suppressed-stderr either"
harness::assert_output_lacks "$tmp/probe-scoped.sh:2: rsync-delete:" \
    "the rule the marker names is the one it suppresses"

# An exception must not leak past the line it precedes.
cat > "$tmp/probe-no-leak.sh" <<'PROBE'
#!/usr/bin/env bash
# astro-allow:rsync-delete the destination is under $HOME, verified above
rsync -a --delete "$one/" "$two/"
rsync -a --delete "$three/" "$four/"
PROBE
assert_scan_reports "$tmp/probe-no-leak.sh" rsync-delete 4 \
    "an exception does not reach a third line"
harness::assert_output_lacks "$tmp/probe-no-leak.sh:3: rsync-delete:" \
    "the line the exception covers is still allowed"

# A heredoc body is data, and must not grant an exception to what follows it.
cat > "$tmp/probe-heredoc-grant.sh" <<'PROBE'
#!/usr/bin/env bash
cat <<'INNER'
# astro-allow:rsync-delete this is heredoc data, not a comment
INNER
rsync -a --delete "$src/" "$dst/"
PROBE
assert_scan_reports "$tmp/probe-heredoc-grant.sh" rsync-delete 5 \
    "a heredoc body does not grant an exception"

# --- and the well-formed exceptions must still be honoured -------------------

cat > "$tmp/probe-good-trailing.sh" <<'PROBE'
#!/usr/bin/env bash
rsync -a --delete "$s/" "$d/"   # astro-allow:rsync-delete destination is under $HOME, verified above
PROBE
assert_scan_clean "$tmp/probe-good-trailing.sh" \
    "a trailing comment naming the rule with a justification is allowed"

cat > "$tmp/probe-good-above.sh" <<'PROBE'
#!/usr/bin/env bash
# astro-allow:rsync-delete destination is under $HOME, verified above
rsync -a --delete "$s/" "$d/"
PROBE
assert_scan_clean "$tmp/probe-good-above.sh" \
    "a pure comment line directly above the command is allowed"

# A line that genuinely breaks two rules carries one marker per rule.
cat > "$tmp/probe-good-two.sh" <<'PROBE'
#!/usr/bin/env bash
probe 2>/dev/null || true   # astro-allow:suppressed-stderr the probe has no diagnostics astro-allow:suppressed-failure absence is the answer being asked for
PROBE
assert_scan_clean "$tmp/probe-good-two.sh" \
    "two markers on one line each suppress the rule they name"

# The same grammar in a workflow file, where '#' is a YAML comment.
cat > "$tmp/probe-forge-workflow.yml" <<'PROBE'
name: probe
jobs:
  build:
    steps:
      - run: echo "astro-allow:mutable-action-tag pretend"
      - uses: actions/checkout@v4
PROBE
assert_scan_reports "$tmp/probe-forge-workflow.yml" mutable-action-tag 6 \
    "a forged marker in a workflow is not an exception"

cat > "$tmp/probe-good-workflow.yml" <<'PROBE'
name: probe
jobs:
  build:
    steps:
      # astro-allow:mutable-action-tag pinned by digest in the reusable workflow
      - uses: actions/checkout@v4
PROBE
assert_scan_clean "$tmp/probe-good-workflow.yml" \
    "a well-formed YAML comment exception is honoured"

# --- Continued logical lines -------------------------------------------------
#
# Scanning PHYSICAL lines was a second bypass, and a worse one than the marker
# forgery above: it needed no marker at all. A string opened on one physical
# line and closed on the next left the closing quote reading as an OPENING one,
# so everything after it counted as quoted text and was never scanned. This
# reported nothing:
#
#     astro::info "a message that spans \
#         two physical lines" && rm -f /tmp/x || true
#
# Findings are reported against the logical line's FIRST physical line, which
# is where a reader's eye and `git blame` both land, so the line number in the
# assertions below is deliberately the start of the construct rather than the
# physical line the banned text sits on.

cat > "$tmp/probe-continued.sh" <<'PROBE'
#!/usr/bin/env bash
astro::info "a message that spans \
    two physical lines" && rm -f /tmp/nothing || true
PROBE
assert_scan_reports "$tmp/probe-continued.sh" suppressed-failure 2 \
    "a quote closed on the next physical line no longer hides the line"

# Every rule, each split across a continuation, each reported at its start.
cat > "$tmp/probe-continued-all.sh" <<'PROBE'
#!/usr/bin/env bash
rsync -a \
    --delete "$a/" "$b/"
git apply \
    --3way "$p"
patch -p1 \
    -F3 < "$p"
ninja chrome \
    2>/dev/null
git \
    pull
PROBE
assert_scan_reports "$tmp/probe-continued-all.sh" rsync-delete 2 \
    "rsync --delete split across a continuation"
assert_scan_reports "$tmp/probe-continued-all.sh" git-apply-3way 4 \
    "git apply --3way split across a continuation"
assert_scan_reports "$tmp/probe-continued-all.sh" fuzzy-patch 6 \
    "patch -F3 split across a continuation"
assert_scan_reports "$tmp/probe-continued-all.sh" suppressed-stderr 8 \
    "2>/dev/null split across a continuation"
assert_scan_reports "$tmp/probe-continued-all.sh" unconstrained-pull 10 \
    "git pull split across a continuation"

# An ESCAPED backslash ends the line. Asserting the finding lands on line 3 and
# NOT line 2 is what tells a correct join from one that swallows any trailing
# backslash it sees.
cat > "$tmp/probe-escaped-backslash.sh" <<'PROBE'
#!/usr/bin/env bash
printf 'a literal backslash argument' \\
rsync -a --delete "$a/" "$b/"
PROBE
assert_scan_reports "$tmp/probe-escaped-backslash.sh" rsync-delete 3 \
    "an escaped backslash does not continue the line"
harness::assert_output_lacks "$tmp/probe-escaped-backslash.sh:2: rsync-delete:" \
    "the escaped-backslash line is not joined to the one below it"

# A comment runs to the end of its PHYSICAL line, so a backslash inside one
# continues nothing. If it did, the comment would swallow the command beneath.
cat > "$tmp/probe-comment-backslash.sh" <<'PROBE'
#!/usr/bin/env bash
# a comment that happens to end in a backslash \
rsync -a --delete "$a/" "$b/"
PROBE
assert_scan_reports "$tmp/probe-comment-backslash.sh" rsync-delete 3 \
    "a backslash in a comment does not swallow the next line"

# Heredoc handling must win over the join. The body line below ends in a
# backslash directly above the terminator: if the join applied inside a heredoc
# it would absorb the terminator, the heredoc would never close, and every
# banned pattern in the rest of the file would be skipped as heredoc data.
cat > "$tmp/probe-heredoc-continuation.sh" <<'PROBE'
#!/usr/bin/env bash
cat <<'INNER'
rsync -a --delete /a /b || true
body text ending in a backslash \
INNER
rsync -a --delete "$a/" "$b/"
PROBE
assert_scan_reports "$tmp/probe-heredoc-continuation.sh" rsync-delete 6 \
    "a heredoc body does not join across its terminator"
harness::assert_output_lacks "$tmp/probe-heredoc-continuation.sh:3: rsync-delete:" \
    "the heredoc body itself is still not scanned"

# --- Markers must keep working on a joined line ------------------------------
#
# The two real markers in tools/sync-sources.sh and tools/apply-patches.sh sit
# on exactly this shape, and became load-bearing for the first time when the
# join closed the gap: before it, the `|| true` they excuse was invisible.
#
# The producer is astro::_untracked_paths because that is what those two lines
# call now. It used to read `git status --porcelain` here, copied from the code
# before it learned to descend into submodules — filler that the
# blind-git-status rule then reported, in a probe about marker handling that
# has nothing to say about git status. A probe that no longer mirrors the line
# it documents is how a gate starts crying wolf.

cat > "$tmp/probe-continued-marked.sh" <<'PROBE'
#!/usr/bin/env bash
artifacts="$(astro::_untracked_paths "$src" \
    | grep -E '\.rej$' | head -5)" || true   # astro-allow:suppressed-failure grep finding nothing is the normal case
PROBE
assert_scan_clean "$tmp/probe-continued-marked.sh" \
    "a trailing marker at the end of a joined logical line is honoured"

cat > "$tmp/probe-continued-unmarked.sh" <<'PROBE'
#!/usr/bin/env bash
artifacts="$(astro::_untracked_paths "$src" \
    | grep -E '\.rej$' | head -5)" || true
PROBE
assert_scan_reports "$tmp/probe-continued-unmarked.sh" suppressed-failure 2 \
    "the same joined line without a marker is reported"

# A pure comment line above the logical line's FIRST physical line grants it.
cat > "$tmp/probe-continued-above.sh" <<'PROBE'
#!/usr/bin/env bash
# astro-allow:rsync-delete destination is under $HOME, verified above
rsync -a \
    --delete "$a/" "$b/"
PROBE
assert_scan_clean "$tmp/probe-continued-above.sh" \
    "a comment above the first physical line grants the whole logical line"

# ...and the grant stops at the end of the logical line, however long it is.
cat > "$tmp/probe-continued-leak.sh" <<'PROBE'
#!/usr/bin/env bash
# astro-allow:rsync-delete destination is under $HOME, verified above
rsync -a \
    --delete "$one/" "$two/"
rsync -a --delete "$three/" "$four/"
PROBE
assert_scan_reports "$tmp/probe-continued-leak.sh" rsync-delete 5 \
    "an exception does not leak past the end of a joined logical line"
harness::assert_output_lacks "$tmp/probe-continued-leak.sh:3: rsync-delete:" \
    "the joined line the exception covers is still allowed"

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


# --- Backslash continuations: a bypass needing no marker at all --------------
#
# The scanner read PHYSICAL lines. A string opened on one physical line and
# closed on the next left the closing quote reading as an OPENING one, so
# everything after it — `|| true` included — counted as quoted text and was
# never scanned. Measured before the fix: the probe below reported
# `no banned patterns` and exited 0.
#
# This one required nobody to type anything. The astro-allow bypass at least
# needed a marker; this disarmed the epic's central rule for free.

cat > "$tmp/probe-continuation.sh" <<'PROBE'
#!/usr/bin/env bash
astro::info "a message that spans \
    two physical lines" && rm -f /tmp/x || true
PROBE
harness::run python3 "$SCANNER" "$tmp/probe-continuation.sh"
harness::assert_nonzero_status "a banned pattern on a continued logical line"
harness::assert_output_contains "suppressed-failure" "names the rule"
harness::assert_output_contains "probe-continuation.sh:2:" \
    "reports the logical line's FIRST physical line, where the construct starts"

# The other direction: a correct marker at the end of the logical line must
# still be honoured, or the fix would simply reject every continued line.
cat > "$tmp/probe-continuation-allowed.sh" <<'PROBE'
#!/usr/bin/env bash
astro::info "a message that spans \
    two physical lines" && rm -f /tmp/x || true   # astro-allow:suppressed-failure the probe tolerates a missing file
PROBE
harness::run python3 "$SCANNER" "$tmp/probe-continuation-allowed.sh"
harness::assert_status 0 "a marker at the end of a continued logical line"

# A pure-comment line above the FIRST physical line of a continued construct
# is still immediately associated with it.
cat > "$tmp/probe-continuation-above.sh" <<'PROBE'
#!/usr/bin/env bash
# astro-allow:suppressed-failure the probe tolerates a missing file
astro::info "a message that spans \
    two physical lines" && rm -f /tmp/x || true
PROBE
harness::run python3 "$SCANNER" "$tmp/probe-continuation-above.sh"
harness::assert_status 0 "a marker on the line above a continued construct"

# An ESCAPED backslash ends the line. Treating `\\` as a continuation would
# swallow the NEXT line into this one and hide whatever it contains.
cat > "$tmp/probe-escaped-backslash.sh" <<'PROBE'
#!/usr/bin/env bash
printf 'a backslash: \\'
rm -f /tmp/x || true
PROBE
harness::run python3 "$SCANNER" "$tmp/probe-escaped-backslash.sh"
harness::assert_nonzero_status "an escaped backslash does not continue the line"
harness::assert_output_contains "probe-escaped-backslash.sh:3:" \
    "the violation is reported on its own line, not folded into the one above"

# A trailing backslash inside a COMMENT is ordinary text: a comment ends at the
# newline and cannot be continued. Treating it as one would hide the next line.
cat > "$tmp/probe-backslash-in-comment.sh" <<'PROBE'
#!/usr/bin/env bash
echo hi   # this comment ends with a backslash \
rm -f /tmp/x || true
PROBE
harness::run python3 "$SCANNER" "$tmp/probe-backslash-in-comment.sh"
harness::assert_nonzero_status "a backslash inside a comment does not continue the line"

# Heredoc bodies are data, and a backslash in one continues nothing. The
# terminator must still be recognised on its own physical line.
cat > "$tmp/probe-continuation-heredoc.sh" <<'PROBE'
#!/usr/bin/env bash
cat > /tmp/x <<'INNER'
a heredoc body line ending in a backslash \
INNER
rm -f /tmp/x || true
PROBE
harness::run python3 "$SCANNER" "$tmp/probe-continuation-heredoc.sh"
harness::assert_nonzero_status "the line after a heredoc is still scanned"
harness::assert_output_contains "probe-continuation-heredoc.sh:5:" \
    "the heredoc body did not swallow the line after its terminator"

# The five markers the repository actually carries must every one be
# load-bearing. Before continuations were joined, two of them suppressed
# nothing — they sat on exactly this shape — so a reader could not tell a
# reviewed exception from a decorative comment.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 2))
stripped="$tmp/stripped"
mkdir -p "$stripped"
for marked in "$ASTRO_ROOT"/tools/sync-sources.sh "$ASTRO_ROOT"/tools/apply-patches.sh \
              "$ASTRO_ROOT"/tools/install-local.sh "$ASTRO_ROOT"/tools/lib/astro-common.sh; do
    sed 's/#[[:space:]]*astro-allow:[^"]*$//' "$marked" > "$stripped/$(basename "$marked")"
done
stripped_status=0
python3 "$SCANNER" "$stripped"/*.sh > "$tmp/stripped-scan.txt" 2>&1 || stripped_status=$?
# Exit 1 is "findings reported". Exit 2 is "nothing was scanned", and a crash
# is anything else — both would leave the count at 0, which the check below
# would read as a marker problem rather than as a broken measurement.
if [ "$stripped_status" -ne 1 ]; then
    harness::fail "scanning the stripped copies should report findings (exit 1), got exit $stripped_status"
fi
found="$(awk '/^[^ ]+:[0-9]+: /{n++} END{print n+0}' "$tmp/stripped-scan.txt")"
if [ "$found" -ne 5 ]; then
    harness::fail "expected all 5 committed astro-allow markers to be load-bearing, \
but stripping them surfaced $found finding(s). A marker that suppresses nothing is a \
comment pretending to be a reviewed exception."
fi

# --- A quote continues a logical line with no backslash at all ---------------
#
# The backslash join closed one instance of the defect; an unterminated quote
# continues a logical line too, and hid everything after it by the same
# mechanism. Joining on either closes the class rather than one shape.

cat > "$tmp/probe-unterminated-quote.sh" <<'PROBE'
#!/usr/bin/env bash
astro::info "a message spanning
two lines with no backslash" && rm -f /tmp/x || true
PROBE
harness::run python3 "$SCANNER" "$tmp/probe-unterminated-quote.sh"
harness::assert_nonzero_status "a banned pattern after a multi-line string"
harness::assert_output_contains "suppressed-failure" "names the rule"
harness::assert_output_contains "probe-unterminated-quote.sh:2:" \
    "reported against the line where the string opens"

# And the marker still reaches it, so the class is closed in both directions.
cat > "$tmp/probe-unterminated-quote-allowed.sh" <<'PROBE'
#!/usr/bin/env bash
astro::info "a message spanning
two lines with no backslash" && rm -f /tmp/x || true   # astro-allow:suppressed-failure the probe tolerates a missing file
PROBE
harness::run python3 "$SCANNER" "$tmp/probe-unterminated-quote-allowed.sh"
harness::assert_status 0 "a marker at the end of a quote-continued logical line"

# A single-quoted string spanning lines behaves the same; without this the fix
# could be double-quote-only and nobody would know.
cat > "$tmp/probe-single-quote-span.sh" <<'PROBE'
#!/usr/bin/env bash
astro::info 'a message spanning
two lines' && rm -f /tmp/x || true
PROBE
harness::run python3 "$SCANNER" "$tmp/probe-single-quote-span.sh"
harness::assert_nonzero_status "a single-quoted string spanning lines hides nothing either"

harness::pass
