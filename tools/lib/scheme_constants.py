#!/usr/bin/env python3
"""Prove nothing has drifted away from the manifest's two scheme names.

Astro's internal URL schemes are declared once, in the product manifest, and
spelled once in C++, in //astro/common/url_constants.h. Everything else must
reach them through the constants. This is what makes that true.

It is a CHECK, not a generator, and the header stays hand-written **on
purpose**: generating it would put a GENERATED file inside the target
//chrome/browser reaches through `allow_circular_includes_from`, which is the
failure chrome/browser/BUILD.gn:8392-8414 warns about in upstream's own words —
"the gn build graph may miss generated dependencies, which will result in
compile errors" — and it surfaces in only some configurations. Duplication that
a check makes safe beats a generated artifact that fails obscurely.

Nine properties, in both directions. The ones that are easy to miss:

*   **The schema must PIN each scheme with `const`.** Without that the manifest
    is a source of truth nobody constrains, and the header would agree with it
    all the way to a scheme name nobody reviewed.
*   **Each initializer must be a single string literal.** A scheme built by
    concatenation — `kAstroUIScheme "-untrusted"` — carries the right bytes
    while making one scheme a derivative of the other. They are separate
    security principals: separate origins, separate site URLs, separate process
    locks. A value comparison alone would certify the wrong thing.
*   **Neither scheme may be registered with the operating system** as a
    direct-launch scheme or an `x-scheme-handler/*` MIME type. That would let
    any web page link straight into a privileged internal scheme. Upstream keeps
    the two roles on different strings deliberately —
    `chrome/browser/shell_integration_linux.cc:909` returns `chromium` or
    `google-chrome`, never `chrome`. This is validator rule 9 in
    product-manifest.md; it is cross-field, so the schema subset cannot express
    it and only a check like this one will catch it.
*   **Inside //astro/common, only url_constants.h may spell a scheme.** #11's
    registration code lives beside it and correctly uses the constants; this is
    what keeps it that way.

Usage:
    scheme_constants.py --check [--manifest P] [--schema P] [--header P]
                               [--legacy-root P] [--common-dir P]

Exit 0 when everything agrees, 1 when it does not, naming the offending file
and field. Exit 2 when it could not measure something it was supposed to
measure — an empty parse must never read as a pass.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import lock  # noqa: E402  (path is set immediately above)

ASTRO_ROOT = Path(__file__).resolve().parents[2]

# The one place that changes when #9's manifest moves to its canonical home at
# //astro/app/product.json and //astro/app/product.schema.json. Until then the
# reviewable contract lives under docs/, as product-manifest.md §Status records.
DEFAULT_MANIFEST = ASTRO_ROOT / "docs/astro-next/architecture/product.example.json"
DEFAULT_SCHEMA = ASTRO_ROOT / "docs/astro-next/architecture/product.schema.json"
DEFAULT_COMMON = ASTRO_ROOT / "common"
DEFAULT_HEADER = DEFAULT_COMMON / "url_constants.h"

# Manifest field under `schemes` -> the C++ constant that must carry its value.
#
# A mapping, not a second copy of the values: the strings themselves appear only
# in the manifest and the header, and this says which pairs with which.
SCHEME_CONSTANTS = {
    "trusted": "kAstroUIScheme",
    "untrusted": "kAstroUIUntrustedScheme",
}

# Places that already spelled a scheme as a literal before the header existed,
# each with the manifest field whose value it must carry.
#
# Declared rather than hidden, and gated rather than merely documented: a
# duplicate a document mentions is one nothing checks. `oxy_auth_service.h`
# declares its own constant for the same string, and the file next to it does
# not even use that — it compares a bare literal. Renaming the scheme without
# both of these would break sign-in and compile perfectly.
#
# The list is exact, so this cannot cry wolf. It shrinks to nothing as #8
# retires the legacy overlay; an entry naming a file that no longer exists is a
# failure telling you to delete the entry, in the same change.
LEGACY_SPELLINGS = (
    ("src/chrome/browser/oxy/oxy_auth_service.h", "trusted"),
    ("src/chrome/browser/oxy/oxy_auth_callback_handler.cc", "trusted"),
)

# The only file inside //astro/common permitted to spell a scheme literally.
SCHEME_LITERAL_HOME = "url_constants.h"

# `inline constexpr char kFoo[] = <initializer>;` — the shape
# content/public/common/url_constants.h:21,23 uses, mirrored by the header under
# test. The initializer is captured raw so it can be rejected when it is
# anything other than one literal.
DECLARATION = re.compile(
    r"^inline\s+constexpr\s+char\s+(\w+)\[\]\s*=\s*(.+?);\s*$", re.MULTILINE
)
STRING_LITERAL = re.compile(r'^"([^"\\]*)"$')


def display(path: Path) -> str:
    """Repository-relative when it is inside the repository, absolute when not.

    The paths are overridable so the test suite can point at a fixture, and a
    fixture lives outside the repository.
    """
    resolved = path.resolve()
    if resolved.is_relative_to(ASTRO_ROOT):
        return str(resolved.relative_to(ASTRO_ROOT))
    return str(resolved)


def find_fields(node, key: str, path: str = "$"):
    """Every (path, value) in the document under the given field name.

    A walk rather than a fixed path, so moving `direct_launch_url_scheme` to
    another platform block cannot quietly take it out of rule 9's reach.
    """
    if isinstance(node, dict):
        for name, value in node.items():
            if name == key:
                yield f"{path}.{name}", value
            yield from find_fields(value, key, f"{path}.{name}")
    elif isinstance(node, list):
        for index, item in enumerate(node):
            yield from find_fields(item, key, f"{path}[{index}]")


def parse_header(path: Path) -> tuple[dict[str, str], list[str]]:
    """Return {constant: value} plus a list of problems found while parsing."""
    problems: list[str] = []
    constants: dict[str, str] = {}

    for name, initializer in DECLARATION.findall(path.read_text(encoding="utf-8")):
        match = STRING_LITERAL.match(initializer.strip())
        if match is None:
            problems.append(
                f"{path.name}: {name} is initialized from {initializer.strip()!r}, "
                f"not a single string literal. A scheme built by concatenation "
                f"makes one scheme a derivative of another; Astro's two are "
                f"separate security principals and each must be written whole."
            )
            continue
        constants[name] = match.group(1)

    return constants, problems


def check_legacy_spellings(
    legacy_root: Path, manifest_schemes: dict[str, str]
) -> list[str]:
    """Every declared pre-existing spelling must still carry the declared value."""
    failures: list[str] = []
    for relative, field in LEGACY_SPELLINGS:
        path = legacy_root / relative
        if not path.is_file():
            failures.append(
                f"{relative} is declared in LEGACY_SPELLINGS but does not exist. "
                f"If #8 retired it, delete the entry in the same change — a list "
                f"naming files nobody has passes without checking anything."
            )
            continue
        value = manifest_schemes.get(field)
        if f'"{value}"' not in path.read_text(encoding="utf-8"):
            failures.append(
                f"{relative} no longer spells schemes.{field} ({value!r}). It is "
                f"a second copy of a manifest value, so it has to move whenever "
                f"the manifest does."
            )
    return failures


def check_external_registration(manifest: dict, values: list[str]) -> tuple[list[str], int]:
    """Rule 9: neither internal scheme may be registered with the OS.

    Returns the failures and how many fields were actually examined, so a walk
    that found nothing cannot pass silently.
    """
    failures: list[str] = []
    examined = 0

    for path, declared in find_fields(manifest, "direct_launch_url_scheme"):
        examined += 1
        if declared and declared in values:
            failures.append(
                f"{path} is {declared!r}, an internal scheme. A direct-launch "
                f"scheme is registered with the operating system, so this would "
                f"let any web page link straight into a privileged surface. "
                f"Upstream never lets the two collide: "
                f"chrome/browser/shell_integration_linux.cc:909 returns "
                f"'chromium' or 'google-chrome', never 'chrome'. If Astro wants "
                f"one, it is a third distinct name and its own review."
            )

    for path, mime_types in find_fields(manifest, "mime_types"):
        if not isinstance(mime_types, list):
            continue
        examined += 1
        for value in values:
            handler = f"x-scheme-handler/{value}"
            if handler in mime_types:
                failures.append(
                    f"{path} contains {handler!r}, which registers an internal "
                    f"scheme as an external protocol handler — the same defect "
                    f"as a direct-launch scheme, by a different route "
                    f"(chrome/browser/shell_integration_linux.cc:382-388 builds "
                    f"these entries from that field)."
                )

    return failures, examined


def check_scheme_literals(common_dir: Path, values: list[str]) -> tuple[list[str], int]:
    """Inside //astro/common, only url_constants.h may spell a scheme literally.

    #11's registration code (common/astro_schemes.cc) sits in this directory and
    correctly uses the constants; this is what keeps it that way. Returns the
    failures and the number of files scanned.
    """
    failures: list[str] = []
    sources = sorted(
        path
        for pattern in ("*.h", "*.cc")
        for path in common_dir.rglob(pattern)
    )

    for path in sources:
        if path.name == SCHEME_LITERAL_HOME:
            continue
        text = path.read_text(encoding="utf-8")
        for value in values:
            if f'"{value}"' in text:
                failures.append(
                    f"{path.name} spells the scheme {value!r} as a literal. "
                    f"Only {SCHEME_LITERAL_HOME} may — everything else in "
                    f"//astro/common reaches it through astro::"
                    f"{SCHEME_CONSTANTS.get('trusted', 'kAstroUIScheme')} or its "
                    f"untrusted counterpart, so a rename stays a one-line change."
                )

    return failures, len(sources)


def check(
    manifest_path: Path,
    schema_path: Path,
    header_path: Path,
    legacy_root: Path,
    common_dir: Path,
) -> int:
    for what, path in (
        ("manifest", manifest_path),
        ("schema", schema_path),
        ("header", header_path),
    ):
        if not path.is_file():
            print(f"ERROR: {what} not found: {path}", file=sys.stderr)
            return 2
    if not common_dir.is_dir():
        print(f"ERROR: common directory not found: {common_dir}", file=sys.stderr)
        return 2

    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    failures: list[str] = []

    # 1. The manifest is a valid instance of the schema at all.
    schema_errors: list[str] = []
    lock.validate_node(manifest, schema, schema, "$", schema_errors)
    failures.extend(f"{manifest_path.name}: {error}" for error in schema_errors)

    schema_schemes = schema["properties"]["schemes"]["properties"]
    manifest_schemes = manifest["schemes"]

    constants, parse_problems = parse_header(header_path)
    failures.extend(parse_problems)

    # A header that parsed to nothing must not certify anything. This is the
    # vacuity floor: without it, a renamed declaration shape, a moved file or a
    # broken regex all look identical to "the constants agree".
    if not constants:
        print(
            f"ERROR: no `inline constexpr char` declarations found in "
            f"{header_path}. Either the file no longer declares the constants "
            f"or this checker's parser no longer matches how it declares them; "
            f"both are failures, and neither is a pass.",
            file=sys.stderr,
        )
        return 2

    for field, constant in SCHEME_CONSTANTS.items():
        # 2. The schema pins the value, so the manifest cannot drift either.
        field_schema = schema_schemes.get(field)
        if field_schema is None:
            failures.append(
                f"{schema_path.name}: schemes.{field} is not in the schema, so "
                f"nothing constrains it"
            )
            continue
        if "const" not in field_schema:
            failures.append(
                f"{schema_path.name}: schemes.{field} is not pinned with "
                f"`const`. A scheme name is not a per-build knob — every "
                f"registered origin, WebUI config key and process lock derives "
                f"from it, so changing it must cost a schema edit and a review."
            )
            continue

        pinned = field_schema["const"]
        declared = manifest_schemes.get(field)
        if declared != pinned:
            failures.append(
                f"{manifest_path.name}: schemes.{field} is {declared!r} but "
                f"{schema_path.name} pins {pinned!r}"
            )

        # 3. The C++ constant carries exactly that value.
        if constant not in constants:
            failures.append(
                f"{header_path.name}: schemes.{field} is declared as {declared!r} "
                f"in the manifest, but no constant named {constant} is declared "
                f"here to carry it"
            )
        elif constants[constant] != declared:
            failures.append(
                f"drift: manifest schemes.{field} is {declared!r} but "
                f"{header_path.name} declares {constant} = "
                f"{constants[constant]!r}"
            )

    # The reverse join. A scheme constant nobody declared in the manifest is a
    # second source of truth, which is the defect this checker exists to
    # prevent — so a one-sided check would miss exactly half of it.
    for name, value in sorted(constants.items()):
        if name.endswith("Scheme") and name not in SCHEME_CONSTANTS.values():
            failures.append(
                f"{header_path.name}: {name} = {value!r} is a scheme constant "
                f"with no manifest field behind it. Declare it under `schemes` "
                f"in the manifest and map it in SCHEME_CONSTANTS, or remove it."
            )

    # The two schemes are separate principals, so they must be separate strings.
    values = [manifest_schemes.get(field) for field in SCHEME_CONSTANTS]
    if len(set(values)) != len(values):
        failures.append(
            f"{manifest_path.name}: the schemes are not distinct ({values!r}). "
            f"They are separate security principals; one string cannot be both."
        )

    failures.extend(check_legacy_spellings(legacy_root, manifest_schemes))

    external_failures, examined = check_external_registration(manifest, values)
    failures.extend(external_failures)

    literal_failures, scanned = check_scheme_literals(common_dir, values)
    failures.extend(literal_failures)

    if failures:
        print("Scheme names have drifted:\n", file=sys.stderr)
        for failure in failures:
            print(f"  - {failure}", file=sys.stderr)
        return 1

    # Vacuity floors for the two scans, checked only once the run is otherwise
    # clean so a real failure is never masked by one of them.
    #
    # Rule 9 walks the document for field names; if it examined nothing, the
    # fields moved or were removed and the rule is silently inert.
    if examined == 0:
        print(
            "ERROR: rule 9 examined no fields. The manifest declares neither "
            "`direct_launch_url_scheme` nor `mime_types` anywhere, so the ban "
            "on registering an internal scheme with the OS checked nothing.",
            file=sys.stderr,
        )
        return 2

    # And the literal scan needs a positive control: url_constants.h itself must
    # contain what the scan looks for, or the scan is passing because it cannot
    # match rather than because nothing offends.
    header_text = header_path.read_text(encoding="utf-8")
    missing = [value for value in values if f'"{value}"' not in header_text]
    if missing or scanned == 0:
        print(
            f"ERROR: the scheme-literal scan cannot demonstrate it works. It "
            f"scanned {scanned} file(s) under {common_dir}, and "
            f"{header_path.name} does not contain {missing!r} as a literal. A "
            f"scan that cannot match is not evidence that nothing matched.",
            file=sys.stderr,
        )
        return 2

    print(f"manifest: {display(manifest_path)}")
    print(f"header:   {display(header_path)}")
    for field, constant in SCHEME_CONSTANTS.items():
        print(
            f"  schemes.{field:<10} = {manifest_schemes[field]:<16} "
            f"pinned by schema, carried by astro::{constant}"
        )
    for relative, field in LEGACY_SPELLINGS:
        print(f"  legacy spelling of schemes.{field}: {relative}")
    print(f"  rule 9: {examined} OS-registration field(s) examined, none collides")
    print(f"  {scanned} file(s) under {display(common_dir)} scanned for literals")
    print(f"{len(SCHEME_CONSTANTS)} scheme constants agree")
    return 0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--check", action="store_true", required=True)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--schema", type=Path, default=DEFAULT_SCHEMA)
    parser.add_argument("--header", type=Path, default=DEFAULT_HEADER)
    parser.add_argument("--legacy-root", type=Path, default=ASTRO_ROOT)
    parser.add_argument("--common-dir", type=Path, default=DEFAULT_COMMON)
    args = parser.parse_args(argv)
    return check(
        args.manifest, args.schema, args.header, args.legacy_root, args.common_dir
    )


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
