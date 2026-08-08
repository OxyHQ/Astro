#!/usr/bin/env bash
# The product's identity is one fact. It must have one source.
#
# The scheme name once lived in four files at once — branding/astro.conf, the
# product manifest, the C++ constants and the build defines — and a change to
# any one was invisible to the other three. That is not a tidiness concern: the
# same shape, applied to the two halves of the scheme decision, produced a
# browser that NAVIGATED to astro:// while REGISTERING under chrome://, so
# every internal page failed with ERR_INVALID_URL. Two halves of one fact,
# edited separately.
#
# //astro/build/product.gni is the source of truth. This case asserts every
# other copy agrees with it, and fails naming both sides when one drifts.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

# The module lives on the #7 stack; a checkout without it has nothing to check,
# and that must be visible rather than silently passing.
# The python below reports the absence itself rather than this shell branching
# on it: a shell-level skip that prints nothing is indistinguishable from a
# pass, which is the shape this repository refuses.

harness::run python3 - "$ASTRO_ROOT" <<'PY'
import pathlib, re, sys

root = pathlib.Path(sys.argv[1])
problems = []
checked = 0


def read(path):
    full = root / path
    return full.read_text(encoding="utf-8") if full.is_file() else None


gni = read("build/product.gni")
if gni is None:
    print("      //astro/build/product.gni not present on this branch.")
    print("      Nothing to compare against; reporting rather than passing.")
    raise SystemExit(0)

def gni_value(name):
    match = re.search(rf'^\s*{name}\s*=\s*"([^"]*)"', gni, re.MULTILINE)
    return match.group(1) if match else None

truth = {
    "trusted": gni_value("astro_url_scheme"),
    "untrusted": gni_value("astro_untrusted_url_scheme"),
}
for role, value in truth.items():
    if not value:
        problems.append(f"product.gni declares no {role} scheme")
if problems:
    print("\n".join(f"      {p}" for p in problems))
    raise SystemExit(1)

# The two are separate security principals; a rename that collapsed them would
# satisfy every equality check below.
if truth["trusted"] == truth["untrusted"]:
    problems.append(
        f"trusted and untrusted are both {truth['trusted']!r}; they are distinct "
        "security principals and cannot share a name"
    )

header = read("common/url_constants.h")
if header is not None:
    checked += 1
    for role, symbol in (("trusted", "kAstroUIScheme"),
                         ("untrusted", "kAstroUIUntrustedScheme")):
        match = re.search(rf'{symbol}\[\]\s*=\s*"([^"]+)"', header)
        if not match:
            problems.append(f"common/url_constants.h has no {symbol}")
        elif match.group(1) != truth[role]:
            problems.append(
                f"{symbol} is {match.group(1)!r}, product.gni says {truth[role]!r}"
            )

conf = read("branding/astro.conf")
if conf is not None:
    checked += 1
    match = re.search(r'^URL_SCHEME="([^"]*)"', conf, re.MULTILINE)
    if match and match.group(1) != truth["trusted"]:
        problems.append(
            f"branding/astro.conf URL_SCHEME is {match.group(1)!r}, "
            f"product.gni says {truth['trusted']!r}"
        )

# A vacuity floor. If every consumer moved or was renamed, this case would
# compare product.gni against nothing and report success.
if checked == 0:
    print("      no consumer of the product identity was found to compare.")
    print("      That is what a broken path looks like, so it fails rather than passes.")
    raise SystemExit(1)

if problems:
    print(f"      product identity has drifted across {len(problems)} place(s):")
    for problem in problems:
        print(f"        {problem}")
    print("      //astro/build/product.gni is the source of truth. Change it there.")
    raise SystemExit(1)

print(f"      product identity agrees across {checked} consumer(s): "
      f"trusted={truth['trusted']} untrusted={truth['untrusted']}")
PY
harness::assert_status 0 "the product identity is single-sourced"

harness::pass
