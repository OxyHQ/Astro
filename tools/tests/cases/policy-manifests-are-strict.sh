#!/usr/bin/env bash
# The feature and endpoint manifests (issue #10) are what later issues cite as
# their input, so the checks that keep them honest have to be checks that can
# fail. Every detector below is exercised in BOTH directions: the clean run
# passes, and a deliberate mutation makes it fail AND name the thing it caught.
#
# A detector that only ever reports "no violation" is indistinguishable from one
# whose traversal is broken, and it would certify a rotted manifest as current.
#
# The manifests are mutated in a COPY of the repository's policy directory, and
# the tool is pointed at it with --policy-dir, so a developer's uncommitted work
# in docs/astro-next/policy/ is never touched. A flag rather than an environment
# variable: it changes what is being measured, so it has to be visible in the
# command, and it cannot be set ambiently for a run that was meant to be real.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

POLICY_TOOL="$ASTRO_ROOT/tools/policy/manifest.py"
POLICY_DIR="$ASTRO_ROOT/docs/astro-next/policy"
tmp="$(harness::tmpdir)"

# --------------------------------------------------------------------------
# The committed manifests validate and their documents are current
# --------------------------------------------------------------------------

harness::run python3 "$POLICY_TOOL" --check
harness::assert_status 0 "committed policy manifests validate"
harness::assert_output_contains "policy manifests validate" "the check reports its verdict"

# Vacuity floor on the run itself. Every rule prints how many entries it
# examined; a traversal that silently visited nothing would print zero and
# still exit 0 without these.
harness::assert_output_contains "checked host-join:" "the host join reports its size"
harness::assert_output_contains "checked feature-ids:" "the feature id check reports its size"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
python3 - "$RUN_STDOUT" <<'PY' || harness::fail "a rule class examined nothing"
import re, sys

text = open(sys.argv[1], encoding="utf-8").read()
counts = dict(re.findall(r"checked ([a-z-]+): (\d+)", text))
if not counts:
    raise SystemExit("no rule reported a count at all")
empty = sorted(name for name, number in counts.items() if int(number) == 0)
if empty:
    raise SystemExit(f"rule(s) examined nothing: {empty}")
# The host join is the load-bearing one. A seed that collapsed to a handful of
# hosts would still "pass" every join.
if int(counts.get("host-join", 0)) < 50:
    raise SystemExit(f"host join covered only {counts.get('host-join')} hosts")
PY

# --------------------------------------------------------------------------
# Mutation: a host in committed text with no manifest entry must fail
# --------------------------------------------------------------------------
#
# This is the property that stops a new endpoint merging undeclared, so it is
# the one most worth proving can fail.

mutate() {
    # $1 = python expression body operating on `document`
    # $2 = which manifest
    rm -rf "$tmp/policy"
    cp -a "$POLICY_DIR" "$tmp/policy"
    python3 - "$tmp/policy/$2" "$1" <<'PY'
import json, sys
path, mutation = sys.argv[1], sys.argv[2]
with open(path, encoding="utf-8") as handle:
    document = json.load(handle)
exec(mutation)
with open(path, "w", encoding="utf-8") as handle:
    json.dump(document, handle, indent=2)
PY
}

run_mutated() {
    harness::run python3 "$POLICY_TOOL" --check --policy-dir "$tmp/policy"
}

mutate "document['hosts'] = [e for e in document['hosts'] if e['host'] != 'auth.oxy.so']" endpoints.json
run_mutated
harness::assert_nonzero_status "dropping a declared host fails the join"
harness::assert_output_contains "auth.oxy.so" "the failure names the undeclared host"

# --------------------------------------------------------------------------
# Mutation: an entry for a host nothing references must fail
# --------------------------------------------------------------------------

mutate "document['hosts'].append(dict(document['hosts'][0], host='invented.example', id='invented-example'))" endpoints.json
run_mutated
harness::assert_nonzero_status "an entry for an unreferenced host fails"
harness::assert_output_contains "invented.example" "the failure names the invented host"

# --------------------------------------------------------------------------
# Mutation: INVESTIGATE without a question must fail
# --------------------------------------------------------------------------

mutate "[e.pop('investigate') for e in document['hosts'] if e['state'] == 'INVESTIGATE'][:1]" endpoints.json
run_mutated
harness::assert_nonzero_status "INVESTIGATE without a question fails"
harness::assert_output_contains "investigate block" "the failure says what is missing"

# --------------------------------------------------------------------------
# Mutation: DORMANT on a NOT_BUILT feature must fail
# --------------------------------------------------------------------------
#
# The rule that keeps baseline finding 1 — the overlay is not in the build graph
# — from being recorded as a disposition somebody chose.

mutate "next(e for e in document['features'] if e['observed_state'] == 'NOT_BUILT').update(state='DORMANT')" features.json
run_mutated
harness::assert_nonzero_status "DORMANT on a NOT_BUILT feature fails"
harness::assert_output_contains "build defect" "the failure explains why it is not a disposition"

# --------------------------------------------------------------------------
# Mutation: a duplicate id must fail
# --------------------------------------------------------------------------

mutate "document['features'].append(dict(document['features'][0]))" features.json
run_mutated
harness::assert_nonzero_status "a duplicate feature id fails"
harness::assert_output_contains "is declared 2 times" "the failure names the duplication"

# --------------------------------------------------------------------------
# Mutation: an endpoint naming an unknown feature must fail
# --------------------------------------------------------------------------

mutate "next(e for e in document['hosts'] if e['owning_feature'] != 'none').update(owning_feature='no-such-feature')" endpoints.json
run_mutated
harness::assert_nonzero_status "an unknown owning_feature fails"
harness::assert_output_contains "no-such-feature" "the failure names the unknown feature"

# --------------------------------------------------------------------------
# Mutation: a schema keyword the validator does not honour must fail
# --------------------------------------------------------------------------
#
# Without this, adding a constraint the validator ignores looks exactly like
# adding one it enforces.

mutate "document['\$defs']['endpoint']['maxProperties'] = 3" endpoint-manifest.schema.json
run_mutated
harness::assert_nonzero_status "an unenforced schema keyword fails"
harness::assert_output_contains "maxProperties" "the failure names the keyword"

# --------------------------------------------------------------------------
# Mutation: a stale generated document must be reported
# --------------------------------------------------------------------------

rm -rf "$tmp/policy"
cp -a "$POLICY_DIR" "$tmp/policy"
printf '\nDRIFTED\n' >> "$tmp/policy/network-endpoints.md"
run_mutated
harness::assert_nonzero_status "a hand-edited generated document is reported"
harness::assert_output_contains "out of date" "the failure says the document is stale"

# --------------------------------------------------------------------------
# The repository itself was never written to
# --------------------------------------------------------------------------

harness::run python3 "$POLICY_TOOL" --check
harness::assert_status 0 "the committed manifests still validate after the mutations"

harness::pass "policy manifests: joins, rules and the drift check all fail when broken"
