#!/usr/bin/env python3
"""Read and validate browser.lock.json — Astro's source revision lock.

The lock declares the exact immutable revision of every external source that
can change browser output. A build reads it; it never asks a remote what
"latest" means, and never accepts whatever a cached runner happens to hold.

Validation reads `browser.lock.schema.json` rather than re-stating its rules,
so the schema is the contract and the two cannot drift. Only the JSON Schema
subset the lock actually uses is implemented — a partial validator that says
so beats a dependency on `jsonschema`, which would have to be installed on
every clean machine and CI runner before the lock could be checked at all.

Usage:
    lock.py --validate [LOCK]              Validate against the schema.
    lock.py --get PATH [LOCK]              Print one value, e.g. chromium.commit
    lock.py --get-optional PATH [LOCK]     Same, but print nothing and exit 0
                                           when the field is absent.
    lock.py --revisions [LOCK]             Print `name<TAB>revision` for each.
    lock.py --check-remote [LOCK]          Verify each commit exists at its
                                           origin (needs network).

LOCK defaults to browser.lock.json beside this script's repository root.
Exits non-zero on any failure, and names what failed.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_LOCK = REPO_ROOT / "browser.lock.json"
DEFAULT_SCHEMA = REPO_ROOT / "browser.lock.schema.json"


class LockError(Exception):
    """A lock file problem, phrased for whoever has to fix it."""


# ---------------------------------------------------------------------------
# Minimal JSON Schema validation
# ---------------------------------------------------------------------------

SUPPORTED_KEYWORDS = {
    "$schema", "$id", "$ref", "$defs", "title", "description",
    "type", "required", "properties", "additionalProperties",
    "propertyNames", "pattern", "const", "enum", "minLength", "items",
}

TYPE_MAP = {
    "object": dict,
    "array": list,
    "string": str,
    "integer": int,
    "boolean": bool,
    "number": (int, float),
}


def resolve_ref(schema: dict, root: dict) -> dict:
    """Follow a local $ref. Only in-document refs are used by this schema."""
    ref = schema["$ref"]
    if not ref.startswith("#/"):
        raise LockError(f"schema uses an unsupported external $ref: {ref}")
    node = root
    for part in ref[2:].split("/"):
        node = node[part]
    return node


def validate_node(value, schema: dict, root: dict, path: str, errors: list[str]) -> None:
    if "$ref" in schema:
        validate_node(value, resolve_ref(schema, root), root, path, errors)
        return

    # A keyword this validator does not implement must be loud, not ignored:
    # silently skipping a constraint makes the schema look enforced when it is
    # not, which is worse than having no validator.
    for keyword in schema:
        if keyword not in SUPPORTED_KEYWORDS:
            errors.append(
                f"{path}: schema uses '{keyword}', which tools/lib/lock.py does "
                f"not implement. Implement it or stop using it — a skipped "
                f"constraint is an unenforced one."
            )

    expected_type = schema.get("type")
    if expected_type is not None:
        python_type = TYPE_MAP[expected_type]
        # bool is a subclass of int in Python; an integer field must not
        # silently accept true.
        if expected_type == "integer" and isinstance(value, bool):
            errors.append(f"{path}: expected integer, got boolean")
            return
        if not isinstance(value, python_type):
            errors.append(
                f"{path}: expected {expected_type}, got {type(value).__name__}"
            )
            return

    if "const" in schema and value != schema["const"]:
        errors.append(f"{path}: expected {schema['const']!r}, got {value!r}")

    if "enum" in schema and value not in schema["enum"]:
        errors.append(f"{path}: {value!r} is not one of {schema['enum']!r}")

    if isinstance(value, str):
        pattern = schema.get("pattern")
        if pattern and not re.fullmatch(pattern, value):
            errors.append(
                f"{path}: {value!r} does not match {pattern}"
                + _explain(path, pattern, value)
            )
        minimum_length = schema.get("minLength")
        if minimum_length is not None and len(value) < minimum_length:
            errors.append(f"{path}: must be at least {minimum_length} character(s)")

    if isinstance(value, dict):
        for required in schema.get("required", []):
            if required not in value:
                errors.append(f"{path}: missing required field '{required}'")

        properties = schema.get("properties", {})
        names_schema = schema.get("propertyNames")
        allow_extra = schema.get("additionalProperties", True)

        for key, child in value.items():
            child_path = f"{path}.{key}" if path else key
            if names_schema is not None:
                validate_node(key, names_schema, root, f"{child_path} (name)", errors)
            if key in properties:
                validate_node(child, properties[key], root, child_path, errors)
            elif allow_extra is False:
                errors.append(f"{child_path}: unexpected field")
            elif isinstance(allow_extra, dict):
                validate_node(child, allow_extra, root, child_path, errors)

    if isinstance(value, list) and "items" in schema:
        for index, item in enumerate(value):
            validate_node(item, schema["items"], root, f"{path}[{index}]", errors)


def _explain(path: str, pattern: str, value: str) -> str:
    """Turn a pattern mismatch into the reason it matters."""
    if pattern == "^[0-9a-f]{40}$":
        if re.fullmatch(r"[0-9a-fA-F]{7,39}", value):
            return (
                "\n      An abbreviated SHA is not acceptable: abbreviations are "
                "not stable as a repository grows, and two objects can share a "
                "prefix. Record the full 40 characters."
            )
        if re.fullmatch(r"[0-9a-fA-F]{40}", value):
            return "\n      Use lowercase hex."
        return (
            "\n      This looks like a branch or tag name. Both can be moved or "
            "retagged to point at a different commit, which is exactly the "
            "failure this lock exists to prevent. Record the resolved commit."
        )
    return ""


def validate(lock: dict, schema: dict) -> list[str]:
    errors: list[str] = []
    validate_node(lock, schema, schema, "", errors)
    return errors


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------

def load_json(path: Path, what: str) -> dict:
    if not path.is_file():
        raise LockError(f"{what} not found: {path}")
    try:
        with path.open(encoding="utf-8") as handle:
            return json.load(handle)
    except json.JSONDecodeError as error:
        raise LockError(f"{what} is not valid JSON: {path}\n      {error}") from error


def load_validated(lock_path: Path, schema_path: Path) -> dict:
    lock = load_json(lock_path, "lock file")
    schema = load_json(schema_path, "lock schema")
    errors = validate(lock, schema)
    if errors:
        raise LockError(
            "lock file does not satisfy %s:\n%s"
            % (schema_path.name, "\n".join("    - " + e for e in errors))
        )
    return lock


# ---------------------------------------------------------------------------
# Accessors
# ---------------------------------------------------------------------------

def revisions(lock: dict) -> list[tuple[str, str]]:
    """(name, revision) for every locked source, in a stable order.

    Unpinned third-party entries are included, reported as unpinned, so they
    appear in every revision listing rather than being invisible.
    """
    result: list[tuple[str, str]] = []
    for name in ("chromium", "depot_tools", "ungoogled_chromium"):
        entry = lock.get(name)
        if entry:
            result.append((name, entry["commit"]))
    for name, entry in sorted(lock.get("third_party", {}).items()):
        if entry.get("pinned"):
            result.append((f"third_party.{name}", entry["commit"]))
        else:
            result.append((f"third_party.{name}", "UNPINNED"))
    return result


def get_path(lock: dict, dotted: str):
    node = lock
    for part in dotted.split("."):
        if not isinstance(node, dict) or part not in node:
            raise LockError(f"no such field in lock: {dotted}")
        node = node[part]
    return node


def check_remote(lock: dict) -> list[str]:
    """Verify each locked ref still resolves to its locked commit.

    Needs network.

    An ANNOTATED tag must be peeled before comparing. `git ls-remote` reports
    `refs/tags/X` as the tag *object* and `refs/tags/X^{}` as the commit it
    points at; a lightweight tag has no `^{}` line at all. Comparing against
    the unpeeled line reports permanent, bogus drift for every annotated tag —
    verified against ungoogled-chromium's `146.0.7680.177-1`, whose tag object
    is 87bc3cfe while the commit is ecd0ec03. A check that cries wolf on
    correct data is a check somebody disables, so this peels first.
    """
    problems: list[str] = []
    for name in ("chromium", "depot_tools", "ungoogled_chromium"):
        entry = lock.get(name)
        if not entry:
            continue
        url, commit = entry["url"], entry["commit"]
        ref = entry.get("ref")
        if not ref:
            continue
        completed = subprocess.run(
            ["git", "ls-remote", url, ref, ref + "^{}"],
            capture_output=True, text=True, timeout=120, check=False,
        )
        if completed.returncode != 0:
            problems.append(f"{name}: could not query {url}: {completed.stderr.strip()}")
            continue

        advertised: dict[str, str] = {}
        for line in completed.stdout.splitlines():
            if not line.strip():
                continue
            sha, _, refname = line.partition("\t")
            advertised[refname.strip()] = sha.strip()

        if not advertised:
            problems.append(f"{name}: {ref} does not exist at {url}")
            continue

        # Peeled value when the tag is annotated, direct value otherwise.
        resolved = advertised.get(ref + "^{}") or advertised.get(ref)
        if resolved != commit:
            problems.append(
                f"{name}: {ref} now resolves to {resolved}, but the lock records "
                f"{commit}. The ref was moved or retagged. The lock still pins the "
                f"reviewed commit, which is correct — but the mismatch is worth a "
                f"deliberate decision."
            )
    return problems


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__, file=sys.stderr)
        return 2

    mode = argv[1]
    rest = argv[2:]

    if mode in ("--get", "--get-optional"):
        if not rest:
            print(f"{mode} needs a dotted path, e.g. chromium.commit", file=sys.stderr)
            return 2
        dotted, rest = rest[0], rest[1:]
    else:
        dotted = ""

    lock_path = Path(rest[0]) if rest else DEFAULT_LOCK
    schema_path = (
        Path(rest[1]) if len(rest) > 1
        else lock_path.parent / DEFAULT_SCHEMA.name
    )

    try:
        lock = load_validated(lock_path, schema_path)

        if mode == "--validate":
            print(f"{lock_path.name}: valid against {schema_path.name}")
            for name, revision in revisions(lock):
                print(f"  {name:26} {revision}")
            return 0

        if mode == "--get":
            print(get_path(lock, dotted))
            return 0

        if mode == "--get-optional":
            # Absent is a valid answer here, so it is not an error. It is a
            # separate mode rather than a flag on --get so that a caller who
            # believes a field is required still fails when it is missing.
            try:
                print(get_path(lock, dotted))
            except LockError:
                pass
            return 0

        if mode == "--revisions":
            for name, revision in revisions(lock):
                print(f"{name}\t{revision}")
            return 0

        if mode == "--check-remote":
            problems = check_remote(lock)
            if problems:
                for problem in problems:
                    print(f"ERROR {problem}", file=sys.stderr)
                return 1
            print("every locked ref still resolves to its locked commit")
            return 0

        print(f"unknown mode: {mode}", file=sys.stderr)
        return 2

    except LockError as error:
        print(f"ERROR {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
