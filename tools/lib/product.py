#!/usr/bin/env python3
"""Read and validate the Astro product manifest.

The manifest declares every value that makes a build call itself Astro. This
reads it, proves it satisfies its schema, and applies the rules a JSON Schema
cannot express. Design and field-by-field reasoning:
docs/astro-next/architecture/product-manifest.md.

Schema validation is DELEGATED to tools/lib/lock.py rather than reimplemented.
Two JSON Schema subsets in one repository would drift, and drift between two
copies of the same rule is the defect this whole issue exists to remove. The
consequence worth knowing: product.schema.json may only use keywords lock.py
implements, and lock.py treats an unimplemented keyword as a hard error
(lock.py:80-92), so a schema that outgrows the validator fails loudly instead
of silently skipping a constraint.

Usage:
    product.py --validate [MANIFEST]        Schema, then structural rules 1-9.
    product.py --check-release CHANNEL      Additionally rules 10-13.
    product.py --get PATH [MANIFEST]        Print one value, e.g.
                                            platforms.windows.executable

MANIFEST defaults to the manifest beside this script's repository root, falling
back to the design copy under docs/astro-next/architecture/ while the module
layout for it is still being created.

Exits non-zero on any failure, and names what failed and why it matters.

Declared limitation, stated rather than hidden: rule 4 compares against
Chromium's install-mode identifiers recorded below as literals, transcribed
from chrome/install_static/chromium_install_modes.h:57-106. Nothing verifies
that transcription against the real header on every run, so an upstream change
would go unnoticed. The check that would close it, against a real checkout:

    grep -A4 'active_setup_guid\\|toast_activator_clsid' \\
        chromium/src/chrome/install_static/chromium_install_modes.h

That belongs in the test suite, where a fixture can pin it; it is not done
here, and this paragraph is the record that it is not.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import lock  # noqa: E402  (path must be set first; sibling module)

REPO_ROOT = Path(__file__).resolve().parents[2]
DESIGN_DIR = REPO_ROOT / "docs" / "astro-next" / "architecture"

# The module layout puts these at //astro/app/. Until that directory exists the
# design copies are authoritative, and the fallback is ordered so the real
# location wins the moment it appears — nobody has to remember to switch.
MANIFEST_CANDIDATES = (
    REPO_ROOT / "app" / "product.json",
    DESIGN_DIR / "product.example.json",
)
SCHEMA_CANDIDATES = (
    REPO_ROOT / "app" / "product.schema.json",
    DESIGN_DIR / "product.schema.json",
)

# Transcribed from chrome/install_static/chromium_install_modes.h:57-106.
# An Astro identifier equal to any of these is shared with every other Chromium
# fork that also failed to change it: one registration, one toast route, one
# AppContainer profile, fought over.
CHROMIUM_IDENTIFIERS = {
    "{7D2B3E1D-D096-4594-9D8F-A6667F12E0AC}": "Chromium's active_setup_guid",
    "{A2DF06F9-A21A-44A8-8A99-8B9C84F29160}": "Chromium's legacy_command_execute_clsid",
    "{635EFA6F-08D6-4EC9-BD14-8A0FDE975159}": "Chromium's toast_activator_clsid",
    "{D133B120-6DB4-4D6B-8BFE-83BF8CA1B1B0}": "Chromium's elevator_clsid",
    "{BB19A0E5-00C6-4966-94B2-5AFEC6FED93A}": "Chromium's elevator_iid",
    "{83F69367-442D-447F-8BCC-0E3F97BE9CF2}": "Chromium's tracing_service_clsid",
    "{A3FD580A-FFD4-4075-9174-75D0B199D3CB}": "Chromium's tracing_service_iid",
    "S-1-15-2-3251537155-1984446955-2931258699-841473695-1938553385-924012148-":
        "Chromium's sandbox_sid_prefix",
}

NON_RELEASE_HOSTS = ("localhost", "127.", "[::1]", "::1")
NON_RELEASE_SUFFIXES = (".local", ".internal", ".test", ".invalid")

WINDOWS_IDENTIFIER_FIELDS = (
    "active_setup_guid", "legacy_command_execute_clsid", "toast_activator_clsid",
    "elevator_clsid", "elevator_iid", "tracing_service_clsid",
    "tracing_service_iid", "sandbox_sid_prefix",
)


class ProductError(Exception):
    """A manifest problem, phrased for whoever has to fix it."""


# ---------------------------------------------------------------------------
# Walking helpers
# ---------------------------------------------------------------------------

def walk_identifiers(node, path: str = "$"):
    """Yield (path, object) for every identifier-shaped object in the tree.

    Shape rather than location, so an identifier added to a block this file has
    never heard of is still checked. The alternative — a fixed list of paths —
    silently stops covering the manifest the first time it grows.
    """
    if isinstance(node, dict):
        if "declared" in node and isinstance(node["declared"], bool):
            yield path, node
        for key, child in node.items():
            yield from walk_identifiers(child, f"{path}.{key}")
    elif isinstance(node, list):
        for index, child in enumerate(node):
            yield from walk_identifiers(child, f"{path}[{index}]")


def walk_urls(node, path: str = "$"):
    """Yield (path, value) for every string that looks like a URL."""
    if isinstance(node, dict):
        for key, child in node.items():
            yield from walk_urls(child, f"{path}.{key}")
    elif isinstance(node, list):
        for index, child in enumerate(node):
            yield from walk_urls(child, f"{path}[{index}]")
    elif isinstance(node, str) and "://" in node:
        yield path, node


# ---------------------------------------------------------------------------
# Structural rules — product-manifest.md §"Rules the schema cannot express"
# ---------------------------------------------------------------------------

def rule_1_identifiers_are_complete(manifest: dict) -> tuple[list[str], int]:
    """declared:true needs a value; declared:false needs a reason.

    This is the one rule of eleven that the schema demonstrably cannot catch —
    verified by mutation, not assumed.
    """
    failures, examined = [], 0
    for path, entry in walk_identifiers(manifest):
        examined += 1
        if entry["declared"]:
            if not entry.get("value"):
                failures.append(
                    f"{path}: declared is true but no non-empty value is "
                    f"recorded. An identifier that claims to be minted and is "
                    f"not is worse than one that admits it is missing: the "
                    f"release check passes it."
                )
        else:
            if not entry.get("reason"):
                failures.append(
                    f"{path}: declared is false with no reason. An unminted "
                    f"identifier has to say why and what would change it, or "
                    f"it is indistinguishable from an oversight."
                )
    return failures, examined


def rule_2_channels_join_both_ways(manifest: dict) -> tuple[list[str], int]:
    declared = set(manifest.get("channels", {}))
    failures, examined = [], 0
    for os_name, block in manifest.get("platforms", {}).items():
        if not isinstance(block, dict) or "channels" not in block:
            continue
        per_platform = set(block["channels"])
        examined += len(per_platform)
        for extra in sorted(per_platform - declared):
            failures.append(
                f"platforms.{os_name}.channels.{extra}: no such channel in the "
                f"top-level channels block. Identifiers reserved for a channel "
                f"nobody ships are reserved against nothing."
            )
        for missing in sorted(declared - per_platform):
            failures.append(
                f"platforms.{os_name}.channels: channel '{missing}' is declared "
                f"at the top level but has no {os_name} block, so that channel "
                f"cannot be built for {os_name}."
            )
    return failures, examined


def rule_3_only_stable_is_unsuffixed(manifest: dict) -> tuple[list[str], int]:
    failures, examined = [], 0
    for name, channel in manifest.get("channels", {}).items():
        examined += 1
        if name != "stable" and not channel.get("display_suffix"):
            failures.append(
                f"channels.{name}.display_suffix is empty, but only stable may "
                f"be unsuffixed. Two channels sharing a display name are "
                f"indistinguishable to the person running them."
            )
    windows = manifest.get("platforms", {}).get("windows", {})
    for name, channel in windows.get("channels", {}).items():
        examined += 1
        if name != "stable" and not channel.get("install_suffix"):
            failures.append(
                f"platforms.windows.channels.{name}.install_suffix is empty. "
                f"Every install path and registry key for this mode would "
                f"collide with stable's — a silent overwrite, not an error."
            )
    return failures, examined


def rule_4_windows_identifiers_are_unique(manifest: dict) -> tuple[list[str], int]:
    windows = manifest.get("platforms", {}).get("windows", {})
    seen: dict[str, str] = {}
    failures, examined = [], 0
    for name, channel in windows.get("channels", {}).items():
        for field in WINDOWS_IDENTIFIER_FIELDS:
            entry = channel.get(field)
            if not isinstance(entry, dict):
                continue
            # Count every identifier SLOT inspected, not every declared value.
            # Astro has minted none of these yet, so counting declared values
            # would report this rule as vacuous for a manifest that is exactly
            # as it should be — and "examined nothing" has to keep meaning "the
            # walk stopped matching the document", which is the only reading
            # that makes the floor worth having.
            examined += 1
            if not entry.get("declared"):
                continue
            value = entry.get("value", "")
            where = f"platforms.windows.channels.{name}.{field}"
            upstream = CHROMIUM_IDENTIFIERS.get(value.upper()) or \
                CHROMIUM_IDENTIFIERS.get(value)
            if upstream:
                failures.append(
                    f"{where} is {upstream}. Sharing it means sharing the "
                    f"registration with every fork that also left it unchanged."
                )
            if value in seen:
                failures.append(
                    f"{where} repeats the value already used by {seen[value]}. "
                    f"Per-channel identifiers exist to keep channels apart."
                )
            else:
                seen[value] = where
    return failures, examined


def rule_5_internal_name_matches_executable(manifest: dict) -> tuple[list[str], int]:
    windows = manifest.get("platforms", {}).get("windows", {})
    executable, internal = windows.get("executable"), windows.get("internal_name")
    if not executable or not internal:
        return [], 0
    expected = executable.removesuffix(".exe").replace("-", "_") + "_exe"
    if internal != expected:
        return ([
            f"platforms.windows.internal_name is '{internal}' but the "
            f"executable is '{executable}', so the PE InternalName and "
            f"OriginalFilename fields would disagree with each other. Expected "
            f"'{expected}'."
        ], 1)
    return [], 1


def rule_6_release_counter(manifest: dict) -> tuple[list[str], int]:
    release = manifest.get("version", {}).get("release")
    if not isinstance(release, int) or isinstance(release, bool) or release < 1:
        return ([
            f"version.release must be an integer of at least 1, got {release!r}."
        ], 1)
    return [], 1


def rule_7_mime_types(manifest: dict) -> tuple[list[str], int]:
    mime_types = manifest.get("platforms", {}).get("linux", {}).get("mime_types")
    if not isinstance(mime_types, list):
        return [], 0
    failures = []
    if not mime_types:
        failures.append("platforms.linux.mime_types is empty.")
    duplicates = {m for m in mime_types if mime_types.count(m) > 1}
    for duplicate in sorted(duplicates):
        failures.append(f"platforms.linux.mime_types repeats {duplicate!r}.")
    for required in ("x-scheme-handler/http", "x-scheme-handler/https"):
        if required not in mime_types:
            failures.append(
                f"platforms.linux.mime_types is missing {required!r}. A browser "
                f"that does not claim it cannot be made the default."
            )
    return failures, len(mime_types)


def rule_9_no_internal_scheme_registered(manifest: dict) -> tuple[list[str], int]:
    """Delegated to tools/lib/scheme_constants.py, which owns the scheme slice.

    Imported rather than reimplemented, and a HARD failure when the symbol is
    absent. Silently skipping it would leave the one rule that guards a security
    boundary looking enforced while checking nothing — and there is a live
    reason to be strict: two different files named scheme_constants.py have
    existed in this repository at once, only one of which exports this.
    """
    try:
        import scheme_constants
    except ImportError as error:
        raise ProductError(
            f"rule 9 cannot be checked: tools/lib/scheme_constants.py could not "
            f"be imported ({error}). It owns the internal-scheme rule, and "
            f"passing validation without it would report a security boundary as "
            f"enforced when nothing checked it."
        ) from error

    checker = getattr(scheme_constants, "check_external_registration", None)
    if checker is None:
        raise ProductError(
            "rule 9 cannot be checked: the tools/lib/scheme_constants.py on this "
            "path does not export check_external_registration. Two versions of "
            "that file have coexisted; this is the one without the rule. Get the "
            "version that has it before trusting a validation run."
        )

    schemes = manifest.get("schemes", {})
    values = [v for v in (schemes.get("trusted"), schemes.get("untrusted")) if v]
    return checker(manifest, values)


STRUCTURAL_RULES = (
    ("1  identifiers are complete", rule_1_identifiers_are_complete),
    ("2  channels join both ways", rule_2_channels_join_both_ways),
    ("3  only stable is unsuffixed", rule_3_only_stable_is_unsuffixed),
    ("4  windows identifiers are unique", rule_4_windows_identifiers_are_unique),
    ("5  internal name matches executable", rule_5_internal_name_matches_executable),
    ("6  release counter", rule_6_release_counter),
    ("7  linux mime types", rule_7_mime_types),
    # 8 is retired: the schema pins both scheme names with const, so a manifest
    # cannot reach here carrying a colliding one. See product-manifest.md.
    ("9  no internal scheme registered externally", rule_9_no_internal_scheme_registered),
)


# ---------------------------------------------------------------------------
# Release-safety rules
# ---------------------------------------------------------------------------

def release_rules(manifest: dict, channel: str) -> tuple[list[str], int]:
    failures, examined = [], 0

    channels = manifest.get("channels", {})
    if channel not in channels:
        raise ProductError(
            f"no such channel in the manifest: {channel}. Declared: "
            f"{', '.join(sorted(channels)) or 'none'}"
        )

    # 13. The channel must be one that ships.
    examined += 1
    if not channels[channel].get("is_release"):
        failures.append(
            f"channels.{channel}.is_release is false, so it must not be built "
            f"as a release."
        )

    # 10. Nothing reachable from that channel may be unminted.
    # macos.team_id is deliberately left to rule 12, which names the specific
    # consequence — reporting one field twice in a failure list is how a report
    # stops being read.
    for path, entry in walk_identifiers(manifest):
        other = [c for c in channels if c != channel and f".channels.{c}." in path]
        if other or path == "$.platforms.macos.team_id":
            continue
        examined += 1
        if not entry["declared"]:
            failures.append(
                f"{path} is not minted ({entry.get('reason', 'no reason given')})"
            )

    # 11. No release build may point at a development endpoint.
    for path, url in walk_urls(manifest):
        examined += 1
        scheme, _, rest = url.partition("://")
        host = rest.split("/")[0].split(":")[0]
        if scheme != "https":
            failures.append(f"{path} uses {scheme}://, but a release build requires https.")
        if host.startswith(NON_RELEASE_HOSTS) or host.endswith(NON_RELEASE_SUFFIXES):
            failures.append(f"{path} points at {host}, which is not reachable for a released build.")

    # 12. macOS cannot be signed without a Team ID.
    macos = manifest.get("platforms", {}).get("macos", {})
    if macos:
        examined += 1
        team_id = macos.get("team_id", {})
        if isinstance(team_id, dict) and not team_id.get("declared"):
            failures.append(
                "platforms.macos.team_id is not declared. Code signing and "
                "notarisation cannot succeed without it, so no macOS release "
                "channel may build."
            )

    return failures, examined


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------

def first_existing(candidates, what: str) -> Path:
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    searched = "\n".join(f"      {c}" for c in candidates)
    raise ProductError(f"no {what} found. Searched:\n{searched}")


def load(manifest_path: Path | None) -> tuple[dict, Path, Path]:
    manifest_file = manifest_path or first_existing(MANIFEST_CANDIDATES, "product manifest")
    schema_file = first_existing(SCHEMA_CANDIDATES, "product schema")
    manifest = lock.load_json(manifest_file, "product manifest")
    schema = lock.load_json(schema_file, "product schema")

    errors = lock.validate(manifest, schema)
    if errors:
        raise ProductError(
            "%s does not satisfy %s:\n%s"
            % (manifest_file.name, schema_file.name,
               "\n".join("    - " + e for e in errors))
        )
    return manifest, manifest_file, schema_file


def report(results, header: str) -> int:
    """Print rule outcomes. A rule that examined nothing is a failure.

    The vacuity floor is per rule rather than per run: a walk that stopped
    matching the document reports zero failures, which is indistinguishable
    from a pass unless the count is checked too.
    """
    print(header)
    failed = False
    for name, failures, examined in results:
        if examined == 0:
            print(f"  VACUOUS  {name} — examined nothing, so its pass means nothing")
            failed = True
            continue
        if failures:
            failed = True
            print(f"  FAIL     {name} ({examined} examined)")
            for failure in failures:
                print(f"             - {failure}")
        else:
            print(f"  ok       {name} ({examined} examined)")
    return 1 if failed else 0


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__, file=sys.stderr)
        return 2

    mode, rest = argv[1], argv[2:]

    try:
        if mode == "--validate":
            manifest, manifest_file, schema_file = load(Path(rest[0]) if rest else None)
            print(f"{manifest_file.name}: valid against {schema_file.name}")
            results = [(name, *fn(manifest)) for name, fn in STRUCTURAL_RULES]
            return report(results, "structural rules:")

        if mode == "--check-release":
            if not rest:
                print("--check-release needs a channel name", file=sys.stderr)
                return 2
            channel, rest = rest[0], rest[1:]
            manifest, manifest_file, schema_file = load(Path(rest[0]) if rest else None)
            print(f"{manifest_file.name}: valid against {schema_file.name}")
            results = [(name, *fn(manifest)) for name, fn in STRUCTURAL_RULES]
            status = report(results, "structural rules:")
            failures, examined = release_rules(manifest, channel)
            status |= report(
                [(f"release safety ({channel})", failures, examined)],
                f"\nrelease rules for {channel}:",
            )
            return status

        if mode == "--get":
            if not rest:
                print("--get needs a dotted path", file=sys.stderr)
                return 2
            dotted, rest = rest[0], rest[1:]
            manifest, _, _ = load(Path(rest[0]) if rest else None)
            node = manifest
            for part in dotted.split("."):
                if not isinstance(node, dict) or part not in node:
                    raise ProductError(f"no such field in manifest: {dotted}")
                node = node[part]
            print(node if not isinstance(node, (dict, list)) else json.dumps(node, indent=2))
            return 0

        print(f"unknown mode: {mode}", file=sys.stderr)
        return 2

    except (ProductError, lock.LockError) as error:
        print(f"ERROR {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
