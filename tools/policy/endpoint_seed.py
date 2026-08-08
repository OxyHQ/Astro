"""Seed the endpoint manifest FROM the generated baseline inventory (issue #10).

The manifest's host set is never typed by hand. A hand-copied list is stale the
day it is written, and the failure is silent: the copy keeps describing a
repository that has moved on, and the next person reads it as current.

So this module derives the host set mechanically from three sources, each
attributed in the output so nobody mistakes one for another:

  baseline-inventory   `tools/baseline/inventory_endpoints.py`, imported rather
                       than re-implemented. That generator is issue #6's and is
                       CI-checked against `network-inventory.yaml`; importing it
                       means this seed cannot disagree with the committed
                       baseline about which hosts exist in `src/` and
                       `patches/`.
  webui-scan           `webui/*/src/`, which the baseline generator does NOT
                       read — it scans `src/` for `.cc/.h/.mojom/.rs` only.
                       Measured: 21 hosts live only there, including the two
                       the New Tab Page fetches from directly, the three DoH
                       resolvers the settings page's Secure DNS control offers,
                       and four that exist only in the settings app's dev
                       fixtures. A manifest seeded from the baseline alone would
                       declare a browser quieter than the one this repository
                       builds. Reported as a gap in the baseline, not as a fault
                       in it: extending that generator is #6's call.
  declared             A host with no reference in committed text at all, added
                       because the endpoint exists anyway — an upstream Chromium
                       endpoint no Astro patch mentions, or one a decision
                       introduces. Every such entry names why it cannot be
                       derived, because "the tool did not find it" and "the tool
                       cannot see it" are different statements.

## The evidence this adds, and why the manifest needs it

The baseline inventory answers "which hosts does committed text mention". That
is not the question a classification needs, because a host in a patch may be one
the patch DELETES. Measured across the committed stack: of the 94 hosts carrying
patch references, 39 appear only on lines a patch REMOVES or on diff headers —
one host in three. Classifying those as endpoints
Astro contacts would invent a browser that does not exist.

So every reference is resolved to the diff side it sits on:

  added      the patched tree contains this text; the reference is live
  removed    the patched tree does NOT contain it; the patch deletes it
  context    unchanged surrounding text; the tree contains it, patch-independent
  header     a `---`/`+++`/`diff`/`index` line — a filename, never a request

`header` matters more than it looks. `--- a/chrome/...` lines are how a URL-like
string reaches this scan without being a URL at all.

One deliberate limitation, stated rather than hidden: a diff side says what the
PATCH does, not whether the patch APPLIES. Nine Astro patches do not apply to
the locked Chromium revision (baseline finding 3), so their added hosts are not
in any tree today. That is declared per-patch in `endpoint-dispositions.json`
rather than measured here, because measuring it means running the patch stack
against a Chromium checkout, which this module deliberately does not need.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path
from urllib.parse import urlsplit

REPO_ROOT = Path(__file__).resolve().parents[2]
BASELINE_DIR = REPO_ROOT / "tools" / "baseline"

# The baseline generators are importable only from their own directory, and they
# are imported rather than copied on purpose: a copy of the scan would drift
# from the committed inventory without anything noticing.
if str(BASELINE_DIR) not in sys.path:
    sys.path.insert(0, str(BASELINE_DIR))

import committed_state  # noqa: E402
import inventory_endpoints  # noqa: E402

SOURCE_BASELINE = "baseline-inventory"
SOURCE_WEBUI = "webui-scan"
SOURCE_DECLARED = "declared"

# The WebUI frontends. Text formats only: `dist/` is build output and would
# report a host twice, once from the source it was built from.
WEBUI_ROOT = "webui"
WEBUI_SUFFIXES = (".html", ".ts", ".tsx", ".js", ".css")
WEBUI_EXCLUDE = ("/dist/", "/node_modules/")

# A hostname, not merely "a string with a dot in it". Frontend source is full of
# URL-shaped text that is not a URL — `https://...` in a comment, template
# literals interpolating a base, `$`-prefixed placeholders — and each one would
# otherwise become a manifest entry demanding a disposition for a host that does
# not exist. Requires real labels and an alphabetic TLD.
HOSTNAME_RE = re.compile(
    r"^(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$"
)

DIFF_SIDES = ("added", "removed", "context", "header")


def _host_of(url: str) -> str:
    # Trailing punctuation is part of the surrounding source, not the URL. The
    # baseline generator strips the same set; keeping them in step matters
    # because a host that differs by one character is a different manifest entry.
    return urlsplit(url.rstrip("\";'),")).netloc


def _diff_side(line: str) -> str:
    if line.startswith(("--- ", "+++ ", "diff ", "index ")):
        return "header"
    if line.startswith("+"):
        return "added"
    if line.startswith("-"):
        return "removed"
    return "context"


def _sides_in_patch(relative: str, host: str) -> dict[str, int]:
    """How many times `host` appears on each diff side of one patch file."""
    text = committed_state.read_bytes(relative).decode("utf-8", "replace")
    sides: dict[str, int] = {}
    for line in text.splitlines():
        if host not in {_host_of(url) for url in inventory_endpoints.URL_RE.findall(line)}:
            continue
        side = _diff_side(line)
        sides[side] = sides.get(side, 0) + 1
    return sides


def _blank(host: str, source: str) -> dict:
    return {
        "host": host,
        "sources": [source],
        "components": [],
        "references": [],
        "patch_sides": {},
        "substituted_shape": bool(inventory_endpoints.SUBSTITUTED_MARKER.search(host)),
    }


def _merge(seed: dict[str, dict], host: str, source: str) -> dict:
    entry = seed.setdefault(host, _blank(host, source))
    if source not in entry["sources"]:
        entry["sources"].append(source)
    return entry


def _from_baseline(seed: dict[str, dict]) -> None:
    document = inventory_endpoints.build()
    for section, is_patch in (("overlay_hosts", False), ("patch_hosts", True)):
        for record in document[section]:
            entry = _merge(seed, record["host"], SOURCE_BASELINE)
            if record["component"] not in entry["components"]:
                entry["components"].append(record["component"])
            for reference in record["references"]:
                if reference not in entry["references"]:
                    entry["references"].append(reference)
                if not is_patch:
                    continue
                for side, count in _sides_in_patch(reference, record["host"]).items():
                    entry["patch_sides"][side] = entry["patch_sides"].get(side, 0) + count


def _from_webui(seed: dict[str, dict]) -> None:
    for relative in committed_state.list_files(WEBUI_ROOT, WEBUI_SUFFIXES):
        if any(marker in relative for marker in WEBUI_EXCLUDE):
            continue
        try:
            text = committed_state.read_bytes(relative).decode("utf-8")
        except UnicodeDecodeError:
            continue
        for url in inventory_endpoints.URL_RE.findall(text):
            host = _host_of(url)
            if not HOSTNAME_RE.match(host):
                continue
            entry = _merge(seed, host, SOURCE_WEBUI)
            if "webui" not in entry["components"]:
                entry["components"].append("webui")
            if relative not in entry["references"]:
                entry["references"].append(relative)


def build_seed() -> dict[str, dict]:
    """Every host committed text references, with its provenance and diff sides."""
    committed_state.require_repository()
    seed: dict[str, dict] = {}
    _from_baseline(seed)
    _from_webui(seed)
    for entry in seed.values():
        entry["components"].sort()
        entry["references"].sort()
        entry["sources"].sort()
    return dict(sorted(seed.items()))


def reference_only(entry: dict) -> bool:
    """True when every patch reference sits on a side that makes no request.

    A host seen only on `removed` and `header` lines is not contacted by the
    patched tree: the patch deletes the one and the other is a filename. This is
    the mechanical half of the KEEP/DISABLE distinction, and it is deliberately
    conservative — it says nothing about hosts referenced from source rather
    than patch text, which is why it returns False when there are none.
    """
    sides = entry.get("patch_sides") or {}
    if not sides:
        return False
    if entry["sources"] != [SOURCE_BASELINE]:
        return False
    live = {"added", "context"}
    return not (live & {side for side, count in sides.items() if count})


if __name__ == "__main__":
    seed = build_seed()
    print(f"{len(seed)} host(s) seeded")
    for host, entry in seed.items():
        sides = ",".join(f"{k}={v}" for k, v in sorted(entry["patch_sides"].items()))
        print(f"  {host:45} {'+'.join(entry['sources']):40} {sides}")
