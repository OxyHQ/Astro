#!/usr/bin/env python3
"""Navigate a real browser via CDP and report what ACTUALLY loaded.

Why this exists, and why the obvious alternative is banned.

`chrome --headless=new --dump-dom <url>` does NOT navigate to <url> in this
configuration. Measured: `chrome://version/` and `astro://test/` produce
byte-identical output, and instrumentation inside the browser shows the
navigation stack only ever seeing `chrome://headless/headless_command.html` and
`chrome://new-tab-page-third-party/`. Neither requested URL is ever navigated
to. Several hours of conclusions were drawn from that harness before a control
— a URL known to work — exposed it, and every one of them was about the harness
rather than the product.

So this tool reports REQUESTED and COMMITTED separately, always. Conflating them
is the specific error that made the old harness look like it worked: the DOM it
returned was real, it just belonged to a different URL than the one asked for.

Usage:
    cdp-navigate.py --binary PATH --url URL [--url URL ...] [--marker TEXT]

Exit status is 0 when every navigation was performed and measured; it says
nothing about whether the URLs loaded what you wanted. Read the report.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

import websockets


def free_port() -> int:
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return probe.getsockname()[1]


def wait_for_devtools(port: int, timeout: float = 30.0) -> str:
    """Block until the DevTools endpoint answers, or fail saying so.

    A timeout here is a REFUSAL, not a skip: a harness that proceeds without a
    browser measures nothing, which is how the previous one produced confident
    readings about a navigation that never happened.
    """
    deadline = time.monotonic() + timeout
    last_error = "no attempt made"
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(
                f"http://127.0.0.1:{port}/json/version", timeout=1
            ) as response:
                return json.load(response).get("webSocketDebuggerUrl", "")
        except (urllib.error.URLError, OSError, json.JSONDecodeError) as error:
            last_error = str(error)
            time.sleep(0.2)
    raise SystemExit(
        f"ERROR DevTools never answered on port {port} within {timeout}s: {last_error}\n"
        f"      The browser did not start, or started without the debugging port.\n"
        f"      Nothing was measured; this is a failure, not an empty result."
    )


class Session:
    """One CDP websocket, with monotonic message ids."""

    def __init__(self, socket_) -> None:
        self._socket = socket_
        self._next_id = 0
        # CDP events arrive interleaved with call replies. They used to be read
        # and thrown away, which is why a page that loaded but logged a refused
        # resource measured as clean: the DOM was there, the title was right,
        # and the browser's complaint went in the bin.
        #
        # Console output is the ONLY signal for a whole class of defect here --
        # a blocked script or stylesheet does not crash, does not fail the
        # build, and still renders a page. It has to be collected, not skipped.
        self.events: list[dict] = []

    async def call(
        self, method: str, params: dict | None = None, timeout: float = 20.0
    ) -> dict:
        """Issue one CDP call, and REFUSE to wait forever for the answer.

        Without the timeout a single unanswered call blocks the whole run: the
        process is killed from outside, nothing is printed, and every URL
        already measured is lost along with the one that hung. Measured here --
        an eight-URL run died at the outer timeout having reported nothing at
        all, which is strictly less useful than reporting seven results and one
        timeout.

        A timeout is recorded as a RESULT, not raised, so the run continues and
        the report says which call stopped answering.
        """
        self._next_id += 1
        message_id = self._next_id
        await self._socket.send(
            json.dumps({"id": message_id, "method": method, "params": params or {}})
        )

        async def await_reply() -> dict:
            while True:
                message = json.loads(await self._socket.recv())
                if message.get("id") == message_id:
                    if "error" in message:
                        return {"__error__": message["error"]}
                    return message.get("result", {})
                if "method" in message:
                    self.events.append(message)

        try:
            return await asyncio.wait_for(await_reply(), timeout)
        except asyncio.TimeoutError:
            return {"__timeout__": f"{method} did not answer within {timeout}s"}
        except Exception as error:  # noqa: BLE001 - the socket died; say so
            return {"__error__": f"{method} failed: {type(error).__name__}: {error}"}


async def measure(session: Session, url: str, marker: str) -> dict:
    """Navigate to `url` and report requested and committed SEPARATELY."""
    record: dict = {"requested": url}

    result = await session.call("Page.navigate", {"url": url})
    record["navigate_result"] = result

    # Settle. A fixed wait is crude, but the alternative — waiting on a load
    # event — cannot distinguish "loaded the requested URL" from "loaded
    # something else", which is exactly the confusion being eliminated here.
    await asyncio.sleep(2.0)

    tree = await session.call("Page.getFrameTree")
    frame = tree.get("frameTree", {}).get("frame", {})
    record["main_frame_url"] = frame.get("url", "")
    record["main_frame_security_origin"] = frame.get("securityOrigin", "")

    history = await session.call("Page.getNavigationHistory")
    entries = history.get("entries", [])
    index = history.get("currentIndex", -1)
    if 0 <= index < len(entries):
        record["history_current_url"] = entries[index].get("url", "")
        record["history_current_title"] = entries[index].get("title", "")
    else:
        record["history_current_url"] = ""
        record["history_current_title"] = ""

    for key, expression in (
        ("document_url", "location.href"),
        ("document_origin", "window.origin"),
        ("title", "document.title"),
        ("body_text", "document.body ? document.body.innerText : ''"),
    ):
        evaluated = await session.call(
            "Runtime.evaluate", {"expression": expression, "returnByValue": True}
        )
        record[key] = evaluated.get("result", {}).get("value", "")

    # Drain whatever the browser reported while the page was loading. A quiet
    # no-op call is the cheapest way to pump the socket for pending events.
    await session.call("Runtime.evaluate",
                       {"expression": "0", "returnByValue": True})
    problems = []
    for event in session.events:
        method = event.get("method")
        if method == "Log.entryAdded":
            entry = event.get("params", {}).get("entry", {})
            if entry.get("level") in ("error", "warning"):
                problems.append(
                    f"{entry.get('level')}: {entry.get('text', '')[:300]}")
        elif method == "Runtime.exceptionThrown":
            # An uncaught exception leaves a page half-built exactly like a
            # refused resource does, and is just as invisible to the build.
            details = event.get("params", {}).get("exceptionDetails", {})
            text = (details.get("exception", {}).get("description")
                    or details.get("text") or "")
            problems.append(f"exception: {text[:300]}")
    record["console_problems"] = problems
    record["console_problem_count"] = len(problems)
    record["blocked_by_csp"] = sum(
        1 for p in problems if "Content Security Policy" in p
        or "Not allowed to load local resource" in p)

    body = record.get("body_text") or ""
    record["body_sha256"] = hashlib.sha256(body.encode("utf-8")).hexdigest()[:16]
    record["marker_present"] = marker in body

    # The whole point of the tool: did we get what we asked for?
    record["committed_matches_requested"] = (
        record["main_frame_url"] == url or record["document_url"] == url
    )
    return record


async def run(binary: str, urls: list[str], marker: str) -> list[dict]:
    port = free_port()
    profile = tempfile.mkdtemp(prefix="astro-cdp-")
    process = subprocess.Popen(
        [
            binary,
            f"--user-data-dir={profile}",
            f"--remote-debugging-port={port}",
            "--no-sandbox",
            "--headless=new",
            "--disable-gpu",
            # No startup URL, no restore, nothing that could load a page the
            # test did not ask for.
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-session-crashed-bubble",
            "about:blank",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        browser_ws = wait_for_devtools(port)
        records = []
        async with websockets.connect(browser_ws, max_size=None) as browser_socket:
            browser = Session(browser_socket)
            for url in urls:
                # A FRESH target per URL. Reusing one tab lets a previous
                # navigation's state answer for the next one.
                created = await browser.call(
                    "Target.createTarget", {"url": "about:blank"}
                )
                target_id = created.get("targetId")
                if not target_id:
                    records.append(
                        {"requested": url, "error": f"no target created: {created}"}
                    )
                    continue
                page_ws = f"ws://127.0.0.1:{port}/devtools/page/{target_id}"
                async with websockets.connect(page_ws, max_size=None) as page_socket:
                    page = Session(page_socket)
                    await page.call("Page.enable")
                    await page.call("Runtime.enable")
                    # Log carries the browser's own refusals -- CSP blocks,
                    # "Not allowed to load local resource" -- which never reach
                    # Runtime.consoleAPICalled because no page script logged
                    # them.
                    await page.call("Log.enable")
                    record = await measure(page, url, marker)
                    records.append(record)
                    # Print as we go. A run killed from outside -- an outer
                    # timeout, a Ctrl-C, a crashed browser -- must still leave
                    # behind everything it had already measured.
                    report(record)
                await browser.call("Target.closeTarget", {"targetId": target_id})
        return records
    finally:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
        shutil.rmtree(profile, ignore_errors=True)


def report(record: dict) -> None:
    """Print one measurement. Requested and committed always stay separate."""
    print(f"\n=== {record['requested']} ===", flush=True)
    for key in (
        "navigate_result",
        "main_frame_url",
        "history_current_url",
        "document_url",
        "document_origin",
        "title",
        "body_sha256",
        "marker_present",
        "committed_matches_requested",
        "console_problem_count",
        "blocked_by_csp",
    ):
        if key in record:
            value = record[key]
            if isinstance(value, dict):
                value = json.dumps(value)
            print(f"  {key:30} {value}", flush=True)
    for problem in record.get("console_problems", [])[:6]:
        print(f"  {'console':30} {problem}", flush=True)
    if "error" in record:
        print(f"  {'error':30} {record['error']}", flush=True)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", required=True)
    parser.add_argument("--url", action="append", required=True, dest="urls")
    parser.add_argument("--marker", default="ASTRO_TEST_WEBUI_OK")
    parser.add_argument("--json", help="also write the raw records here")
    args = parser.parse_args(argv[1:])

    if not os.path.isfile(args.binary):
        raise SystemExit(f"ERROR no such binary: {args.binary}")

    records = asyncio.run(run(args.binary, args.urls, args.marker))

    # Records were printed as they completed, in run().

    if args.json:
        with open(args.json, "w", encoding="utf-8") as handle:
            json.dump(records, handle, indent=2)
        print(f"\nwrote {args.json}")

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
