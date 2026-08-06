#!/usr/bin/env python3
"""Generate the WebUI security baseline for Astro Next (issue #6).

Astro's WebUI security posture is entirely readable from the controller source:
each one builds a WebUIDataSource, overrides CSP directives on it, and decides
whether to enforce Trusted Types. So this part of the baseline needs no built
browser, and it is evidence rather than recollection.

It checks the four epic (#3) non-negotiable rules that a controller can break:

    no unsafe-eval
    no unsafe-inline without a documented, owned, time-limited exception
    no blanket disabling of Trusted Types
    no privileged WebUI loading remote scripts, styles or fonts

plus one from the global definition of done:

    no privileged WebUI reads mutable application files from beside the executable

The last one matters more than it looks: a page served from `base::DIR_EXE` is
not part of the signed browser resources, so anything that can write next to the
binary can change what a privileged page runs.

CSP directives are read only from OverrideContentSecurityPolicy calls, not from
the file as a whole. `unsafe-eval` appears twice in this repository and neither
occurrence is Astro's — both are `$csp=` rules inside the shipped easylist
filter data. A grep would report two epic-rule violations that do not exist, and
a baseline that cries wolf is one nobody trusts.

Usage:
    inventory_webui_security.py --json OUT.json --markdown OUT.md [--source DIR]
    inventory_webui_security.py --verify
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE = REPO_ROOT / "src" / "chrome" / "browser" / "oxy"

# OverrideContentSecurityPolicy(CSPDirectiveName::X, "…"); possibly wrapped
# across lines, with the value split into adjacent string literals.
OVERRIDE_RE = re.compile(
    r"OverrideContentSecurityPolicy\(\s*"
    r"network::mojom::CSPDirectiveName::(\w+)\s*,\s*"
    r"((?:\s*\"(?:[^\"\\]|\\.)*\"\s*)+)\)",
    re.MULTILINE,
)
STRING_PIECE_RE = re.compile(r"\"((?:[^\"\\]|\\.)*)\"")
REMOTE_ORIGIN_RE = re.compile(r"https?://[A-Za-z0-9.-]+")

DISABLES_TRUSTED_TYPES = "DisableTrustedTypesCSP()"
SERVES_FROM_EXE_DIR = "base::DIR_EXE"


def analyse(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")

    directives = {}
    for name, raw in OVERRIDE_RE.findall(text):
        value = "".join(STRING_PIECE_RE.findall(raw))
        directives[name] = value.strip()

    remote_origins = sorted(
        {origin for value in directives.values() for origin in REMOTE_ORIGIN_RE.findall(value)}
    )
    unsafe = sorted({
        token
        for value in directives.values()
        for token in re.findall(r"'unsafe-[a-z-]+'", value)
    })

    # A --source outside the repository (the test fixtures) has no repo-relative
    # form; fall back to the absolute path rather than crashing.
    try:
        display = str(path.relative_to(REPO_ROOT))
    except ValueError:
        display = str(path)

    return {
        "file": display,
        "directives": directives,
        "remote_origins": remote_origins,
        "unsafe_tokens": unsafe,
        "trusted_types_disabled": DISABLES_TRUSTED_TYPES in text,
        "serves_from_exe_dir": SERVES_FROM_EXE_DIR in text,
    }


def violations(entry: dict) -> list[str]:
    found = []
    if "'unsafe-eval'" in entry["unsafe_tokens"]:
        found.append("unsafe-eval")
    if "'unsafe-inline'" in entry["unsafe_tokens"]:
        found.append("unsafe-inline")
    if entry["trusted_types_disabled"]:
        found.append("trusted-types-disabled")
    if entry["remote_origins"]:
        found.append("remote-origins")
    if entry["serves_from_exe_dir"]:
        found.append("serves-from-exe-dir")
    return found


def build(source_dir: Path) -> dict:
    controllers = sorted(source_dir.rglob("*_ui.cc"))
    if not controllers:
        raise SystemExit(f"ERROR no WebUI controllers found under {source_dir}")

    entries = []
    for path in controllers:
        entry = analyse(path)
        entry["violations"] = violations(entry)
        entries.append(entry)

    summary: dict[str, list[str]] = {}
    for entry in entries:
        for name in entry["violations"]:
            summary.setdefault(name, []).append(Path(entry["file"]).name)

    try:
        source_display = str(source_dir.relative_to(REPO_ROOT))
    except ValueError:
        source_display = str(source_dir)

    return {
        "tool": "tools/baseline/inventory_webui_security.py",
        "source": source_display,
        "controller_count": len(entries),
        "controllers": entries,
        "violations_by_rule": {k: sorted(v) for k, v in sorted(summary.items())},
    }


RULE_TEXT = {
    "unsafe-eval": ("No `unsafe-eval`", "epic #3, non-negotiable rules"),
    "unsafe-inline": (
        "No `unsafe-inline` unless a narrowly documented temporary exception has "
        "an owner and removal issue",
        "epic #3, non-negotiable rules",
    ),
    "trusted-types-disabled": (
        "No blanket disabling of Trusted Types", "epic #3, non-negotiable rules"
    ),
    "remote-origins": (
        "No privileged WebUI loading remote scripts, styles or fonts",
        "epic #3, non-negotiable rules",
    ),
    "serves-from-exe-dir": (
        "No privileged WebUI reads mutable application files from beside the executable",
        "epic #3, global definition of done",
    ),
}


def render_markdown(document: dict) -> str:
    lines = [
        "<!-- Generated by tools/baseline/inventory_webui_security.py — do not edit by hand.",
        "     Regenerate with: tools/baseline/generate-all.sh -->",
        "",
        "# WebUI security baseline",
        "",
        "Read from the controller source. Each controller builds a",
        "`WebUIDataSource`, overrides CSP directives on it, and decides whether to",
        "enforce Trusted Types — so this is evidence, and it needs no built browser.",
        "",
        "**Scope, and why it is drawn here.** CSP directives are read only from",
        "`OverrideContentSecurityPolicy` calls, not from the file as a whole.",
        "`unsafe-eval` appears twice in this repository and neither occurrence is",
        "Astro's: both are `$csp=` rules inside the shipped easylist filter data. A",
        "grep would report two epic-rule violations that do not exist.",
        "",
        "## Rule violations",
        "",
    ]

    if document["violations_by_rule"]:
        lines += ["| Rule | Source | Controllers |", "|---|---|---|"]
        for rule, files in document["violations_by_rule"].items():
            text, source = RULE_TEXT.get(rule, (rule, ""))
            lines.append(
                "| %s | %s | %s |" % (text, source, ", ".join(f"`{f}`" for f in files))
            )
    else:
        lines.append("None.")

    lines += [
        "",
        "None of these is a new finding introduced by this baseline — they are the",
        "current state, recorded so that later issues can show they were fixed",
        "rather than assert it. Packaging every WebUI through GN/GRIT with strict",
        "CSP and Trusted Types is",
        "[#14](https://github.com/OxyHQ/Astro/issues/14).",
        "",
        "## Per controller",
        "",
    ]

    for entry in document["controllers"]:
        lines += [f"### `{entry['file']}`", ""]
        if entry["directives"]:
            lines += ["| Directive | Value |", "|---|---|"]
            for name, value in sorted(entry["directives"].items()):
                lines.append(f"| `{name}` | `{value}` |")
        else:
            lines.append("No CSP overrides.")
        lines += [
            "",
            "| Property | Value |",
            "|---|---|",
            "| Trusted Types enforced | %s |"
            % ("**no** — `DisableTrustedTypesCSP()`" if entry["trusted_types_disabled"] else "yes"),
            "| Remote origins allowed | %s |"
            % (", ".join(f"`{o}`" for o in entry["remote_origins"]) or "none"),
            "| Unsafe CSP tokens | %s |"
            % (", ".join(f"`{t}`" for t in entry["unsafe_tokens"]) or "none"),
            "| Serves resources from `DIR_EXE` | %s |"
            % ("**yes** — mutable files beside the executable" if entry["serves_from_exe_dir"] else "no"),
            "",
        ]

    lines += [
        "## Not captured here",
        "",
        "These need a running browser and are **not** in this document. They are",
        "listed so nobody reads its silence as an all-clear:",
        "",
        "- effective origin of each internal URL at runtime",
        "- SiteInstance and process-lock behaviour",
        "- whether tokens or session ids reach URLs, logs, history or referrers",
        "- incognito behaviour for Oxy Identity, Alia and adblock",
        "- the sandbox and Site Isolation configuration of a built binary",
        "",
        "`tools/baseline/smoke.sh` is the harness that will capture them, and it",
        "refuses to emit a result it did not measure.",
        "",
    ]
    return "\n".join(lines) + "\n"


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json")
    parser.add_argument("--markdown")
    parser.add_argument("--source", default=str(DEFAULT_SOURCE))
    parser.add_argument("--verify", action="store_true")
    args = parser.parse_args(argv[1:])

    document = build(Path(args.source))

    if args.verify:
        print(f"webui security: {document['controller_count']} controller(s)")
        for rule, files in document["violations_by_rule"].items():
            print(f"  {rule}: {len(files)} controller(s)")

    if args.json:
        path = Path(args.json)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8") as handle:
            json.dump(document, handle, indent=2, sort_keys=True)
            handle.write("\n")
        print(f"wrote {path}")

    if args.markdown:
        path = Path(args.markdown)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(render_markdown(document), encoding="utf-8")
        print(f"wrote {path}")

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
