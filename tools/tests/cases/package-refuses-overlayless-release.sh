#!/usr/bin/env bash
# An artifact named after the product must contain the product.
#
# tools/package-release.sh produced `astro-0.1.0-linux-x64.tar.gz` from a binary
# with no Oxy Identity, no Alia, no ad blocker and none of the five WebUI
# controllers, reported success, and left it in releases/ beside genuine
# artifacts. The only hint was an optional-member warning about
# `adblock_resources/`, which is a warning by design.
#
# This case is about the DETECTOR and the shared gate: that every artifact shape
# can be measured, and that the answer is three-valued. The companion case
# packagers-refuse-overlayless-artifacts.sh proves the six packagers actually
# behave that way, by running them and reading the filenames they produce.
#
# Every mode is checked in all THREE directions, because "absent" and "the scan
# measured nothing" are different answers and collapsing them would make a wrong
# path indistinguishable from the real defect. Two further directions are
# checked that the original three do not cover:
#
#   * a RESOURCE carrying the marker must not vote. A packaged `astro-ntp`
#     string in an HTML file or an APK asset says nothing about whether the
#     overlay was compiled in, and an overlayless build acquires those files
#     simply by being packaged.
#   * a CRASHED scan must report `unmeasurable`. The detector exits 1 for
#     "absent", which is also what an unhandled Python exception exits, so
#     without a guard a crash speaks with the authority of a measurement.

source "$(dirname "${BASH_SOURCE[0]}")/../lib/harness.sh"
harness::setup

DETECTOR="$ASTRO_ROOT/tools/lib/overlay_in_binary.py"
tmp="$(harness::tmpdir)"

harness::assert_file_exists "$DETECTOR"

# Content standing in for the three states a real binary can be in.
OVERLAY_TEXT='pad chrome://version pad chrome://alia pad astro-ntp pad astro-error pad'
CONTROL_TEXT='pad chrome://version pad chrome://settings pad chrome://history pad'
MUTE_TEXT='nothing relevant in this file at all, four printable chars minimum'

# ==========================================================================
# --binary: a plain file (ELF, PE, anything)
# ==========================================================================

printf '%s' "$OVERLAY_TEXT" > "$tmp/with-overlay.bin"
harness::run python3 "$DETECTOR" --binary "$tmp/with-overlay.bin"
harness::assert_status 0 "a binary carrying the overlay markers"
harness::assert_output_contains "overlay present" "says so"
harness::assert_output_contains "astro-ntp" "names what it found"

# --- absent, and measurably so ----------------------------------------------
# The control marker is present, so a verdict of "absent" is evidence rather
# than a guess. This is the shape of the real overlayless build.
printf '%s' "$CONTROL_TEXT" > "$tmp/no-overlay.bin"
harness::run python3 "$DETECTOR" --binary "$tmp/no-overlay.bin"
harness::assert_status 1 "a Chromium binary without the overlay"
harness::assert_output_contains "overlay ABSENT" "says so"
harness::assert_output_contains "control" "cites the control marker as its warrant"

# --- unmeasurable ------------------------------------------------------------
# Neither marker. Without this branch the detector would answer "absent" here,
# which is the same answer as the real defect and therefore worthless.
printf '%s' "$MUTE_TEXT" > "$tmp/unmeasurable.bin"
harness::run python3 "$DETECTOR" --binary "$tmp/unmeasurable.bin"
harness::assert_status 2 "a binary the scan cannot measure"
harness::assert_output_contains "measured nothing" "distinguishes it from absent"
harness::assert_output_lacks "overlay ABSENT" "must not report absence it cannot support"

harness::run python3 "$DETECTOR" --binary "$tmp/does-not-exist.bin"
harness::assert_status 2 "a binary that is not there"
harness::assert_output_contains "no such binary" "names the problem"

harness::run python3 "$DETECTOR"
harness::assert_status 2 "no probe arguments at all"
harness::assert_output_contains "nothing to scan" "names the problem"

# A marker split across the detector's read boundary must still be found, or the
# verdict depends on where an 8 MiB chunk happens to end — and a real `chrome`
# is 465 MB, so every marker sits near some boundary.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
python3 - "$tmp/boundary.bin" <<'PY'
import sys
# 8 MiB is the detector's chunk size; straddle it with both markers.
chunk = 8 << 20
head = b"chrome://version " + b"x" * (chunk - 25)
with open(sys.argv[1], "wb") as handle:
    handle.write(head + b"astro-ntp" + b"y" * 4096)
PY
harness::run python3 "$DETECTOR" --binary "$tmp/boundary.bin"
harness::assert_status 0 "a marker straddling the read boundary is still found"

# --- UTF-16LE ----------------------------------------------------------------
# A PE may hold a wide string literal the byte-oriented ASCII scan cannot see.
# Measured on the real chrome.dll from releases/astro-0.1.0-windows-arm64-
# portable.zip, `chrome://version` occurs once in UTF-16LE, so this encoding is
# genuinely used by Chromium on Windows and not a hypothetical.
HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
python3 - "$tmp/wide.bin" <<'PY'
import sys
with open(sys.argv[1], "wb") as handle:
    handle.write(b"\x00\x01\x02\x03")
    handle.write("chrome://version".encode("utf-16-le"))
    handle.write(b"\x00\x01\x02\x03")
    handle.write("astro-ntp".encode("utf-16-le"))
PY
harness::run python3 "$DETECTOR" --binary "$tmp/wide.bin"
harness::assert_status 0 "markers stored as UTF-16LE are found"

# --- multiple binaries, aggregated ------------------------------------------
# The Windows probe passes chrome.dll AND chrome.exe, because the real
# chrome.exe is a launcher stub that carries neither marker while the chrome.dll
# beside it carries all of them. Aggregating is what makes that pair answerable;
# naming one file would have produced a permanent false refusal.
harness::run python3 "$DETECTOR" \
    --binary "$tmp/unmeasurable.bin" --binary "$tmp/with-overlay.bin"
harness::assert_status 0 "an unmeasurable stub beside a binary that has the overlay"

harness::run python3 "$DETECTOR" \
    --binary "$tmp/unmeasurable.bin" --binary "$tmp/no-overlay.bin"
harness::assert_status 1 "an unmeasurable stub beside a binary that does not"

harness::run python3 "$DETECTOR" \
    --binary "$tmp/unmeasurable.bin" --binary "$tmp/does-not-exist.bin"
harness::assert_status 2 "two artifacts, neither of which measures anything"

# ==========================================================================
# --bundle: a macOS .app, scanned for Mach-O images only
# ==========================================================================

# 64-bit little-endian Mach-O magic. The detector keys on this and nothing else,
# so a file without it is invisible to the scan however it is named.
write_macho() {
    local path="$1" text="$2"
    mkdir -p "$(dirname "$path")"
    printf '\xcf\xfa\xed\xfe%s' "$text" > "$path"
}

# A faithful bundle: a launcher stub under Contents/MacOS that carries nothing,
# and the real code in the framework. This is the layout that makes naming a
# single path unsafe.
make_bundle() {
    local root="$1" framework_text="$2"
    rm -rf "$root"
    write_macho "$root/Contents/MacOS/Astro" "$MUTE_TEXT"
    write_macho "$root/Contents/Frameworks/Astro Framework.framework/Versions/A/Astro Framework" \
        "$framework_text"
}

make_bundle "$tmp/present.app" "$OVERLAY_TEXT"
harness::run python3 "$DETECTOR" --bundle "$tmp/present.app"
harness::assert_status 0 "a bundle whose framework carries the overlay"
harness::assert_output_contains "Astro Framework" "names the image it found it in"

make_bundle "$tmp/absent.app" "$CONTROL_TEXT"
harness::run python3 "$DETECTOR" --bundle "$tmp/absent.app"
harness::assert_status 1 "a bundle whose framework does not carry the overlay"

# The stub alone: a Mach-O image was found and scanned, but it says nothing.
# This is the macOS analogue of the real chrome.exe result, and it must read as
# unmeasurable rather than as absence.
rm -rf "$tmp/stub-only.app"
write_macho "$tmp/stub-only.app/Contents/MacOS/Astro" "$MUTE_TEXT"
harness::run python3 "$DETECTOR" --bundle "$tmp/stub-only.app"
harness::assert_status 2 "a bundle holding only a launcher stub"
harness::assert_output_lacks "overlay ABSENT" "must not report absence from a stub"

# THE DECOY. package-macos.sh copies the WebUI dist into the bundle, and a
# second run of it finds the first run's copy already there. If a resource file
# could vote, an overlayless build would package itself as Astro on the second
# attempt. The framework says no; the HTML says yes; the answer must be no.
make_bundle "$tmp/decoy.app" "$CONTROL_TEXT"
mkdir -p "$tmp/decoy.app/Contents/Resources/astro-ntp"
printf '<!doctype html><a href="chrome://alia">astro-ntp astro-error</a>\n' \
    > "$tmp/decoy.app/Contents/Resources/astro-ntp/index.html"
harness::run python3 "$DETECTOR" --bundle "$tmp/decoy.app"
harness::assert_status 1 "a resource file carrying the markers does not vote"
harness::assert_output_contains "overlay ABSENT" "the compiled code is what answers"

# A directory with no Mach-O image in it at all measured nothing.
rm -rf "$tmp/empty.app"
mkdir -p "$tmp/empty.app/Contents/Resources"
printf 'astro-ntp chrome://alia astro-error chrome://version\n' \
    > "$tmp/empty.app/Contents/Resources/index.html"
harness::run python3 "$DETECTOR" --bundle "$tmp/empty.app"
harness::assert_status 2 "a bundle with no Mach-O image"
harness::assert_output_contains "no Mach-O image" "names the problem"
harness::assert_output_lacks "overlay present" \
    "a bundle full of matching resources is still not a measurement"

harness::run python3 "$DETECTOR" --bundle "$tmp/no-such-bundle.app"
harness::assert_status 2 "a bundle that is not there"
harness::assert_output_contains "no such bundle" "names the problem"

# ==========================================================================
# --zip: an APK, scanned member by member
# ==========================================================================

# Real zips, written by python's zipfile, with real deflate compression — an
# APK's native libraries are stored either way and the scan must read both.
make_apk() {
    local path="$1" lib_text="$2" asset_text="$3"
    python3 - "$path" "$lib_text" "$asset_text" <<'PY'
import sys
import zipfile

path, lib_text, asset_text = sys.argv[1:4]
with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as archive:
    archive.writestr("AndroidManifest.xml", "binary xml stand-in")
    archive.writestr("classes.dex", "dex stand-in")
    if lib_text:
        archive.writestr("lib/arm64-v8a/libmonochrome.so", lib_text)
    if asset_text:
        archive.writestr("assets/astro-ntp/index.html", asset_text)
PY
}

make_apk "$tmp/present.apk" "$OVERLAY_TEXT" ""
harness::run python3 "$DETECTOR" --zip "$tmp/present.apk" --zip-member-glob '*.so'
harness::assert_status 0 "an APK whose native library carries the overlay"
harness::assert_output_contains "libmonochrome.so" "names the member it found it in"

make_apk "$tmp/absent.apk" "$CONTROL_TEXT" ""
harness::run python3 "$DETECTOR" --zip "$tmp/absent.apk" --zip-member-glob '*.so'
harness::assert_status 1 "an APK whose native library does not"

make_apk "$tmp/mute.apk" "$MUTE_TEXT" ""
harness::run python3 "$DETECTOR" --zip "$tmp/mute.apk" --zip-member-glob '*.so'
harness::assert_status 2 "an APK whose native library says nothing"
harness::assert_output_lacks "overlay ABSENT" "must not report absence it cannot support"

# THE DECOY, again: the packaged WebUI assets carry the markers, the code does
# not. Widening the member filter to `*` until something matches is exactly the
# mistake this asserts against.
make_apk "$tmp/decoy.apk" "$CONTROL_TEXT" \
    '<!doctype html><a href="chrome://alia">astro-ntp astro-error</a>'
harness::run python3 "$DETECTOR" --zip "$tmp/decoy.apk" --zip-member-glob '*.so'
harness::assert_status 1 "an APK asset carrying the markers does not vote"

# ...and the same file scanned WITHOUT the filter shows the decoy is real: the
# assertion above is not passing because the fixture is inert.
harness::run python3 "$DETECTOR" --zip "$tmp/decoy.apk"
harness::assert_status 0 "unfiltered, the decoy asset does answer — which is why the filter exists"

# No member matches: nothing was measured, and the answer is not "absent".
make_apk "$tmp/nolibs.apk" "" "$OVERLAY_TEXT"
harness::run python3 "$DETECTOR" --zip "$tmp/nolibs.apk" --zip-member-glob '*.so'
harness::assert_status 2 "an APK with no native library to scan"
harness::assert_output_contains "no member matching" "names the problem"

harness::run python3 "$DETECTOR" --zip "$tmp/no-such.apk" --zip-member-glob '*.so'
harness::assert_status 2 "an APK that is not there"
harness::assert_output_contains "no such archive" "names the problem"

printf 'this is not a zip file at all\n' > "$tmp/not-a.apk"
harness::run python3 "$DETECTOR" --zip "$tmp/not-a.apk" --zip-member-glob '*.so'
harness::assert_status 2 "a file that is not a zip"
harness::assert_output_contains "not a readable zip archive" "names the problem"

# ==========================================================================
# A crashed scan is unmeasurable, never absent
#
# The detector exits 1 for "absent". An unhandled exception also exits 1, and a
# signal-level death exits 128+n. Both were observed here on real artifacts —
# a SIGSEGV scanning a 118 MB mini_installer.exe and a TypeError naming a type
# the code cannot construct while scanning a 464 MB ELF, neither reproducible.
# Without the guard, a crash tells the packager, in the packager's own words,
# that the overlay is genuinely not compiled in.
#
# A corrupt archive member is the deterministic way to reach that path, and it
# is also a real one: a truncated APK download looks exactly like this.
# ==========================================================================

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
python3 - "$tmp/corrupt.apk" <<'PY'
import pathlib
import sys
import zipfile

path = pathlib.Path(sys.argv[1])
with zipfile.ZipFile(path, "w", zipfile.ZIP_STORED) as archive:
    archive.writestr("lib/arm64-v8a/libmonochrome.so", "x" * 4096)

# Flip bytes in the stored member's payload. The CRC in the header no longer
# matches, so zipfile raises while READING — inside the scan, not while opening
# the archive, which is the path the top-level guard exists for.
raw = bytearray(path.read_bytes())
offset = raw.index(b"xxxx")
raw[offset:offset + 64] = b"y" * 64
path.write_bytes(bytes(raw))
PY

harness::run python3 "$DETECTOR" --zip "$tmp/corrupt.apk" --zip-member-glob '*.so'
harness::assert_status 2 "a scan that crashes is unmeasurable"
harness::assert_output_contains "the scan itself failed" "says the scan failed"
harness::assert_output_lacks "overlay ABSENT" \
    "a crash must never be reported as a measured absence"

# ==========================================================================
# The shared gate consumes it
#
# Every assertion above tests a tool nothing runs, unless this holds. The gate
# lives in astro-common.sh so that six packagers cannot implement it six ways;
# the behaviour of those six is proved by running them, in
# packagers-refuse-overlayless-artifacts.sh.
# ==========================================================================

HARNESS_ASSERTIONS=$((HARNESS_ASSERTIONS + 1))
python3 - "$ASTRO_ROOT/tools/lib/astro-common.sh" <<'PY' || exit 1
import pathlib
import sys

text = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")

assert "astro::require_astro_overlay()" in text, "the shared gate does not exist"
assert "tools/lib/overlay_in_binary.py" in text, "the gate does not run the detector"
# Refusal is the default; the override must be explicit and must rename.
assert "ASTRO_ALLOW_OVERLAYLESS_PACKAGE" in text, "no explicit override exists"
assert "NO-ASTRO-OVERLAY" in text, "the overridden artifact is not renamed"
assert "pipeline-validation" in text, "the overridden artifact is not marked"
# Unmeasurable must not be treated as permission to proceed, and neither must a
# status the detector never deliberately returns.
assert text.count("Cannot determine whether the overlay is present") == 2, (
    "the unmeasurable verdict and the crashed-scan verdict must BOTH refuse; "
    "expected that sentence in both arms of the case statement"
)
PY

harness::pass
