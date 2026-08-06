#!/usr/bin/env bash
# Binary pruning DELETES tracked files from the Chromium checkout. git reports a
# deletion as a modification, so unless the pruned paths are recorded as
# something Astro did, the post-application attribution check treats a tree the
# pipeline itself produced as carrying changes nobody can account for.
#
# That was a real defect: the report stored deletions under "pruned", while the
# attribution collector only read "path", "paths" and "files". On the first real
# run of `apply-patches.sh all` — which prunes 12,392 listed files — every
# tracked one among them would have come back unattributable.
#
# This is the end-to-end case: a tracked file is deleted by pruning, and the
# final verification recognises the deletion as an Astro-produced modification.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

tmp="$(harness::tmpdir)"
chromium="$tmp/chromium-src"
report="$tmp/patch-report.json"

harness::make_chromium_fixture "$chromium"

# A tracked binary of exactly the kind pruning removes.
mkdir -p "$chromium/third_party/prebuilt"
printf 'fake prebuilt binary\n' > "$chromium/third_party/prebuilt/tool.bin"
printf 'another prebuilt\n' > "$chromium/third_party/prebuilt/lib.so"
printf 'alpha\n' > "$chromium/net/net_util.cc"
git -C "$chromium" add -A
git -C "$chromium" commit --quiet -m "prebuilt binaries and a patch target"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 2))
[ -n "$(git -C "$chromium" ls-files -- third_party/prebuilt/tool.bin)" ] \
    || harness::fail "premise broken: the file to be pruned is not tracked"
[ -n "$(git -C "$chromium" ls-files -- third_party/prebuilt/lib.so)" ] \
    || harness::fail "premise broken: the second file to be pruned is not tracked"

# An ungoogled tree carrying only a pruning list and an empty patch series.
ungoogled="$tmp/ungoogled"
mkdir -p "$ungoogled"
cat > "$ungoogled/pruning.list" <<'EOF'
third_party/prebuilt/tool.bin
third_party/prebuilt/lib.so
EOF
: > "$ungoogled/series"
# --skip-domain-substitution still requires the lists to be present; the step
# refuses to make a claim about files it was never shown.
printf 'example\.com#replaced\.invalid\n' > "$ungoogled/domain_regex.list"
: > "$ungoogled/domain_substitution.list"

# One Astro patch, so the run also modifies a file the normal way and the case
# covers both kinds of change in a single report.
astro_patches="$tmp/astro-patches"
mkdir -p "$astro_patches"
harness::write_patch "$astro_patches/001-a.patch" "net/net_util.cc" "alpha" "bravo"
printf '001-a.patch\n' > "$astro_patches/series"

# --- The full run: prune, patch, then verify every change is accounted for ---

harness::run env ASTRO_CHROMIUM_SRC="$chromium" ASTRO_PATCH_REPORT="$report" \
    "$ASTRO_ROOT/tools/apply-patches.sh" all --skip-domain-substitution \
    --dest "$chromium" --astro-patches "$astro_patches" --ungoogled-patches "$ungoogled"

harness::assert_status 0 "prune + patch + attribution over a tree with tracked deletions"
harness::assert_output_contains "pruned 2 file(s)" "both tracked files were pruned"
harness::assert_output_contains "Verifying every change is accounted for" "the post-run check ran"
harness::assert_output_contains "all attributable to Astro" "deletions were attributed"

# The deletions really happened, and git really reports them as changes — so the
# check above was not passing simply because there was nothing to attribute.
harness::assert_file_missing "$chromium/third_party/prebuilt/tool.bin"
harness::assert_file_missing "$chromium/third_party/prebuilt/lib.so"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
deleted="$(git -C "$chromium" status --porcelain | grep -c '^ D ')"
if [ "$deleted" -ne 2 ]; then
    harness::fail "expected git to report 2 deletions, got $deleted"
fi

# And the report records them where the attribution collector looks.
harness::assert_file_exists "$report"
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
python3 - "$report" <<'PY' || exit 1
import json, sys
with open(sys.argv[1], encoding="utf-8") as handle:
    document = json.load(handle)
pruned = document["pruned"]
assert "third_party/prebuilt/tool.bin" in pruned, pruned
assert "third_party/prebuilt/lib.so" in pruned, pruned
assert document["outcome"] == "succeeded", document["outcome"]
PY

# --- Mutation: without the pruned paths, attribution MUST fail ---------------
#
# Proves this case tests the fix rather than passing for some other reason. A
# report that has lost its pruning record is exactly the pre-fix state: the
# deletions are still in the tree, but nothing says Astro made them.

python3 - "$report" <<'MUTATE'
import json, sys
path = sys.argv[1]
with open(path, encoding="utf-8") as handle:
    document = json.load(handle)
document["pruned"] = []
with open(path, "w", encoding="utf-8") as handle:
    json.dump(document, handle)
MUTATE

# A second run reads the report to decide what is attributable. With the
# pruning record removed, the two deletions must come back unaccounted for.
harness::run env ASTRO_CHROMIUM_SRC="$chromium" ASTRO_PATCH_REPORT="$report" \
    "$ASTRO_ROOT/tools/apply-patches.sh" astro \
    --dest "$chromium" --astro-patches "$astro_patches"

harness::assert_nonzero_status "pruned deletions missing from the report"
harness::assert_output_contains "Astro did not write" "the deletions are unattributable"
harness::assert_output_contains "third_party/prebuilt" "names a pruned path"
harness::pass
