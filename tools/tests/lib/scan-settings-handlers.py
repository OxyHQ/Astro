#!/usr/bin/env python3
"""scan-settings-handlers.py — does every chrome.send reach a handler that is installed?

`chrome.send('resetPinnedToolbarActions')` from a page whose controller never
installed AppearanceHandler does not throw, does not log, and does not fail the
build. `WebUIImpl::ProcessWebUIMessage` looks the name up, finds nothing, and
reaches DUMP_WILL_BE_NOTREACHED — fatal in a DCHECK build, and in the release
build users get, a silent no-op. The button depresses and nothing happens.

Four of astro://settings' sections shipped like that. Nothing could have caught
it: tsc sees a string, the dev fixtures answer every message themselves (that
is what they are for), and a browser run only finds the buttons somebody
thought to press.

So the join is done here, over committed source alone — no build, no
node_modules, no Chromium checkout:

    what the app SENDS          src/pages/settings/**  (send/sendWithPromise)
    what the app LISTENS for    src/pages/settings/**  (addWebUIListener)
    what a handler SERVES       webui/app/settings-handler-messages.json
    what is INSTALLED           astro_settings_ui.cc   (AddMessageHandler)

and it is strict in both directions. A message with no installed handler is the
defect this exists for. A handler declared in the manifest but not installed is
the same defect one step earlier — the manifest would be vouching for messages
nothing serves. A handler installed but not declared means the manifest has
stopped describing the page, so it can no longer be trusted for the first two.

Exit status:
  0  every message and event the app uses is served by an installed handler
  1  one is not, or the manifest and the controller disagree
  2  the scan itself is broken (below a vacuity floor); nothing was measured
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys

# Floors. Each is a different way this can measure nothing and read as clean:
# the app not parsed (no messages found), or the manifest not parsed (nothing
# to check against).
#
# There is deliberately NO floor on how many handlers the controller installs.
# Four is what it installed while this defect was live, and a floor above that
# would have turned the one run that could report the defect into "the scan is
# broken" — a check that fails loudest exactly when it is needed is no better
# than one that passes. The controller's own vacuity check is a different
# question, asked below: does the parse account for every AddMessageHandler
# call in the file? That distinguishes "few handlers" from "the regex stopped
# matching", which a count never can.
DEFAULT_MIN_MESSAGES = 25
DEFAULT_MIN_EVENTS = 8
DEFAULT_MIN_DECLARED = 100

# `send('x', ...)`, `sendWithPromise<T>('x', ...)`. The generic argument is
# optional and the message is always the first argument and always a literal:
# a computed message would be unscannable, and there is none (a floor below
# would drop if one appeared and displaced a literal).
SEND_CALL = re.compile(r"\b(send|sendWithPromise)\s*(?:<[^<>()]*>)?\s*\(\s*'([^']+)'")
LISTEN_CALL = re.compile(r"\baddWebUIListener\s*\(\s*'([^']+)'")

# Every handler the controller installs, whoever owns it. The namespace is
# captured rather than required: an Astro-owned handler is not a defect, it is
# simply not something the manifest can vouch for, and the two have to be told
# apart rather than one of them going unseen.
INSTALLED = re.compile(
    r"AddMessageHandler\s*\(\s*std::make_unique<\s*((?:::)?[A-Za-z_][A-Za-z0-9_:]*)\s*>",
    re.S,
)
ADD_HANDLER = re.compile(r"AddMessageHandler\s*\(")
SETTINGS_HANDLER = re.compile(r"^::settings::([A-Za-z_][A-Za-z0-9_]*)$")


def strip_ts_comments(source: str) -> str:
    """The source with every comment blanked, offsets and line count preserved.

    A character scanner, not a regex, and for a reason this file makes acute:
    every section documents the handler it calls in prose, quoting the message
    names as it goes. `downloads.tsx` names `selectDownloadLocation` in its
    header comment; `default-browser.tsx` lists all three of its messages in a
    table. A scanner that read comments would report messages the app does not
    send, and — worse — would keep reporting them after the call was deleted.
    """
    out: list[str] = []
    index = 0
    length = len(source)

    while index < length:
        char = source[index]

        if char == "/" and index + 1 < length:
            following = source[index + 1]
            if following == "/":
                while index < length and source[index] != "\n":
                    out.append(" ")
                    index += 1
                continue
            if following == "*":
                while index < length and not (
                    source[index] == "*" and index + 1 < length and source[index + 1] == "/"
                ):
                    out.append("\n" if source[index] == "\n" else " ")
                    index += 1
                out.append("  ")
                index += 2
                continue

        if char in "'\"`":
            quote = char
            out.append(char)
            index += 1
            while index < length:
                current = source[index]
                out.append(current)
                if current == "\\" and index + 1 < length:
                    out.append(source[index + 1])
                    index += 2
                    continue
                index += 1
                if current == quote:
                    break
            continue

        out.append(char)
        index += 1

    return "".join(out)


def strip_cc_comments(source: str) -> str:
    """Same, for C++. The controller's own comment block names handlers too."""
    return strip_ts_comments(source)


class Use:
    """One call site, kept with its location so a finding can name it."""

    __slots__ = ("name", "path", "line", "kind")

    def __init__(self, name: str, path: str, line: int, kind: str) -> None:
        self.name = name
        self.path = path
        self.line = line
        self.kind = kind

    def where(self) -> str:
        return f"{self.path}:{self.line}"


def scan_app(app_dir: str) -> tuple[list[Use], list[Use], int]:
    """Every message sent and every event listened for, with locations."""
    sends: list[Use] = []
    listens: list[Use] = []
    files = 0

    for root, _dirs, names in os.walk(app_dir):
        for name in sorted(names):
            if not name.endswith((".ts", ".tsx")):
                continue
            # The dev fixtures are the mock's ANSWERS, not the app's calls. A
            # fixture names every message its section sends, so counting them
            # would make the check pass on the fixture's word rather than the
            # section's — exactly backwards.
            if name.endswith(".fixtures.ts"):
                continue
            path = os.path.join(root, name)
            with open(path, encoding="utf-8") as handle:
                source = strip_ts_comments(handle.read())
            files += 1
            relative = os.path.relpath(path, app_dir)
            for match in SEND_CALL.finditer(source):
                line = source.count("\n", 0, match.start()) + 1
                sends.append(Use(match.group(2), relative, line, match.group(1)))
            for match in LISTEN_CALL.finditer(source):
                line = source.count("\n", 0, match.start()) + 1
                listens.append(Use(match.group(1), relative, line, "addWebUIListener"))

    return sends, listens, files


def scan_controller(path: str) -> tuple[list[str], list[str], int]:
    """What the controller installs: upstream handlers, others, and call count.

    The third value is the vacuity denominator. Every `AddMessageHandler(` in
    the file should have been parsed into one of the first two lists; a
    shortfall means the construction is no longer spelled the way this reads
    it, and the caller turns that into "nothing was measured" rather than into
    a shorter list nobody notices.
    """
    with open(path, encoding="utf-8") as handle:
        source = strip_cc_comments(handle.read())

    upstream: list[str] = []
    other: list[str] = []
    for qualified in INSTALLED.findall(source):
        match = SETTINGS_HANDLER.match(qualified)
        if match:
            upstream.append(match.group(1))
        else:
            other.append(qualified)

    return upstream, other, len(ADD_HANDLER.findall(source))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--app-dir", required=True,
                        help="webui/app/src/pages/settings, or a copy of it")
    parser.add_argument("--controller", required=True,
                        help="the AstroSettingsUI translation unit")
    parser.add_argument("--manifest", required=True,
                        help="webui/app/settings-handler-messages.json")
    parser.add_argument("--min-messages", type=int, default=DEFAULT_MIN_MESSAGES)
    parser.add_argument("--min-events", type=int, default=DEFAULT_MIN_EVENTS)
    parser.add_argument("--min-declared", type=int, default=DEFAULT_MIN_DECLARED)
    args = parser.parse_args()

    # --- The manifest --------------------------------------------------------
    try:
        with open(args.manifest, encoding="utf-8") as handle:
            manifest = json.load(handle)
    except (OSError, ValueError) as error:
        print(f"Settings handlers: the manifest could not be read: {error}",
              file=sys.stderr)
        return 2

    declared = manifest.get("handlers")
    if not isinstance(declared, dict) or not declared:
        print(f"Settings handlers: {os.path.basename(args.manifest)} declares no\n"
              f"  handlers. Nothing can be checked against it.", file=sys.stderr)
        return 2

    served_by: dict[str, str] = {}
    fired_by: dict[str, str] = {}
    for handler in sorted(declared):
        entry = declared[handler]
        if not isinstance(entry, dict):
            print(f"Settings handlers: {handler} is not an object.", file=sys.stderr)
            return 2
        for message in entry.get("messages", []):
            served_by.setdefault(message, handler)
        for event in entry.get("events", []):
            fired_by.setdefault(event, handler)

    if len(served_by) < args.min_declared:
        print(f"Settings handlers: the manifest yielded {len(served_by)} message(s),\n"
              f"  below the floor of {args.min_declared}. It has been truncated, or its\n"
              f"  shape changed and the messages are no longer being read.",
              file=sys.stderr)
        return 2

    # --- The controller ------------------------------------------------------
    try:
        installed_list, other_handlers, add_calls = scan_controller(args.controller)
    except OSError as error:
        print(f"Settings handlers: the controller could not be read: {error}",
              file=sys.stderr)
        return 2

    parsed = len(installed_list) + len(other_handlers)
    if add_calls == 0:
        print(f"Settings handlers: {os.path.basename(args.controller)} installs no\n"
              f"  handlers at all. Either it is the wrong file, or AddMessageHandler is\n"
              f"  no longer how a handler is installed and nothing is being measured.",
              file=sys.stderr)
        return 2
    if parsed != add_calls:
        print(f"Settings handlers: {os.path.basename(args.controller)} makes "
              f"{add_calls} AddMessageHandler\n"
              f"  call(s) and only {parsed} could be read. The rest are installed and\n"
              f"  invisible to this check, which would then pass on a page it had only\n"
              f"  partly seen.", file=sys.stderr)
        return 2

    installed = set(installed_list)

    # --- The app -------------------------------------------------------------
    sends, listens, files = scan_app(args.app_dir)
    if len(sends) < args.min_messages:
        print(f"Settings handlers: {len(sends)} send call(s) found across {files}\n"
              f"  file(s), below the floor of {args.min_messages}. The app source was not\n"
              f"  read, or send/sendWithPromise is no longer how a handler is called.",
              file=sys.stderr)
        return 2
    if len(listens) < args.min_events:
        print(f"Settings handlers: {len(listens)} addWebUIListener call(s) found,\n"
              f"  below the floor of {args.min_events}. Push updates have stopped being\n"
              f"  measured while the send scan still passes.", file=sys.stderr)
        return 2

    problems: list[str] = []

    # --- Manifest and controller must describe the same page -----------------
    for handler in sorted(installed - set(declared)):
        problems.append(
            f"  {handler}: installed by the controller, undeclared by the manifest.\n"
            f"    {os.path.basename(args.controller)} installs it and\n"
            f"    {os.path.basename(args.manifest)} does not describe it, so the manifest\n"
            f"    has stopped describing this page and cannot be trusted for anything\n"
            f"    else here.")
    for handler in sorted(set(declared) - installed):
        problems.append(
            f"  {handler}: declared by the manifest, not installed by the controller.\n"
            f"    {os.path.basename(args.manifest)} says it serves\n"
            f"    {len(declared[handler].get('messages', []))} message(s), and\n"
            f"    {os.path.basename(args.controller)} never installs it, so every one of\n"
            f"    them is a silent no-op. The declaration is vouching for calls nothing\n"
            f"    answers.")

    # An installed handler registers everything in its manifest entry, so the
    # answer to "is this message served" is the union over installed handlers.
    live_messages = {
        message for handler in installed & set(declared)
        for message in declared[handler].get("messages", [])
    }
    live_events = {
        event for handler in installed & set(declared)
        for event in declared[handler].get("events", [])
    }

    # --- The join ------------------------------------------------------------
    for use in sorted(sends, key=lambda item: (item.name, item.path, item.line)):
        if use.name in live_messages:
            continue
        owner = served_by.get(use.name)
        if owner:
            detail = (f"    {owner} registers it. The controller\n"
                      f"    ({os.path.basename(args.controller)}) does not install {owner}.")
        else:
            detail = ("    No handler in the manifest registers it. Either the name is\n"
                      "    misspelled, or the handler that serves it has never been\n"
                      "    declared.")
        problems.append(
            f"  {use.name}: {use.kind} from {use.where()} reaches no installed handler.\n"
            f"{detail}\n"
            f"    In a release build this call is a silent no-op: the control draws and\n"
            f"    does nothing.")

    for use in sorted(listens, key=lambda item: (item.name, item.path, item.line)):
        if use.name in live_events:
            continue
        owner = fired_by.get(use.name)
        if owner:
            detail = (f"    {owner} fires it. The controller\n"
                      f"    ({os.path.basename(args.controller)}) does not install {owner}.")
        else:
            detail = ("    No handler in the manifest fires it. Either the name is\n"
                      "    misspelled, or the handler that pushes it has never been\n"
                      "    declared.")
        problems.append(
            f"  {use.name}: addWebUIListener at {use.where()} subscribes to an event no\n"
            f"    installed handler pushes.\n"
            f"{detail}\n"
            f"    The subscription simply never fires; the row stays on its pending or\n"
            f"    empty state forever.")

    if problems:
        print(f"Settings handlers: {len(problems)} call(s) reach nothing.\n",
              file=sys.stderr)
        for problem in problems:
            print(problem, file=sys.stderr)
        print(f"\nMeasured across {files} source file(s): {len(sends)} send(s), "
              f"{len(listens)} listener(s),\n"
              f"  against {len(installed)} installed handler(s) serving "
              f"{len(live_messages)} message(s).", file=sys.stderr)
        return 1

    print(f"Every settings chrome.send reaches an installed handler: "
          f"{len(sends)} send(s) and\n"
          f"  {len(listens)} listener(s) across {files} source file(s), served by "
          f"{len(installed)} handler(s)\n"
          f"  registering {len(live_messages)} message(s) and {len(live_events)} event(s).")
    if other_handlers:
        print(f"  {len(other_handlers)} handler(s) outside ::settings:: are installed and "
              f"not\n  described by the manifest: {', '.join(sorted(other_handlers))}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
