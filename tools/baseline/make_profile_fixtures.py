#!/usr/bin/env python3
"""Generate the synthetic profile fixtures for the Astro Next baseline (#6).

Astro Next will move profile data across an architecture change. The only way
to tell a migration that worked from one that quietly dropped a value is to
have a profile whose contents are known exactly beforehand — which is what
these fixtures are.

The fixtures are split by PROVENANCE, and the split is the point of this tool:

  generated
      State whose shape Astro itself owns: the Oxy/Astro preference keys, the
      adblock preferences and filter-list layout, the token-store layout, the
      internal-URL corpus. Every one of these is derived by PARSING the code or
      the patch that defines it, never by hand: a fixture that is hand-written
      is wrong the first time a pref is renamed, and nothing tells you.

  requires-browser-capture
      State whose shape CHROMIUM owns: `History`, `Login Data` and `Web Data`
      are SQLite databases, `Sessions/` is a serialised command stream and
      `Secure Preferences` carries a MAC keyed on machine state. Their schemas
      are Chromium's, they change between milestones, and none of them is
      documented as a stable format. A hand-built one of those files LOOKS like
      a fixture, loads in nothing, and makes a migration test pass without ever
      exercising a migration — strictly worse than having no fixture at all. So
      those entries are DEFERRED: the manifest records what must be captured,
      why it cannot be synthesised, and the exact command that produces it once
      a build exists.

`--verify` enforces both halves. A generated fixture must byte-match what this
tool produces right now, so it cannot drift from the code it was derived from.
A deferred fixture that has appeared on disk must be accompanied by capture
metadata, so somebody quietly hand-filling a `History` file to make a test go
green fails instead.

No value here is or resembles a credential. Every string is a literal test
constant, and `tools/tests/cases/baseline-fixtures-have-no-secrets.sh` scans the
output to keep it that way.

Regeneration is byte-stable: no timestamps, no randomness, no `now()`. The
byte-stability is itself tested, and it is what makes "regenerate and diff" a
usable review tool.

The fixtures are committed, so every source they are derived from is read from
`HEAD` through `committed_state` — never from the working tree. A fixture set
derived from somebody's uncommitted edits describes a browser that does not
exist in the repository, and `--verify` would then fail for everyone else with a
diff naming preferences they have never seen. Uncommitted edits to those sources
are reported separately, as working-tree observations.

Usage:
    make_profile_fixtures.py                 Write fixtures to the default dir.
    make_profile_fixtures.py --output DIR    Write them somewhere else.
    make_profile_fixtures.py --verify        Check them; write nothing.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import committed_state

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT = REPO_ROOT / "test" / "astro-next" / "fixtures"

# Sources every generated value is derived from, as repository-relative paths:
# they are addressed in git, not on disk. Every parse over them is held to the
# structural invariant below rather than to a minimum count.
PREF_PATCHES = (
    "patches/astro/020-register-oxy-prefs.patch",
    "patches/astro/046-adblock-prefs.patch",
)
WEBUI_DIR = "src/chrome/browser/oxy/webui"
FILTER_CATALOG = "src/chrome/browser/oxy/adblock/astro_adblock_filter_list_catalog.cc"
ADBLOCK_SERVICE = "src/chrome/browser/oxy/adblock/astro_adblock_service.cc"
ADBLOCK_UPDATER = "src/chrome/browser/oxy/adblock/astro_adblock_filter_list_updater.cc"
TOKEN_STORE = "src/chrome/browser/oxy/oxy_auth_token_store.cc"
LOCK_FILE = "browser.lock.json"

# The judgement half of the preference registry: which preferences belong to the
# reproducible baseline and which are candidate future work observed only in a
# working tree. Names are parsed, dispositions are declared, and the join
# between them is strict in both directions — see the file's own header.
PREF_DISPOSITIONS = "docs/astro-next/baseline/pref-dispositions.json"
VALID_PREF_STATUSES = ("legacy-baseline", "observed-local-only")

# Everything above, for the working-tree difference report.
DERIVED_FROM = (
    *PREF_PATCHES,
    PREF_DISPOSITIONS,
    WEBUI_DIR,
    FILTER_CATALOG,
    ADBLOCK_SERVICE,
    ADBLOCK_UPDATER,
    TOKEN_STORE,
    LOCK_FILE,
)

# Chromium's own NTP host. `chrome://astro-ntp` is the page that actually
# exists; patch 056 teaches search.cc to treat it as an NTP so the omnibox
# shows `chrome://newtab`, which patch 011's scheme alias displays as
# `astro://newtab`. Both spellings therefore reach stored profile data, and a
# URL migration has to handle both.
NTP_ALIAS_HOST = "newtab"

# Fixed points on Chromium's WebKit timeline (microseconds since 1601-01-01).
# Literal constants rather than the clock: regeneration has to be byte-stable
# or "regenerate and diff" cannot tell a real change from time passing.
T_CREATED = "13350096000000000"
T_MODIFIED = "13350182400000000"
T_USED = "13350268800000000"

PROFILES = ("Default", "Profile 1")

CAPTURE_SUFFIX = ".capture.json"
# `astro_revision` is deliberately the SHORT git revision. A full 40-character
# SHA is indistinguishable from a leaked key to any secret scanner, including
# the one that gates this directory, so the contract asks for the short form
# rather than leaving a future capture to trip a check it cannot interpret.
CAPTURE_FIELDS = ("captured_at", "captured_from", "capture_command", "astro_revision")

CAPTURE_DIR = "$ASTRO_CAPTURE_DIR"
CHROME_BINARY = "chromium/src/out/Release/chrome"
FIXTURE_DIR_REL = str(DEFAULT_OUTPUT.relative_to(REPO_ROOT))


# ---------------------------------------------------------------------------
# Parsing the sources
# ---------------------------------------------------------------------------

# STRICT parsers. Each one turns a declaration into structured data, and each
# narrows what it accepts: a name character class, a required receiver, a
# required qualifier. That narrowing is deliberate and is what makes the parsed
# values trustworthy — it is also exactly what makes a parser able to LOSE a
# declaration without saying so.
PREF_RE = re.compile(
    r'registry->Register(?P<kind>[A-Za-z0-9]+)Pref\(\s*"(?P<name>[A-Za-z0-9_.]+)"'
    r"(?:\s*,\s*(?P<default>.*?))?\s*\)\s*;",
    re.DOTALL,
)
HOST_RE = re.compile(r'inline constexpr char kAstro(\w+)Host\[\]\s*=\s*"([^"]+)"\s*;')

# A page Astro serves on a host UPSTREAM owns declares `.host =
# chrome::kChromeUI<Name>Host` instead of defining a constant of its own, and
# the value of that constant lives in the Chromium tree, which this generator
# deliberately cannot read. Settings and What's New are both in that position.
#
# They are recorded by CONSTANT rather than dropped. Dropping them is what
# happened when What's New moved onto upstream's host: two rows left the corpus,
# `astro://whats-new/` among them, and nothing said so -- a URL that can sit in a
# bookmark written by an older build simply stopped being covered. A corpus that
# shrinks silently is the failure mode this whole fixture set exists to prevent.
TAKEOVER_HOST_RE = re.compile(r"\.host\s*=\s*chrome::kChromeUI(\w+)Host\s*,")
CATALOG_RE = re.compile(
    r'\.id = "(?P<id>[^"]+)".*?\.default_enabled = (?P<enabled>true|false)', re.DOTALL
)

# LOOSE recognisers, one per strict parser above, deliberately written by a
# different rule: find where a declaration BEGINS and nothing else. No receiver
# name, no qualifier, no character class on the value, no closing punctuation.
#
# The asymmetry is the entire point and is why the invariant below is not
# vacuous. If "how many declarations are there" and "how many did we parse" both
# came from PREF_RE they would agree by construction, and the check would be an
# expensive way of writing `True`. Because these accept a strict superset, a
# declaration the strict parser cannot handle — a receiver not spelled
# `registry->`, a name held in a constant rather than a string literal, a
# character the strict name class excludes, a field the DOTALL parser swallowed
# along with the entry after it — shows up as a discrepancy that NAMES the
# offending line instead of silently shrinking the fixture.
#
# Keep them loose. Narrowing one to match its strict partner more closely
# quietly disables the check it exists to perform.
PREF_CALL_SITE_RE = re.compile(r"Register\w*Pref\s*\(")
HOST_SITE_RE = re.compile(r"kAstro\w*Host\s*\[\s*\]")
CATALOG_SITE_RE = re.compile(r'\.id\s*=\s*"')

# A registration that DELEGATES (`oxy::RegisterOxyPrefs(registry);`) hides an
# unbounded number of preferences behind one call, so the set stops being
# enumerable from the patch text at all — and the invariant below would report
# three agreeing counts while the fixture silently lost every pref behind it.
# There are none today; this exists so the day one appears it is a loud failure
# rather than a smaller fixture nobody notices.
PREF_DELEGATION_RE = re.compile(r"\w+::Register\w*Prefs\s*\(")


# ---------------------------------------------------------------------------
# The structural invariant
# ---------------------------------------------------------------------------
#
# What replaced four minimum-count thresholds, and why.
#
# A floor ("at least 15 preferences") answers a question nobody asked. How many
# preferences Astro registers is a product decision that moves in both
# directions; 10 is not more or less correct than 18 or 40. So the floor could
# only ever be wrong in one of two ways: too low to catch a broken parse, or —
# the way it actually failed here — high enough to fail on a legitimate number,
# at which point the only available repairs are to edit the threshold (turning a
# signal into a silence) or to commit somebody's uncommitted work to reach it.
#
# What must hold regardless of the number is that the parse LOSES NOTHING. That
# is a structural property, and it is stated as an identity between three counts,
# each arrived at by a different route:
#
#   detected      declaration sites found by the LOOSE recogniser
#   parsed        declarations the STRICT parser turned into structured data
#   represented   items that actually reached the generated fixtures
#
# All three must agree. Each pairing catches a different failure:
#
#   detected != parsed        the strict parser cannot handle a declaration that
#                             is really there — a reformat, a renamed receiver, a
#                             name that moved into a constant, a DOTALL match
#                             that swallowed the entry after it.
#   parsed != represented     the parse worked and the value fell out anyway — a
#                             nested-path collision, a duplicate key, a synthesis
#                             branch that skipped it.
#
# and the three-way agreement is what a bare count cannot give: a fixture with
# ten preferences in it is correct if the repository declares ten, and broken if
# it declares eighteen. Only the comparison knows which.
#
# The counts are recorded in the manifest, so the numbers move visibly in a
# diff rather than living in a threshold somebody has to maintain.


def line_at(text: str, offset: int) -> tuple[int, str]:
    """The 1-based line number containing `offset`, and that line's text.

    A discrepancy is only actionable if it names the line, so this exists to
    make every failure below quote the source rather than print an arithmetic
    complaint about two integers.
    """
    number = text.count("\n", 0, offset) + 1
    start = text.rfind("\n", 0, offset) + 1
    end = text.find("\n", offset)
    return number, text[start:] if end < 0 else text[start:end]


def assert_parse_is_lossless(
    what: str,
    source: str,
    text: str,
    loose: re.Pattern,
    strict: list[re.Match],
) -> int:
    """Pair every loose declaration site with the strict match covering it.

    Returns the DETECTED count. Raises if the pairing is not a bijection, which
    is the same thing as saying `detected == parsed` — stated as a pairing
    rather than as a comparison of two integers so the failure can name lines.

    Three ways it breaks, all reported, because they have different causes:

      unparsed   a loose site inside no strict match. The strict parser is
                 losing a declaration that is right there in the text.
      merged     one strict match covering several loose sites. This is the
                 DOTALL failure specifically: `.id = "a" .*? .default_enabled`
                 with `a`'s field missing runs on into the NEXT entry, reporting
                 one entry where there are two and silently adopting the wrong
                 value. It cannot be seen by counting alone.
      uncovered  a strict match containing no loose site. That means the loose
                 recogniser is NOT a superset of the strict one, so agreement
                 between the two counts would prove nothing — a vacuity guard on
                 the check itself.
    """
    spans = [(match.start(), match.end()) for match in strict]
    sites = [match.start() for match in loose.finditer(text)]

    unparsed = [
        line_at(text, site)
        for site in sites
        if not any(start <= site < end for start, end in spans)
    ]
    merged = [
        line_at(text, start)
        for start, end in spans
        if sum(1 for site in sites if start <= site < end) > 1
    ]
    uncovered = [
        line_at(text, start)
        for start, end in spans
        if not any(start <= site < end for site in sites)
    ]

    if unparsed or merged or uncovered:
        report = [
            f"ERROR the {what} parse is losing declarations in {source}.",
            "",
            f"      declaration sites detected (loose scan): {len(sites)}",
            f"      declarations parsed (strict parse):      {len(strict)}",
            "",
            "      The two are measured by deliberately different rules so that they",
            "      CAN disagree. They disagree here, which means the strict parser no",
            "      longer matches what the source actually declares. Fix the parser",
            "      rather than the source, and never by loosening the check.",
        ]
        for label, hint, group in (
            (
                "not parsed",
                "declared here, and the strict parser did not produce a value for it",
                unparsed,
            ),
            (
                "swallowed the following declaration",
                "one strict match spans two or more declarations; a field the parser "
                "requires is missing, so it ran on into the next one",
                merged,
            ),
            (
                "parsed but not detected",
                "the loose recogniser did not see this, so it is not a superset of "
                "the strict parser and comparing their counts proves nothing",
                uncovered,
            ),
        ):
            if not group:
                continue
            report += ["", f"      {label} ({len(group)}) — {hint}:", ""]
            report += [f"        {source}:{number}: {line.strip()}" for number, line in group]
        raise SystemExit("\n".join(report))

    # Arithmetic restatement of the bijection just proved. Cheap, and it makes
    # "the three counts agree" literally true of three integers rather than a
    # property the reader has to reconstruct from the pairing above.
    if len(sites) != len(strict):
        raise SystemExit(
            f"ERROR {what} in {source}: {len(sites)} declaration site(s) detected but "
            f"{len(strict)} parsed, with every site paired. The pairing above and this "
            f"count disagree, which is a bug in this tool, not in the source."
        )
    return len(sites)


def assert_represented(what: str, parsed: int, represented: int, detail: str) -> None:
    """The third count: what actually reached the generated fixtures.

    Separate from the pairing above because it catches the opposite failure. The
    parse can be perfect and the value can still fall out on the way to disk —
    a dotted path colliding with a parent, two declarations normalising to one
    key, a synthesis branch that returned early. Nothing upstream can see that;
    only counting the output can.
    """
    if parsed != represented:
        raise SystemExit(
            f"ERROR {parsed} {what} were parsed but {represented} reached the "
            f"generated fixtures.\n"
            f"      {detail}\n"
            f"      A fixture missing an item a migration is supposed to carry across\n"
            f"      makes the migration test pass without exercising it."
        )


def read_text(path: str) -> str:
    """The COMMITTED text of a source file. The working tree is never consulted."""
    if not committed_state.exists(path):
        raise SystemExit(
            f"ERROR source file not found at {committed_state.REVISION}: {path}\n"
            f"      These fixtures are committed, so they are derived from committed\n"
            f"      sources only. If the file is new, commit it first."
        )
    return committed_state.read_text(path)


def added_lines(patch_text: str) -> str:
    """The patch's ADDED lines, with the diff marker removed.

    Reading the whole patch would also pick up Chromium's own registrations
    sitting in the context, and reading it line-by-line would miss a
    registration wrapped across two lines by clang-format. Reconstructing the
    added text and matching over that handles both.
    """
    return "\n".join(
        line[1:]
        for line in patch_text.splitlines()
        if line.startswith("+") and not line.startswith("+++")
    )


def parse_default(raw: str | None) -> object:
    """The registered default, when the registration states one literally."""
    if raw is None:
        return None
    raw = raw.strip()
    if raw in ("true", "false"):
        return raw == "true"
    if re.fullmatch(r"-?\d+", raw):
        return int(raw)
    literal = re.fullmatch(r'"([^"]*)"', raw)
    if literal:
        return literal.group(1)
    # A computed default (a constant, an expression). The kind is still known,
    # which is all the value synthesis below actually needs.
    return None


def parse_registered_prefs() -> tuple[list[dict], int]:
    """Every Astro-owned preference, read out of the patches that register it.

    Returns the preferences and the DETECTED declaration-site count, which the
    caller compares against what reaches the fixtures.

    The names are not hardcoded on purpose. A hardcoded list is a second copy
    of the pref registry that nothing keeps in sync, and the first rename makes
    the fixture describe a browser that no longer exists.
    """
    prefs: dict[str, dict] = {}
    detected = 0
    for source in PREF_PATCHES:
        text = added_lines(read_text(source))

        delegations = [
            line_at(text, match.start()) for match in PREF_DELEGATION_RE.finditer(text)
        ]
        if delegations:
            raise SystemExit(
                f"ERROR {source} registers preferences through a delegating call.\n"
                f"      One call registers an unknown number of preferences, so the set\n"
                f"      is no longer enumerable from the patch text and the fixture would\n"
                f"      silently lose every preference behind it — with the counts below\n"
                f"      still agreeing. Teach this tool to follow the delegation.\n"
                + "\n".join(f"        {source}:{n}: {line.strip()}" for n, line in delegations)
            )

        strict = list(PREF_RE.finditer(text))
        if not strict:
            raise SystemExit(
                f"ERROR no preference registrations parsed from {source}.\n"
                f"      The registration idiom this tool matches "
                f"(registry->Register<Kind>Pref(\"name\", …)) is gone or changed."
            )
        detected += assert_parse_is_lossless(
            "preference registration", source, text, PREF_CALL_SITE_RE, strict
        )

        for match in strict:
            name = match.group("name")
            if name in prefs:
                raise SystemExit(
                    f"ERROR preference {name!r} is registered twice "
                    f"({prefs[name]['source']} and {source})"
                )
            prefs[name] = {
                "name": name,
                "kind": match.group("kind"),
                "default": parse_default(match.group("default")),
                "source": source,
            }

    return [prefs[name] for name in sorted(prefs)], detected


def load_pref_dispositions(raw: str, committed_names: set[str]) -> dict[str, dict]:
    """Join the declared dispositions against the committed registry, both ways.

    The names come from the patches; the judgement comes from the disposition
    file. The join is what keeps the two from drifting apart, and it fails in
    both directions for the same reason `patch-dispositions.json`'s does.

    The direction that matters most is the last one. Every `observed-local-only`
    entry is an assertion that the committed stack does NOT register that
    preference. The day the local preference work lands, all of them become
    false at once — and this fails naming each, so the file has to be brought up
    to date rather than quietly becoming untrue.

    The document text is passed in rather than read here, so a test can exercise
    the join against a constructed one without this tool growing a "read that
    file instead of the committed one" switch — the same escape hatch that let
    the working tree into the baseline in the first place.
    """
    document = json.loads(raw)
    declared = document.get("prefs")
    if not isinstance(declared, dict) or not declared:
        raise SystemExit(
            f"ERROR {PREF_DISPOSITIONS} has no 'prefs' object, so no preference has a "
            f"declared disposition and the join below would pass vacuously"
        )

    problems: list[str] = []
    for name, entry in sorted(declared.items()):
        status = entry.get("status")
        if status not in VALID_PREF_STATUSES:
            problems.append(
                f"{name}: status {status!r} is not one of {', '.join(VALID_PREF_STATUSES)}"
            )
            continue
        if not str(entry.get("purpose", "")).strip():
            problems.append(f"{name}: no purpose recorded")
        if status == "legacy-baseline" and name not in committed_names:
            problems.append(
                f"{name}: declared legacy-baseline, but the committed patches do not "
                f"register it. Either it was removed — reclassify or delete the entry — "
                f"or the parse above is broken."
            )
        if status == "observed-local-only":
            if name in committed_names:
                problems.append(
                    f"{name}: declared observed-local-only, but the committed patches "
                    f"DO register it now. The work has landed: reclassify it as "
                    f"legacy-baseline so the fixtures start carrying it."
                )
            if not isinstance(entry.get("owner_issue"), int):
                problems.append(
                    f"{name}: observed-local-only with no owner_issue, so nothing "
                    f"records who decides whether it ships"
                )
            observed_in = entry.get("observed_in")
            if observed_in not in PREF_PATCHES:
                problems.append(
                    f"{name}: observed_in is {observed_in!r}, which is not one of the "
                    f"patches this tool reads ({', '.join(PREF_PATCHES)})"
                )

    for name in sorted(committed_names - set(declared)):
        problems.append(
            f"{name}: registered by the committed patches with no entry in "
            f"{PREF_DISPOSITIONS}. Every Astro-owned preference carries a disposition; "
            f"add one rather than letting it into the fixtures undeclared."
        )

    if problems:
        raise SystemExit(
            f"ERROR the preference dispositions do not join against the committed "
            f"registry:\n" + "\n".join(f"      - {problem}" for problem in problems)
        )
    return declared


def local_only_prefs(declared: dict[str, dict]) -> list[dict]:
    """The declared candidate preferences, sorted, for the generated documents.

    Rendered from the COMMITTED disposition file, never from the working tree.
    A document that listed whatever preferences happen to be uncommitted on this
    machine would regenerate differently on every checkout, which is the exact
    failure `committed_state` exists to prevent.
    """
    return [
        {
            "name": name,
            # One issue owns the decision; `also_owned_by` names any other issue
            # whose scope the preference falls inside, because "which issue do I
            # raise this on" is the question a reader actually has.
            "decided_by": [entry["owner_issue"], *entry.get("also_owned_by", [])],
            "observed_in": entry["observed_in"],
            "purpose": entry["purpose"],
        }
        for name, entry in sorted(declared.items())
        if entry["status"] == "observed-local-only"
    ]


def report_undeclared_worktree_prefs(committed_names: set[str], declared: dict[str, dict]) -> None:
    """Preferences this working tree registers that are neither committed nor declared.

    A working-tree observation, printed to stderr and reaching no committed
    artefact — the same terms as every other working-tree read in this tool. Not
    fatal: uncommitted work in progress is legitimate, and a generator that
    refused to run while somebody was editing a patch would just get bypassed.
    Silent on a clean checkout, where there is nothing to report.
    """
    undeclared: list[tuple[str, str]] = []
    for source in PREF_PATCHES:
        for name in worktree_pref_names(source):
            if name not in committed_names and name not in declared:
                undeclared.append((name, source))
    if not undeclared:
        return
    print(
        f"WORKING-TREE PREFERENCES not in {committed_state.REVISION} and not declared in\n"
        f"          {PREF_DISPOSITIONS} ({len(undeclared)}). They are NOT in the fixtures,\n"
        f"          and a clean checkout does not have them. Declare them as\n"
        f"          observed-local-only if they are candidate work worth recording:",
        file=sys.stderr,
    )
    for name, source in undeclared:
        print(f"            {name}  ({source})", file=sys.stderr)


def worktree_pref_names(source: str) -> list[str]:
    """The preference names a patch registers ON DISK.

    The only working-tree read in this tool. It exists to explain a failure and
    never to produce a fixture — no value it returns reaches a generated file.
    """
    path = REPO_ROOT / source
    if not path.is_file():
        return []
    names: list[str] = []
    for match in PREF_RE.finditer(added_lines(path.read_text(encoding="utf-8"))):
        if match.group("name") not in names:
            names.append(match.group("name"))
    return names


def parse_webui_hosts() -> tuple[list[dict], int]:
    """The internal hosts, read from the WebUI controllers that define them."""
    hosts: list[dict] = []
    detected = 0
    for header in committed_state.list_files(WEBUI_DIR, (".h",)):
        text = committed_state.read_text(header)
        detected += assert_parse_is_lossless(
            "WebUI host constant", header, text, HOST_SITE_RE, list(HOST_RE.finditer(text))
        )
        for symbol, host in HOST_RE.findall(text):
            hosts.append(
                {
                    "host": host,
                    "constant": f"kAstro{symbol}Host",
                    "defined_in": header,
                }
            )
    return sorted(hosts, key=lambda entry: entry["host"]), detected


def parse_takeover_hosts() -> list[dict]:
    """Pages served on a host upstream owns, by the constant that names it.

    No literal, because there is no honest way to produce one from this
    repository alone. `not-derivable` says which command answers it, in the same
    shape every other unmeasured field in the baseline uses.
    """
    takeovers: list[dict] = []
    for source in committed_state.list_files(WEBUI_DIR, (".cc",)):
        text = committed_state.read_text(source)
        for symbol in TAKEOVER_HOST_RE.findall(text):
            takeovers.append(
                {
                    "constant": f"chrome::kChromeUI{symbol}Host",
                    "declared_in": source,
                    "host": "not-derivable",
                    "resolve_with": (
                        "grep -n 'kChromeUI%sHost' chromium/src/chrome/common/"
                        "webui_url_constants.h" % symbol
                    ),
                }
            )
    return sorted(takeovers, key=lambda entry: entry["constant"])


def parse_filter_catalog() -> tuple[list[dict], int]:
    text = read_text(FILTER_CATALOG)
    # The highest-value of the four pairings. CATALOG_RE is DOTALL, so an entry
    # missing `.default_enabled` does not fail to match — the `.*?` runs on into
    # the NEXT entry, reporting one list where there are two and adopting the
    # wrong enabled flag. That is invisible to any count taken from CATALOG_RE
    # alone; pairing against `.id = "` sites reports it as a merge and names it.
    detected = assert_parse_is_lossless(
        "filter list entry",
        FILTER_CATALOG,
        text,
        CATALOG_SITE_RE,
        list(CATALOG_RE.finditer(text)),
    )
    lists = [
        {"id": match.group("id"), "default_enabled": match.group("enabled") == "true"}
        for match in CATALOG_RE.finditer(text)
    ]
    return lists, detected


def parse_adblock_layout() -> dict:
    text = read_text(ADBLOCK_SERVICE)
    names = dict(re.findall(r'constexpr char (k\w+)\[\] = "([^"]+)"\s*;', text))
    updater = read_text(ADBLOCK_UPDATER)
    names.update(re.findall(r'constexpr char (k\w+)\[\] = "([^"]+)"\s*;', updater))
    for required in ("kAdBlockDataDir", "kEngineCacheFileName", "kFilterListsSubdir"):
        if required not in names:
            raise SystemExit(
                f"ERROR {required} not found in the adblock sources; the on-disk "
                f"layout this fixture mirrors cannot be derived"
            )
    return {
        "data_dir": names["kAdBlockDataDir"],
        "engine_cache": names["kEngineCacheFileName"],
        "filter_lists_subdir": names["kFilterListsSubdir"],
    }


def parse_token_store() -> dict:
    """The token store's real on-disk layout, read from the store itself."""
    text = read_text(TOKEN_STORE)
    files = dict(re.findall(r'constexpr char k(\w+)TokenFile\[\] = "([^"]+)"\s*;', text))
    directory = re.search(r'user_data_dir\.AppendASCII\("([^"]+)"\)', text)
    if not files or not directory:
        raise SystemExit(
            f"ERROR could not read the token-store layout from {Path(TOKEN_STORE).name}; "
            f"the fixture would describe a layout that no longer exists"
        )
    # The description this fixture ships says the real files hold OSCrypt
    # ciphertext. If the store stops encrypting, that description becomes a
    # false statement about the browser's security posture, so it is checked.
    if "OSCrypt::EncryptString" not in text:
        raise SystemExit(
            f"ERROR {Path(TOKEN_STORE).name} no longer calls OSCrypt::EncryptString, so the "
            f"token-store fixture's description of the on-disk format is wrong"
        )
    return {
        "directory": directory.group(1),
        "files": {kind.lower(): name for kind, name in sorted(files.items())},
    }


def chromium_version() -> str:
    """The baseline Chromium version, from the lock.

    Only the version is copied. The commit SHAs stay in `browser.lock.json`,
    which is their single source of truth — a second copy is a second thing to
    keep in sync, and a 40-character hex blob committed into a fixture tree is
    indistinguishable from a leaked key to a secret scanner.
    """
    return json.loads(read_text(LOCK_FILE))["chromium"]["version"]


# ---------------------------------------------------------------------------
# Synthetic values
# ---------------------------------------------------------------------------

# Values chosen so a lazy migration cannot pass. Every string is an obvious
# test constant: no base64, no JWT, no hex blob, nothing that could be mistaken
# for a real credential in a repository or in a scanner's output.
SYNTHETIC_STRINGS = {
    "oxy.access_token": "astro-fixture-access-token-not-a-real-credential",
    "oxy.refresh_token": "astro-fixture-refresh-token-not-a-real-credential",
    "oxy.session_id": "astro-fixture-session-0001",
    "oxy.token_expiry": "2099-01-01T00:00:00Z",
    "oxy.user_id": "astro-fixture-user-0001",
    "oxy.username": "astro-fixture-user",
    "oxy.user_avatar": "astro-fixture-avatar-file-id",
    "oxy.adblock.custom_rules": (
        "! Astro fixture rules - synthetic, not a real filter list.\n"
        "||ads.example.com^\n"
        "example.org##.ad-slot\n"
    ),
}

# Only `false` entries: SetSiteEnabled() REMOVES the key when a site is
# re-enabled rather than storing `true`, so a fixture containing `true` would
# be a shape the browser never writes.
SYNTHETIC_SITE_OVERRIDES = {
    "Default": {"example.com": False, "shop.example.net": False},
    "Profile 1": {"news.example.org": False},
}

SYNTHETIC_INTEGERS = {"Default": 24917, "Profile 1": 3}


def synthetic_value(pref: dict, profile: str) -> object:
    """A value for one preference in one profile.

    `Default` moves EVERY preference off its registered default, so a migration
    that silently re-registers defaults instead of carrying values across fails
    on the very first key. `Profile 1` sits at its defaults and is signed out,
    so a migration that copies one profile's state into all of them fails too.
    Neither profile alone catches both mistakes.
    """
    kind = pref["kind"]
    name = pref["name"]
    is_default_profile = profile == "Default"

    if kind == "Boolean":
        registered = pref["default"]
        if not isinstance(registered, bool):
            raise SystemExit(
                f"ERROR boolean pref {name!r} has no literal registered default; "
                f"the fixture cannot state a value that differs from it"
            )
        return (not registered) if is_default_profile else registered

    if kind == "Integer":
        return SYNTHETIC_INTEGERS[profile]

    if kind == "String":
        if not is_default_profile and name.startswith("oxy.") and "adblock" not in name:
            # Second profile is signed out; the identity prefs are empty, which
            # is exactly the state a migration must not overwrite with the
            # first profile's session.
            return ""
        return SYNTHETIC_STRINGS.get(
            name, "astro-fixture-" + name.replace(".", "-").replace("_", "-")
        )

    if kind == "Dictionary":
        return dict(SYNTHETIC_SITE_OVERRIDES[profile]) if "site_overrides" in name else {}

    if kind == "List":
        return []

    if kind == "Double":
        return 0.5 if is_default_profile else 1.0

    # Not a warning and not a skip: an unsynthesised pref is a hole in the
    # fixture that no test can see.
    raise SystemExit(
        f"ERROR preference {name!r} has kind {kind!r}, which this generator does not "
        f"know how to synthesise. Add it to synthetic_value() rather than letting the "
        f"pref fall out of the fixture."
    )


def has_nested(root: dict, path: str) -> bool:
    """Whether `a.b.c` resolves in the document, the way PrefService addresses it.

    Used to count what actually REACHED a fixture. A flat `{"oxy.adblock.enabled":
    true}` key would satisfy a naive `path in document` test and be invisible to
    the browser, so the lookup walks the same nesting `set_nested` writes.
    """
    node: object = root
    for part in path.split("."):
        if not isinstance(node, dict) or part not in node:
            return False
        node = node[part]
    return True


def set_nested(root: dict, path: str, value: object) -> None:
    """Store `a.b.c` as nested dictionaries, the way PrefService serialises it.

    A flat `{"oxy.adblock.enabled": true}` key reads perfectly to a human and
    is invisible to the browser, which is the exact failure mode these fixtures
    exist to rule out.
    """
    node = root
    parts = path.split(".")
    for part in parts[:-1]:
        node = node.setdefault(part, {})
        if not isinstance(node, dict):
            raise SystemExit(f"ERROR pref path {path!r} collides with a non-dict value")
    node[parts[-1]] = value


# ---------------------------------------------------------------------------
# The generated documents
# ---------------------------------------------------------------------------


def internal_urls(hosts: list[dict]) -> list[dict]:
    """Every spelling of an internal URL that can reach stored profile data.

    The scheme alias (patch 011) is a plain scheme swap, so each host is
    reachable as both `chrome://host` and `astro://host`, and the NTP is also
    reachable through Chromium's own `newtab` host. All of them can be sitting
    in a bookmark, a startup URL or a history row written by an older build.

    What a migration should REWRITE each of these to is a product decision this
    issue explicitly does not make. The corpus records the shapes that exist;
    the expectation belongs to the migration's own tests.
    """
    entries = []
    for host in [entry["host"] for entry in hosts] + [NTP_ALIAS_HOST]:
        for scheme in ("chrome", "astro"):
            entries.append(
                {
                    "url": f"{scheme}://{host}/",
                    "scheme": scheme,
                    "host": host,
                    "style": "legacy-chrome-scheme" if scheme == "chrome" else "astro-scheme",
                }
            )
    return sorted(entries, key=lambda entry: entry["url"])


def collect_urls(document: object, found: set[str]) -> None:
    if isinstance(document, dict):
        for value in document.values():
            collect_urls(value, found)
    elif isinstance(document, list):
        for value in document:
            collect_urls(value, found)
    elif isinstance(document, str) and "://" in document:
        found.add(document)


def build_preferences(profile: str, prefs: list[dict], version: str) -> dict:
    document: dict = {}
    for pref in prefs:
        set_nested(document, pref["name"], synthetic_value(pref, profile))

    signed_in = profile == "Default"

    # Chromium-owned preferences the issue names explicitly: startup, the
    # default search engine, content permissions, pinned tabs. These few have
    # well-known shapes and the issue requires them present, so they are stated
    # here rather than guessed per pref. Everything else Chromium owns comes
    # from a captured profile: its prefs are Chromium's, there is no Astro-side
    # list of them to enumerate, and inventing a value for a pref whose type was
    # guessed produces a profile the browser rejects.
    chromium_shaped = {
        "bookmark_bar.show_on_all_tabs": True,
        "browser.show_home_button": True,
        "homepage": "astro://newtab",
        "homepage_is_newtabpage": False,
        "profile.created_by_version": version,
        "profile.exit_type": "Normal",
        "profile.name": profile,
        "session.restore_on_startup": 4,
        "session.startup_urls": [
            "https://start.example.com/",
            "chrome://astro-ntp/",
            "astro://newtab",
        ],
        # PinnedTabCodec stores pinned tabs here, so pinned-tab state is
        # testable without the serialised session file, which is deferred.
        "pinned_tabs": [
            {"url": "https://example.com/pinned"},
            {"url": "chrome://astro-ntp/"},
        ],
        # The DEFAULT engine is mirrored into Preferences; the user's other
        # custom engines live in the `keywords` table of Web Data, which is a
        # deferred capture. Both halves are needed to call search configuration
        # covered, and the manifest says so.
        "default_search_provider_data.template_url_data": {
            "date_created": T_CREATED,
            "favicon_url": "https://search.example.com/favicon.ico",
            "id": "2",
            "input_encodings": ["UTF-8"],
            "is_active": 1,
            "keyword": "fixture-search",
            "last_modified": T_MODIFIED,
            "prepopulate_id": 0,
            "safe_for_autoreplace": False,
            "short_name": "Astro Fixture Search",
            "suggestions_url": "https://search.example.com/ac?q={searchTerms}",
            "synced_guid": "00000000-0000-4000-8000-0000000005e1",
            "url": "https://search.example.com/search?q={searchTerms}",
        },
        # Content settings: 1 = allow, 2 = block, keyed by Chromium's
        # "<origin>,*" pattern pair.
        "profile.content_settings.exceptions.geolocation": {
            "https://maps.example.com:443,*": {"last_modified": T_MODIFIED, "setting": 2}
        },
        "profile.content_settings.exceptions.media_stream_camera": {
            "https://meet.example.com:443,*": {"last_modified": T_MODIFIED, "setting": 1}
        },
        "profile.content_settings.exceptions.media_stream_mic": {
            "https://meet.example.com:443,*": {"last_modified": T_MODIFIED, "setting": 1}
        },
        "profile.content_settings.exceptions.notifications": {
            "https://news.example.org:443,*": {"last_modified": T_MODIFIED, "setting": 2}
        },
        "profile.content_settings.exceptions.popups": {
            "https://shop.example.net:443,*": {"last_modified": T_MODIFIED, "setting": 1}
        },
    }
    if not signed_in:
        chromium_shaped["session.restore_on_startup"] = 5
        chromium_shaped["session.startup_urls"] = []
        chromium_shaped["pinned_tabs"] = []

    for path, value in chromium_shaped.items():
        set_nested(document, path, value)
    return document


def build_bookmarks(profile: str) -> dict:
    """A bookmark tree carrying both internal-URL spellings.

    Chromium's `checksum` field is deliberately absent. It is an MD5 of the
    tree, which the browser recomputes and which is wrong the moment anything
    edits the file — and a committed 32-character hex string is exactly what a
    secret scanner is built to flag. Omitting it costs nothing: the codec
    treats a missing checksum as "recompute", which is what a fixture wants.
    """
    signed_in = profile == "Default"
    bar_children = [
        {
            "date_added": T_CREATED,
            "date_last_used": T_USED,
            "guid": "00000000-0000-4000-8000-0000000010a1",
            "id": "10",
            "name": "Example site",
            "type": "url",
            "url": "https://example.com/",
        },
        {
            "date_added": T_CREATED,
            "date_last_used": "0",
            "guid": "00000000-0000-4000-8000-0000000010a2",
            "id": "11",
            "name": "Astro new tab (legacy internal URL)",
            "type": "url",
            "url": "chrome://astro-ntp/",
        },
        {
            "children": [
                {
                    "date_added": T_CREATED,
                    "date_last_used": "0",
                    "guid": "00000000-0000-4000-8000-0000000010a4",
                    "id": "13",
                    "name": "Astro settings",
                    "type": "url",
                    "url": "astro://settings/",
                },
                {
                    "date_added": T_CREATED,
                    "date_last_used": "0",
                    "guid": "00000000-0000-4000-8000-0000000010a5",
                    "id": "14",
                    "name": "Alia panel (legacy internal URL)",
                    "type": "url",
                    "url": "chrome://alia/",
                },
            ],
            "date_added": T_CREATED,
            "date_modified": T_MODIFIED,
            "guid": "00000000-0000-4000-8000-0000000010a3",
            "id": "12",
            "name": "Astro pages",
            "type": "folder",
        },
    ]
    if not signed_in:
        bar_children = bar_children[:1]

    return {
        "roots": {
            "bookmark_bar": {
                "children": bar_children,
                "date_added": T_CREATED,
                "date_modified": T_MODIFIED,
                "guid": "00000000-0000-4000-8000-000000000001",
                "id": "1",
                "name": "Bookmarks bar",
                "type": "folder",
            },
            "other": {
                "children": [
                    {
                        "date_added": T_CREATED,
                        "date_last_used": "0",
                        "guid": "00000000-0000-4000-8000-0000000020a1",
                        "id": "20",
                        "name": "Astro what's new",
                        "type": "url",
                        "url": "astro://whats-new/",
                    },
                    # The omnibox spelling of the NTP. A migration that rewrites
                    # only `chrome://astro-ntp` leaves this one behind, which is
                    # why it is here and not just in the corpus.
                    {
                        "date_added": T_CREATED,
                        "date_last_used": "0",
                        "guid": "00000000-0000-4000-8000-0000000020a2",
                        "id": "21",
                        "name": "New tab (alias host)",
                        "type": "url",
                        "url": f"chrome://{NTP_ALIAS_HOST}/",
                    },
                ],
                "date_added": T_CREATED,
                "date_modified": T_MODIFIED,
                "guid": "00000000-0000-4000-8000-000000000002",
                "id": "2",
                "name": "Other bookmarks",
                "type": "folder",
            },
            "synced": {
                "children": [],
                "date_added": T_CREATED,
                "date_modified": "0",
                "guid": "00000000-0000-4000-8000-000000000003",
                "id": "3",
                "name": "Mobile bookmarks",
                "type": "folder",
            },
        },
        "version": 1,
    }


def build_local_state(version: str) -> dict:
    """The user-data-dir-wide state, including the profile list itself."""
    document: dict = {}
    for path, value in {
        "profile.info_cache": {
            profile: {
                "active_time": 0,
                "background_apps": False,
                "is_ephemeral": False,
                "name": "Astro Fixture" if profile == "Default" else "Astro Fixture Two",
                "shortcut_name": "",
            }
            for profile in PROFILES
        },
        "profile.last_used": PROFILES[0],
        "profile.profiles_order": list(PROFILES),
        "profile.profile_counts_reported": T_MODIFIED,
        "user_experience_metrics.stability.exited_cleanly": True,
        "astro.baseline_chromium_version": version,
    }.items():
        set_nested(document, path, value)
    return document


def build_filter_list(list_id: str) -> str:
    """A stand-in for a downloaded filter list.

    Truncated on purpose and says so in its own first line: the real lists are
    ~100k rules fetched over the network, and committing one would make the
    fixture a copy of somebody else's data. What a migration needs from this
    file is that it exists at the right path with parseable content.
    """
    return (
        f"! Title: Astro fixture stand-in for '{list_id}'\n"
        "! Synthetic test data. Not the real list, and not a copy of one.\n"
        "! Generated by tools/baseline/make_profile_fixtures.py\n"
        "||ads.example.com^\n"
        "||tracker.example.net^$third-party\n"
        "example.org##.ad-slot\n"
    )


def build_token_placeholder(kind: str, filename: str) -> str:
    return (
        f"ASTRO FIXTURE PLACEHOLDER - {kind} token slot ({filename})\n"
        "Not a token. Not encrypted. Never valid anywhere.\n"
        "The real file at this path holds OSCrypt ciphertext, which is keyed on\n"
        "the OS credential store and cannot be produced offline - see the\n"
        "requires-browser-capture entry for the encrypted form in manifest.json.\n"
    )


def build_readme(
    entries: list[dict], prefs: list[dict], candidates: list[dict], version: str
) -> str:
    generated = [entry for entry in entries if entry["provenance"] == "generated"]
    deferred = [entry for entry in entries if entry["provenance"] == "requires-browser-capture"]
    lines = [
        "<!-- Generated by tools/baseline/make_profile_fixtures.py - do not edit by hand.",
        "     Regenerate with: python3 tools/baseline/make_profile_fixtures.py -->",
        "",
        "# Synthetic profile fixtures",
        "",
        f"Baseline Chromium {version} (revisions are pinned in `browser.lock.json`,",
        "which stays their single source of truth - they are not copied here).",
        "",
        "These profiles exist so an Astro Next migration can be tested against a",
        "profile whose contents are known exactly. Nothing here is real user data,",
        "a real token or a secret; every value is a literal test constant.",
        "",
        "## Regenerating",
        "",
        "```",
        "python3 tools/baseline/make_profile_fixtures.py            # write",
        "python3 tools/baseline/make_profile_fixtures.py --verify   # check",
        "```",
        "",
        "Regeneration is byte-stable, so `--verify` failing means either a fixture",
        "was hand-edited or the code it is derived from changed. Both are answered",
        "the same way: regenerate and review the diff.",
        "",
        "## Provenance",
        "",
        f"{len(generated)} file(s) are **generated**. Their values come from parsing",
        "the code that defines them - the preference registrations in",
        "`patches/astro/020-register-oxy-prefs.patch` and",
        f"`patches/astro/046-adblock-prefs.patch` ({len(prefs)} preferences), the WebUI",
        "host constants, the adblock filter catalog and the token store - so they",
        "cannot drift from the browser without `--verify` noticing.",
        "",
        f"{len(deferred)} entry(ies) are **requires-browser-capture**. Those are",
        "Chromium-owned formats (SQLite databases, the serialised session stream,",
        "MAC-protected preferences, the adblock engine cache). A hand-built version",
        "of one of those files would look like a fixture and exercise no migration,",
        "so they are recorded as deferred with the command that captures them.",
        "",
        "## Capturing a deferred fixture",
        "",
        "Run the command in that entry's `capture_command`, then write its capture",
        "metadata beside the file as `<name>.capture.json` with these fields:",
        "",
        "```json",
        "{",
        '  "captured_at": "2026-01-31",',
        '  "captured_from": "Astro <version> release build, linux x64",',
        '  "capture_command": "<the command actually run>",',
        '  "astro_revision": "<short git revision, e.g. 169f4eb>"',
        "}",
        "```",
        "",
        "The revision is the SHORT form deliberately: a full 40-character SHA is",
        "indistinguishable from a leaked key to a secret scanner, including the one",
        "that gates this directory.",
        "",
        "`--verify` fails if a deferred file exists without that metadata, which is",
        "what stops a hand-filled database from passing as a capture.",
        "",
        "## Astro preferences deliberately NOT in this baseline",
        "",
        f"{len(candidates)} Astro-owned preference(s) are registered only in a",
        "working-tree copy of a patch, never at `HEAD`. They are **candidate future",
        "preferences**, not part of the legacy baseline, and they are excluded from",
        "these fixtures on purpose: the baseline is what a clean checkout can",
        "reproduce, and a fixture carrying a preference the committed patch stack",
        "does not register fails `--verify` for everybody except the machine that",
        "produced it.",
        "",
        "The list is declared in",
        f"[`{PREF_DISPOSITIONS}`](../../../{PREF_DISPOSITIONS}) and joined against the",
        "committed registry in both directions, so the day one of them is committed",
        "this generator fails until the entry is reclassified — which is what keeps",
        "the record below from quietly becoming untrue.",
        "",
        "| Preference | Decided by | Observed in |",
        "|---|---|---|",
    ]
    for candidate in candidates:
        issues = ", ".join(
            f"[#{issue}](https://github.com/OxyHQ/Astro/issues/{issue})"
            for issue in candidate["decided_by"]
        )
        lines.append(
            f"| `{candidate['name']}` | {issues} | `{candidate['observed_in']}` |"
        )
    lines += [
        "",
        "## Contents",
        "",
        "| Path | Provenance | Covers |",
        "|---|---|---|",
    ]
    for entry in entries:
        lines.append(
            "| `{path}` | {provenance} | {covers} |".format(
                path=entry["path"],
                provenance=entry["provenance"],
                covers=", ".join(entry["covers"]),
            )
        )
    lines.append("")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Assembling the fixture set
# ---------------------------------------------------------------------------


def as_json(document: object) -> bytes:
    return (json.dumps(document, indent=2, sort_keys=True) + "\n").encode("utf-8")


def build_fixture_set() -> tuple[list[dict], dict[str, bytes], dict]:
    """Every fixture entry, the bytes of the generated ones, and the metadata."""
    prefs, prefs_detected = parse_registered_prefs()
    hosts, hosts_detected = parse_webui_hosts()
    takeover_hosts = parse_takeover_hosts()
    catalog, catalog_detected = parse_filter_catalog()
    adblock = parse_adblock_layout()
    tokens = parse_token_store()
    version = chromium_version()

    dispositions = load_pref_dispositions(
        read_text(PREF_DISPOSITIONS), {pref["name"] for pref in prefs}
    )
    candidates = local_only_prefs(dispositions)
    report_undeclared_worktree_prefs({pref["name"] for pref in prefs}, dispositions)

    # The one floor that survives, and the only one that encodes no expectation
    # about the product: ZERO. Ten preferences is correct if the repository
    # declares ten; none is never correct, because the three counts agree at zero
    # and a fixture describing nothing makes every migration test over it pass
    # without checking anything. Anything above zero is a product decision this
    # tool has no business asserting.
    for label, parsed, where in (
        ("preference registrations", len(prefs), " and ".join(PREF_PATCHES)),
        ("WebUI host constants", len(hosts), WEBUI_DIR),
        ("filter list entries", len(catalog), FILTER_CATALOG),
    ):
        if parsed == 0:
            raise SystemExit(
                f"ERROR no {label} found in {where}.\n"
                f"      The parse and the loose scan agree — at zero — so the identity\n"
                f"      they enforce is satisfied and says nothing. Either the source\n"
                f"      moved, or the declaration idiom changed entirely."
            )

    # `represented`, the third count, for the one surface that does not pass
    # through a per-profile document. It is looking for a COLLAPSE: two
    # declarations normalising to one key, which no upstream count can see.
    assert_represented(
        "WebUI host constants",
        len(hosts),
        len({entry["host"] for entry in hosts}),
        "Two controllers claim the same host, so one of them is unreachable and its "
        "URLs are missing from the corpus.",
    )

    # The per-profile value tables are keyed by profile name. Adding a profile
    # without extending them would otherwise surface as a KeyError traceback
    # somewhere deep in value synthesis.
    for profile in PROFILES:
        if profile not in SYNTHETIC_INTEGERS or profile not in SYNTHETIC_SITE_OVERRIDES:
            raise SystemExit(
                f"ERROR profile {profile!r} has no entry in the synthetic value tables; "
                f"add one rather than letting its preferences fall back to a shared value"
            )

    entries: list[dict] = []
    content: dict[str, bytes] = {}

    def generated(path: str, data: bytes, covers: list[str], derived_from: list[str]) -> None:
        entries.append(
            {
                "path": path,
                "provenance": "generated",
                "kind": "file",
                "owner": "astro",
                "covers": covers,
                "derived_from": derived_from,
            }
        )
        content[path] = data

    def deferred(
        path: str,
        kind: str,
        covers: list[str],
        reason: str,
        scenario: str,
        source: str,
        recursive: bool = False,
    ) -> None:
        # Two runnable lines: drive the browser to the state, then copy the
        # artefact out. The scenario is a separate field rather than a trailing
        # `#` comment, because a comment on the first line of a `&&` chain
        # swallows the copy and the command silently does half its job.
        copy = "cp -r" if recursive else "cp"
        entries.append(
            {
                "path": path,
                "provenance": "requires-browser-capture",
                "kind": kind,
                "owner": "chromium",
                "covers": covers,
                "reason": reason,
                "capture_scenario": scenario,
                "capture_command": (
                    f'{CHROME_BINARY} --user-data-dir="{CAPTURE_DIR}"\n'
                    f'{copy} "{CAPTURE_DIR}/{source}" "{FIXTURE_DIR_REL}/{path}"'
                ),
                "capture_metadata": path + CAPTURE_SUFFIX,
                "capture_metadata_fields": list(CAPTURE_FIELDS),
            }
        )

    pref_sources = sorted({pref["source"] for pref in prefs})

    # --- per-profile, generated ---------------------------------------------
    for profile in PROFILES:
        preferences = build_preferences(profile, prefs, version)
        bookmarks = build_bookmarks(profile)
        # Every parsed preference must reach EVERY profile. Checking only the
        # first would miss the case this fixture set exists to catch: a value
        # carried for one profile and dropped for the rest.
        assert_represented(
            f"Astro-owned preferences (profile {profile!r})",
            len(prefs),
            sum(1 for pref in prefs if has_nested(preferences, pref["name"])),
            f"A registered preference did not reach user-data/{profile}/Preferences. "
            f"Most likely a dotted path collided with a parent key, or two "
            f"registrations normalised to the same nested key.",
        )
        generated(
            f"user-data/{profile}/Preferences",
            as_json(preferences),
            [
                "current Oxy preference keys",
                "adblock preferences and per-site overrides",
                "custom search engine configuration (default engine)",
                "startup preferences",
                "pinned tabs",
                "content permissions",
                "legacy internal URLs",
            ],
            pref_sources,
        )
        generated(
            f"user-data/{profile}/Bookmarks",
            as_json(bookmarks),
            ["bookmarks and folders", "legacy internal URLs"],
            ["src/chrome/browser/oxy/webui"],
        )

        # Counted through `content`, not by counting loop iterations: two catalog
        # entries sharing an id would write the same path twice, and only the
        # number of DISTINCT files actually produced shows that one was lost.
        files_before = len(content)
        enabled = 0
        for entry in catalog:
            if not entry["default_enabled"]:
                continue
            generated(
                f"user-data/{profile}/{adblock['data_dir']}"
                f"/{adblock['filter_lists_subdir']}/{entry['id']}.txt",
                build_filter_list(entry["id"]).encode("utf-8"),
                ["adblock filter lists"],
                [FILTER_CATALOG],
            )
            enabled += 1
        assert_represented(
            f"filter list entries (profile {profile!r})",
            len(catalog),
            (len(content) - files_before) + (len(catalog) - enabled),
            f"Every default-enabled list must produce exactly one file under "
            f"user-data/{profile}/{adblock['data_dir']}/"
            f"{adblock['filter_lists_subdir']}/, and every disabled one must produce "
            f"none. Two entries sharing an id collapse into a single file.",
        )

    # --- user-data-dir wide, generated --------------------------------------
    generated(
        "user-data/Local State",
        as_json(build_local_state(version)),
        ["multiple browser profiles", "profile list and ordering"],
        [LOCK_FILE],
    )

    for kind, filename in tokens["files"].items():
        generated(
            f"user-data/{tokens['directory']}/{filename}",
            build_token_placeholder(kind, filename).encode("utf-8"),
            ["token-store layout with non-production dummy values"],
            [TOKEN_STORE],
        )

    # --- descriptive, generated ---------------------------------------------
    urls = internal_urls(hosts)
    appearances: dict[str, list[str]] = {}
    for path, data in sorted(content.items()):
        if not path.endswith(("Preferences", "Bookmarks", "Local State")):
            continue
        found: set[str] = set()
        collect_urls(json.loads(data.decode("utf-8")), found)
        for url in sorted(found):
            appearances.setdefault(url, []).append(path)

    # The issue asks specifically for BOTH spellings to be present in the
    # generated profile data. Asserting it here means a future edit that drops
    # one cannot quietly remove the thing a URL migration is tested against.
    for scheme in ("chrome://", "astro://"):
        if not any(url.startswith(scheme) for url in appearances):
            raise SystemExit(
                f"ERROR no {scheme} URL appears in any generated profile fixture, so a "
                f"URL migration would have nothing to exercise"
            )

    generated(
        "internal-url-corpus.json",
        as_json(
            {
                "_generated_by": "tools/baseline/make_profile_fixtures.py",
                "note": (
                    "'urls' is every spelling of an internal URL that can appear in "
                    "stored profile data. What a migration should rewrite each one to "
                    "is a product decision issue #6 does not make; this records only "
                    "the shapes that exist. "
                    "'urls_in_generated_fixtures' indexes every URL of any scheme "
                    "actually present in the generated profiles, so a migration test "
                    "knows which file to assert against. "
                    "'hosts_taken_from_upstream' is the gap: a page Astro serves on "
                    "a host Chromium owns names that host with Chromium's own "
                    "constant, whose value is not readable from this repository, so "
                    "those URLs are NOT in 'urls' and a migration test must add them "
                    "by hand."
                ),
                "hosts": hosts,
                "hosts_taken_from_upstream": takeover_hosts,
                "ntp_alias_host": NTP_ALIAS_HOST,
                "urls": urls,
                "urls_in_generated_fixtures": appearances,
                "also_expected_in": [
                    "user-data/Default/History (deferred capture)",
                    "user-data/Default/Sessions (deferred capture)",
                ],
            }
        ),
        ["legacy chrome://astro-* and astro:// URLs"],
        [entry["defined_in"] for entry in hosts]
        + [entry["declared_in"] for entry in takeover_hosts],
    )

    generated(
        "astro-owned-prefs.json",
        as_json(
            {
                "_generated_by": "tools/baseline/make_profile_fixtures.py",
                "note": (
                    "Every preference Astro itself registers, by name and kind, read "
                    "out of the patches that register them. Chromium's own preferences "
                    "are not listed: they belong to Chromium, they are not enumerable "
                    "from anything Astro owns, and the profiles that carry them are "
                    "captured from a real browser rather than synthesised."
                ),
                "astro_owned": [
                    {"name": pref["name"], "kind": pref["kind"], "registered_in": pref["source"]}
                    for pref in prefs
                ],
                # Sits beside `astro_owned` because that is where the question
                # gets asked: a reader who expects a preference in the registry
                # and does not find it needs the answer here, not in a commit
                # message. Declared in the committed disposition file, so this
                # list is a function of HEAD like everything else — it does not
                # change from checkout to checkout with whoever's work is in
                # progress.
                "astro_owned_observed_local_only": {
                    "note": (
                        "Astro-owned preferences registered ONLY in a working-tree "
                        "copy of a patch, never at HEAD. They are deliberately NOT in "
                        "these fixtures: the baseline is what a clean checkout can "
                        "reproduce, and a fixture carrying a preference the committed "
                        "patch stack does not register cannot be regenerated by "
                        "anyone else. Recorded as candidate future preferences; the "
                        "issue named on each decides whether it ships, under what "
                        "name and with what default."
                    ),
                    "declared_in": PREF_DISPOSITIONS,
                    "prefs": candidates,
                },
            }
        ),
        ["the Astro-owned pref registry", "Astro-owned prefs excluded from the baseline"],
        [*pref_sources, PREF_DISPOSITIONS],
    )

    generated(
        "token-store-layout.json",
        as_json(
            {
                "_generated_by": "tools/baseline/make_profile_fixtures.py",
                "note": (
                    "The token store is rooted at the USER DATA DIR, not the profile "
                    "dir, so both profiles share one set of tokens. A migration that "
                    "assumes per-profile tokens loses the session for every profile "
                    "but one."
                ),
                "directory": tokens["directory"],
                "relative_to": "user data dir",
                "files": tokens["files"],
                "on_disk_format": "OSCrypt::EncryptString ciphertext (binary)",
                "fixture_contents": (
                    "plaintext placeholder text, never a token and never valid "
                    "ciphertext; the encrypted form is a deferred capture"
                ),
                "source": TOKEN_STORE,
            }
        ),
        ["token-store layout with non-production dummy values"],
        [TOKEN_STORE],
    )

    # --- deferred ------------------------------------------------------------
    #
    # `$ASTRO_CAPTURE_DIR` is a scratch user data dir, never this repository: a
    # capture run against the fixture tree itself would have the browser
    # rewrite the generated files it sits next to.
    deferred(
        "user-data/Default/History",
        "file",
        ["browsing history", "download history"],
        "SQLite database whose schema is Chromium's and changes between "
        "milestones. A hand-built one would satisfy a migration test without "
        "exercising a single real row.",
        "visit every URL in internal-url-corpus.json and download a file, then quit",
        "Default/History",
    )
    deferred(
        "user-data/Default/Login Data",
        "file",
        ["saved passwords (test credentials only)"],
        "SQLite database whose credential column is OSCrypt ciphertext keyed "
        "on the OS credential store, so it cannot be produced offline at all.",
        "sign in to a local test form with throwaway credentials, accept the save "
        "prompt, then quit",
        "Default/Login Data",
    )
    deferred(
        "user-data/Default/Web Data",
        "file",
        [
            "autofill addresses (test data only)",
            "payment methods",
            "custom search engines (keywords table)",
        ],
        "SQLite database holding autofill and the authoritative keyword table. "
        "Preferences only mirrors the DEFAULT search engine; the user's other "
        "engines live here.",
        "save a test address, add a custom search engine, then quit",
        "Default/Web Data",
    )
    deferred(
        "user-data/Default/Sessions",
        "directory",
        ["open tabs", "recently closed tabs", "tab groups", "pinned tab ordering"],
        "A serialised command stream, not a document format. Tab groups and "
        "recently-closed entries exist nowhere else on disk.",
        "open several tabs, group two, pin one, close another, then quit cleanly",
        "Default/Sessions",
        recursive=True,
    )
    deferred(
        "user-data/Default/Extensions",
        "directory",
        ["installed extensions"],
        "Unpacked extension trees. What is on disk is whatever the extension "
        "shipped, not something to invent.",
        "install a test extension from a local directory, then quit",
        "Default/Extensions",
        recursive=True,
    )
    deferred(
        "user-data/Default/Secure Preferences",
        "file",
        ["extension enable/disable state", "protected preference MACs"],
        "JSON, but every protected value carries a MAC keyed on machine state. "
        "A hand-written copy is rejected by the browser and silently reset, "
        "which looks exactly like a migration that worked.",
        "install a test extension, toggle it off, then quit",
        "Default/Secure Preferences",
    )
    engine_cache = f"{adblock['data_dir']}/{adblock['engine_cache']}"
    deferred(
        f"user-data/Default/{engine_cache}",
        "file",
        ["adblock engine cache"],
        "A serialised adblock-rust engine. Its format is the Rust crate's and "
        "is version-tied; a synthetic one proves nothing about loading a real "
        "cache written by an older build.",
        "let the adblock service build and cache its engine, then quit",
        f"Default/{engine_cache}",
    )
    deferred(
        "user-data/OxyAuth-encrypted",
        "directory",
        ["token store in its real encrypted form"],
        "OSCrypt ciphertext is keyed on the OS credential store, so a valid "
        "blob cannot be produced offline and does not move between machines "
        "either. The generated placeholders cover the token store's LAYOUT; "
        "this covers its format, and sits beside the real directory name "
        "because those paths are already taken by the placeholders.",
        "sign in to Oxy with a throwaway test account, then quit",
        tokens["directory"],
        recursive=True,
    )

    entries.append(
        {
            "path": "README.md",
            "provenance": "generated",
            "kind": "file",
            "owner": "astro",
            "covers": ["how these fixtures are generated from scratch"],
            "derived_from": ["tools/baseline/make_profile_fixtures.py"],
        }
    )
    entries.sort(key=lambda entry: entry["path"])
    content["README.md"] = build_readme(entries, prefs, candidates, version).encode("utf-8")

    # The three counts, per surface, recorded rather than asserted-and-forgotten.
    # `parsed` and `represented` are recomputed here from the finished artefacts
    # so the manifest states what was actually produced; the identity between
    # them was enforced above, at the point each one could still be explained.
    invariant = {
        "preference registrations": (prefs_detected, len(prefs)),
        "WebUI host constants": (hosts_detected, len(hosts)),
        "filter list entries": (catalog_detected, len(catalog)),
    }

    return (
        entries,
        content,
        {
            "registered_pref_count": len(prefs),
            "chromium_version": version,
            "parse_invariant": {
                name: {"detected": detected, "parsed": parsed}
                for name, (detected, parsed) in invariant.items()
            },
            "observed_local_only_pref_count": len(candidates),
        },
    )


def build_manifest(entries: list[dict], meta: dict) -> bytes:
    return as_json(
        {
            "tool": "tools/baseline/make_profile_fixtures.py",
            "issue": "https://github.com/OxyHQ/Astro/issues/6",
            "fixture_version": 1,
            "baseline_chromium_version": meta["chromium_version"],
            "revision_authority": "browser.lock.json",
            "profiles": list(PROFILES),
            "registered_pref_count": meta["registered_pref_count"],
            "observed_local_only_pref_count": meta["observed_local_only_pref_count"],
            # Recorded, not thresholded. What each declaration surface parses to
            # is a product decision that moves; that the parse loses nothing is
            # the property this tool enforces, and putting the numbers in a
            # committed artefact makes them move visibly in a diff instead of
            # living in a constant somebody has to maintain.
            "parse_invariant": {
                "note": (
                    "'detected' comes from a deliberately loose recogniser and "
                    "'parsed' from the strict parser, measured by different rules so "
                    "they can disagree; generation fails unless they pair one-to-one "
                    "and unless the same number reaches the generated fixtures. There "
                    "is no minimum: the only floor is zero, which would satisfy the "
                    "identity while describing nothing."
                ),
                "surfaces": meta["parse_invariant"],
            },
            "capture_metadata_suffix": CAPTURE_SUFFIX,
            "capture_metadata_fields": list(CAPTURE_FIELDS),
            "counts": {
                "generated": sum(1 for e in entries if e["provenance"] == "generated"),
                "requires-browser-capture": sum(
                    1 for e in entries if e["provenance"] == "requires-browser-capture"
                ),
            },
            "entries": entries,
        }
    )


# ---------------------------------------------------------------------------
# Write / verify
# ---------------------------------------------------------------------------


def write(output: Path, entries: list[dict], content: dict[str, bytes], manifest: bytes) -> None:
    for path, data in sorted(content.items()):
        destination = output / path
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
    (output / "manifest.json").write_bytes(manifest)
    generated = len(content)
    deferred = sum(1 for e in entries if e["provenance"] == "requires-browser-capture")
    print(f"wrote {output}")
    print(f"  {generated} generated file(s), {deferred} awaiting browser capture")


def known_paths(entries: list[dict]) -> set[str]:
    paths = {"manifest.json"}
    for entry in entries:
        paths.add(entry["path"])
        if "capture_metadata" in entry:
            paths.add(entry["capture_metadata"])
    return paths


def verify(output: Path, entries: list[dict], content: dict[str, bytes], manifest: bytes) -> None:
    if not output.is_dir():
        raise SystemExit(
            f"ERROR fixture directory not found: {output}\n"
            f"      Generate it with: python3 tools/baseline/make_profile_fixtures.py"
        )

    problems: list[str] = []

    manifest_path = output / "manifest.json"
    if not manifest_path.is_file():
        problems.append(f"manifest.json is missing from {output}")
    elif manifest_path.read_bytes() != manifest:
        problems.append(
            "manifest.json does not match the one this tool produces now; "
            "regenerate and review the diff"
        )

    for path, data in sorted(content.items()):
        destination = output / path
        if not destination.is_file():
            problems.append(f"generated fixture is missing: {path}")
        elif destination.read_bytes() != data:
            problems.append(
                f"generated fixture does not match what this tool produces: {path}\n"
                f"        Either it was edited by hand, or the source it is derived "
                f"from changed.\n"
                f"        Regenerate and review the diff."
            )

    pending: list[str] = []
    for entry in entries:
        if entry["provenance"] != "requires-browser-capture":
            continue
        target = output / entry["path"]
        metadata = output / entry["capture_metadata"]
        if not target.exists():
            pending.append(entry["path"])
            if metadata.exists():
                problems.append(
                    f"capture metadata exists without the fixture it describes: "
                    f"{entry['capture_metadata']}"
                )
            continue
        if not metadata.is_file():
            # This is the hand-filled case: something appeared at a path that
            # can only come from a real browser, with nothing recording where
            # it came from.
            problems.append(
                f"deferred fixture has been hand-filled: {entry['path']}\n"
                f"        It exists but no capture was recorded at "
                f"{entry['capture_metadata']}.\n"
                f"        This entry is deferred because its format is Chromium's, so a\n"
                f"        synthesised file passes tests while exercising no migration.\n"
                f"        Capture it with: {entry['capture_command']}"
            )
            continue
        try:
            with metadata.open(encoding="utf-8") as handle:
                document = json.load(handle)
        except (OSError, json.JSONDecodeError) as error:
            problems.append(
                f"capture metadata is not readable JSON: "
                f"{entry['capture_metadata']} ({error})"
            )
            continue
        missing = [
            field
            for field in CAPTURE_FIELDS
            if not str(document.get(field, "")).strip()
        ]
        if missing:
            problems.append(
                f"capture metadata {entry['capture_metadata']} is missing: "
                f"{', '.join(missing)}"
            )

    # A file nobody declared is unexplained data in a tree whose whole promise
    # is that its contents are known — which is also how a real profile blob,
    # and everything in it, gets committed by accident.
    declared = known_paths(entries)
    directories = [
        entry["path"] for entry in entries if entry.get("kind") == "directory"
    ]
    for path in sorted(output.rglob("*")):
        if not path.is_file():
            continue
        relative = path.relative_to(output).as_posix()
        if relative in declared:
            continue
        if any(relative.startswith(directory + "/") for directory in directories):
            continue
        problems.append(
            f"unexplained file in the fixture tree: {relative}\n"
            f"        Every file here must be declared in manifest.json. Add it to the\n"
            f"        generator, or delete it."
        )

    if problems:
        raise SystemExit(
            "ERROR fixture verification failed:\n"
            + "\n".join(f"      - {problem}" for problem in problems)
        )

    generated = len(content)
    captured = sum(
        1
        for entry in entries
        if entry["provenance"] == "requires-browser-capture"
        and (output / entry["path"]).exists()
    )
    print(
        f"profile fixtures: {len(PROFILES)} profiles, {generated} generated file(s) verified, "
        f"{captured} captured, {len(pending)} awaiting browser capture"
    )
    for path in pending:
        print(f"  awaiting capture: {path}")


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        default=str(DEFAULT_OUTPUT),
        help="fixture directory (default: test/astro-next/fixtures)",
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        help="check the fixtures on disk against this tool; write nothing",
    )
    args = parser.parse_args(argv[1:])

    committed_state.require_repository()

    # Printed before the parse, so that when a source's uncommitted state is
    # what makes generation fail, the reader has already seen which files
    # differ rather than having to guess from the failure alone.
    committed_state.report_working_tree_observations(
        "make_profile_fixtures.py",
        committed_state.working_tree_observations(DERIVED_FROM),
    )

    entries, content, meta = build_fixture_set()
    manifest = build_manifest(entries, meta)

    output = Path(args.output)
    if args.verify:
        verify(output, entries, content, manifest)
    else:
        write(output, entries, content, manifest)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
