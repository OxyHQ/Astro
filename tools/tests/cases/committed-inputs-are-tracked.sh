#!/usr/bin/env bash
# The converse of developer-wip-stays-untracked.sh.
#
# That gate stops a file the repository decided NOT to track from being swept
# into a commit. This one stops the opposite: a script going in while a file it
# cannot run without stays behind on somebody's disk. Both directions have
# happened here, and the local suite was green through all four occurrences —
# a path resolves whether or not git has ever heard of the file behind it.
#
# The one that shows why a working-tree suite cannot catch this:
# tools/verify-build-outcome.sh was left out of the commit that added the
# tools/build.sh requiring it at line 151 and invoking it at 282. Everyone's
# working tree had the file. A clean checkout had a build script that died at
# its own required-input check.
#
# This case is the static half of the property and runs on every pull request.
# The dynamic half — materialise the commit, run the whole suite inside it, and
# compare — is tools/verify-clean-head.sh, which needs a working tree that
# DIFFERS from the commit to have anything to say, so it earns its keep on a
# developer's machine rather than in CI.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

SCANNER="$ASTRO_ROOT/tools/tests/lib/scan-committed-inputs.py"
tmp="$(harness::tmpdir)"

harness::assert_file_exists "$SCANNER"

# --------------------------------------------------------------------------
# The real repository
# --------------------------------------------------------------------------

harness::run python3 "$SCANNER" --repo "$ASTRO_ROOT" --rev HEAD
harness::assert_status 0 "every path a committed script names is tracked at HEAD"

# Vacuity floors. The scan reports what it covered precisely so that a broken
# git listing, a narrowed file filter or a reference regex that stopped
# matching cannot report a clean tree from having looked at nothing.
scanned="$(grep -oE 'scanned [0-9]+' "$RUN_STDOUT" | grep -oE '[0-9]+')"
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ "${scanned:-0}" -lt 40 ]; then
    harness::fail "the scan covered only ${scanned:-0} committed script(s); the git listing is broken"
fi

candidates="$(grep -oE '[0-9]+ candidate' "$RUN_STDOUT" | grep -oE '[0-9]+')"
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ "${candidates:-0}" -lt 150 ]; then
    harness::fail "the scan found only ${candidates:-0} candidate path(s); the reference regex is broken"
fi

# The declaration table is the one hand-maintained input, so it is asked the
# other question separately: is every entry still earning its place here, and
# does none of them shadow content the commit actually tracks.
harness::run python3 "$SCANNER" --repo "$ASTRO_ROOT" --rev HEAD --check-declarations
harness::assert_status 0 "the NOT_TRACKED table still describes this repository"
harness::assert_output_contains "are used and none shadows tracked content" \
    "the declaration check says what it verified"

# --------------------------------------------------------------------------
# Fixtures
# --------------------------------------------------------------------------

# make_repo <dir> — an Astro-shaped repository with a tools/ directory.
make_repo() {
    local dir="$1"
    mkdir -p "$dir/tools"
    harness::setup_run git -C "$dir" init --quiet
}

commit_repo() {
    local dir="$1"
    harness::setup_run git -C "$dir" add -A
    harness::setup_run git -C "$dir" commit --quiet -m "fixture"
}

# scan_fixture <dir> — run the scanner over a fixture's HEAD.
scan_fixture() {
    harness::run python3 "$SCANNER" --repo "$1" --rev HEAD
}

# --- A committed script whose input is committed too --------------------------

satisfied="$tmp/satisfied"
make_repo "$satisfied"
cat > "$satisfied/tools/driver.sh" <<'FIXTURE'
#!/usr/bin/env bash
astro::require_file "$ASTRO_ROOT/tools/input.txt" "the input"
FIXTURE
printf 'input\n' > "$satisfied/tools/input.txt"
commit_repo "$satisfied"

scan_fixture "$satisfied"
harness::assert_status 0 "a committed script whose required input is committed"

# --- The same script with its input left untracked ---------------------------
#
# The detector's positive direction. Without this the whole check could have
# stopped matching and every repository would report clean.

coupled="$tmp/coupled"
make_repo "$coupled"
cat > "$coupled/tools/driver.sh" <<'FIXTURE'
#!/usr/bin/env bash
astro::require_file "$ASTRO_ROOT/tools/input.txt" "the input"
FIXTURE
commit_repo "$coupled"
printf 'input\n' > "$coupled/tools/input.txt"

scan_fixture "$coupled"
harness::assert_status 1 "a committed script requiring an untracked file"
harness::assert_output_contains "tools/input.txt" "the missing path is named"
harness::assert_output_contains "tools/driver.sh:2" "the requiring line is named"
# The whole matched line, not a capture group: a truncated finding reads the
# same whether it caught something fatal or something harmless.
# The needle is the fixture's literal text, so it must NOT expand here.
# shellcheck disable=SC2016
harness::assert_output_contains 'astro::require_file "$ASTRO_ROOT/tools/input.txt"' \
    "the finding quotes the line in full"

# --- A path assembled through a chain of variables ---------------------------

chained="$tmp/chained"
make_repo "$chained"
cat > "$chained/tools/driver.sh" <<'FIXTURE'
#!/usr/bin/env bash
TOOLS="$ASTRO_ROOT/tools"
LIB="$TOOLS/lib"
astro::require_file "$LIB/absent.py" "a driver"
FIXTURE
commit_repo "$chained"

scan_fixture "$chained"
harness::assert_status 1 "a path assembled from two intermediate variables"
harness::assert_output_contains "tools/lib/absent.py" "the resolved path is named"

# --- Directories count as satisfied when the commit has content there --------

directory="$tmp/directory"
make_repo "$directory"
mkdir -p "$directory/tools/lib"
cat > "$directory/tools/driver.sh" <<'FIXTURE'
#!/usr/bin/env bash
astro::require_dir "$ASTRO_ROOT/tools/lib" "the library"
cp -a "$ASTRO_ROOT/tools/lib/." "$dest/"
FIXTURE
printf '# helper\n' > "$directory/tools/lib/helper.sh"
commit_repo "$directory"

scan_fixture "$directory"
harness::assert_status 0 "a directory with committed content, and a trailing /."

# --------------------------------------------------------------------------
# The false-positive direction
#
# A check that cries wolf is a check somebody disables, so each shape that must
# NOT be reported is planted rather than assumed. Every one of these is present
# in the real tree.
# --------------------------------------------------------------------------

quiet="$tmp/quiet"
make_repo "$quiet"
cat > "$quiet/tools/driver.sh" <<'FIXTURE'
#!/usr/bin/env bash
# A comment naming $ASTRO_ROOT/tools/never-existed.sh must not be a finding.
astro::require_file "$ASTRO_ROOT/tools/real.txt" "the one real reference"
for page in ntp settings; do
    echo "$ASTRO_ROOT/webui/$page/dist/index.html"
done
report="$ASTRO_ROOT/build/reports/gn-check-$PLATFORM.txt"
glob="$ASTRO_ROOT/tools/*.sh"
outside="$ASTRO_ROOT/../elsewhere/thing.txt"
own="$SCRIPT_DIR/sibling.sh"
needle='$ASTRO_ROOT/tools/quoted-literal.sh'
message="it's fine to have an apostrophe, and $ASTRO_ROOT/tools/real.txt after it"
cat > "$generated" <<'INNER'
astro::require_file "$ASTRO_ROOT/tools/inside-a-quoted-heredoc.sh"
INNER
FIXTURE
# One reference that resolves, so the probe is not vacuous: without it the
# fixture would trip the "nothing was scanned" floor and every assertion below
# would be measuring an empty scan rather than a quiet one.
printf 'real\n' > "$quiet/tools/real.txt"
commit_repo "$quiet"

scan_fixture "$quiet"
harness::assert_status 0 "prose, variable segments, globs, .., literals and heredoc bodies"
harness::assert_output_lacks "never-existed" "a path named only in a comment"
harness::assert_output_lacks "webui" "a path with a variable segment"
harness::assert_output_lacks "gn-check-" "a path truncated at a variable"
harness::assert_output_lacks "elsewhere" "a path escaping the repository"
harness::assert_output_lacks "sibling.sh" "a path rooted at something other than ASTRO_ROOT"
harness::assert_output_lacks "quoted-literal" "a single-quoted string the shell would not expand"
harness::assert_output_lacks "inside-a-quoted-heredoc" "the body of a quoted heredoc"
harness::assert_output_contains "1 candidate" "exactly the one reference that resolves"

# --------------------------------------------------------------------------
# Vacuity
# --------------------------------------------------------------------------

empty="$tmp/empty"
make_repo "$empty"
printf 'nothing to see\n' > "$empty/README.md"
commit_repo "$empty"

scan_fixture "$empty"
harness::assert_status 2 "a commit with no committed scripts must not read as a pass"
harness::assert_output_contains "nothing was scanned" "the vacuous run says so"

# --------------------------------------------------------------------------
# The declaration table, in both directions
#
# NOT_TRACKED is the one hand-maintained input, so the join against it is
# strict both ways: a declaration nothing matches is stale, and a declaration
# covering tracked content would silence real findings. Neither can be
# exercised from a fixture — the table is a constant in the scanner — so both
# are mutation-tested by planting an entry in a copy of it.
# --------------------------------------------------------------------------

# The scanner loads tools/tests/lib/scan-shell-patterns.py from its own
# directory and raises if it is absent, so a mutant has to sit beside a copy of
# it. That requirement is deliberate — the shared comment reading is a required
# input, not an optional one — and it is why the mutants live in a directory of
# their own rather than loose in the fixture root.
MUTANTS="$tmp/mutants"
mkdir -p "$MUTANTS"
cp "$ASTRO_ROOT/tools/tests/lib/scan-shell-patterns.py" "$MUTANTS/"

mutate_table() {
    local entry="$1" destination="$2"
    sed 's|^NOT_TRACKED: list\[tuple\[str, str\]\] = \[$|&\n'"$entry"'|' \
        "$SCANNER" > "$destination"

    # The sed must have changed something. A pattern that stopped matching
    # would leave an unmutated copy, and both mutations below would then
    # "pass" by measuring the unmutated scanner.
    HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
    if cmp -s "$SCANNER" "$destination"; then
        harness::fail "the table mutation changed nothing; the anchor no longer matches"
    fi
}

mutate_table '    ("not-referenced-anywhere", "a declaration nothing names"),' \
    "$MUTANTS/stale-scanner.py"
harness::run python3 "$MUTANTS/stale-scanner.py" --repo "$ASTRO_ROOT" --rev HEAD --check-declarations
harness::assert_status 2 "a declaration no committed script names"
harness::assert_output_contains "stale declaration" "the stale entry is named"

mutate_table '    ("tools", "an entry broad enough to cover tracked content"),' \
    "$MUTANTS/overbroad-scanner.py"
harness::run python3 "$MUTANTS/overbroad-scanner.py" --repo "$ASTRO_ROOT" --rev HEAD --check-declarations
harness::assert_status 2 "a declaration covering tracked content"
harness::assert_output_contains "over-broad declaration" "the over-broad entry is named"

# And the mutated scanner must still have been measuring something. Exit 2 is
# also what a vacuous run returns, so without this both mutations above would
# pass on a copy that scanned nothing — or on one that failed to parse.
mutant_scanned="$(grep -oE 'scanned [0-9]+' "$RUN_STDOUT" | grep -oE '[0-9]+')"
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ "${mutant_scanned:-0}" -lt 40 ]; then
    harness::fail "the mutated scanner covered only ${mutant_scanned:-0} script(s); it exited 2 for the wrong reason"
fi

harness::pass
