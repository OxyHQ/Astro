#!/usr/bin/env bash
# The baseline inventories are what later issues cite as their compatibility
# reference, so each generator has to be right about the repository AND has to
# fail loudly when it cannot be.
#
# Every detector here is checked in both directions. A detector that only ever
# reports "found a violation" is indistinguishable from one that always does,
# and it would quietly certify a fixed page as still broken.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

BASELINE="$ASTRO_ROOT/tools/baseline"
tmp="$(harness::tmpdir)"

# --------------------------------------------------------------------------
# Patch inventory
# --------------------------------------------------------------------------

harness::run python3 "$BASELINE/inventory_patches.py" --verify
harness::assert_status 0 "patch inventory over the real patch stack"
# 54, not 56: two files in patches/astro/ were 0 bytes and were removed from
# the stack. An empty file is not a patch — `git apply` rejects it outright —
# and one of them (007-oxy-auth-build-hook) is why nothing in the committed
# pipeline compiles the Astro overlay. See patch-dispositions.json.
harness::assert_output_contains "astro 54" "every Astro patch is covered"
harness::assert_output_contains "ungoogled 112" "every inherited patch is covered"

harness::run python3 "$BASELINE/inventory_patches.py" --json "$tmp/patches.json"
harness::assert_status 0 "patch inventory JSON"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
python3 - "$tmp/patches.json" "$ASTRO_ROOT" <<'PY' || exit 1
import json, pathlib, sys

path, repo = sys.argv[1:3]
with open(path, encoding="utf-8") as handle:
    document = json.load(handle)

astro = document["series"]["astro"]

# Every patch on disk is in the inventory, and in the order the series declares.
on_disk = sorted(p.name for p in (pathlib.Path(repo) / "patches/astro").glob("*.patch"))
assert sorted(p["name"] for p in astro["patches"]) == on_disk, "inventory misses a patch"
assert [p["order"] for p in astro["patches"]] == list(range(1, len(on_disk) + 1))

# Every Astro patch carries a disposition, and it is one of the four values.
valid = {"keep", "replace", "remove", "investigate"}
for patch in astro["patches"]:
    disposition = patch["disposition"]
    assert disposition["disposition"] in valid, patch
    assert disposition.get("purpose"), f"{patch['name']} has no purpose"
    assert disposition["source"] == "patch", f"{patch['name']} fell back to a group"

# The three known overlaps, named individually so a silently-empty overlap
# detector cannot pass.
overlaps = {o["file"] for o in astro["file_overlaps"]}
for expected in (
    "chrome/browser/ui/webui/chrome_web_ui_configs.cc",
    "chrome/browser/ui/browser_navigator.cc",
    "chrome/browser/prefs/browser_prefs.cc",
):
    assert expected in overlaps, f"overlap not detected: {expected}"

# Inherited patches resolve through their group rather than needing 112
# hand-written entries.
ungoogled = document["series"]["ungoogled"]["patches"]
assert any(p["disposition"]["source"].startswith("group:") for p in ungoogled)
PY

# --- The join is strict in BOTH directions ----------------------------------

dispositions="$ASTRO_ROOT/docs/astro-next/baseline/patch-dispositions.json"
harness::assert_file_exists "$dispositions"

# A patch with no disposition must fail. Simulated by removing one entry from a
# copy of the dispositions file and pointing the tool at it.
python3 - "$dispositions" "$tmp/missing.json" <<'PY'
import json, sys
src, dst = sys.argv[1:3]
with open(src, encoding="utf-8") as handle:
    document = json.load(handle)
del document["patches"]["001-branding-strings.patch"]
with open(dst, "w", encoding="utf-8") as handle:
    json.dump(document, handle)
PY
harness::run env ASTRO_TEST_DISPOSITIONS="$tmp/missing.json" \
    python3 - "$BASELINE/inventory_patches.py" "$tmp/missing.json" <<'PY'
import importlib.util, pathlib, sys
tool, dispositions = sys.argv[1:3]
spec = importlib.util.spec_from_file_location("inv", tool)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.DISPOSITIONS = pathlib.Path(dispositions)
module.build(True)
PY
harness::assert_nonzero_status "a patch with no disposition"
harness::assert_output_contains "no disposition for Astro patch" "refusal reason"
harness::assert_output_contains "investigate" "tells the author what to record instead"

# A disposition for a patch that no longer exists must also fail: that is stale
# documentation pointing at nothing.
python3 - "$dispositions" "$tmp/orphan.json" <<'PY'
import json, sys
src, dst = sys.argv[1:3]
with open(src, encoding="utf-8") as handle:
    document = json.load(handle)
document["patches"]["999-was-deleted.patch"] = {
    "purpose": "gone", "disposition": "keep", "effect": "none"}
with open(dst, "w", encoding="utf-8") as handle:
    json.dump(document, handle)
PY
harness::run python3 - "$BASELINE/inventory_patches.py" "$tmp/orphan.json" <<'PY'
import importlib.util, pathlib, sys
tool, dispositions = sys.argv[1:3]
spec = importlib.util.spec_from_file_location("inv", tool)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.DISPOSITIONS = pathlib.Path(dispositions)
module.build(True)
PY
harness::assert_nonzero_status "a disposition naming a patch that does not exist"
harness::assert_output_contains "999-was-deleted.patch" "names the stale entry"

# --------------------------------------------------------------------------
# GN args matrix
# --------------------------------------------------------------------------

harness::run python3 "$BASELINE/inventory_gn_args.py" --verify
harness::assert_status 0 "GN args matrix"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
keys="$(grep -oE '^gn args: [0-9]+' "$RUN_STDOUT" | grep -oE '[0-9]+')"
if [ "${keys:-0}" -lt 20 ]; then
    harness::fail "only ${keys:-0} GN keys parsed; the parser is broken"
fi
harness::assert_output_contains "partially set" "reports keys set on some platforms only"

# --------------------------------------------------------------------------
# WebUI security
# --------------------------------------------------------------------------

harness::run python3 "$BASELINE/inventory_webui_security.py" --verify
harness::assert_status 0 "WebUI security baseline"
harness::assert_output_contains "trusted-types-disabled" "detects DisableTrustedTypesCSP"
harness::assert_output_contains "unsafe-inline" "detects relaxed CSP"
harness::assert_output_contains "remote-origins" "detects remote font origins"
harness::assert_output_contains "serves-from-exe-dir" "detects serving from DIR_EXE"

# unsafe-eval appears twice in this repository and NEITHER is Astro's: both are
# $csp= rules inside the shipped easylist data. Reporting them would be a false
# positive on an epic rule, and a baseline that cries wolf is one nobody trusts.
harness::assert_output_lacks "unsafe-eval" "must not report filter-list data as an Astro CSP violation"

# The other direction: a controller WITHOUT the problems must come back clean,
# otherwise the detector could be passing by always reporting a violation.
clean="$tmp/clean-source"
mkdir -p "$clean"
cat > "$clean/astro_clean_ui.cc" <<'CONTROLLER'
// A WebUI controller with none of the problems the baseline looks for.
void Configure(content::WebUIDataSource* source) {
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::ScriptSrc,
      "script-src chrome://resources 'self';");
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::FontSrc,
      "font-src 'self';");
  source->AddResourcePath("index.html", IDR_ASTRO_CLEAN_HTML);
}
CONTROLLER

harness::run python3 "$BASELINE/inventory_webui_security.py" --verify --source "$clean"
harness::assert_status 0 "a controller with no violations"
harness::assert_output_contains "1 controller(s)" "the clean controller was read"
harness::assert_output_lacks "trusted-types-disabled" "no false positive on Trusted Types"
harness::assert_output_lacks "unsafe-inline" "no false positive on unsafe-inline"
harness::assert_output_lacks "remote-origins" "no false positive on remote origins"
harness::assert_output_lacks "serves-from-exe-dir" "no false positive on DIR_EXE"

# And a controller WITH each problem must be caught, so the clean result above
# is not simply a detector that never fires.
dirty="$tmp/dirty-source"
mkdir -p "$dirty"
cat > "$dirty/astro_dirty_ui.cc" <<'CONTROLLER'
void Configure(content::WebUIDataSource* source) {
  base::PathService::Get(base::DIR_EXE, &exe_dir);
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::StyleSrc,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;");
  source->DisableTrustedTypesCSP();
}
CONTROLLER

harness::run python3 "$BASELINE/inventory_webui_security.py" --verify --source "$dirty"
harness::assert_status 0 "a controller with every violation"
harness::assert_output_contains "trusted-types-disabled" "catches Trusted Types"
harness::assert_output_contains "unsafe-inline" "catches unsafe-inline"
harness::assert_output_contains "remote-origins" "catches remote origins"
harness::assert_output_contains "serves-from-exe-dir" "catches DIR_EXE"

# --------------------------------------------------------------------------
# Source inventory
# --------------------------------------------------------------------------

harness::run python3 "$BASELINE/inventory_sources.py" --verify
harness::assert_status 0 "source inventory"
harness::assert_output_contains "declared destination" "reads the overlay allowlist"
harness::assert_output_contains "upstream overwrite" "reports whole-file overwrites"

# --------------------------------------------------------------------------
# Endpoint inventory
# --------------------------------------------------------------------------

harness::run python3 "$BASELINE/inventory_endpoints.py" --verify
harness::assert_status 0 "endpoint inventory"
harness::assert_output_contains "auth.oxy.so" "finds the Oxy identity host"
harness::assert_output_contains "fonts.gstatic.com" "finds the remote font host"
harness::assert_output_contains "easylist.to" "finds the filter-list host"

harness::pass
