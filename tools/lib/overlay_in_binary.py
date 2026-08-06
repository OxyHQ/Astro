#!/usr/bin/env python3
"""Decide whether a built artifact actually contains the Astro overlay.

`tools/package-release.sh` produced `astro-0.1.0-linux-x64.tar.gz` from a binary
with no Oxy Identity, no Alia, no ad blocker and none of the five WebUI
controllers, and said nothing. The only hint was one optional-member warning
(`adblock_resources/ not present`), which is downgraded to a warning by design.
An artefact named after the product but not containing it is the single most
misleading thing this pipeline can emit — see
`docs/astro-next/baseline/findings.md`, finding 1.

The check is a string scan for the WebUI hosts the overlay registers. It is
deliberately NOT vacuity-blind: a control marker that must be present in any
Chromium binary is scanned for too, and its absence is reported as
`unmeasurable` rather than as `absent`. Without that, a wrong path, a stripped
binary or a broken scan all read as "the overlay is missing", which is the same
answer as the real defect and therefore useless.

Exit status:
    0   overlay present
    1   overlay absent (the artifact is Chromium plus the patch base)
    2   the scan could not measure anything — the control marker is missing too

Any OTHER status is a crash, and a caller must treat it as `unmeasurable`, never
as `absent`. This is not hypothetical: scanning a real 118 MB `mini_installer.exe`
here died on SIGSEGV (exit 139) once in four attempts, under concurrent load,
and never again. `tools/lib/overlay-gate.sh` is the shared caller that gets this
right.

Scanning modes, one per artifact shape. Each was chosen against a real artifact
or a faithful fixture; the reasoning is at each call site.

    --binary PATH   scan a whole file. Repeatable.
    --bundle PATH   walk a macOS .app and scan only files carrying a Mach-O
                    magic number. A bundle also holds the WebUI resources,
                    whose HTML can contain `astro-ntp` with no overlay compiled
                    in anywhere; restricting to Mach-O images means only CODE
                    can answer the question.
    --zip PATH      scan members of a zip (an APK is a zip). --zip-member-glob
                    restricts which, for the same reason: an APK's resources
                    are not its code.

The format-agnostic claim is measured, not assumed: the ASCII scan finds the
markers in a real ELF (`releases/astro-browser_0.1.0_amd64.deb` payload) and a
real PE (`chrome.dll` from `astro-0.1.0-windows-arm64-portable.zip`) with no
per-format handling. UTF-16LE is scanned as well because a PE may hold a wide
string literal the byte-oriented ASCII scan cannot see; on that real chrome.dll
`chrome://version` occurs once in UTF-16LE and the overlay markers zero times,
so ASCII alone was sufficient there — but a scan that can only be wrong in the
direction of a false `absent` is worth widening.

Usage:
    overlay_in_binary.py --binary out/Release/chrome
    overlay_in_binary.py --binary out/Release/chrome.dll --binary out/Release/chrome.exe
    overlay_in_binary.py --bundle out/Release/Chromium.app
    overlay_in_binary.py --zip out/Release/apks/ChromePublic.apk --zip-member-glob '*.so'
"""

from __future__ import annotations

import argparse
import fnmatch
import pathlib
import re
import sys
import zipfile

# WebUI hosts registered by src/chrome/browser/oxy/webui/. If the overlay is
# compiled in, these are in the binary; if it is not, none of them can be.
OVERLAY_MARKERS = ("astro-ntp", "astro-error", "chrome://alia")

# Present in every Chromium binary ever built. Its absence means the scan is
# not reading what it thinks it is reading.
CONTROL_MARKER = "chrome://version"

# `strings(1)` without the subprocess: same rule (runs of >=4 printable bytes).
PRINTABLE = re.compile(rb"[\x20-\x7e]{4,}")

CHUNK_BYTES = 8 << 20

# Mach-O images, both endiannesses and both widths, plus the fat/universal
# header. A macOS bundle is walked for these and nothing else.
MACHO_MAGICS = (
    b"\xfe\xed\xfa\xce",  # 32-bit, big endian
    b"\xce\xfa\xed\xfe",  # 32-bit, little endian
    b"\xfe\xed\xfa\xcf",  # 64-bit, big endian
    b"\xcf\xfa\xed\xfe",  # 64-bit, little endian
    b"\xca\xfe\xba\xbe",  # universal
    b"\xbe\xba\xfe\xca",  # universal, byte-swapped
)


def _encodings(needles: tuple[str, ...]) -> list[tuple[str, str, bytes]]:
    """(marker, encoding, raw bytes) for every marker in every encoding."""
    encoded: list[tuple[str, str, bytes]] = []
    for needle in needles:
        encoded.append((needle, "ascii", needle.encode("ascii")))
        encoded.append((needle, "utf-16le", needle.encode("utf-16-le")))
    return encoded


def scan_stream(handle, needles: tuple[str, ...]) -> dict[str, int]:
    """Count occurrences of each marker in a readable binary stream.

    The counts are evidence for a verdict, not an exact census: a marker lying
    across a read boundary is counted in both windows. Presence and absence —
    the only two things the verdict turns on — are unaffected, and a marker
    straddling the boundary is found rather than missed, which is the property
    that matters on a 465 MB binary where every marker sits near some boundary.
    """
    encoded = _encodings(needles)
    counts = {needle: 0 for needle in needles}
    overlap = max(len(raw) for _needle, _encoding, raw in encoded)
    tail = b""
    while chunk := handle.read(CHUNK_BYTES):
        window = tail + chunk
        # UTF-16LE runs against the raw window: the interleaved NUL bytes are
        # not printable, so the printable-run filter below can never see them.
        for needle, encoding, raw in encoded:
            if encoding == "utf-16le":
                counts[needle] += window.count(raw)
        for run in PRINTABLE.findall(window):
            for needle, encoding, raw in encoded:
                if encoding == "ascii":
                    counts[needle] += run.count(raw)
        tail = window[-overlap:]
    return counts


class Report:
    """What was scanned, what was found, and what could not be read."""

    def __init__(self) -> None:
        self.counts: dict[str, int] = {
            needle: 0 for needle in OVERLAY_MARKERS + (CONTROL_MARKER,)
        }
        self.scanned: list[str] = []
        self.problems: list[str] = []
        self.evidence: list[str] = []

    def merge(self, label: str, counts: dict[str, int]) -> None:
        self.scanned.append(label)
        for needle, count in counts.items():
            self.counts[needle] += count
        found = {m: counts[m] for m in OVERLAY_MARKERS if counts[m]}
        if found:
            detail = ", ".join(f"{m} x{n}" for m, n in sorted(found.items()))
            self.evidence.append(f"{label}: {detail}")


def scan_file(path: pathlib.Path, report: Report) -> None:
    if not path.is_file():
        report.problems.append(f"no such binary: {path}")
        return
    with path.open("rb") as handle:
        report.merge(str(path), scan_stream(handle, OVERLAY_MARKERS + (CONTROL_MARKER,)))


def scan_bundle(path: pathlib.Path, report: Report) -> None:
    """Scan every Mach-O image inside a macOS .app bundle.

    A bundle's executable code is not at a fixed path: the file under
    Contents/MacOS/ is a launcher stub, and the browser itself lives in
    Contents/Frameworks/<name>.framework/Versions/<v>/<name>. Measured on the
    Windows equivalent of that split, the stub carries NEITHER marker — real
    `chrome.exe` from a shipped Astro artifact reports `unmeasurable`, while the
    `chrome.dll` beside it reports `present`. Naming one file would therefore
    have produced a permanent false refusal on some platform. Walking for
    Mach-O magic finds the code wherever it is, and cannot be answered by a
    resource file the packager copied in.
    """
    if not path.is_dir():
        report.problems.append(f"no such bundle: {path}")
        return
    images = 0
    for candidate in sorted(path.rglob("*")):
        if not candidate.is_file() or candidate.is_symlink():
            continue
        with candidate.open("rb") as handle:
            if handle.read(4) not in MACHO_MAGICS:
                continue
            handle.seek(0)
            report.merge(
                str(candidate),
                scan_stream(handle, OVERLAY_MARKERS + (CONTROL_MARKER,)),
            )
            images += 1
    if images == 0:
        report.problems.append(f"no Mach-O image found in bundle: {path}")


def scan_zip(path: pathlib.Path, globs: list[str], report: Report) -> None:
    if not path.is_file():
        report.problems.append(f"no such archive: {path}")
        return
    try:
        archive = zipfile.ZipFile(path)
    except (zipfile.BadZipFile, OSError) as error:
        report.problems.append(f"not a readable zip archive: {path} ({error})")
        return
    with archive:
        members = 0
        for info in archive.infolist():
            if info.is_dir():
                continue
            if globs and not any(fnmatch.fnmatch(info.filename, g) for g in globs):
                continue
            with archive.open(info) as handle:
                report.merge(
                    f"{path}!{info.filename}",
                    scan_stream(handle, OVERLAY_MARKERS + (CONTROL_MARKER,)),
                )
            members += 1
        if members == 0:
            wanted = " or ".join(globs) if globs else "any member"
            report.problems.append(f"no member matching {wanted} in archive: {path}")


def main(argv: list[str]) -> int:
    """Wrapper. `verdict` does the work; this guarantees the exit STATUS.

    An unhandled exception exits 1, and 1 is the `absent` verdict — so a
    crashed scan would tell a packager, in the packager's own words, that the
    overlay is genuinely not compiled in. Observed here, not theorised: two
    unreproducible failures on real 118 MB and 464 MB artifacts within minutes,
    a SIGSEGV and a `TypeError` naming a type the code cannot construct, both
    while other builds were running on the machine. Exit 1 must be reachable
    only from a measurement that succeeded and said no.
    """
    try:
        return verdict(argv)
    except Exception as error:  # noqa: BLE001 - the point is that ANY fault is unmeasurable
        print(f"      the scan itself failed: {type(error).__name__}: {error}")
        print("      Nothing was measured, so the overlay's presence is unknown.")
        return 2


def verdict(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", action="append", default=[], type=pathlib.Path,
                        help="a file to scan whole; repeatable")
    parser.add_argument("--bundle", action="append", default=[], type=pathlib.Path,
                        help="a macOS .app to walk for Mach-O images; repeatable")
    parser.add_argument("--zip", action="append", default=[], dest="archives",
                        type=pathlib.Path, help="a zip/APK to scan; repeatable")
    parser.add_argument("--zip-member-glob", action="append", default=[],
                        dest="zip_globs", metavar="GLOB",
                        help="restrict --zip to matching members; repeatable")
    args = parser.parse_args(argv[1:])

    if not (args.binary or args.bundle or args.archives):
        print("      nothing to scan: pass --binary, --bundle or --zip.")
        return 2

    report = Report()
    for path in args.binary:
        scan_file(path, report)
    for path in args.bundle:
        scan_bundle(path, report)
    for path in args.archives:
        scan_zip(path, args.zip_globs, report)

    for problem in report.problems:
        print(f"      {problem}")

    label = report.scanned[0] if len(report.scanned) == 1 else \
        f"the {len(report.scanned)} artifact(s) scanned"
    control = report.counts[CONTROL_MARKER]
    found = {m: report.counts[m] for m in OVERLAY_MARKERS if report.counts[m]}

    if found:
        detail = ", ".join(f"{m} x{n}" for m, n in sorted(found.items()))
        print(f"      Astro overlay present ({detail}).")
        for line in report.evidence:
            print(f"      evidence: {line}")
        return 0

    if not control:
        print(f"      the control marker {CONTROL_MARKER!r} is absent from {label}.")
        print("      Every Chromium binary contains it, so this scan measured nothing —")
        print("      wrong path, unexpected format, or a broken read. Reporting the")
        print("      overlay as absent on this evidence would be a guess.")
        if report.scanned:
            print(f"      scanned: {', '.join(report.scanned[:8])}")
        return 2

    name = pathlib.Path(report.scanned[0]).name if len(report.scanned) == 1 else label
    print(f"      Astro overlay ABSENT from {name}.")
    print(f"      None of {', '.join(OVERLAY_MARKERS)} occur in it, while the control")
    print(f"      marker {CONTROL_MARKER!r} occurs {control} time(s) — so the scan works")
    print("      and the overlay genuinely is not compiled in. This artifact is Chromium")
    print("      plus the legacy patch base: no Oxy Identity, no Alia, no ad blocker,")
    print("      none of the five WebUI controllers. See findings.md, finding 1.")
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
