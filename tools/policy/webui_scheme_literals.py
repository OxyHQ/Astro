#!/usr/bin/env python3
"""No WebUIConfig may be constructed with a hard-coded scheme string.

Why this exists, measured rather than imagined.

Astro composes the internal scheme from `//astro/build/product.gni`, so
`content::kChromeUIScheme` reads "astro" in an Astro build. A config that spells
the scheme as a literal `"chrome"` instead of using the constant therefore
registers under a scheme no longer in the trusted set, and
`WebUIConfigMap::AddWebUIConfig` CHECK-fails. That is the correct behaviour --
fail closed, at startup -- but it is discovered by launching the browser, and
the crash names neither the file nor the host:

    Thread 1 "chrome" received signal SIGTRAP
    #0  content::WebUIConfigMap::AddWebUIConfig(...)
    #1  RegisterChromeWebUIConfigs()

One such config existed: `chrome/browser/ui/webui/ungoogled_first_run.h`, added
by `patches/ungoogled/extra/ungoogled-chromium/first-run-page.patch`, which
passed `"chrome"` where every one of the other 163 constructions passes the
constant. It cost a full ThinLTO link and a gdb session to name. This check
names it in under a second, before the compiler runs.

The rule is narrow on purpose: the argument must be an IDENTIFIER, not a string
literal. Forwarding parameters (`scheme`) and named constants
(`content::kChromeUIScheme`, `kAstroUIScheme`) are all fine -- what is banned is
writing the scheme's *spelling* at a construction site, because that spelling is
a build-time product decision that lives in exactly one file.

Exceptions are declared in DECLARED_EXCEPTIONS with the reason and the evidence,
never by loosening the pattern.

Usage:
    tools/policy/webui_scheme_literals.py [--root DIR]

Exit status is 0 when no undeclared literal exists, 1 otherwise.
"""

from __future__ import annotations

import argparse
import os
import re
import sys

# Directories worth scanning. Anything outside them cannot register a config
# into the browser's map.
SCAN_ROOTS = ("astro", "chrome", "components", "content", "ui", "ash")

SOURCE_SUFFIXES = (".cc", ".h", ".mm")

# A construction site: `: DefaultWebUIConfig<Foo>("chrome", ...` or
# `: WebUIConfig("chrome", ...`, with or without a `content::` qualifier.
CONSTRUCTION = re.compile(
    r":\s*(?:content::)?(?:Default)?WebUIConfig(?:<[^>]*>)?\(\s*(?P<arg>[^,\s][^,]*?)\s*,"
)

# Declared exceptions: path -> reason. Each entry must say why the literal is
# harmless AND how that was established, so a future reader can re-check it
# rather than trust it.
DECLARED_EXCEPTIONS = {
    "chrome/browser/ui/webui/ash/cros_components/cros_components_browsertest.cc": (
        "ChromeOS-only test fixture. Its target "
        "chrome/browser/ui/webui/ash/cros_components/BUILD.gn is guarded by "
        "assert(is_chromeos) and is testonly=true, so it is built in no Astro "
        "configuration and its config is never added to a shipping browser's "
        "map. Re-check with: gn refs out/<dir> "
        "chrome/browser/ui/webui/ash/cros_components/cros_components_browsertest.cc"
    ),
}

# A traversal that stops matching would report zero violations, which is the
# same output as success. Every tree this runs against has far more than this;
# the real count at the time of writing was 164.
MINIMUM_CONSTRUCTIONS = 50


def scan(root: str) -> tuple[list[tuple[str, int, str]], int]:
    """Return (violations, total constructions seen)."""
    violations: list[tuple[str, int, str]] = []
    total = 0
    for scan_root in SCAN_ROOTS:
        base = os.path.join(root, scan_root)
        if not os.path.isdir(base):
            continue
        for directory, _subdirs, files in os.walk(base):
            for name in files:
                if not name.endswith(SOURCE_SUFFIXES):
                    continue
                path = os.path.join(directory, name)
                relative = os.path.relpath(path, root)
                try:
                    with open(path, "r", encoding="utf-8", errors="replace") as handle:
                        lines = handle.readlines()
                except OSError:
                    continue
                for number, line in enumerate(lines, start=1):
                    match = CONSTRUCTION.search(line)
                    if not match:
                        continue
                    total += 1
                    argument = match.group("arg")
                    if not argument.startswith('"'):
                        continue
                    if relative in DECLARED_EXCEPTIONS:
                        continue
                    violations.append((relative, number, line.strip()))
    return violations, total


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        default="chromium/src",
        help="Chromium source root to scan (default: chromium/src)",
    )
    # An exception naming a file that is not there is a real defect against the
    # Chromium tree -- it silently covers whatever takes that path next -- and
    # meaningless against a fixture, which is not expected to contain it. So the
    # check is ON by default, where the default root is the real tree, and is
    # turned off explicitly rather than by weakening it to "warn".
    parser.add_argument(
        "--no-check-exceptions",
        action="store_true",
        help="Do not require each declared exception's file to exist. Only for "
        "scanning a fixture tree that is not expected to contain them.",
    )
    args = parser.parse_args(argv[1:])

    if not os.path.isdir(args.root):
        print(f"ERROR no such source root: {args.root}", file=sys.stderr)
        return 1

    violations, total = scan(args.root)

    # The vacuity floor. Without it, a renamed directory or a pattern that
    # stopped matching passes silently, and a check whose pass and whose
    # nothing-was-measured look identical is worse than no check.
    if total < MINIMUM_CONSTRUCTIONS:
        print(
            f"ERROR only {total} WebUIConfig construction(s) found under "
            f"{args.root}; expected at least {MINIMUM_CONSTRUCTIONS}.\n"
            f"      Nothing meaningful was scanned. This is a failure of the "
            f"check, not a clean tree.",
            file=sys.stderr,
        )
        return 1

    for path, reason in sorted(DECLARED_EXCEPTIONS.items()):
        if args.no_check_exceptions:
            break
        full = os.path.join(args.root, path)
        if not os.path.isfile(full):
            print(
                f"ERROR declared exception no longer exists: {path}\n"
                f"      Remove it from DECLARED_EXCEPTIONS. A stale exception "
                f"silently covers whatever takes that path next.",
                file=sys.stderr,
            )
            return 1
        del reason

    if violations:
        print(
            f"ERROR {len(violations)} WebUIConfig(s) constructed with a "
            f"hard-coded scheme string:",
            file=sys.stderr,
        )
        for path, number, text in violations:
            print(f"  {path}:{number}", file=sys.stderr)
            print(f"      {text}", file=sys.stderr)
        print(
            "\n      Astro composes the internal scheme from "
            "//astro/build/product.gni, so a literal spelling registers the "
            "config under a scheme that is not in the trusted set and "
            "WebUIConfigMap::AddWebUIConfig CHECK-fails at browser startup.\n"
            "      Use content::kChromeUIScheme / "
            "content::kChromeUIUntrustedScheme instead. If the file is "
            "genuinely never built, declare it in DECLARED_EXCEPTIONS with the "
            "evidence.",
            file=sys.stderr,
        )
        return 1

    print(
        f"OK {total} WebUIConfig construction(s) scanned; every scheme argument "
        f"is a named constant "
        f"({len(DECLARED_EXCEPTIONS)} declared exception(s))."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
