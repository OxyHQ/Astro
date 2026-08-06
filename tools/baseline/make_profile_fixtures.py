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

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT = REPO_ROOT / "test" / "astro-next" / "fixtures"

# Sources every generated value is derived from. Each one is parsed, and each
# parse carries a floor below which it is treated as broken rather than empty.
PREF_PATCHES = (
    REPO_ROOT / "patches" / "astro" / "020-register-oxy-prefs.patch",
    REPO_ROOT / "patches" / "astro" / "046-adblock-prefs.patch",
)
SETTINGS_HANDLER = (
    REPO_ROOT / "src" / "chrome" / "browser" / "oxy" / "webui" / "astro_settings_handler.cc"
)
WEBUI_DIR = REPO_ROOT / "src" / "chrome" / "browser" / "oxy" / "webui"
FILTER_CATALOG = (
    REPO_ROOT
    / "src"
    / "chrome"
    / "browser"
    / "oxy"
    / "adblock"
    / "astro_adblock_filter_list_catalog.cc"
)
ADBLOCK_SERVICE = (
    REPO_ROOT / "src" / "chrome" / "browser" / "oxy" / "adblock" / "astro_adblock_service.cc"
)
TOKEN_STORE = REPO_ROOT / "src" / "chrome" / "browser" / "oxy" / "oxy_auth_token_store.cc"
LOCK_FILE = REPO_ROOT / "browser.lock.json"

# Vacuity floors. A regex that stops matching — because a patch was reformatted,
# a file moved, or the registration idiom changed — must fail loudly. Silently
# producing a fixture with no preferences in it is the failure this prevents:
# the migration test would still pass, having checked nothing.
MIN_REGISTERED_PREFS = 15
MIN_SETTINGS_MAPPINGS = 20
MIN_WEBUI_HOSTS = 4
MIN_FILTER_LISTS = 5

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

PREF_RE = re.compile(
    r'registry->Register(?P<kind>[A-Za-z0-9]+)Pref\(\s*"(?P<name>[A-Za-z0-9_.]+)"'
    r"(?:\s*,\s*(?P<default>.*?))?\s*\)\s*;",
    re.DOTALL,
)
MAPPING_RE = re.compile(r'\{\s*"([A-Za-z0-9_-]+)"\s*,\s*"([A-Za-z0-9_.]+)"\s*\}')
HOST_RE = re.compile(r'inline constexpr char kAstro(\w+)Host\[\]\s*=\s*"([^"]+)"\s*;')
CATALOG_RE = re.compile(
    r'\.id = "(?P<id>[^"]+)".*?\.default_enabled = (?P<enabled>true|false)', re.DOTALL
)


def read_text(path: Path) -> str:
    if not path.is_file():
        raise SystemExit(f"ERROR source file not found: {path}")
    return path.read_text(encoding="utf-8")


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


def parse_registered_prefs() -> list[dict]:
    """Every Astro-owned preference, read out of the patches that register it.

    The names are not hardcoded on purpose. A hardcoded list is a second copy
    of the pref registry that nothing keeps in sync, and the first rename makes
    the fixture describe a browser that no longer exists.
    """
    prefs: dict[str, dict] = {}
    for patch in PREF_PATCHES:
        source = str(patch.relative_to(REPO_ROOT))
        found = 0
        for match in PREF_RE.finditer(added_lines(read_text(patch))):
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
            found += 1
        if not found:
            raise SystemExit(
                f"ERROR no preference registrations parsed from {source}.\n"
                f"      The registration idiom this tool matches "
                f"(registry->Register<Kind>Pref(\"name\", …)) is gone or changed."
            )

    if len(prefs) < MIN_REGISTERED_PREFS:
        raise SystemExit(
            f"ERROR parsed only {len(prefs)} Astro preferences, expected at least "
            f"{MIN_REGISTERED_PREFS}.\n"
            f"      A fixture generated from a broken parse would contain almost no\n"
            f"      preferences and every migration test over it would pass without\n"
            f"      checking anything, so this is a hard failure rather than a warning."
        )
    return [prefs[name] for name in sorted(prefs)]


def parse_settings_surface() -> dict[str, list[dict]]:
    """The settings page's pref map: which pref each control reads and writes.

    These paths are recorded by NAME only. Their types belong to Chromium, and
    inventing a value for a pref whose type you guessed produces a profile the
    browser rejects — the same "looks right, is not" failure the deferred
    entries exist to avoid. So the fixture carries the Astro-owned values and a
    checklist of the Chromium-owned prefs a captured profile has to contain.
    """
    text = read_text(SETTINGS_HANDLER)
    surface: dict[str, list[dict]] = {}
    total = 0
    for array, service in (
        ("kProfilePrefMappings", "profile"),
        ("kLocalStatePrefMappings", "local_state"),
    ):
        start = text.find(f"{array}[] = {{")
        if start < 0:
            raise SystemExit(f"ERROR {array}[] not found in {SETTINGS_HANDLER.name}")
        end = text.find("\n};", start)
        if end < 0:
            raise SystemExit(f"ERROR {array}[] is not terminated in {SETTINGS_HANDLER.name}")
        entries = [
            {"settings_id": settings_id, "pref_path": pref_path, "service": service}
            for settings_id, pref_path in MAPPING_RE.findall(text[start:end])
        ]
        surface[service] = sorted(entries, key=lambda entry: entry["settings_id"])
        total += len(entries)

    if total < MIN_SETTINGS_MAPPINGS:
        raise SystemExit(
            f"ERROR parsed only {total} settings pref mappings, expected at least "
            f"{MIN_SETTINGS_MAPPINGS}; the mapping-table parse is broken"
        )
    return surface


def parse_webui_hosts() -> list[dict]:
    """The internal hosts, read from the WebUI controllers that define them."""
    hosts: list[dict] = []
    for header in sorted(WEBUI_DIR.glob("*.h")):
        for symbol, host in HOST_RE.findall(header.read_text(encoding="utf-8")):
            hosts.append(
                {
                    "host": host,
                    "constant": f"kAstro{symbol}Host",
                    "defined_in": str(header.relative_to(REPO_ROOT)),
                }
            )
    if len(hosts) < MIN_WEBUI_HOSTS:
        raise SystemExit(
            f"ERROR parsed only {len(hosts)} WebUI hosts from {WEBUI_DIR}, expected at "
            f"least {MIN_WEBUI_HOSTS}; the host-constant parse is broken"
        )
    return sorted(hosts, key=lambda entry: entry["host"])


def parse_filter_catalog() -> list[dict]:
    lists = [
        {"id": match.group("id"), "default_enabled": match.group("enabled") == "true"}
        for match in CATALOG_RE.finditer(read_text(FILTER_CATALOG))
    ]
    if len(lists) < MIN_FILTER_LISTS:
        raise SystemExit(
            f"ERROR parsed only {len(lists)} filter lists from {FILTER_CATALOG.name}, "
            f"expected at least {MIN_FILTER_LISTS}; the catalog parse is broken"
        )
    return lists


def parse_adblock_layout() -> dict:
    text = read_text(ADBLOCK_SERVICE)
    names = dict(re.findall(r'constexpr char (k\w+)\[\] = "([^"]+)"\s*;', text))
    updater = read_text(
        ADBLOCK_SERVICE.with_name("astro_adblock_filter_list_updater.cc")
    )
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
            f"ERROR could not read the token-store layout from {TOKEN_STORE.name}; "
            f"the fixture would describe a layout that no longer exists"
        )
    # The description this fixture ships says the real files hold OSCrypt
    # ciphertext. If the store stops encrypting, that description becomes a
    # false statement about the browser's security posture, so it is checked.
    if "OSCrypt::EncryptString" not in text:
        raise SystemExit(
            f"ERROR {TOKEN_STORE.name} no longer calls OSCrypt::EncryptString, so the "
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
    with LOCK_FILE.open(encoding="utf-8") as handle:
        return json.load(handle)["chromium"]["version"]


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
    # default search engine, content permissions, pinned tabs. Unlike the
    # settings surface above, these few have well-known shapes and the issue
    # requires them present, so they are stated here rather than guessed per
    # pref. Everything else Chromium owns is listed by name in
    # settings-surface-prefs.json or captured from a real browser.
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


def build_readme(entries: list[dict], prefs: list[dict], version: str) -> str:
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
    prefs = parse_registered_prefs()
    surface = parse_settings_surface()
    hosts = parse_webui_hosts()
    catalog = parse_filter_catalog()
    adblock = parse_adblock_layout()
    tokens = parse_token_store()
    version = chromium_version()

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

        for entry in catalog:
            if not entry["default_enabled"]:
                continue
            generated(
                f"user-data/{profile}/{adblock['data_dir']}"
                f"/{adblock['filter_lists_subdir']}/{entry['id']}.txt",
                build_filter_list(entry["id"]).encode("utf-8"),
                ["adblock filter lists"],
                [str(FILTER_CATALOG.relative_to(REPO_ROOT))],
            )

    # --- user-data-dir wide, generated --------------------------------------
    generated(
        "user-data/Local State",
        as_json(build_local_state(version)),
        ["multiple browser profiles", "profile list and ordering"],
        [str(LOCK_FILE.relative_to(REPO_ROOT))],
    )

    for kind, filename in tokens["files"].items():
        generated(
            f"user-data/{tokens['directory']}/{filename}",
            build_token_placeholder(kind, filename).encode("utf-8"),
            ["token-store layout with non-production dummy values"],
            [str(TOKEN_STORE.relative_to(REPO_ROOT))],
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
                    "knows which file to assert against."
                ),
                "hosts": hosts,
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
        [entry["defined_in"] for entry in hosts],
    )

    generated(
        "settings-surface-prefs.json",
        as_json(
            {
                "_generated_by": "tools/baseline/make_profile_fixtures.py",
                "note": (
                    "Preferences the Astro settings page reads and writes, by NAME "
                    "only. The Chromium-owned ones carry no fixture value: inventing "
                    "a value for a pref whose type was guessed produces a profile the "
                    "browser rejects. A captured profile must contain these."
                ),
                "profile": surface["profile"],
                "local_state": surface["local_state"],
                "astro_owned": [
                    {"name": pref["name"], "kind": pref["kind"], "registered_in": pref["source"]}
                    for pref in prefs
                ],
            }
        ),
        ["settings-page pref surface"],
        [str(SETTINGS_HANDLER.relative_to(REPO_ROOT))],
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
                "source": str(TOKEN_STORE.relative_to(REPO_ROOT)),
            }
        ),
        ["token-store layout with non-production dummy values"],
        [str(TOKEN_STORE.relative_to(REPO_ROOT))],
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
    content["README.md"] = build_readme(entries, prefs, version).encode("utf-8")

    return entries, content, {"registered_pref_count": len(prefs), "chromium_version": version}


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
