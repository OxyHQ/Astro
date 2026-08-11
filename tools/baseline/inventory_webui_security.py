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

CSP reaches a data source two ways and BOTH are read. A controller may call
`OverrideContentSecurityPolicy` itself, or it may declare a `WebUIPage` and let
`astro_webui_page.cc` apply the directives — and that shared base is also what
serves assets from `base::DIR_EXE`. Reading only the direct calls made the
first page built on the base report "No CSP overrides" and "Serves resources
from DIR_EXE: no", with an `'unsafe-inline'` widening and a DIR_EXE read both
invisible. A refactor is not supposed to be able to clear a security baseline,
so a controller that declares a `WebUIPage` is analysed together with the base,
and a source tree where that base cannot be found is a hard failure rather than
a quiet zero.

CSP directives are read only from these two shapes, not from the file as a
whole. `unsafe-eval` appears twice in this repository and neither
occurrence is Astro's — both are `$csp=` rules inside the shipped easylist
filter data. A grep would report two epic-rule violations that do not exist, and
a baseline that cries wolf is one nobody trusts.

Controllers are read from `HEAD` through `committed_state`, so the committed
document describes the browser a fresh clone builds. `--worktree-source` reads a
directory off disk instead, for pointing the detectors at a constructed fixture;
it says so loudly and refuses to write the committed document, because a
security baseline that silently described somebody's unsaved edits is exactly
the failure this tool is supposed to make impossible.

Usage:
    inventory_webui_security.py --json OUT.json --markdown OUT.md
    inventory_webui_security.py --verify
    inventory_webui_security.py --verify --worktree-source DIR
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import committed_state

REPO_ROOT = Path(__file__).resolve().parents[2]
COMMITTED_SOURCE = "src/chrome/browser/oxy"

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

# The shared page base: `astro::WebUIPage` declared by a controller, applied by
# astro_webui_page.cc. A controller naming the struct is asking that file to
# create its data source, so that file's behaviour is the controller's.
SHARED_PAGE_BASE_FILE = "astro_webui_page.cc"
USES_SHARED_PAGE_BASE_RE = re.compile(r"\bWebUIPage\b")

# `.style_src = "style-src 'self' …;"` inside a WebUIPageCsp initialiser. The
# field name is the directive, spelled the way the struct spells it.
PAGE_CSP_FIELD_RE = re.compile(
    r"\.\s*(script_src|style_src|img_src|font_src|connect_src)\s*=\s*"
    r"((?:\s*\"(?:[^\"\\]|\\.)*\"\s*)+)",
    re.MULTILINE,
)
PAGE_CSP_FIELD_DIRECTIVE = {
    "script_src": "ScriptSrc",
    "style_src": "StyleSrc",
    "img_src": "ImgSrc",
    "font_src": "FontSrc",
    "connect_src": "ConnectSrc",
}


def strip_comments(source: str) -> str:
    """C++ source with comments blanked out and string literals left alone.

    Every marker below is a substring search over the file, and a substring
    search reads prose. Measured: the ported Alia and New Tab controllers each
    explain in a comment that what they replaced "called DisableTrustedTypesCSP()
    outright" — and the baseline reported both pages as having Trusted Types
    DISABLED, which is the exact opposite of what they do. A security document
    that turns a sentence about a fixed defect into a finding is worse than one
    that says nothing, and it is the same class of false positive this file
    already refuses for `unsafe-eval` in the shipped filter data.

    Blanked rather than deleted, so offsets and line counts are unchanged, and
    raw string literals are honoured. The case that forced the latter was
    astro_adblock_ui.cc serving a whole page as `R"html(...)html"`: a stripper
    that did not know about raw strings ate half of it at the first `//` inside
    a URL. That page is now an entry of the WebUI app and no overlay file holds
    a document any more, so this is kept for the next one rather than for a
    file in the tree — dropping it would make the failure return silently.
    """
    out = []
    index = 0
    length = len(source)
    while index < length:
        char = source[index]
        pair = source[index:index + 2]
        if pair == "//":
            end = source.find("\n", index)
            end = length if end < 0 else end
            out.append(" " * (end - index))
            index = end
        elif pair == "/*":
            end = source.find("*/", index + 2)
            end = length if end < 0 else end + 2
            out.append("".join(c if c == "\n" else " " for c in source[index:end]))
            index = end
        elif char in "\"'":
            # A raw string is introduced by R, u8R, LR, u8R… — the prefix ends
            # in R immediately before the quote.
            raw = source[:index].endswith("R") and source[index] == '"'
            if raw:
                close = source.find("(", index + 1)
                delim = source[index + 1:close] if close > 0 else ""
                terminator = f"){delim}\""
                end = source.find(terminator, close + 1) if close > 0 else -1
                end = length if end < 0 else end + len(terminator)
            else:
                end = index + 1
                while end < length:
                    if source[end] == "\\":
                        end += 2
                        continue
                    if source[end] == char:
                        end += 1
                        break
                    end += 1
            out.append(source[index:end])
            index = end
        else:
            out.append(char)
            index += 1
    return "".join(out)


def analyse(display: str, text: str, base_text: str | None = None) -> dict:
    text = strip_comments(text)
    if base_text is not None:
        base_text = strip_comments(base_text)
    directives = {}
    for name, raw in OVERRIDE_RE.findall(text):
        value = "".join(STRING_PIECE_RE.findall(raw))
        directives[name] = value.strip()
    for field, raw in PAGE_CSP_FIELD_RE.findall(text):
        value = "".join(STRING_PIECE_RE.findall(raw))
        directives[PAGE_CSP_FIELD_DIRECTIVE[field]] = value.strip()

    remote_origins = sorted(
        {origin for value in directives.values() for origin in REMOTE_ORIGIN_RE.findall(value)}
    )
    unsafe = sorted({
        token
        for value in directives.values()
        for token in re.findall(r"'unsafe-[a-z-]+'", value)
    })

    return {
        "file": display,
        "directives": directives,
        "remote_origins": remote_origins,
        "unsafe_tokens": unsafe,
        "trusted_types_disabled": DISABLES_TRUSTED_TYPES in text
        or (base_text is not None and DISABLES_TRUSTED_TYPES in base_text),
        "serves_from_exe_dir": SERVES_FROM_EXE_DIR in text
        or (base_text is not None and SERVES_FROM_EXE_DIR in base_text),
        "uses_shared_page_base": base_text is not None,
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


def committed_controllers() -> list[tuple[str, str]]:
    return [
        (path, committed_state.read_text(path))
        for path in committed_state.list_files(COMMITTED_SOURCE, (".cc",))
        if path.endswith("_ui.cc")
    ]


def committed_page_base() -> str | None:
    for path in committed_state.list_files(COMMITTED_SOURCE, (".cc",)):
        if path.endswith(SHARED_PAGE_BASE_FILE):
            return committed_state.read_text(path)
    return None


def worktree_controllers(source_dir: Path) -> list[tuple[str, str]]:
    """Read a directory off disk. Never feeds the committed document."""
    return [
        (str(path), path.read_text(encoding="utf-8"))
        for path in sorted(source_dir.rglob("*_ui.cc"))
    ]


def worktree_page_base(source_dir: Path) -> str | None:
    for path in sorted(source_dir.rglob(SHARED_PAGE_BASE_FILE)):
        return path.read_text(encoding="utf-8")
    return None


def build(source_dir: Path | None) -> dict:
    if source_dir is None:
        controllers = committed_controllers()
        page_base = committed_page_base()
        source_display = COMMITTED_SOURCE
        origin = "committed"
    else:
        controllers = worktree_controllers(source_dir)
        page_base = worktree_page_base(source_dir)
        source_display = str(source_dir)
        origin = "worktree"

    if not controllers:
        raise SystemExit(f"ERROR no WebUI controllers found under {source_display}")

    entries = []
    for display, text in controllers:
        uses_base = bool(USES_SHARED_PAGE_BASE_RE.search(text))
        if uses_base and page_base is None:
            # Reading zero here would clear the page's CSP and its DIR_EXE read
            # from the baseline, which is the failure this lookup exists to
            # prevent. Refuse rather than under-report.
            raise SystemExit(
                f"ERROR {display} declares a WebUIPage, so its CSP and its "
                f"asset serving live in {SHARED_PAGE_BASE_FILE}, and that file "
                f"is not under {source_display}. Analysing the controller alone "
                "would report it as having neither."
            )
        entry = analyse(display, text, page_base if uses_base else None)
        entry["violations"] = violations(entry)
        entries.append(entry)

    summary: dict[str, list[str]] = {}
    for entry in entries:
        for name in entry["violations"]:
            summary.setdefault(name, []).append(Path(entry["file"]).name)

    return {
        "tool": "tools/baseline/inventory_webui_security.py",
        "source": source_display,
        "source_origin": origin,
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
        "**Scope, and why it is drawn here.** CSP directives are read from two",
        "shapes and only those two: an `OverrideContentSecurityPolicy` call, and a",
        "`WebUIPage`'s CSP fields, which `astro_webui_page.cc` applies on the",
        "controller's behalf. A controller that declares a `WebUIPage` is reported",
        "together with that base, because the base is also what reads assets from",
        "`base::DIR_EXE` — reading the controller alone showed the first page built",
        "on it as having no CSP and no `DIR_EXE` read, with an `'unsafe-inline'`",
        "widening invisible.",
        "",
        "Nothing else in a file counts. `unsafe-eval` appears twice in this",
        "repository and neither occurrence is Astro's: both are `$csp=` rules inside",
        "the shipped easylist filter data. A grep would report two epic-rule",
        "violations that do not exist.",
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
        if entry.get("uses_shared_page_base"):
            lines += [
                "Declares a `WebUIPage`; its data source, CSP and asset serving are",
                "`astro_webui_page.cc`'s. Both are reported below.",
                "",
            ]
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
    parser.add_argument(
        "--worktree-source",
        help="analyse an on-disk directory instead of committed content; "
        "cannot produce the committed document",
    )
    parser.add_argument("--verify", action="store_true")
    args = parser.parse_args(argv[1:])

    committed_state.require_repository()

    if args.worktree_source:
        # Refused rather than warned about: the whole point of this change is
        # that no committed artefact can be produced from unversioned content,
        # and a warning is something a script pipes to /dev/null.
        if args.markdown:
            raise SystemExit(
                "ERROR --worktree-source cannot produce --markdown.\n"
                "      The committed security baseline must be reproducible from a\n"
                "      clean checkout, so it is derived from committed content only."
            )
        print(
            f"WORKING-TREE READ — NOT the baseline. Analysing {args.worktree_source} "
            f"as it is on disk; this output describes no committed revision.",
            file=sys.stderr,
        )
        document = build(Path(args.worktree_source))
    else:
        document = build(None)
        observations = committed_state.working_tree_observations([COMMITTED_SOURCE])
        committed_state.report_working_tree_observations(
            "inventory_webui_security.py", observations
        )
        document["working_tree_observations"] = observations

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
