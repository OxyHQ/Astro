#!/usr/bin/env bash
# Domain substitution must not claim to have happened when it did not.
#
# domain_regex.list holds Python regexes with group references (\g<1>). The old
# implementation passed each raw line to `sed -e`, which is not a valid sed
# expression, so every expression failed against every listed file. The error
# went to 2>/dev/null and the step printed a count and continued. No Astro
# build has ever had domain substitution applied.
#
# The fix for #4 is not to implement it — that is #8's scope — but to stop the
# step from reporting a success it did not achieve.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

tmp="$(harness::tmpdir)"
chromium="$tmp/chromium-src"
ungoogled="$tmp/ungoogled"

harness::make_chromium_fixture "$chromium"
mkdir -p "$ungoogled"

# The real regex list is Python-syntax, exactly as shipped by upstream.
cat > "$ungoogled/domain_regex.list" <<'EOF'
fonts(\\*?)\.googleapis(\\*?)\.com#f0ntz\g<1>.9oo91e8p1\g<2>.qjz9zk
google([A-Za-z\-]*?\\*?)\.com(?!mon)#9oo91e\g<1>.qjz9zk
EOF
printf 'net/net_util.cc\n' > "$ungoogled/domain_substitution.list"
: > "$ungoogled/pruning.list"

# Confirm the premise: a raw line from the list is not a valid sed expression.
# If sed ever accepts it, this case is testing nothing and must be revisited.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if printf 'x\n' | sed -e "$(head -1 "$ungoogled/domain_regex.list")" >/dev/null 2>&1; then
    harness::fail "premise broken: sed accepts the Python-syntax expression"
fi

printf 'const char kUrl[] = "https://fonts.googleapis.com/x";\n' > "$chromium/net/net_util.cc"
git -C "$chromium" add -A
git -C "$chromium" commit --quiet -m "with a google domain"

before="$(harness::manifest "$chromium")"

# --- Default: refuse, loudly, with the reason -------------------------------

harness::run env ASTRO_CHROMIUM_SRC="$chromium" ASTRO_PATCH_REPORT="$tmp/report.json" \
    "$ASTRO_ROOT/tools/apply-patches.sh" domains \
    --dest "$chromium" --ungoogled-patches "$ungoogled"

harness::assert_nonzero_status "domain substitution with the shipped Python regexes"
harness::assert_output_contains "not implemented and cannot be applied" "refusal reason"
harness::assert_output_contains "substituting nothing" "states what previous builds did"
harness::assert_output_contains "--skip-domain-substitution" "names the explicit way forward"
harness::assert_tree_unchanged "$chromium" "$before"

# --- Explicit skip: proceeds, warns, and records the fact -------------------

harness::run env ASTRO_CHROMIUM_SRC="$chromium" ASTRO_PATCH_REPORT="$tmp/report.json" \
    "$ASTRO_ROOT/tools/apply-patches.sh" domains --skip-domain-substitution \
    --dest "$chromium" --ungoogled-patches "$ungoogled"

harness::assert_status 0 "domain substitution explicitly skipped"
harness::assert_output_contains "optional:domain-substitution" "structured warning"
harness::assert_output_contains "NO domain substitution applied" "states the consequence"
harness::assert_tree_unchanged "$chromium" "$before"

# The report records it, so no downstream artifact can imply otherwise.
harness::assert_file_exists "$tmp/report.json"
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
python3 - "$tmp/report.json" <<'PY' || exit 1
import json, sys

with open(sys.argv[1], encoding="utf-8") as handle:
    document = json.load(handle)

assert document["domain_substitution"] == "skipped-by-flag", document["domain_substitution"]
assert document["substituted"] == [], document["substituted"]
PY

harness::pass
