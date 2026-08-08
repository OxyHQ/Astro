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
# 57 files, but the series numbers them to 059: two files in patches/astro/
# were 0 bytes and were removed from the stack. An empty file is not a patch —
# `git apply` rejects it outright. See patch-dispositions.json, which still
# records both by name and byte size.
#
# The literal is the point. Deriving this count from the series would make the
# assertion agree with whatever it is handed, and the inventory's whole job is
# to notice a patch that arrived without a disposition — so a new patch is
# meant to fail here once, deliberately, and be counted in by hand.
harness::assert_output_contains "astro 60" "every Astro patch is covered"
harness::assert_output_contains "ungoogled 112" "every inherited patch is covered"

harness::run python3 "$BASELINE/inventory_patches.py" --json "$tmp/patches.json"
harness::assert_status 0 "patch inventory JSON"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
python3 - "$tmp/patches.json" "$ASTRO_ROOT" <<'PY' || exit 1
import json, pathlib, subprocess, sys

path, repo = sys.argv[1:3]
with open(path, encoding="utf-8") as handle:
    document = json.load(handle)

astro = document["series"]["astro"]

# Every COMMITTED patch is in the inventory, and in the order the series
# declares. Committed, not "on disk": the inventory is derived from HEAD so a
# clean checkout reproduces it, and a directory listing would compare it against
# whatever uncommitted patch files this machine happens to carry.
committed = sorted(
    pathlib.PurePosixPath(name).name
    for name in subprocess.run(
        ["git", "-C", repo, "ls-tree", "-r", "--name-only", "HEAD", "--", "patches/astro"],
        capture_output=True, text=True, check=True,
    ).stdout.split()
    if name.endswith(".patch")
)
assert sorted(p["name"] for p in astro["patches"]) == committed, "inventory misses a patch"
assert [p["order"] for p in astro["patches"]] == list(range(1, len(committed) + 1))

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
# copy of the dispositions file and handing the tool that text.
#
# The dispositions document is passed in as TEXT rather than by swapping a path
# on the module. The generator reads committed content and has no "read this
# file from disk instead" switch by design — that escape hatch is how the
# working tree got into the baseline in the first place — so the seam a test
# uses is the same one the tool exposes to any caller.
python3 - "$dispositions" "$tmp/missing.json" <<'PY'
import json, sys
src, dst = sys.argv[1:3]
with open(src, encoding="utf-8") as handle:
    document = json.load(handle)
del document["patches"]["001-branding-strings.patch"]
with open(dst, "w", encoding="utf-8") as handle:
    json.dump(document, handle)
PY
harness::run python3 - "$BASELINE/inventory_patches.py" "$tmp/missing.json" <<'PY'
import importlib.util, pathlib, sys
tool, dispositions = sys.argv[1:3]
# The tool imports its sibling `committed_state`; loading it by path rather
# than running it as a script means that directory is not already on sys.path.
sys.path.insert(0, str(pathlib.Path(tool).resolve().parent))
spec = importlib.util.spec_from_file_location("inv", tool)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.build(True, dispositions_text=pathlib.Path(dispositions).read_text(encoding="utf-8"))
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
sys.path.insert(0, str(pathlib.Path(tool).resolve().parent))
spec = importlib.util.spec_from_file_location("inv", tool)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.build(True, dispositions_text=pathlib.Path(dispositions).read_text(encoding="utf-8"))
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

harness::run python3 "$BASELINE/inventory_webui_security.py" --verify --worktree-source "$clean"
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

harness::run python3 "$BASELINE/inventory_webui_security.py" --verify --worktree-source "$dirty"
harness::assert_status 0 "a controller with every violation"
harness::assert_output_contains "trusted-types-disabled" "catches Trusted Types"
harness::assert_output_contains "unsafe-inline" "catches unsafe-inline"
harness::assert_output_contains "remote-origins" "catches remote origins"
harness::assert_output_contains "serves-from-exe-dir" "catches DIR_EXE"

# A controller can also declare its CSP as a `WebUIPage` and let
# astro_webui_page.cc apply it. That refactor CLEARED the settings page from
# this baseline once: no OverrideContentSecurityPolicy call in the controller
# meant "No CSP overrides", and no `base::DIR_EXE` in it meant the DIR_EXE read
# went unreported too, with an 'unsafe-inline' widening invisible in both. A
# refactor must not be able to clear a security finding, so both shapes are
# read, and both directions are exercised here.
shared="$tmp/shared-base-source"
mkdir -p "$shared/webui"
cat > "$shared/webui/astro_webui_page.cc" <<'BASE'
// The shared page base: it owns the data source, applies the page's declared
// CSP, and reads the assets from beside the executable.
void CreateAstroWebUIDataSource(content::WebUI* web_ui, const WebUIPage& page) {
  base::PathService::Get(base::DIR_EXE, &exe_dir);
}
BASE
cat > "$shared/webui/astro_shared_ui.cc" <<'CONTROLLER'
// A controller that declares its CSP rather than calling the data source.
const WebUIPage& SharedPage() {
  static const WebUIPage kPage{
      .host = kHost,
      .resource_directory = "astro-shared",
      .csp =
          {
              .style_src = "style-src 'self' 'unsafe-inline';",
              .connect_src = "connect-src 'none';",
          },
  };
  return kPage;
}
CONTROLLER

harness::run python3 "$BASELINE/inventory_webui_security.py" --verify --worktree-source "$shared"
harness::assert_status 0 "a controller declaring a WebUIPage"
harness::assert_output_contains "unsafe-inline" "reads CSP out of the WebUIPage fields"
harness::assert_output_contains "serves-from-exe-dir" \
    "attributes the base's DIR_EXE read to the page that declared the WebUIPage"

# The mutation that broke it: same controller, base file absent. Reporting a
# clean page here is the failure, so the tool must refuse instead.
orphan="$tmp/shared-base-missing"
mkdir -p "$orphan/webui"
cp "$shared/webui/astro_shared_ui.cc" "$orphan/webui/astro_shared_ui.cc"

harness::run python3 "$BASELINE/inventory_webui_security.py" --verify --worktree-source "$orphan"
harness::assert_nonzero_status "a WebUIPage whose base is not in the scanned source"
harness::assert_output_contains "astro_webui_page.cc" "and the refusal names the file it needed"

# And the other direction for the base half: a page declaring nothing unsafe,
# with a base that does not read DIR_EXE, must come back clean — otherwise the
# two findings above are a detector that always fires.
declared_clean="$tmp/shared-base-clean"
mkdir -p "$declared_clean/webui"
cat > "$declared_clean/webui/astro_webui_page.cc" <<'BASE'
// A base that serves from a .pak instead, which is where #16 takes it.
void CreateAstroWebUIDataSource(content::WebUI* web_ui, const WebUIPage& page) {
  source->AddResourcePaths(page.resources);
}
BASE
cat > "$declared_clean/webui/astro_clean_shared_ui.cc" <<'CONTROLLER'
const WebUIPage& CleanPage() {
  static const WebUIPage kPage{
      .host = kHost,
      .csp = {.style_src = "style-src 'self';"},
  };
  return kPage;
}
CONTROLLER

harness::run python3 "$BASELINE/inventory_webui_security.py" --verify --worktree-source "$declared_clean"
harness::assert_status 0 "a WebUIPage with nothing to report"
harness::assert_output_lacks "unsafe-inline" "no false positive from the WebUIPage shape"
harness::assert_output_lacks "serves-from-exe-dir" "no false positive from a pak-backed base"

# Reading a directory off disk is a diagnostic mode, and it must not be able to
# write the committed document. Without this, --worktree-source is one flag away
# from reintroducing exactly the bug this generator was changed to fix.
harness::run python3 "$BASELINE/inventory_webui_security.py" \
    --worktree-source "$dirty" --markdown "$tmp/should-not-exist.md"
harness::assert_nonzero_status "--worktree-source asked to write the committed document"
harness::assert_output_contains "cannot produce --markdown" "names the refusal"

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
if [ -e "$tmp/should-not-exist.md" ]; then
    harness::fail "--worktree-source wrote a markdown document after refusing to"
fi

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
