#!/usr/bin/env python3
import argparse
import email.utils
import re
import sys
import xml.etree.ElementTree as ET

SPARKLE = "http://www.andymatuschak.org/xml-namespaces/sparkle"
KEEP_PER_CHANNEL = 3
NOTES_PAGE = "https://astro.oxy.so/release-notes"

ET.register_namespace("sparkle", SPARKLE)


def sparkle(name):
    return f"{{{SPARKLE}}}{name}"


def version_key(version):
    bare = version.strip().lstrip("vV").split("+")[0]
    core, _, prerelease = bare.partition("-")
    numbers = [int(part) if part.isdigit() else 0 for part in core.split(".")]
    while numbers and numbers[-1] == 0:
        numbers.pop()
    if not prerelease:
        return (tuple(numbers), (1,))
    identifiers = tuple((0, int(part), "") if part.isdigit() else (1, 0, part) for part in prerelease.split(".") if part)
    return (tuple(numbers), (0, identifiers))


def text_of(item, name):
    element = item.find(sparkle(name))
    return element.text.strip() if element is not None and element.text else None


def windows_enclosure(item):
    for enclosure in item.findall("enclosure"):
        if enclosure.get(sparkle("os")) == "windows":
            return enclosure
    return None


def make_item(args):
    if not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+(-nightly\.[0-9]+)?", args.version):
        sys.exit(f"error: {args.version} isn't a release version")
    if (args.channel == "nightly") != ("-nightly." in args.version):
        sys.exit(f"error: {args.version} doesn't fit the {args.channel} channel")
    if not re.fullmatch(r"[A-Za-z0-9+/]{86}==", args.signature):
        sys.exit("error: the signature isn't a base64 EdDSA signature")
    if not args.url.startswith("https://"):
        sys.exit("error: the installer's URL must be https")
    item = ET.Element("item")
    ET.SubElement(item, "title").text = args.version
    ET.SubElement(item, "pubDate").text = email.utils.formatdate(usegmt=True)
    ET.SubElement(item, sparkle("version")).text = str(args.build)
    ET.SubElement(item, sparkle("shortVersionString")).text = args.version
    if args.channel == "nightly":
        ET.SubElement(item, sparkle("channel")).text = "nightly"
    ET.SubElement(item, sparkle("fullReleaseNotesLink")).text = NOTES_PAGE
    ET.SubElement(
        item,
        "enclosure",
        {
            "url": args.url,
            "length": str(args.length),
            "type": "application/octet-stream",
            sparkle("os"): "windows",
            sparkle("edSignature"): args.signature,
        },
    )
    ET.indent(item, space="    ")
    with open(args.out, "w") as out:
        out.write(ET.tostring(item, encoding="unicode") + "\n")
    print(f"PASS  Windows appcast item for {args.version} (build {args.build}, {args.channel})")


def empty_feed():
    rss = ET.Element("rss", {"version": "2.0"})
    channel = ET.SubElement(rss, "channel")
    ET.SubElement(channel, "title").text = "Astro for Windows"
    ET.SubElement(channel, "link").text = "https://github.com/OxyHQ/Astro"
    return rss


def merge(args):
    item = ET.parse(args.item).getroot()
    version = text_of(item, "shortVersionString")
    build = text_of(item, "version")
    if not version or windows_enclosure(item) is None:
        sys.exit(f"error: {args.item} isn't a Windows appcast item")
    source = open(args.feed).read().strip() if args.feed else ""
    rss = ET.fromstring(source) if source else empty_feed()
    channel = rss.find("channel")
    if rss.tag != "rss" or channel is None:
        sys.exit(f"error: {args.feed} isn't an appcast")
    published = [i for i in channel.findall("item") if windows_enclosure(i) is not None]
    clash = [i for i in published if text_of(i, "version") == build and text_of(i, "shortVersionString") != version]
    if clash:
        sys.exit(f"error: the published Windows feed already has build {build} as another version")
    for old in channel.findall("item"):
        channel.remove(old)
    kept = [item] + [i for i in published if text_of(i, "shortVersionString") != version and text_of(i, "version") != build]
    by_channel = {}
    for entry in kept:
        by_channel.setdefault(text_of(entry, "channel") or "stable", []).append(entry)
    survivors = []
    for entries in by_channel.values():
        entries.sort(key=lambda entry: version_key(text_of(entry, "shortVersionString") or "0"), reverse=True)
        survivors += entries[:KEEP_PER_CHANNEL]
    survivors.sort(key=lambda entry: version_key(text_of(entry, "shortVersionString") or "0"), reverse=True)
    channel.extend(survivors)
    ET.indent(rss, space="    ")
    with open(args.out, "w") as out:
        out.write('<?xml version="1.0" encoding="utf-8"?>\n' + ET.tostring(rss, encoding="unicode") + "\n")
    counts = {}
    for entry in survivors:
        name = text_of(entry, "channel") or "stable"
        counts[name] = counts.get(name, 0) + 1
    summary = ", ".join(f"{n} {c}" for c, n in sorted(counts.items()))
    print(f"PASS  Windows appcast for {version} (build {build}) merged onto {'the published feed' if source else 'a new feed'} ({summary})")


parser = argparse.ArgumentParser(
    description="Builds Astro's Windows update feed (appcast-windows.xml): Sparkle's appcast format, one item per "
    'release with a sparkle:os="windows" enclosure, stable items without a channel and nightlies on "nightly", '
    f"{KEEP_PER_CHANNEL} per channel."
)
commands = parser.add_subparsers(dest="command", required=True)
item_command = commands.add_parser("item", help="write the appcast item for a signed installer")
item_command.add_argument("--version", required=True)
item_command.add_argument("--build", required=True, type=int)
item_command.add_argument("--channel", choices=["stable", "nightly"], default="stable")
item_command.add_argument("--url", required=True)
item_command.add_argument("--length", required=True, type=int)
item_command.add_argument("--signature", required=True)
item_command.add_argument("--out", required=True)
merge_command = commands.add_parser("merge", help="put an item onto a published feed (or a new one)")
merge_command.add_argument("--feed", default="", help="the published appcast-windows.xml; empty for a new feed")
merge_command.add_argument("--item", required=True)
merge_command.add_argument("--out", required=True)
parsed = parser.parse_args()
make_item(parsed) if parsed.command == "item" else merge(parsed)
