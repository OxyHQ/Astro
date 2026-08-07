#!/usr/bin/env bash
# The release invariant: no packager can name an artifact after the product
# unless the product is in it.
#
# This is not a workaround for one bad build. It is a property of release, so it
# is asserted the way a property is: every packager, every verdict, by RUNNING
# the packager and reading the filenames it left behind.
#
# Exit status is deliberately not the assertion. A packager that refuses loudly
# and then writes the file anyway would pass an exit-status check while doing
# the exact thing this case exists to prevent, so what lands in releases/ is
# what gets inspected — and on the refusal paths, the assertion is that the
# directory is EMPTY, not merely that nothing is called astro.
#
# The five scenarios per packager:
#
#   present               -> may produce an artifact named after the product
#   absent                -> refuses, produces nothing
#   unmeasurable          -> refuses, produces nothing
#   absent + override     -> produces ONLY a pipeline-validation artifact,
#                            marked in the filename AND in its provenance
#   unmeasurable+override -> STILL refuses. The override exists for a build
#                            that was measured and found empty; it is not a way
#                            to package something nobody measured. This is the
#                            single most important row in the table.
#
# Everything runs against a fixture Astro repository under the harness
# temporary directory. The real releases/ is never written to and the real
# chromium/ checkout is never read.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

tmp="$(harness::tmpdir)"

# Content standing in for the three states a build can be in. Padded past 100
# bytes because package-windows.sh skips DLLs smaller than that as
# cross-compilation stubs, and a fixture that trips an unrelated guard fails for
# the wrong reason.
PADDING="$(printf 'x%.0s' {1..200})"
OVERLAY_TEXT="pad chrome://version pad chrome://alia pad astro-ntp pad astro-error pad $PADDING"
CONTROL_TEXT="pad chrome://version pad chrome://settings pad chrome://history pad $PADDING"
MUTE_TEXT="nothing relevant in this file at all, four printable chars minimum $PADDING"

# ==========================================================================
# The fixture Astro repository
#
# The packagers derive ASTRO_ROOT from their own path, so running the copies
# here sends every artifact to this fixture's releases/ directory.
# ==========================================================================

setup_run() {
    local log="$tmp/setup.log"
    local status=0
    "$@" >"$log" 2>&1 || status=$?
    if [ "$status" -ne 0 ]; then
        printf -- '--- setup output ---\n' >&2
        cat "$log" >&2
        harness::fail "fixture setup failed (exit $status): $*"
    fi
}

ROOT="$tmp/astro-repo"
mkdir -p "$ROOT/tools/lib" "$ROOT/branding/web"
cp "$ASTRO_ROOT"/tools/package-*.sh "$ROOT/tools/"
cp "$ASTRO_ROOT/tools/astro-launch.sh" "$ROOT/tools/"
cp -R "$ASTRO_ROOT/tools/lib/." "$ROOT/tools/lib/"
# The real branding files, not stand-ins: package-deb.sh feeds the icon to
# ImageMagick, which fails on anything that is not really a PNG.
cp "$ASTRO_ROOT/branding/astro-browser.desktop" "$ROOT/branding/"
cp "$ASTRO_ROOT/branding/web/icon-512.png" "$ROOT/branding/web/"
printf '9.9.9\n' > "$ROOT/VERSION"

# Provenance the packagers stage into their artifacts. ASTRO_REPORT_DIR is
# pointed at the harness temporary directory by harness::setup, so this never
# touches the repository's own build/reports.
mkdir -p "$ASTRO_REPORT_DIR"
cat > "$ASTRO_REPORT_DIR/provenance.json" <<'EOF'
{
  "chromium": {"commit": "0123456789abcdef0123456789abcdef01234567"},
  "overlay": {"state": "clean", "revision": "fedcba9876543210fedcba9876543210fedcba98"},
  "reproducible": true,
  "not_reproducible_because": []
}
EOF

# macOS DMG creation needs hdiutil, which does not exist on Linux. It is stubbed
# so the naming and gating logic can be exercised end to end; the DMG's CONTENTS
# are not under test here and this case does not claim to have produced a real
# one. Without the stub the macOS rows could only ever assert refusals, and the
# "present -> may be named astro" direction would go unchecked on the one
# platform whose probe is itself fixture-verified.
STUB_BIN="$tmp/stub-bin"
mkdir -p "$STUB_BIN"
cat > "$STUB_BIN/hdiutil" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
# hdiutil create ... <image path>: the image path is the last argument.
for argument in "$@"; do target="$argument"; done
printf 'stub disk image\n' > "$target"
EOF
chmod 755 "$STUB_BIN/hdiutil"

# ==========================================================================
# Build directories, one shape per platform
# ==========================================================================

make_linux_build() {
    local dir="$1" text="$2"
    rm -rf "$dir"
    mkdir -p "$dir"
    printf '%s' "$text" > "$dir/chrome"
    printf 'sandbox %s' "$PADDING"  > "$dir/chrome_sandbox"
    printf 'crashpad %s' "$PADDING" > "$dir/chrome_crashpad_handler"
    printf 'icu %s' "$PADDING"      > "$dir/icudtl.dat"
    printf 'pak %s' "$PADDING"      > "$dir/chrome_100_percent.pak"
    printf 'pak %s' "$PADDING"      > "$dir/resources.pak"
    printf 'bin %s' "$PADDING"      > "$dir/snapshot_blob.bin"
}

make_windows_build() {
    local dir="$1" text="$2"
    rm -rf "$dir"
    mkdir -p "$dir"
    # The DLL carries the code and the EXE is a launcher stub that carries
    # neither marker — the layout measured on the real shipped Windows artifact,
    # and the reason the probe passes both files rather than naming one.
    printf '%s' "$text"       > "$dir/chrome.dll"
    printf '%s' "$MUTE_TEXT"  > "$dir/chrome.exe"
    printf 'elf %s' "$PADDING"      > "$dir/chrome_elf.dll"
    printf 'crashpad %s' "$PADDING" > "$dir/chrome_crashpad_handler.exe"
    printf 'icu %s' "$PADDING"      > "$dir/icudtl.dat"
    printf 'pak %s' "$PADDING"      > "$dir/resources.pak"
    printf 'bin %s' "$PADDING"      > "$dir/snapshot_blob.bin"
    printf 'dat %s' "$PADDING"      > "$dir/extra.dat"
    printf 'installer %s' "$PADDING" > "$dir/mini_installer.exe"
}

make_macos_build() {
    local dir="$1" text="$2"
    rm -rf "$dir"
    local bundle="$dir/Astro.app"
    mkdir -p "$bundle/Contents/MacOS" \
             "$bundle/Contents/Frameworks/Astro Framework.framework/Versions/A"
    # 64-bit little-endian Mach-O magic; the detector keys on it.
    printf '\xcf\xfa\xed\xfe%s' "$MUTE_TEXT" > "$bundle/Contents/MacOS/Astro"
    printf '\xcf\xfa\xed\xfe%s' "$text" \
        > "$bundle/Contents/Frameworks/Astro Framework.framework/Versions/A/Astro Framework"
}

make_android_build() {
    local dir="$1" text="$2"
    rm -rf "$dir"
    mkdir -p "$dir/apks"
    setup_run python3 - "$dir/apks/ChromePublic.apk" "$text" <<'PY'
import sys
import zipfile

path, text = sys.argv[1:3]
with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as archive:
    archive.writestr("AndroidManifest.xml", "binary xml stand-in")
    archive.writestr("classes.dex", "dex stand-in")
    archive.writestr("lib/arm64-v8a/libmonochrome.so", text)
PY
}

# ==========================================================================
# Inspecting what a run produced
# ==========================================================================

release_entries() {
    local dir="$1"
    [ -d "$dir" ] || return 0
    ( cd "$dir" && find . -mindepth 1 -maxdepth 1 | sed 's|^\./||' | sort )
}

# Reads every provenance record out of whatever the packager produced, whatever
# format it is in, and prints "<where>\t<artifact_class>" per record. Prints
# NONE if there are none, so "the artifact carries no provenance at all" cannot
# pass as "the provenance does not disagree with me".
read_provenance_classes() {
    local dir="$1"
    python3 - "$dir" <<'PY'
import io
import json
import pathlib
import subprocess
import sys
import tarfile
import zipfile

releases = pathlib.Path(sys.argv[1])
found = []


def record(label, document):
    entry = document.get("overlay_in_binary")
    found.append((label, entry.get("artifact_class") if entry else "MISSING-KEY"))


def from_tar(label, fileobj):
    with tarfile.open(fileobj=fileobj) as archive:
        for member in archive.getmembers():
            if member.name.endswith("provenance.json"):
                handle = archive.extractfile(member)
                if handle is not None:
                    record(f"{label}!{member.name}", json.load(handle))


if releases.is_dir():
    for entry in sorted(releases.iterdir()):
        if entry.is_dir():
            continue
        name = entry.name
        if name.endswith(".provenance.json"):
            record(name, json.loads(entry.read_text(encoding="utf-8")))
        elif name.endswith(".tar.gz"):
            with entry.open("rb") as handle:
                from_tar(name, handle)
        elif name.endswith(".zip"):
            with zipfile.ZipFile(entry) as archive:
                for member in archive.namelist():
                    if member.endswith("provenance.json"):
                        record(f"{name}!{member}", json.loads(archive.read(member)))
        elif name.endswith(".deb"):
            payload = subprocess.run(
                ["dpkg-deb", "--fsys-tarfile", str(entry)],
                capture_output=True, check=True,
            ).stdout
            from_tar(name, io.BytesIO(payload))

for label, artifact_class in found:
    print(f"{label}\t{artifact_class}")
if not found:
    print("NONE")
PY
}

assert_nothing_produced() {
    local dir="$1" what="$2"
    HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
    local entries
    entries="$(release_entries "$dir")"
    if [ -n "$entries" ]; then
        harness::fail "$what: refused, but left this behind in releases/: $(printf '%s' "$entries" | tr '\n' ' ')"
    fi
}

# The product name is matched case-SENSITIVELY and in lowercase, which is the
# whole point of writing the override marker as NO-ASTRO-OVERLAY in capitals:
# it reads as a warning stamped across the name, never as a product called
# astro. A case-insensitive check could not tell the two apart.
assert_named_astro() {
    local dir="$1" what="$2"
    local entries entry astro_named=0
    entries="$(release_entries "$dir")"
    HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 2))
    [ -n "$entries" ] || harness::fail "$what: produced nothing at all"
    while IFS= read -r entry; do
        [ -n "$entry" ] || continue
        case "$entry" in
            *astro*) astro_named=1 ;;
        esac
        case "$entry" in
            *pipeline-validation*|*NO-ASTRO-OVERLAY*)
                harness::fail "$what: a genuine build was marked as validation-only: $entry"
                ;;
        esac
    done <<< "$entries"
    [ "$astro_named" -eq 1 ] || \
        harness::fail "$what: produced no artifact named after the product: $(printf '%s' "$entries" | tr '\n' ' ')"
}

assert_named_validation_only() {
    local dir="$1" what="$2"
    local entries entry
    entries="$(release_entries "$dir")"
    HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
    [ -n "$entries" ] || harness::fail "$what: the override produced nothing at all"
    while IFS= read -r entry; do
        [ -n "$entry" ] || continue
        HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 3))
        case "$entry" in
            *astro*)
                harness::fail "$what: an overlayless artifact still carries the product name: $entry"
                ;;
        esac
        case "$entry" in
            *pipeline-validation*) ;;
            *) harness::fail "$what: not marked as pipeline-validation: $entry" ;;
        esac
        case "$entry" in
            *NO-ASTRO-OVERLAY*) ;;
            *) harness::fail "$what: not marked NO-ASTRO-OVERLAY: $entry" ;;
        esac
    done <<< "$entries"
}

assert_provenance_class() {
    local dir="$1" expected="$2" what="$3"
    local classes line
    classes="$(read_provenance_classes "$dir")"
    HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
    if [ "$classes" = "NONE" ]; then
        harness::fail "$what: the artifact carries no provenance record at all"
    fi
    while IFS= read -r line; do
        [ -n "$line" ] || continue
        HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
        case "$line" in
            *"	$expected") ;;
            *) harness::fail "$what: provenance says '$line', expected artifact_class $expected" ;;
        esac
    done <<< "$classes"
}

# ==========================================================================
# The table: one row per packager
#
# Each row names the script, the build-directory maker, and the build directory
# to hand it. Adding a packager without adding a row here fails the coverage
# floor below rather than silently going ungated.
# ==========================================================================

declare -a PACKAGER=() BUILDER=()

register_packager() {
    PACKAGER+=("$1")
    BUILDER+=("$2")
}

register_packager package-release.sh make_linux_build
register_packager package-linux.sh   make_linux_build
register_packager package-deb.sh     make_linux_build
register_packager package-windows.sh make_windows_build
register_packager package-macos.sh   make_macos_build
register_packager package-android.sh make_android_build

# --- coverage floor ----------------------------------------------------------
#
# A broken loop covering zero packagers would otherwise report a green case, and
# so would a new packager that nobody registered. The second check is the one
# that matters over time: it compares the table against what is actually on
# disk, so tools/package-freebsd.sh cannot appear ungated.

MINIMUM_PACKAGERS=6

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 3))
if [ "${#PACKAGER[@]}" -lt "$MINIMUM_PACKAGERS" ]; then
    harness::fail "table covers ${#PACKAGER[@]} packager(s), below the floor of $MINIMUM_PACKAGERS"
fi
if [ "${#BUILDER[@]}" != "${#PACKAGER[@]}" ]; then
    harness::fail "table arrays disagree: ${#PACKAGER[@]} packagers, ${#BUILDER[@]} builders"
fi

ON_DISK=()
for candidate in "$ASTRO_ROOT"/tools/package-*.sh; do
    ON_DISK+=("$(basename "$candidate")")
done
COVERED="$(printf '%s\n' "${PACKAGER[@]}" | sort)"
PRESENT="$(printf '%s\n' "${ON_DISK[@]}" | sort)"
if [ "$COVERED" != "$PRESENT" ]; then
    harness::fail "$(printf 'the table and tools/package-*.sh disagree.\ncovered:\n%s\non disk:\n%s\n' \
        "$COVERED" "$PRESENT")"
fi

printf 'Packagers under test: %s\n' "${#PACKAGER[@]}"

# ==========================================================================
# The runs
# ==========================================================================

RUNS=0

run_packager() {
    local script="$1" build_dir="$2" override="$3"
    rm -rf "$ROOT/releases"
    RUNS=$((RUNS + 1))
    harness::run env \
        PATH="$STUB_BIN:$PATH" \
        ASTRO_ALLOW_OVERLAYLESS_PACKAGE="$override" \
        "$ROOT/tools/$script" "$build_dir"
}

for index in "${!PACKAGER[@]}"; do
    script="${PACKAGER[$index]}"
    builder="${BUILDER[$index]}"
    build="$tmp/build-${script%.sh}"

    # --- present: may be named after the product ----------------------------
    "$builder" "$build" "$OVERLAY_TEXT"
    run_packager "$script" "$build" 0
    harness::assert_status 0 "$script with the overlay present"
    harness::assert_output_contains "overlay present" "$script reports the verdict"
    assert_named_astro "$ROOT/releases" "$script with the overlay present"
    assert_provenance_class "$ROOT/releases" "astro-release" \
        "$script with the overlay present"

    # --- absent: refuses, and produces nothing ------------------------------
    "$builder" "$build" "$CONTROL_TEXT"
    run_packager "$script" "$build" 0
    harness::assert_nonzero_status "$script with the overlay absent"
    harness::assert_output_contains "Refusing to package a build with no Astro overlay" \
        "$script refuses for the right reason"
    assert_nothing_produced "$ROOT/releases" "$script with the overlay absent"

    # --- unmeasurable: refuses, and produces nothing ------------------------
    "$builder" "$build" "$MUTE_TEXT"
    run_packager "$script" "$build" 0
    harness::assert_nonzero_status "$script with an unmeasurable binary"
    harness::assert_output_contains "Cannot determine whether the overlay is present" \
        "$script refuses for the right reason"
    harness::assert_output_lacks "no Astro overlay" \
        "$script must not claim absence it did not measure"
    assert_nothing_produced "$ROOT/releases" "$script with an unmeasurable binary"

    # --- absent + override: validation artifact only ------------------------
    "$builder" "$build" "$CONTROL_TEXT"
    run_packager "$script" "$build" 1
    harness::assert_status 0 "$script overriding a measured absence"
    harness::assert_output_contains "override:overlayless-package" \
        "$script records the override as a structured warning"
    assert_named_validation_only "$ROOT/releases" "$script overriding a measured absence"
    assert_provenance_class "$ROOT/releases" "pipeline-validation" \
        "$script overriding a measured absence"

    # --- unmeasurable + override: STILL refuses -----------------------------
    #
    # The override says "I know this build has no overlay, package it anyway".
    # It cannot say "I do not know what this build has, package it anyway".
    "$builder" "$build" "$MUTE_TEXT"
    run_packager "$script" "$build" 1
    harness::assert_nonzero_status "$script overriding an unmeasurable binary"
    harness::assert_output_contains "Cannot determine whether the overlay is present" \
        "$script refuses despite the override"
    assert_nothing_produced "$ROOT/releases" "$script overriding an unmeasurable binary"
done

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
EXPECTED_RUNS=$(( ${#PACKAGER[@]} * 5 ))
if [ "$RUNS" -ne "$EXPECTED_RUNS" ]; then
    harness::fail "ran $RUNS packager invocations, expected $EXPECTED_RUNS"
fi

harness::pass
