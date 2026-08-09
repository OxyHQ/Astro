#!/usr/bin/env bash
# A release binary must contain no code that serves a WebUI page off the disk.
#
# Astro deleted a settings surface for exactly one reason: it read its assets
# from a directory beside the executable, so a packaging mistake reached users
# as a blank page with no error and no log line, indistinguishable from a
# browser bug. The replacement puts every asset in astro_webui_resources.pak
# and keeps ONE disk-reading path, astro_webui_dev_source.cc, behind the
# `astro_webui_dev_tools` GN argument.
#
# That guarantee is spelled in four places that no compiler compares:
#
#   * astro_webui.gni, where the argument defaults to false;
#   * chrome/browser/oxy/BUILD.gn, where the sources are added only inside the
#     `if (astro_webui_dev_tools)` block;
#   * astro_webui_page.cc, where the include and the call sit inside
#     `#if BUILDFLAG(ASTRO_WEBUI_DEV_TOOLS)`;
#   * gn_args/, where no committed configuration may turn it on.
#
# Break any one and the build still succeeds. Moving the sources out of the
# `if` compiles the reader into every binary; flipping the default does the
# same without touching a source file; dropping the `#if` around the call is a
# link error only until someone repairs it by compiling the file
# unconditionally. None of those is visible in a diff that looks like build
# tidying.
#
# Both directions are exercised. A check that cannot fail is not a check.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

tmp="$(harness::tmpdir)"

GNI="$ASTRO_ROOT/src/chrome/browser/oxy/webui/astro_webui.gni"
BUILD="$ASTRO_ROOT/src/chrome/browser/oxy/BUILD.gn"
PAGE="$ASTRO_ROOT/src/chrome/browser/oxy/webui/astro_webui_page.cc"
OVERLAY="$ASTRO_ROOT/src/chrome/browser/oxy"
GN_ARGS="$ASTRO_ROOT/gn_args"

CHECK="$tmp/check.py"
cat > "$CHECK" <<'PY'
"""Assert the disk-serving WebUI path cannot reach a release binary.

argv: <astro_webui.gni> <oxy/BUILD.gn> <astro_webui_page.cc> <overlay-root> <gn_args-dir>
Exit 0 when every guarantee holds, 1 naming each one that does not.
"""
import pathlib
import re
import sys

GUARD_ARG = "astro_webui_dev_tools"
GUARD_FLAG = "BUILDFLAG(ASTRO_WEBUI_DEV_TOOLS)"
DEV_SOURCE = "astro_webui_dev_source"
SWITCH = "astro-webui-dir"

gni_path, build_path, page_path, overlay_root, gn_args_dir = (
    pathlib.Path(p) for p in sys.argv[1:6]
)
problems = []
checked = 0


def read(path):
    if not path.is_file():
        problems.append(f"missing input: {path}")
        return None
    return path.read_text(encoding="utf-8")


gni = read(gni_path)
build = read(build_path)
page = read(page_path)
if not overlay_root.is_dir():
    problems.append(f"missing input: {overlay_root}")
if not gn_args_dir.is_dir():
    problems.append(f"missing input: {gn_args_dir}")
if problems:
    for problem in problems:
        print(f"      {problem}")
    print("      Every input is required. An absent one is a broken path, not a pass.")
    raise SystemExit(1)


def guarded_block(text, opener):
    """Returns the body of `opener { ... }`, matched by brace depth.

    A regex cannot do this: the block holds braces of its own.
    """
    start = text.find(opener)
    if start < 0:
        return None
    brace = text.find("{", start)
    if brace < 0:
        return None
    depth = 0
    for index in range(brace, len(text)):
        if text[index] == "{":
            depth += 1
        elif text[index] == "}":
            depth -= 1
            if depth == 0:
                return text[brace : index + 1]
    return None


# --- 1. the argument defaults to off ---------------------------------------
checked += 1
declared = guarded_block(gni, "declare_args()")
if declared is None:
    problems.append(f"{gni_path.name} has no declare_args() block")
else:
    default = re.search(rf"^\s*{GUARD_ARG}\s*=\s*(\S+)\s*$", declared, re.MULTILINE)
    if not default:
        problems.append(f"{gni_path.name} declares no {GUARD_ARG} argument")
    elif default.group(1) != "false":
        problems.append(
            f"{gni_path.name} defaults {GUARD_ARG} to {default.group(1)}; "
            "a developer affordance that is on by default is not one"
        )

# --- 2. the sources are compiled only inside the guard ----------------------
checked += 1
mentions = [
    line.strip()
    for line in build.splitlines()
    if DEV_SOURCE in line and not line.strip().startswith("#")
]
guard_body = guarded_block(build, f"if ({GUARD_ARG})")
if not mentions:
    problems.append(
        f"{build_path.name} names no {DEV_SOURCE} source at all. Either the "
        "developer override was removed (delete this case with it) or the "
        "sources moved somewhere this check no longer reads."
    )
elif guard_body is None:
    problems.append(
        f"{build_path.name} names {DEV_SOURCE} but has no "
        f"`if ({GUARD_ARG})` block, so it is compiled into every binary"
    )
else:
    outside = [line for line in mentions if line not in guard_body]
    if outside:
        problems.append(
            f"{build_path.name} compiles {DEV_SOURCE} outside "
            f"`if ({GUARD_ARG})`: {outside}"
        )

# --- 3. the shared page base does not read the filesystem -------------------
#
# Read line by line so the preprocessor guard is respected: a mention inside
# `#if BUILDFLAG(ASTRO_WEBUI_DEV_TOOLS)` is the intended shape, the same
# mention outside it is the defect.
checked += 1
depth = 0
unguarded = []
for number, line in enumerate(page.splitlines(), start=1):
    stripped = line.strip()
    if stripped.startswith("#if") and GUARD_FLAG in stripped:
        depth += 1
        continue
    if depth and stripped.startswith("#endif"):
        depth -= 1
        continue
    if depth:
        continue
    if DEV_SOURCE in stripped and not stripped.startswith("//"):
        unguarded.append(f"{page_path.name}:{number}: {stripped}")
if unguarded:
    problems.append(
        f"the shared page base reaches {DEV_SOURCE} outside "
        f"`#if {GUARD_FLAG}`: {unguarded}"
    )

checked += 1
for banned, why in (
    ("DIR_EXE", "reads a directory beside the executable"),
    ("ReadFileToString", "reads a file off the disk"),
):
    for number, line in enumerate(page.splitlines(), start=1):
        stripped = line.strip()
        if banned in stripped and not stripped.startswith(("//", "*", "/*")):
            problems.append(
                f"{page_path.name}:{number} {why}, in the base every Astro page "
                f"is served through: {stripped}"
            )

# --- 4. the switch is named in exactly one file -----------------------------
checked += 1
scanned = 0
carriers = []
for source in sorted(overlay_root.rglob("*")):
    if source.suffix not in (".cc", ".h"):
        continue
    scanned += 1
    if SWITCH in source.read_text(encoding="utf-8"):
        carriers.append(source.relative_to(overlay_root).as_posix())
if scanned < 20:
    problems.append(
        f"only {scanned} overlay source(s) scanned under {overlay_root}; "
        "that is a broken traversal, not a clean result"
    )
# The header names it in the comment explaining what the file is for, which is
# where a reader looks first; the .cc is the only place it is READ.
expected = [f"webui/{DEV_SOURCE}.cc", f"webui/{DEV_SOURCE}.h"]
if carriers != expected:
    problems.append(
        f"the --{SWITCH} switch is spelled in {carriers or 'no file'}; "
        f"it belongs in {expected} and nowhere else"
    )

# --- 5. no committed configuration turns it on ------------------------------
checked += 1
configs = sorted(gn_args_dir.glob("*.gn"))
if not configs:
    problems.append(f"no *.gn configurations found in {gn_args_dir}")
for config in configs:
    for number, line in enumerate(
        config.read_text(encoding="utf-8").splitlines(), start=1
    ):
        stripped = line.strip()
        if stripped.startswith("#"):
            continue
        enabled = re.match(rf"{GUARD_ARG}\s*=\s*true\b", stripped)
        if enabled:
            problems.append(
                f"gn_args/{config.name}:{number} sets {GUARD_ARG} = true; "
                "a committed configuration must never ship the disk reader"
            )

if checked == 0:
    print("      nothing was checked. That is a broken traversal, not a pass.")
    raise SystemExit(1)

if problems:
    print(f"      the pak-only guarantee is broken in {len(problems)} place(s):")
    for problem in problems:
        print(f"        {problem}")
    print("      Astro serves WebUI assets from astro_webui_resources.pak. The one")
    print(f"      disk-reading path stays behind {GUARD_ARG}, which is off in every")
    print("      committed configuration.")
    raise SystemExit(1)

print(
    f"      {checked} guarantee(s) hold across {scanned} overlay source(s) and "
    f"{len(configs)} configuration(s): assets come from the pak"
)
raise SystemExit(0)
PY

harness::run python3 "$CHECK" "$GNI" "$BUILD" "$PAGE" "$OVERLAY" "$GN_ARGS"
harness::assert_status 0 "the release binary contains no WebUI disk reader"
harness::assert_output_contains "assets come from the pak" "and says what it proved"

# --------------------------------------------------------------------------
# The negative direction, one mutation at a time.
#
# Each copy breaks exactly one of the four spellings. A check that passes any
# of these is not reading that file at all.
# --------------------------------------------------------------------------

mutate() {
    # mutate <name> <which> <sed-expression>
    local name="$1" which="$2" expression="$3"
    local dir="$tmp/$name"
    rm -rf "$dir"
    mkdir -p "$dir/gn_args"
    cp -r "$OVERLAY" "$dir/oxy"
    cp "$GNI" "$dir/astro_webui.gni"
    cp "$BUILD" "$dir/BUILD.gn"
    cp "$PAGE" "$dir/astro_webui_page.cc"
    cp "$GN_ARGS"/*.gn "$dir/gn_args/"
    sed -i "$expression" "$dir/$which"
    harness::run python3 "$CHECK" \
        "$dir/astro_webui.gni" "$dir/BUILD.gn" "$dir/astro_webui_page.cc" \
        "$dir/oxy" "$dir/gn_args"
}

mutate flipped-default astro_webui.gni \
    's|astro_webui_dev_tools = false|astro_webui_dev_tools = true|'
harness::assert_status 1 "a default that ships the disk reader is caught"
harness::assert_output_contains "defaults astro_webui_dev_tools to true" \
    "and the failure names the argument"

mutate unguarded-sources BUILD.gn \
    's|^  if (astro_webui_dev_tools) {|  if (true) {|'
harness::assert_status 1 "compiling the dev source unconditionally is caught"
harness::assert_output_contains "has no \`if (astro_webui_dev_tools)\` block" \
    "and the failure says the reader reaches every binary"

mutate unguarded-include astro_webui_page.cc \
    's|^#if BUILDFLAG(ASTRO_WEBUI_DEV_TOOLS)$||'
harness::assert_status 1 "an unguarded reach into the dev source is caught"
harness::assert_output_contains "outside" "and the failure says it is outside the guard"

mutate reads-from-disk astro_webui_page.cc \
    's|source->AddResourcePaths(page.resources);|base::ReadFileToString(file, \&contents);|'
harness::assert_status 1 "a filesystem read in the shared page base is caught"
harness::assert_output_contains "reads a file off the disk" \
    "and the failure says what the line does"

mutate switch-leaked-into-a-controller oxy/webui/astro_settings_ui.cc \
    's|^namespace astro {|namespace astro {\nconstexpr char kDir[] = "astro-webui-dir";|'
harness::assert_status 1 "the switch spelled in a second file is caught"
harness::assert_output_contains "astro_settings_ui.cc" "and the failure names that file"

mutate release-config-turns-it-on gn_args/linux.gn \
    "\$a astro_webui_dev_tools = true"
harness::assert_status 1 "a committed configuration enabling it is caught"
harness::assert_output_contains "must never ship the disk reader" \
    "and the failure says why"

# A missing input must fail rather than check nothing.
harness::run python3 "$CHECK" "$tmp/absent.gni" "$BUILD" "$PAGE" "$OVERLAY" "$GN_ARGS"
harness::assert_status 1 "an absent input fails instead of passing vacuously"
harness::assert_output_contains "missing input" "and says which one"

harness::pass
