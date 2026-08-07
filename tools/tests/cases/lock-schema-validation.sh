#!/usr/bin/env bash
# The lock declares what gets compiled. A malformed one must be rejected with
# the reason named, not partially acted on.
#
# The rejections that matter most are the ones that still "look like" a
# revision: an abbreviated SHA, a branch name, a tag name. All three resolve to
# different commits over time, which is the entire failure the lock exists to
# prevent, and none of them is a syntax error.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

LOCK="$ASTRO_ROOT/tools/lib/lock.py"
SCHEMA="$ASTRO_ROOT/browser.lock.schema.json"
tmp="$(harness::tmpdir)"

harness::assert_file_exists "$LOCK"
harness::assert_file_exists "$SCHEMA"
harness::assert_file_exists "$ASTRO_ROOT/browser.lock.json"

# --- The repository's own lock is valid --------------------------------------

harness::run python3 "$LOCK" --validate "$ASTRO_ROOT/browser.lock.json" "$SCHEMA"
harness::assert_status 0 "the repository's browser.lock.json"
harness::assert_output_contains "chromium" "revision listing"
harness::assert_output_contains "depot_tools" "depot_tools is pinned"

# Production origins must be https. The schema permits file:// so the fixtures
# below can use real local git remotes without network; that relaxation must
# not leak into the real lock.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if grep -q '"url": *"file://' "$ASTRO_ROOT/browser.lock.json"; then
    harness::fail "browser.lock.json uses a file:// origin; production must be https"
fi

# Every recorded commit is a full 40-character lowercase SHA.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
while IFS=$'\t' read -r name revision; do
    [ "$revision" = "UNPINNED" ] && continue
    if ! printf '%s' "$revision" | grep -qE '^[0-9a-f]{40}$'; then
        harness::fail "$name records '$revision', which is not a full 40-char SHA"
    fi
done < <(python3 "$LOCK" --revisions "$ASTRO_ROOT/browser.lock.json" "$SCHEMA")

# --- Rejections --------------------------------------------------------------

VALID_SHA="ae03f7fb2cf1215853896d6a4c15fdceee2badb7"
DEPOT_SHA="41c40cfaec7ee3bf0423c59925d8b23982a601f1"

write_lock_with() {
    local path="$1" chromium_commit="$2"
    python3 - "$path" "$chromium_commit" "$DEPOT_SHA" <<'PY'
import json, sys
path, chromium_commit, depot_commit = sys.argv[1:4]
document = {
    "lockfile_version": 1,
    "chromium": {
        "version": "146.0.7680.177",
        "commit": chromium_commit,
        "url": "https://chromium.googlesource.com/chromium/src.git",
    },
    "depot_tools": {
        "commit": depot_commit,
        "url": "https://chromium.googlesource.com/chromium/tools/depot_tools.git",
    },
}
with open(path, "w", encoding="utf-8") as handle:
    json.dump(document, handle, indent=2)
PY
}

assert_rejected() {
    local label="$1" path="$2" needle="$3"
    harness::run python3 "$LOCK" --validate "$path" "$SCHEMA"
    harness::assert_nonzero_status "$label"
    harness::assert_output_contains "$needle" "reason for $label"
}

# An abbreviated SHA is the most plausible mistake, and the most dangerous:
# abbreviations are not stable as a repository grows.
write_lock_with "$tmp/abbrev.json" "ae03f7f"
assert_rejected "abbreviated SHA" "$tmp/abbrev.json" "abbreviated SHA"

write_lock_with "$tmp/branch.json" "main"
assert_rejected "branch name" "$tmp/branch.json" "branch or tag name"

write_lock_with "$tmp/tag.json" "refs/tags/146.0.7680.177"
assert_rejected "tag name" "$tmp/tag.json" "branch or tag name"

write_lock_with "$tmp/upper.json" "AE03F7FB2CF1215853896D6A4C15FDCEEE2BADB7"
assert_rejected "uppercase SHA" "$tmp/upper.json" "lowercase"

# Structural rejections.
printf '{"lockfile_version": 1}\n' > "$tmp/missing.json"
assert_rejected "missing chromium section" "$tmp/missing.json" "missing required field 'chromium'"

python3 - "$tmp/version.json" "$VALID_SHA" "$DEPOT_SHA" <<'PY'
import json, sys
path, sha, depot = sys.argv[1:4]
json.dump({
    "lockfile_version": 2,
    "chromium": {"version": "146.0.7680.177", "commit": sha,
                 "url": "https://example.invalid/src.git"},
    "depot_tools": {"commit": depot, "url": "https://example.invalid/dt.git"},
}, open(path, "w", encoding="utf-8"))
PY
assert_rejected "unknown lockfile version" "$tmp/version.json" "expected 1"

python3 - "$tmp/extra.json" "$VALID_SHA" "$DEPOT_SHA" <<'PY'
import json, sys
path, sha, depot = sys.argv[1:4]
json.dump({
    "lockfile_version": 1,
    "chromium": {"version": "146.0.7680.177", "commit": sha,
                 "url": "https://example.invalid/src.git", "typo_field": "x"},
    "depot_tools": {"commit": depot, "url": "https://example.invalid/dt.git"},
}, open(path, "w", encoding="utf-8"))
PY
assert_rejected "unexpected field" "$tmp/extra.json" "unexpected field"

printf 'not json at all\n' > "$tmp/broken.json"
assert_rejected "malformed JSON" "$tmp/broken.json" "not valid JSON"

# An unpinned third-party entry must say WHY, or it is just a missing pin
# wearing a declaration.
python3 - "$tmp/no-reason.json" "$VALID_SHA" "$DEPOT_SHA" <<'PY'
import json, sys
path, sha, depot = sys.argv[1:4]
json.dump({
    "lockfile_version": 1,
    "chromium": {"version": "146.0.7680.177", "commit": sha,
                 "url": "https://example.invalid/src.git"},
    "depot_tools": {"commit": depot, "url": "https://example.invalid/dt.git"},
    "third_party": {"adblock_rust": {"pinned": False, "reason": ""}},
}, open(path, "w", encoding="utf-8"))
PY
assert_rejected "unpinned entry with an empty reason" "$tmp/no-reason.json" "at least 1 character"

# --- The validator must not silently skip a constraint it cannot enforce -----
#
# A partial validator that ignores unknown schema keywords looks enforced and
# is not. This proves it refuses instead.

python3 - "$tmp/odd-schema.json" "$SCHEMA" <<'PY'
import json, sys
out, schema_path = sys.argv[1:3]
with open(schema_path, encoding="utf-8") as handle:
    schema = json.load(handle)
schema["properties"]["chromium"]["properties"]["commit"] = {"multipleOf": 3}
with open(out, "w", encoding="utf-8") as handle:
    json.dump(schema, handle)
PY

harness::run python3 "$LOCK" --validate "$ASTRO_ROOT/browser.lock.json" "$tmp/odd-schema.json"
harness::assert_nonzero_status "schema keyword the validator does not implement"
harness::assert_output_contains "does not implement" "refusal reason"
harness::assert_output_contains "skipped constraint" "explains why it refuses"

harness::pass
