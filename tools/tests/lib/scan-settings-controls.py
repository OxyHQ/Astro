#!/usr/bin/env python3
"""scan-settings-controls.py — does every searchable control name a screen it is on?

A section's `*.strings.ts` declares what the settings page's search field can
find inside it. An entry may name the FRAGMENT the control is rendered on:

    {id: 'settings.privacy.security.dns.mode', on: '/security'}

That fragment is the whole of what a hit does. Get it wrong and nothing reports
it: `targetForPath` falls back to the DEFAULT section for a fragment nothing
claims, so a mistyped `/securty` sends someone searching for a privacy setting
to the appearance page, and a fragment that belongs to a DIFFERENT section
opens a screen that really exists and really does not have the control on it.
Both compile, both typecheck, and both look like a page that lost a setting.

This checks the one property that makes the form trustworthy: a control's `on`
is a fragment ITS OWN section routes — the section's path, one of its aliases,
or one of its subpages. Nothing here has an opinion about which screen actually
draws the control; that is not decidable from the registry, and a check that
guessed at it would be a check nobody could trust.

Like the parity scanner beside it, this reads COMMITTED SOURCE — no build, no
node_modules, no dev server — and it strips comments before it reads anything,
because the registry's prose is full of fragment paths and route names and a
scanner that counted them would be measuring the documentation.

Exit status:
  0  every fragment-carrying control names a screen its section routes
  1  one does not, or a section's declared control list is unreachable
  2  the scan itself is broken (below a vacuity floor); nothing was measured
"""

from __future__ import annotations

import argparse
import os
import re
import sys

# Floors. Each answers a different way this can measure nothing and look clean:
# the registry not parsed, the strings modules not parsed, or the object form
# specifically no longer recognised while bare ids still are. The last one is
# the dangerous one, because it is exactly the shape a refactor breaks and the
# other two floors would still pass.
DEFAULT_MIN_SECTIONS = 15
DEFAULT_MIN_FRAGMENTS = 60
DEFAULT_MIN_CONTROLS = 80
DEFAULT_MIN_PLACED = 10

SECTION_ENTRY = re.compile(r"([A-Za-z][A-Za-z0-9_]*)\s*:\s*\{")
PATH_LITERAL = re.compile(r"\bpath:\s*'([^']*)'")
ALIASES_BLOCK = re.compile(r"\baliases:\s*\[([^\]]*)\]", re.S)
CONTROLS_REF = re.compile(r"\bcontrols:\s*([A-Za-z][A-Za-z0-9_]*)")
CONTROLS_IMPORT = re.compile(r"import\s*\{\s*([A-Za-z][A-Za-z0-9_]*Controls)\s*\}\s*from\s*'([^']+)'")
SPREAD = re.compile(r"\.\.\.([A-Za-z][A-Za-z0-9_]*)")
QUOTED = re.compile(r"'([^']*)'")
SEGMENT = re.compile(r"\bsegment:\s*'([^']*)'")
CONTROLS_EXPORT = re.compile(r"export const ([A-Za-z][A-Za-z0-9_]*Controls)\b")


def strip_comments(source: str) -> str:
    """The source with every comment blanked, offsets and line count preserved.

    A character scanner rather than a regex, for the same reason the parity
    scanner has one: only a scanner knows whether a `//` opens a comment or sits
    inside a string, and whether a quote closes a literal or was escaped. Here
    it matters in both directions -- this file's prose quotes fragment paths
    (`/security`, `/clearBrowserData`) constantly, and a comment read as source
    would invent routes that nothing serves.
    """
    out: list[str] = []
    index = 0
    length = len(source)

    while index < length:
        char = source[index]

        if char == "/" and index + 1 < length:
            following = source[index + 1]
            if following == "/":
                while index < length and source[index] != "\n":
                    out.append(" ")
                    index += 1
                continue
            if following == "*":
                while index < length and not (
                    source[index] == "*" and index + 1 < length and source[index + 1] == "/"
                ):
                    out.append("\n" if source[index] == "\n" else " ")
                    index += 1
                out.append("  ")
                index += 2
                continue

        if char in "'\"`":
            quote = char
            out.append(char)
            index += 1
            while index < length:
                current = source[index]
                out.append(current)
                if current == "\\" and index + 1 < length:
                    out.append(source[index + 1])
                    index += 2
                    continue
                index += 1
                if current == quote:
                    break
            continue

        out.append(char)
        index += 1

    return "".join(out)


def block_after(source: str, start: int, opener: str, closer: str) -> tuple[int, int]:
    """The span of the bracketed block whose opener is at or after `start`."""
    begin = source.index(opener, start)
    depth = 0
    for index in range(begin, len(source)):
        if source[index] == opener:
            depth += 1
        elif source[index] == closer:
            depth -= 1
            if depth == 0:
                return begin, index
    raise ValueError(f"unterminated {opener!r} from offset {begin}")


class Section:
    __slots__ = ("name", "controls_export", "fragments")

    def __init__(self, name: str, controls_export: str, fragments: set[str]) -> None:
        self.name = name
        self.controls_export = controls_export
        self.fragments = fragments


def content_type_fragments(app_dir: str) -> set[str]:
    """`/content/<segment>` for each of site settings' generated subpages.

    Built rather than listed, for the same reason the registry builds them: they
    differ only in a segment, and forty-eight hand-written paths here would be
    forty-eight chances for this check to disagree with the page it is checking.
    """
    path = os.path.join(app_dir, "sections", "site-settings.content-types.ts")
    with open(path, encoding="utf-8") as handle:
        source = strip_comments(handle.read())
    return {f"/content/{segment}" for segment in SEGMENT.findall(source)}


def read_registry(app_dir: str) -> tuple[list[Section], dict[str, str]]:
    """Every section: the control list it names, and the fragments it routes."""
    registry_path = os.path.join(app_dir, "settings-page.tsx")
    with open(registry_path, encoding="utf-8") as handle:
        source = strip_comments(handle.read())

    imports = {name: module for name, module in CONTROLS_IMPORT.findall(source)}

    # The literal spelling, so renaming the table is a refusal rather than a
    # prefix match on whatever replaced it.
    start, end = block_after(source, source.index("const SECTIONS = {"), "{", "}")
    body = source[start : end + 1]
    generated = content_type_fragments(app_dir)

    # A section is a key at depth ONE inside the table. Depth rather than
    # indentation: every nested `render: lazy(...)` and every subpage is also a
    # `name: {`, and an indentation-shaped rule would additionally break on a
    # reformat, which is a change to how the file looks and not to what it says.
    depth = 0
    depths: list[int] = []
    for char in body:
        if char in "{[(":
            depth += 1
        depths.append(depth)
        if char in "}])":
            depth -= 1

    sections: list[Section] = []
    for match in SECTION_ENTRY.finditer(body):
        if depths[match.start()] != 1:
            continue
        _, close = block_after(body, match.end() - 1, "{", "}")
        entry = body[match.end() : close]

        fragments = set(PATH_LITERAL.findall(entry))
        for block in ALIASES_BLOCK.findall(entry):
            fragments.update(QUOTED.findall(block))
        if "SITE_SETTINGS_TYPES" in SPREAD.findall(entry):
            fragments.update(generated)

        controls = CONTROLS_REF.search(entry)
        sections.append(
            Section(match.group(1), controls.group(1) if controls else "", fragments)
        )

    return sections, imports


class Control:
    __slots__ = ("identifier", "fragment", "module", "line")

    def __init__(self, identifier: str, fragment: str | None, module: str, line: int) -> None:
        self.identifier = identifier
        self.fragment = fragment
        self.module = module
        self.line = line


def read_controls(path: str, export: str) -> list[Control]:
    """The entries of one `*.strings.ts` control list, in either form."""
    with open(path, encoding="utf-8") as handle:
        source = strip_comments(handle.read())

    # Up to and including the `=`, because the type annotation between the two
    # carries brackets of its own: `readonly SettingsControl[]` would otherwise
    # be read as an empty control list, and an empty list has nothing wrong
    # with it.
    marker = re.search(rf"export const {re.escape(export)}\b[^=]*=", source)
    if marker is None:
        return []
    start, end = block_after(source, marker.end(), "[", "]")
    body = source[start : end + 1]
    module = os.path.basename(path)

    found: list[Control] = []
    index = 0
    while index < len(body):
        brace = body.find("{", index)
        quote = body.find("'", index)
        if brace == -1 and quote == -1:
            break
        if brace != -1 and (quote == -1 or brace < quote):
            _, close = block_after(body, brace, "{", "}")
            entry = body[brace : close + 1]
            identifier = re.search(r"\bid:\s*'([^']*)'", entry)
            fragment = re.search(r"\bon:\s*'([^']*)'", entry)
            line = body.count("\n", 0, brace) + source.count("\n", 0, start) + 1
            found.append(
                Control(
                    identifier.group(1) if identifier else "",
                    fragment.group(1) if fragment else None,
                    module,
                    line,
                )
            )
            index = close + 1
            continue
        closing = body.find("'", quote + 1)
        if closing == -1:
            break
        line = body.count("\n", 0, quote) + source.count("\n", 0, start) + 1
        found.append(Control(body[quote + 1 : closing], None, module, line))
        index = closing + 1

    return found


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--app-dir", required=True, help="webui/app/src/pages/settings")
    parser.add_argument("--min-sections", type=int, default=DEFAULT_MIN_SECTIONS)
    parser.add_argument("--min-fragments", type=int, default=DEFAULT_MIN_FRAGMENTS)
    parser.add_argument("--min-controls", type=int, default=DEFAULT_MIN_CONTROLS)
    parser.add_argument("--min-placed", type=int, default=DEFAULT_MIN_PLACED)
    args = parser.parse_args()

    if not os.path.isdir(args.app_dir):
        print(f"ERROR no such directory: {args.app_dir}", file=sys.stderr)
        return 2

    try:
        sections, imports = read_registry(args.app_dir)
    except (OSError, ValueError) as failure:
        print(f"ERROR the registry could not be read: {failure}", file=sys.stderr)
        return 2

    if len(sections) < args.min_sections:
        print(
            f"ERROR the scan read {len(sections)} section(s) out of the registry,\n"
            f"      below the floor of {args.min_sections}. The registry parse is broken;\n"
            f"      with no sections there are no controls to check and the run\n"
            f"      would report success having measured nothing.",
            file=sys.stderr)
        return 2

    routed = {fragment for section in sections for fragment in section.fragments}
    if len(routed) < args.min_fragments:
        print(
            f"ERROR the scan found {len(routed)} routed fragment(s), below the floor of\n"
            f"      {args.min_fragments}. Fragment extraction is broken, and every `on`\n"
            f"      would be reported as unrouted rather than checked.",
            file=sys.stderr)
        return 2

    problems: list[str] = []
    controls = 0
    placed = 0

    for section in sections:
        if section.controls_export == "":
            problems.append(
                f"  {section.name}: names no control list. Every section declares one,\n"
                f"    even if it is empty; without it the section is unsearchable and\n"
                f"    nothing says so.")
            continue
        module = imports.get(section.controls_export)
        if module is None:
            problems.append(
                f"  {section.name}: names the control list {section.controls_export},\n"
                f"    which the registry does not import. The export was renamed or the\n"
                f"    import was dropped; either way the section is unsearchable.")
            continue

        path = os.path.normpath(os.path.join(args.app_dir, module))
        if not os.path.isfile(path):
            problems.append(
                f"  {section.name}: {module} does not exist.")
            continue

        entries = read_controls(path, section.controls_export)
        controls += len(entries)
        for entry in entries:
            if entry.fragment is None:
                continue
            placed += 1
            if entry.fragment in section.fragments:
                continue
            elsewhere = sorted(
                other.name for other in sections if entry.fragment in other.fragments
            )
            where = (
                f"routed by {', '.join(elsewhere)} instead"
                if elsewhere
                else "routed by no section at all, so it resolves to the default one"
            )
            problems.append(
                f"  {entry.module}:{entry.line}: {entry.identifier}\n"
                f"    is declared on {entry.fragment!r}, which the {section.name} section\n"
                f"    does not route -- {where}. A hit on this control opens a screen\n"
                f"    that does not have it. Its section routes:\n"
                f"      {', '.join(sorted(section.fragments)[:12])}")

    if controls < args.min_controls:
        print(
            f"ERROR the scan read {controls} control entr(ies), below the floor of\n"
            f"      {args.min_controls}. The strings modules were not parsed; a run that\n"
            f"      reads no controls cannot find a wrong one.",
            file=sys.stderr)
        return 2

    if placed < args.min_placed:
        print(
            f"ERROR the scan read {placed} control(s) naming a screen, below the floor\n"
            f"      of {args.min_placed}. Bare ids still parse, so the count above looks\n"
            f"      healthy -- but the object form is the ONLY form this check has an\n"
            f"      opinion about, and none of it was recognised.",
            file=sys.stderr)
        return 2

    if problems:
        print(f"Settings controls: {len(problems)} misplaced control(s).\n", file=sys.stderr)
        for problem in problems:
            print(problem, file=sys.stderr)
        print(
            f"\nRead {len(sections)} section(s), {len(routed)} routed fragment(s),"
            f" {controls} control(s), {placed} of them naming a screen.",
            file=sys.stderr)
        return 1

    print(
        f"Every searchable control names a screen its section routes: "
        f"{len(sections)} section(s), {len(routed)} routed fragment(s), "
        f"{controls} control(s), {placed} of them naming a screen.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
