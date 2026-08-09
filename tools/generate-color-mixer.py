#!/usr/bin/env python3
"""Generate Astro's native colour token table from Bloom's design tokens.

Bloom is the single source of truth for Astro's colours, and it already resolves
them: `@oxyhq/bloom/design-tokens/tokens.json` is a W3C DTCG document carrying
every token, for every preset, in both schemes, as an sRGB hex string. The web
surfaces consume it directly. The NATIVE surfaces — toolbar, menus, omnibox —
cannot, because a Chromium ColorMixer wants `SkColor` at compile time.

So this transcribes that document into a constexpr header. It is transcription
and nothing else: no colour is computed here, no name is invented here, and if
Bloom's engine changes a value the header changes with it on the next
regeneration. The build-safety case
`tools/tests/cases/color-tokens-header-is-generated.sh` fails the build when the
committed header stops matching what this produces.

WHAT THIS DOES NOT DO, deliberately: it does not map a Bloom token onto a
Chromium `ColorId`. That mapping is a design decision per token — which of
Bloom's 58 tokens should paint `kColorToolbar` is not derivable from either
side — so it is hand-written and reviewed in `astro_color_mixer.cc`. A
generator that guessed at it would produce a plausible browser nobody chose.

THE ONE CONVERSION WORTH READING TWICE. DTCG spells alpha LAST (`#rrggbbaa`);
SkColor packs it FIRST (`0xAARRGGBB`). The two disagree only on the tokens that
carry alpha — Bloom's `-subtle` family — and a byte-order mistake there is
invisible in review and nearly invisible on screen: the colour still renders,
just with the wrong opacity and a red channel taken from the alpha. It is
proved by the check case against a fixture whose opaque and translucent tokens
share an RGB triple, so the two orderings cannot both pass.

ORDERING. Presets and tokens are emitted in ASCII order of their names, not in
the order the JSON happens to list them. The JSON's order is Bloom's internal
business; sorting here means a regeneration is byte-identical whenever the
VALUES are unchanged, which is what makes the drift check meaningful.

Usage:
    generate-color-mixer.py [--tokens PATH] [--output PATH]
    generate-color-mixer.py --check [--tokens PATH] [--output PATH]

Exit status:
    0  the header was written, or --check found it current
    1  --check found drift: the committed header is not what this produces
    2  the token document is malformed or violates Bloom's shape contract
    3  the token document is not installed (run `bun install` in webui/app)
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]

# Bloom publishes the document at this subpath and exports it under the same
# name. It arrives through webui/app's dependency tree, which is not committed,
# so a clean checkout legitimately does not have it — hence exit 3 rather than
# a failure.
DEFAULT_TOKENS = (
    REPO_ROOT
    / "webui/app/node_modules/@oxyhq/bloom/src/design-tokens/tokens.json"
)
DEFAULT_OUTPUT = REPO_ROOT / "src/chrome/browser/oxy/ui/astro_color_tokens.h"

BLOOM_PACKAGE = "@oxyhq/bloom"
TOKENS_EXPORT = "design-tokens/tokens.json"

SCHEMES = ("light", "dark")

# "#rrggbb" or "#rrggbbaa", lower-case, as the shape contract states. The
# pattern is strict on purpose: a value this does not recognise is a change to
# the contract, and the right response to that is to stop, not to guess.
HEX_COLOR = re.compile(r"^#(?P<digits>[0-9a-f]{6}(?:[0-9a-f]{2})?)$")

# Bloom's own extension namespace inside the DTCG document.
BLOOM_EXTENSION = "so.oxy.bloom"

# Bloom's `ColorPresetGate` union, in the order the generated enumeration
# declares them after `kNone`. Closed on purpose: an unrecognised gate is
# refused rather than transcribed, because the two ways of guessing are not
# symmetric. Treating an unknown gate as "no gate" hands out a preset somebody
# reserved, silently, and that is the regression Bloom's own file records
# having shipped once already. Stopping costs a build and a decision.
GATES = ("handle", "premium")

GUARD = "CHROME_BROWSER_OXY_UI_ASTRO_COLOR_TOKENS_H_"

EXIT_DRIFT = 1
EXIT_MALFORMED = 2
EXIT_ABSENT = 3


class Malformed(Exception):
    """The token document does not match the shape this transcribes."""


def fail(message: str) -> None:
    raise Malformed(message)


# --------------------------------------------------------------------------
# Reading the token document
# --------------------------------------------------------------------------


def package_identity(tokens_path: Path) -> str:
    """`@oxyhq/bloom@0.88.0`, read from the package the document ships in.

    The header records which release it was transcribed from, because that is
    the only thing that makes a value in it auditable. Read from the nearest
    package.json rather than passed in, so it cannot be asserted incorrectly;
    a document with no package around it is refused rather than recorded as
    "unknown", which would put an unverifiable claim in a committed file.
    """
    for directory in tokens_path.resolve().parents:
        manifest = directory / "package.json"
        if not manifest.is_file():
            continue
        try:
            data = json.loads(manifest.read_text(encoding="utf-8"))
        except json.JSONDecodeError as error:
            fail(f"{manifest} is not readable JSON: {error}")
        name = data.get("name")
        version = data.get("version")
        if not isinstance(name, str) or not isinstance(version, str):
            fail(f"{manifest} declares no name/version pair")
        return f"{name}@{version}"
    fail(
        f"no package.json above {tokens_path}; the header records which Bloom\n"
        f"      release each value came from and cannot be written without it"
    )
    raise AssertionError("unreachable")


def scheme_group(preset: str, group: dict, scheme: str) -> dict:
    node = group.get(scheme)
    if not isinstance(node, dict):
        fail(f"color.{preset} has no '{scheme}' group")
    return node


def token_names(node: dict) -> list[str]:
    return sorted(name for name in node if not name.startswith("$"))


def read_tokens(tokens_path: Path) -> dict:
    """The document, reduced to what the header needs, validated on the way.

    Every check here corresponds to something the emitted table assumes: that
    the preset/scheme/token space is rectangular, that every leaf carries a
    value, and that every value is a colour this can convert. The table is a
    fixed-size 3-D array, so a ragged document would otherwise be transcribed
    into a header that compiles and lies.
    """
    try:
        document = json.loads(tokens_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        fail(f"{tokens_path} is not readable JSON: {error}")

    colors = document.get("color")
    if not isinstance(colors, dict):
        fail("the document has no top-level 'color' group")
    if colors.get("$type") != "color":
        fail("color.$type is not 'color'; this is not the DTCG shape expected")

    presets = sorted(name for name in colors if not name.startswith("$"))
    if not presets:
        fail("the 'color' group declares no presets")

    expected: list[str] | None = None
    entries = []
    for preset in presets:
        group = colors[preset]
        if not isinstance(group, dict):
            fail(f"color.{preset} is not a group")

        extension = (group.get("$extensions") or {}).get(BLOOM_EXTENSION)
        if not isinstance(extension, dict):
            fail(f"color.{preset} carries no $extensions['{BLOOM_EXTENSION}']")

        values: dict[str, dict[str, int]] = {}
        for scheme in SCHEMES:
            node = scheme_group(preset, group, scheme)
            names = token_names(node)
            if expected is None:
                expected = names
            elif names != expected:
                missing = sorted(set(expected) - set(names))
                extra = sorted(set(names) - set(expected))
                fail(
                    f"color.{preset}.{scheme} does not carry the same tokens as\n"
                    f"      the first group read"
                    + (f"; missing {missing}" if missing else "")
                    + (f"; unexpected {extra}" if extra else "")
                )
            values[scheme] = {
                name: to_sk_color(f"color.{preset}.{scheme}.{name}", node[name])
                for name in names
            }

        gate = extension.get("gate")
        if gate is not None and gate not in GATES:
            fail(
                f"color.{preset} is gated on {gate!r}, which is not one of\n"
                f"      {list(GATES)}. Bloom has added a kind of gate this\n"
                f"      transcription does not know how to enforce; decide what\n"
                f"      Astro does with it rather than letting it read as ungated"
            )

        entries.append(
            {
                "name": preset,
                "seed": extension.get("seed"),
                "variant": extension.get("variant"),
                "gate": gate,
                "values": values,
            }
        )

    if not expected:
        fail("no colour tokens were found in any preset")

    return {
        "package": package_identity(tokens_path),
        "presets": entries,
        "tokens": expected,
    }


def to_sk_color(where: str, node: object) -> int:
    """`#rrggbbaa` (DTCG, alpha last) -> `0xAARRGGBB` (SkColor, alpha first).

    An absent alpha is opaque, which is DTCG's own reading of a 6-digit hex.
    """
    if not isinstance(node, dict) or "$value" not in node:
        fail(f"{where} is not a DTCG token node with a $value")
    value = node["$value"]
    if not isinstance(value, str):
        fail(f"{where}.$value is not a string")
    match = HEX_COLOR.match(value)
    if match is None:
        fail(
            f"{where}.$value is {value!r}, which is not the '#rrggbb' or\n"
            f"      '#rrggbbaa' sRGB hex the shape contract declares"
        )
    digits = match.group("digits")
    red = int(digits[0:2], 16)
    green = int(digits[2:4], 16)
    blue = int(digits[4:6], 16)
    alpha = int(digits[6:8], 16) if len(digits) == 8 else 0xFF
    return (alpha << 24) | (red << 16) | (green << 8) | blue


# --------------------------------------------------------------------------
# Emitting the header
# --------------------------------------------------------------------------


def enumerator(name: str) -> str:
    """`surface-foreground` -> `kSurfaceForeground`, `chart-1` -> `kChart1`."""
    parts = [part for part in re.split(r"[^A-Za-z0-9]+", name) if part]
    if not parts:
        fail(f"token name {name!r} has no characters an enumerator can use")
    return "k" + "".join(part[:1].upper() + part[1:] for part in parts)


def enumerators(names: list[str], what: str) -> list[str]:
    mangled = [enumerator(name) for name in names]
    seen: dict[str, str] = {}
    for name, symbol in zip(names, mangled):
        if symbol in seen:
            fail(
                f"{what} {name!r} and {seen[symbol]!r} both spell {symbol}; the\n"
                f"      generated enumeration would be ambiguous"
            )
        seen[symbol] = name
    return mangled


def enum_block(kind: str, names: list[str], what: str) -> list[str]:
    lines = [f"enum class {kind} : size_t {{"]
    for index, symbol in enumerate(enumerators(names, what)):
        lines.append(f"  {symbol} = {index},")
    lines.append("};")
    return lines


def names_block(kind: str, count_name: str, names: list[str]) -> list[str]:
    lines = [
        f"inline constexpr std::array<std::string_view, {count_name}>",
        f"    {kind} = {{{{",
    ]
    for name in names:
        lines.append(f'        "{name}",')
    lines.append("}};")
    return lines


def preset_comment(preset: dict) -> str:
    detail = f"seed {preset['seed']}, {preset['variant']}"
    if preset.get("gate"):
        detail += f", gated on {preset['gate']}"
    return f"// {preset['name']} — {detail}"


def emit(model: dict) -> str:
    presets = model["presets"]
    tokens = model["tokens"]
    lines: list[str] = []

    lines += [
        "// Copyright 2026 Oxy. All rights reserved.",
        "// Use of this source code is governed by a BSD-style license.",
        "//",
        "// GENERATED FILE — DO NOT EDIT.",
        "//",
        f"// Generated by tools/generate-color-mixer.py from {model['package']}",
        f"// ({TOKENS_EXPORT}): "
        f"{len(presets)} presets × {len(SCHEMES)} schemes × {len(tokens)} tokens.",
        "//",
        "// Regenerate with:",
        "//     tools/generate-color-mixer.py",
        "//",
        "// Bloom resolves these values; nothing here computes a colour. Alpha is",
        "// converted from DTCG's '#rrggbbaa' to SkColor's 0xAARRGGBB on the way in.",
        "//",
        "// Which Bloom token paints which Chromium ColorId is NOT here and is not",
        "// generated: that mapping is a per-token design decision, hand-written and",
        "// reviewed in astro_color_mixer.cc.",
        "",
        f"#ifndef {GUARD}",
        f"#define {GUARD}",
        "",
        "#include <array>",
        "#include <cstddef>",
        "#include <optional>",
        "#include <string_view>",
        "",
        '#include "third_party/skia/include/core/SkColor.h"',
        "",
        "// clang-format off",
        "",
        "namespace astro {",
        "",
        "// A Bloom colour preset. The name is what the astro.theme.preset pref",
        "// stores, so ColorPresetFromName below is the pref's only reader.",
    ]
    lines += enum_block("ColorPreset", [preset["name"] for preset in presets], "preset")
    lines += [
        "",
        f"inline constexpr size_t kColorPresetCount = {len(presets)};",
        "",
        "enum class ColorScheme : size_t {",
    ]
    lines += [f"  k{scheme.capitalize()} = {index}," for index, scheme in enumerate(SCHEMES)]
    lines += [
        "};",
        "",
        f"inline constexpr size_t kColorSchemeCount = {len(SCHEMES)};",
        "",
        "// One entry per CSS custom property Bloom writes on the document root,",
        "// with the leading '--' removed.",
    ]
    lines += enum_block("ColorToken", tokens, "token")
    lines += [
        "",
        f"inline constexpr size_t kColorTokenCount = {len(tokens)};",
        "",
    ]
    lines += names_block(
        "kColorPresetNames", "kColorPresetCount", [preset["name"] for preset in presets]
    )
    lines += [""]
    lines += [
        "// Who may pick a preset, as Bloom DECLARES it. Bloom only declares:",
        "// whether a given viewer satisfies a gate is the consuming app's",
        "// question, since only the app knows who is signed in and what they pay",
        "// for. Astro's answer is astro::IsColorPresetOffered, in",
        "// astro_theme_service.h -- that is policy and does not belong in a",
        "// transcription.",
        "//",
        "// This is DATA rather than the comment it used to be. A C++ consumer",
        "// reading kColorPresetNames had no way to see a gate at all, and the",
        "// first one to iterate the table offered another organisation's reserved",
        "// brand colour to everybody. A comment cannot be filtered on.",
        "enum class ColorPresetGate : size_t {",
        "  // Nobody is excluded.",
        "  kNone = 0,",
        "  // Reserved for the account whose brand it is -- not purchasable.",
        "  kHandle = 1,",
        "  // Sold with a subscription.",
        "  kPremium = 2,",
        "};",
        "",
        "inline constexpr std::array<ColorPresetGate, kColorPresetCount>",
        "    kColorPresetGates = {{",
    ]
    width = max(len(preset["name"]) for preset in presets)
    for preset in presets:
        gate = preset.get("gate")
        symbol = "k" + gate.capitalize() if gate else "kNone"
        lines.append(
            f"        ColorPresetGate::{symbol},".ljust(width + 34)
            + f"// {preset['name']}"
        )
    lines += [
        "}};",
        "",
        "constexpr ColorPresetGate ColorPresetGateFor(ColorPreset preset) {",
        "  return kColorPresetGates[static_cast<size_t>(preset)];",
        "}",
        "",
    ]
    lines += names_block("kColorTokenNames", "kColorTokenCount", tokens)
    lines += [
        "",
        "// [preset][scheme][token], every value an opaque-or-translucent SkColor.",
        "inline constexpr std::array<",
        "    std::array<std::array<SkColor, kColorTokenCount>, kColorSchemeCount>,",
        "    kColorPresetCount>",
        "    kColorTokenValues = {{",
    ]
    for preset in presets:
        lines.append(f"        {preset_comment(preset)}")
        lines.append("        {{")
        for scheme in SCHEMES:
            lines.append(f"            // {preset['name']}, {scheme}")
            lines.append("            {{")
            for token in tokens:
                value = preset["values"][scheme][token]
                lines.append(f"                0x{value:08X}u,  // {token}")
            lines.append("            }},")
        lines.append("        }},")
    lines += [
        "    }};",
        "",
        "constexpr SkColor ColorTokenValue(ColorPreset preset,",
        "                                  ColorScheme scheme,",
        "                                  ColorToken token) {",
        "  return kColorTokenValues[static_cast<size_t>(preset)]",
        "                          [static_cast<size_t>(scheme)]",
        "                          [static_cast<size_t>(token)];",
        "}",
        "",
        "// The pref stores a preset by name, and a name it no longer recognises is",
        "// a value from another Bloom release: absent, never a silent default.",
        "constexpr std::optional<ColorPreset> ColorPresetFromName(",
        "    std::string_view name) {",
        "  for (size_t index = 0; index < kColorPresetNames.size(); ++index) {",
        "    if (kColorPresetNames[index] == name) {",
        "      return static_cast<ColorPreset>(index);",
        "    }",
        "  }",
        "  return std::nullopt;",
        "}",
        "",
        "}  // namespace astro",
        "",
        "// clang-format on",
        "",
        f"#endif  // {GUARD}",
    ]
    return "\n".join(lines) + "\n"


# --------------------------------------------------------------------------


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description="Transcribe Bloom's design tokens into a constexpr SkColor header.",
    )
    parser.add_argument(
        "--tokens",
        type=Path,
        default=DEFAULT_TOKENS,
        help=f"Bloom's {TOKENS_EXPORT} (default: %(default)s)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="header to write (default: %(default)s)",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="write nothing; exit 1 if the header on disk is not what this produces",
    )
    args = parser.parse_args(argv)

    if not args.tokens.is_file():
        print(
            f"ABSENT {args.tokens} is not installed, so the colour table cannot be\n"
            f"       regenerated or checked for drift. It arrives with"
            f" {BLOOM_PACKAGE}:\n"
            f"           cd webui/app && bun install",
            file=sys.stderr,
        )
        return EXIT_ABSENT

    try:
        header = emit(read_tokens(args.tokens))
    except Malformed as error:
        print(f"ERROR {error}", file=sys.stderr)
        return EXIT_MALFORMED

    if args.check:
        if not args.output.is_file():
            print(
                f"ERROR {args.output} does not exist. Regenerate it with:\n"
                f"          tools/generate-color-mixer.py",
                file=sys.stderr,
            )
            return EXIT_DRIFT
        on_disk = args.output.read_text(encoding="utf-8")
        if on_disk != header:
            print(
                f"ERROR {args.output} is out of date: it is not what\n"
                f"      tools/generate-color-mixer.py produces from"
                f" {package_identity(args.tokens)}.\n"
                f"      Never hand-edit it — regenerate it with:\n"
                f"          tools/generate-color-mixer.py",
                file=sys.stderr,
            )
            return EXIT_DRIFT
        print(f"Colour token header is current ({args.output.name}).")
        return 0

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(header, encoding="utf-8")
    print(f"Wrote {args.output} from {package_identity(args.tokens)}.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
