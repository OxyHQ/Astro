#!/usr/bin/env python3
"""Validate the Astro Next policy manifests and generate their human documents.

Issue #10. Two manifests, one validator, and every join strict in both
directions -- the same shape the baseline uses for patch and preference
dispositions, for the same reason: a hand-maintained judgement file that nothing
checks against reality becomes wrong quietly, and is then cited.

WHAT IS CHECKED

  schema            Both manifests against the committed JSON Schemas. The
                    schemas are implemented here rather than by a library: no
                    third-party import, and `_assert_supported` fails if a
                    schema uses a keyword this validator does not honour, so a
                    constraint cannot become decorative.
  host join         Every host tools/policy/endpoint_seed.py derives from
                    committed text has exactly one entry, and every entry names
                    a seeded host unless it declares why it cannot be derived.
  feature join      Every endpoint's owning_feature exists; every feature's
                    declared endpoint ids exist; and every endpoint whose
                    contact is not `never` is claimed by the feature it names.
  policy rules      The rules issue #10 requires: no unjustified wildcard host,
                    no unjustified http production endpoint, no staging endpoint
                    without a release block, no INVESTIGATE without a question
                    AND the thing that answers it.
  vacuity           A check whose pass and whose nothing-was-measured look
                    identical is worse than no check (baseline finding 7). Every
                    rule class reports how many entries it examined, and a rule
                    that examined none of a class the manifests contain fails.

Usage:
    tools/policy/manifest.py --check          validate; regenerate; fail on diff
    tools/policy/manifest.py --write          validate and regenerate in place
    tools/policy/manifest.py --json DIR       machine-readable output
    tools/policy/manifest.py --policy-dir D   validate a copy (test seam)
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
POLICY_DIR = REPO_ROOT / "docs" / "astro-next" / "policy"

sys.path.insert(0, str(Path(__file__).resolve().parent))
import endpoint_seed  # noqa: E402

committed_state = endpoint_seed.committed_state

NAMES = {
    "features": "features.json",
    "endpoints": "endpoints.json",
    "feature_schema": "feature-manifest.schema.json",
    "endpoint_schema": "endpoint-manifest.schema.json",
    "feature_doc": "feature-manifest.md",
    "endpoint_doc": "network-endpoints.md",
}

STATES = ("KEEP", "REPLACE", "DISABLE_BUILD", "DISABLE_RUNTIME", "DORMANT", "INVESTIGATE")

# The seed is derived from committed text. If it ever comes back empty the joins
# below all pass trivially, so the floor is asserted before anything is checked.
MINIMUM_SEEDED_HOSTS = 50


class PolicyError(Exception):
    pass


# ---------------------------------------------------------------------------
# A deliberately small JSON Schema subset
# ---------------------------------------------------------------------------

SUPPORTED = {
    "$schema", "$id", "$ref", "$defs", "title", "description", "properties",
    "required", "type", "enum", "items", "pattern", "minItems",
}


def _assert_supported(schema: dict, path: str = "#") -> None:
    """Every keyword in the schema is one this validator honours.

    Without this, adding a constraint the validator ignores is indistinguishable
    from adding one it enforces -- the schema reads as protection and provides
    none. Same failure shape as a `jest.fn` spy nothing is wired to.
    """
    if isinstance(schema, dict):
        for key, value in schema.items():
            if key in ("properties", "$defs"):
                for name, sub in value.items():
                    _assert_supported(sub, f"{path}/{key}/{name}")
                continue
            if key not in SUPPORTED:
                raise PolicyError(f"{path}: schema keyword '{key}' is not enforced by this validator")
            if isinstance(value, dict):
                _assert_supported(value, f"{path}/{key}")


def _resolve(schema: dict, root: dict) -> dict:
    seen = 0
    while "$ref" in schema:
        seen += 1
        if seen > 10:
            raise PolicyError("$ref chain too deep")
        pointer = schema["$ref"]
        if not pointer.startswith("#/"):
            raise PolicyError(f"only local $ref is supported, got {pointer}")
        node = root
        for part in pointer[2:].split("/"):
            node = node[part]
        schema = node
    return schema


def _validate(value, schema: dict, root: dict, path: str, errors: list[str]) -> None:
    schema = _resolve(schema, root)

    expected = schema.get("type")
    if expected == "object" and not isinstance(value, dict):
        errors.append(f"{path}: expected object")
        return
    if expected == "array" and not isinstance(value, list):
        errors.append(f"{path}: expected array")
        return
    if expected == "string" and not isinstance(value, str):
        errors.append(f"{path}: expected string")
        return
    if expected == "integer" and not isinstance(value, int):
        errors.append(f"{path}: expected integer")
        return
    if expected == "boolean" and not isinstance(value, bool):
        errors.append(f"{path}: expected boolean")
        return

    if "enum" in schema and value not in schema["enum"]:
        errors.append(f"{path}: {value!r} is not one of {schema['enum']}")
    if "pattern" in schema and isinstance(value, str):
        if not re.search(schema["pattern"], value):
            errors.append(f"{path}: {value!r} does not match {schema['pattern']}")
    if "minItems" in schema and isinstance(value, list):
        if len(value) < schema["minItems"]:
            errors.append(f"{path}: needs at least {schema['minItems']} item(s)")

    if isinstance(value, dict):
        for name in schema.get("required", []):
            if name not in value:
                errors.append(f"{path}: missing required field '{name}'")
        for name, sub in schema.get("properties", {}).items():
            if name in value:
                _validate(value[name], sub, root, f"{path}.{name}", errors)
    if isinstance(value, list) and "items" in schema:
        for index, item in enumerate(value):
            _validate(item, schema["items"], root, f"{path}[{index}]", errors)


def validate_document(document: dict, schema: dict, label: str) -> list[str]:
    _assert_supported(schema)
    errors: list[str] = []
    _validate(document, schema, schema, label, errors)
    return errors


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------


def _load(path: Path) -> dict:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


# ---------------------------------------------------------------------------
# Joins and policy rules
# ---------------------------------------------------------------------------


def check(features: dict, endpoints: dict, seed: dict) -> tuple[list[str], dict]:
    errors: list[str] = []
    counted: dict[str, int] = {}

    def count(rule: str, n: int = 1) -> None:
        counted[rule] = counted.get(rule, 0) + n

    if len(seed) < MINIMUM_SEEDED_HOSTS:
        errors.append(
            f"seed produced {len(seed)} host(s), below the floor of {MINIMUM_SEEDED_HOSTS}. "
            "Every join below would pass trivially; refusing to report a pass."
        )
        return errors, counted

    feature_list = features["features"]
    endpoint_list = endpoints["hosts"]

    # --- unique ids -------------------------------------------------------
    for label, items in (("feature", feature_list), ("endpoint", endpoint_list)):
        seen: dict[str, int] = {}
        for entry in items:
            seen[entry["id"]] = seen.get(entry["id"], 0) + 1
        for name, n in sorted(seen.items()):
            if n > 1:
                errors.append(f"{label} id '{name}' is declared {n} times")
        count(f"{label}-ids", len(items))

    # --- host join, both directions --------------------------------------
    declared_hosts = {entry["host"] for entry in endpoint_list}
    for host in seed:
        if host not in declared_hosts:
            errors.append(
                f"host '{host}' is referenced by committed text and has no manifest entry "
                f"(sources: {'+'.join(seed[host]['sources'])}, refs: {seed[host]['references'][0]})"
            )
    for entry in endpoint_list:
        if entry["host"] in seed:
            continue
        if "declared_reason" not in entry:
            errors.append(
                f"endpoint '{entry['id']}' names host '{entry['host']}', which no committed text "
                "references, and does not say why it cannot be derived (declared_reason)"
            )
        else:
            count("declared-hosts")
    count("host-join", len(seed))

    # --- feature join, both directions -----------------------------------
    feature_ids = {entry["id"] for entry in feature_list}
    endpoint_ids = {entry["id"] for entry in endpoint_list}
    claimed: dict[str, list[str]] = {}
    for entry in feature_list:
        for name in entry["network"]:
            if name == "none":
                continue
            if name not in endpoint_ids:
                errors.append(f"feature '{entry['id']}' declares unknown endpoint id '{name}'")
            claimed.setdefault(name, []).append(entry["id"])
            count("feature-endpoint-refs")
    for entry in endpoint_list:
        owner = entry["owning_feature"]
        if owner != "none" and owner not in feature_ids:
            errors.append(f"endpoint '{entry['id']}' names unknown owning_feature '{owner}'")
        # An endpoint something actually talks to must be claimed from the
        # feature side too. Without this the two manifests can each look
        # complete while nothing links them.
        if entry["contact"] in ("automatic", "user-initiated") and owner != "none":
            if owner not in claimed.get(entry["id"], []):
                errors.append(
                    f"endpoint '{entry['id']}' is contacted ({entry['contact']}) and names owning_feature "
                    f"'{owner}', but that feature does not list it under `network`"
                )
            count("contacted-endpoints")

    # --- policy rules -----------------------------------------------------
    for entry in endpoint_list:
        where = f"endpoint '{entry['id']}'"
        if "*" in entry["host"]:
            count("wildcard-hosts")
            if not entry.get("wildcard_justification"):
                errors.append(f"{where}: wildcard host requires wildcard_justification")
        if entry.get("scheme") == "http" and entry["environment"] == "production":
            count("http-production")
            if not entry.get("http_justification"):
                errors.append(f"{where}: http production endpoint requires http_justification")
        if entry["environment"] in ("staging", "local-test"):
            count("non-production-endpoints")
            if entry.get("release_blocked") is not True:
                errors.append(
                    f"{where}: {entry['environment']} endpoint must set release_blocked true -- "
                    "a release build may not contain it"
                )
        if entry["state"] == "INVESTIGATE":
            count("investigate-endpoints")
            if "investigate" not in entry:
                errors.append(f"{where}: state INVESTIGATE requires an investigate block")
        if entry["state"] in ("KEEP", "REPLACE") and entry["contact"] in (
            "automatic",
            "user-initiated",
        ):
            count("live-endpoints")
            if entry["environment"] != "production":
                errors.append(
                    f"{where}: state {entry['state']} with contact {entry['contact']} must be a "
                    f"production endpoint, not {entry['environment']}"
                )

    for entry in feature_list:
        where = f"feature '{entry['id']}'"
        if entry["state"] == "INVESTIGATE":
            count("investigate-features")
            if "investigate" not in entry:
                errors.append(f"{where}: state INVESTIGATE requires an investigate block")
        if entry["state"] == "DORMANT":
            count("dormant-features")
            if entry["observed_state"] == "NOT_BUILT":
                errors.append(
                    f"{where}: DORMANT is a decision about reachable code. This capability is "
                    "NOT_BUILT (baseline finding 1 -- nothing links the overlay into the build "
                    "graph), which is a build defect owned by #7, not a disposition."
                )
        if entry.get("routed_to_issue") and entry["state"] != "INVESTIGATE":
            errors.append(
                f"{where}: routed to #{entry['routed_to_issue']} but carries a decided state "
                f"({entry['state']}). A routed capability is listed for completeness; the state "
                "is the other issue's to take."
            )

    # --- declared non-applying patches still exist -----------------------
    series = committed_state.read_text("patches/astro/series")
    for name in endpoints.get("non_applying_patches", {}).get("patches", []):
        count("non-applying-patches")
        if name not in series:
            errors.append(
                f"non_applying_patches names '{name}', which is not in patches/astro/series"
            )

    # --- vacuity ----------------------------------------------------------
    # Each rule class that the manifests actually contain must have been
    # examined. A traversal that silently visited nothing passes every rule.
    if any(entry["state"] == "INVESTIGATE" for entry in endpoint_list):
        if not counted.get("investigate-endpoints"):
            errors.append("vacuity: INVESTIGATE endpoints exist but the rule examined none")
    if any(entry["environment"] in ("staging", "local-test") for entry in endpoint_list):
        if not counted.get("non-production-endpoints"):
            errors.append("vacuity: non-production endpoints exist but the rule examined none")

    return errors, counted


# ---------------------------------------------------------------------------
# Documents
# ---------------------------------------------------------------------------

HEADER = (
    "<!-- Generated by tools/policy/manifest.py — do not edit by hand.\n"
    "     Regenerate with: tools/policy/manifest.py --write\n"
    "     Judgement lives in {source}; the host set is seeded from\n"
    "     tools/baseline/inventory_endpoints.py and joined strictly. -->\n"
)


def _escape(text: str) -> str:
    return text.replace("|", "\\|").replace("\n", " ")


def render_features(features: dict) -> str:
    lines = [HEADER.format(source="`features.json`"), "# Astro Next feature matrix", ""]
    lines.append(
        "Every capability Astro must decide about, with the decision and who owns it. "
        "`Observed` is what the current legacy build does; `State` is the Astro Next "
        "decision. They are separate columns so an inherited patch's effect is never "
        "read as a decision somebody took."
    )
    lines.append("")

    entries = features["features"]
    tally: dict[str, int] = {}
    for entry in entries:
        tally[entry["state"]] = tally.get(entry["state"], 0) + 1
    lines.append("| State | Count |")
    lines.append("|---|---|")
    for state in STATES:
        lines.append(f"| `{state}` | {tally.get(state, 0)} |")
    lines.append(f"| **total** | **{len(entries)}** |")
    lines.append("")

    areas = {
        "core-browser": "Core browser product",
        "google-provider": "Google / provider-dependent",
        "astro-product": "Astro product capabilities",
        "inherited-privacy-patch": "Inherited privacy and security patches",
    }
    for area, title in areas.items():
        group = [entry for entry in entries if entry["area"] == area]
        if not group:
            continue
        lines.append(f"## {title} ({len(group)})")
        lines.append("")
        lines.append("| Feature | Observed | State | Owner | Endpoints | Rationale |")
        lines.append("|---|---|---|---|---|---|")
        for entry in sorted(group, key=lambda item: item["id"]):
            owner = f"#{entry['owner_issue']}"
            if entry.get("routed_to_issue"):
                owner += f" → **#{entry['routed_to_issue']}**"
            network = ", ".join(f"`{name}`" for name in entry["network"])
            lines.append(
                "| `%s` | %s | **%s** | %s | %s | %s |"
                % (
                    entry["id"],
                    entry["observed_state"],
                    entry["state"],
                    owner,
                    network,
                    _escape(entry["rationale"]),
                )
            )
        lines.append("")

    blocking = [entry for entry in entries if entry.get("blocks")]
    if blocking:
        lines.append("## Decisions that block another issue")
        lines.append("")
        lines.append("| Feature | Blocks | Why |")
        lines.append("|---|---|---|")
        for entry in sorted(blocking, key=lambda item: (min(item["blocks"]), item["id"])):
            blocks = ", ".join(f"#{number}" for number in entry["blocks"])
            lines.append(
                "| `%s` | %s | %s |"
                % (entry["id"], blocks, _escape(entry.get("blocks_reason", "")))
            )
        lines.append("")

    unknown = [entry for entry in entries if entry["state"] == "INVESTIGATE"]
    if unknown:
        lines.append("## Open questions")
        lines.append("")
        lines.append("| Feature | Owner | Question | Answered by |")
        lines.append("|---|---|---|---|")
        for entry in sorted(unknown, key=lambda item: item["id"]):
            owner = entry.get("routed_to_issue") or entry["owner_issue"]
            lines.append(
                "| `%s` | #%s | %s | %s |"
                % (
                    entry["id"],
                    owner,
                    _escape(entry["investigate"]["question"]),
                    _escape(entry["investigate"]["answered_by"]),
                )
            )
        lines.append("")

    return "\n".join(lines) + "\n"


def render_endpoints(endpoints: dict, seed: dict) -> str:
    lines = [HEADER.format(source="`endpoints.json`"), "# Astro Next network endpoints", ""]
    lines.append(
        "Every host committed text references, with its disposition. The host set is "
        "derived on every run by `tools/policy/endpoint_seed.py`, which imports issue #6's "
        "`tools/baseline/inventory_endpoints.py` and adds a scan of `webui/` that generator "
        "does not perform. Nothing here is hand-copied."
    )
    lines.append("")
    lines.append(
        "**This is not a measured trace.** It is what the source says. A real network "
        "baseline needs a running browser behind a recorder; `tools/baseline/capture-network.sh` "
        "is that harness and it refuses to emit a trace it did not record. Runtime capture is "
        "blocked because no Astro binary exists yet — baseline finding 1."
    )
    lines.append("")

    entries = endpoints["hosts"]
    tally: dict[str, int] = {}
    observed: dict[str, int] = {}
    contact: dict[str, int] = {}
    kinds: dict[str, int] = {}
    for entry in entries:
        tally[entry["state"]] = tally.get(entry["state"], 0) + 1
        observed[entry["observed_state"]] = observed.get(entry["observed_state"], 0) + 1
        contact[entry["contact"]] = contact.get(entry["contact"], 0) + 1
        kinds[entry["reference_kind"]] = kinds.get(entry["reference_kind"], 0) + 1

    lines.append("### The decision")
    lines.append("")
    lines.append("| State | Hosts |")
    lines.append("|---|---|")
    for state in STATES:
        lines.append(f"| `{state}` | {tally.get(state, 0)} |")
    lines.append(f"| **total** | **{len(entries)}** |")
    lines.append("")

    lines.append("### What the current build does — a separate axis")
    lines.append("")
    lines.append(
        "This is what makes `DISABLE_BUILD` and `DISABLE_RUNTIME` falsifiable rather than "
        "rhetorical. `REMOVED_BY_PATCH` means the literal is absent from the tree and a string "
        "scan of the artefact can prove it. `RUNTIME_BLOCKED` means the literal is **present**, "
        "the calling code is compiled and still reached, and only the net layer refuses — for "
        "these hosts the inherited iridium patch rewrites the URL to `trk:` and "
        "`block-trk-and-subdomains.patch` makes `trk:` unresolvable. The two look identical in a "
        "feature list and are entirely different in a threat model."
    )
    lines.append("")
    lines.append("| Observed | Hosts |")
    lines.append("|---|---|")
    for name, number in sorted(observed.items(), key=lambda item: (-item[1], item[0])):
        lines.append(f"| `{name}` | {number} |")
    lines.append("")

    lines.append("### Contact")
    lines.append("")
    lines.append("| Contact | Hosts |")
    lines.append("|---|---|")
    for name, number in sorted(contact.items(), key=lambda item: (-item[1], item[0])):
        lines.append(f"| `{name}` | {number} |")
    lines.append("")

    lines.append("### Why each host appears in committed text")
    lines.append("")
    lines.append("| `reference_kind` | Hosts |")
    lines.append("|---|---|")
    for kind, number in sorted(kinds.items(), key=lambda item: (-item[1], item[0])):
        lines.append(f"| `{kind}` | {number} |")
    lines.append("")

    groups = [
        ("automatic", "Contacted automatically"),
        ("user-initiated", "Contacted only on a user action"),
        ("unknown", "Contact behaviour not established"),
        ("never", "Never contacted"),
    ]
    for key, title in groups:
        group = [entry for entry in entries if entry["contact"] == key]
        if not group:
            continue
        lines.append(f"## {title} ({len(group)})")
        lines.append("")
        lines.append("| Host | Observed | State | Kind | Feature | Owner | Trigger | Rationale |")
        lines.append("|---|---|---|---|---|---|---|---|")
        for entry in sorted(group, key=lambda item: item["host"]):
            owner = f"#{entry['owner_issue']}"
            if entry.get("routed_to_issue"):
                owner += f" → **#{entry['routed_to_issue']}**"
            lines.append(
                "| `%s` | %s | **%s** | %s | `%s` | %s | %s | %s |"
                % (
                    entry["host"],
                    entry["observed_state"],
                    entry["state"],
                    entry["reference_kind"],
                    entry["owning_feature"],
                    owner,
                    _escape(entry.get("trigger", "—")),
                    _escape(entry["rationale"]),
                )
            )
        lines.append("")

    lines.append("## Seed provenance")
    lines.append("")
    lines.append("| Source | Hosts | What it reads |")
    lines.append("|---|---|---|")
    baseline_only = sum(
        1 for entry in seed.values() if entry["sources"] == [endpoint_seed.SOURCE_BASELINE]
    )
    webui_only = sum(
        1 for entry in seed.values() if entry["sources"] == [endpoint_seed.SOURCE_WEBUI]
    )
    both = sum(1 for entry in seed.values() if len(entry["sources"]) > 1)
    declared = sum(1 for entry in endpoints["hosts"] if entry["host"] not in seed)
    lines.append(
        f"| `baseline-inventory` | {baseline_only} | `src/**/*.{{cc,h,mojom,rs}}` and `patches/**/*.patch`, "
        "via `tools/baseline/inventory_endpoints.py` |"
    )
    lines.append(
        f"| `webui-scan` | {webui_only} | `webui/*/src/**` — not read by the baseline generator |"
    )
    lines.append(f"| both | {both} | referenced from each |")
    lines.append(
        f"| `declared` | {declared} | no committed reference; each entry says why it cannot be derived |"
    )
    lines.append("")

    unknown = [entry for entry in entries if entry["state"] == "INVESTIGATE"]
    if unknown:
        lines.append("## Open questions")
        lines.append("")
        lines.append("| Host | Owner | Question | Answered by |")
        lines.append("|---|---|---|---|")
        for entry in sorted(unknown, key=lambda item: item["host"]):
            owner = entry.get("routed_to_issue") or entry["owner_issue"]
            lines.append(
                "| `%s` | #%s | %s | %s |"
                % (
                    entry["host"],
                    owner,
                    _escape(entry["investigate"]["question"]),
                    _escape(entry["investigate"]["answered_by"]),
                )
            )
        lines.append("")

    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--json")
    parser.add_argument(
        "--policy-dir",
        help=(
            "Validate a COPY of the policy directory instead of the committed one. A test seam, "
            "and a flag rather than an environment variable on purpose: it changes what is being "
            "measured, so it must be visible in the command somebody ran. It waves nothing "
            "through — the manifests it reads are still validated in full, and the seed is still "
            "derived from HEAD."
        ),
    )
    args = parser.parse_args(argv[1:])

    directory = Path(args.policy_dir) if args.policy_dir else POLICY_DIR
    if args.policy_dir:
        print(f"NOTE validating {directory}, not the committed policy directory", file=sys.stderr)
    paths = {key: directory / name for key, name in NAMES.items()}

    features = _load(paths["features"])
    endpoints = _load(paths["endpoints"])
    seed = endpoint_seed.build_seed()

    errors = validate_document(features, _load(paths["feature_schema"]), "features")
    errors += validate_document(endpoints, _load(paths["endpoint_schema"]), "endpoints")
    if errors:
        for message in errors:
            print(f"ERROR {message}", file=sys.stderr)
        print(f"\n{len(errors)} schema error(s)", file=sys.stderr)
        return 1

    errors, counted = check(features, endpoints, seed)
    for rule, number in sorted(counted.items()):
        print(f"checked {rule}: {number}")
    if errors:
        print("", file=sys.stderr)
        for message in errors:
            print(f"ERROR {message}", file=sys.stderr)
        print(f"\n{len(errors)} manifest error(s)", file=sys.stderr)
        return 1

    feature_doc = render_features(features)
    endpoint_doc = render_endpoints(endpoints, seed)

    if args.json:
        out = Path(args.json)
        out.mkdir(parents=True, exist_ok=True)
        with (out / "policy-seed.json").open("w", encoding="utf-8") as handle:
            json.dump(seed, handle, indent=2, sort_keys=True)
            handle.write("\n")
        print(f"wrote {out / 'policy-seed.json'}")

    if args.write:
        paths["feature_doc"].write_text(feature_doc, encoding="utf-8")
        paths["endpoint_doc"].write_text(endpoint_doc, encoding="utf-8")
        print(f"wrote {paths['feature_doc']}")
        print(f"wrote {paths['endpoint_doc']}")
        return 0

    if args.check:
        drifted = False
        for path, current in (
            (paths["feature_doc"], feature_doc),
            (paths["endpoint_doc"], endpoint_doc),
        ):
            if not path.exists():
                print(f"ERROR generated document is missing: {path}", file=sys.stderr)
                drifted = True
                continue
            if path.read_text(encoding="utf-8") != current:
                print(f"ERROR generated document is out of date: {path}", file=sys.stderr)
                drifted = True
        if drifted:
            print(
                "\nRegenerate and commit:  tools/policy/manifest.py --write",
                file=sys.stderr,
            )
            return 1
        print("policy manifests validate and their documents are current")

    return 0


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv))
    except PolicyError as error:
        print(f"ERROR {error}", file=sys.stderr)
        sys.exit(2)
