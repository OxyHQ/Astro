# The `astro` command

`astro` drives a running Astro from the terminal with Python and [pydoll](https://pydoll.tech) 3.0. It's a separate
download, not part of the app bundle. The app ships `install.sh`, and runs it when the user opts in during onboarding
or in Settings ("Let the astro command control Astro").

Code: `apps/cli` (`astro_cli`, `install.sh`, `scripts/build.sh`). Dependencies are pinned with hashes in
`apps/cli/requirements.lock` (regenerate with `uv pip compile requirements.in --python-version 3.13
--python-platform aarch64-apple-darwin --generate-hashes --no-annotate --no-header -o requirements.lock`, then copy
the pins into `pyproject.toml`).

## Commands

- `astro exec [CODE | -] [-f FILE] [--data-dir DIR] [--port N] [--ws URL] [--timeout S] [--json]` runs Python with
  top-level `await`. In scope: `browser` (pydoll `Chrome`), `tab` (the page shown in Astro's last focused window,
  from `GET /astro/active?token=…` on the token path, so it holds while the window is covered; `--port`/`--ws` test
  servers fall back to visible and focused, else visible; with no page, as on New Tab, it's a placeholder that raises
  `NoPageTab` on first use), `tabs` (http, https, about, data and blob pages, plus what `new_tab` opens, minus
  the New Tab's prewarmed `about:blank`: on the token path every `about:blank` that isn't the active page, on test
  servers the hidden ones),
  `new_tab(url, background=True)`, `js(expression, tab=None)` (default: `tab`, else the last `new_tab`), `await pinned()`,
  `await history(days=1, limit=200, profile=None, domains=False)` (see Browsing data), `By`, `Key`,
  `asyncio`, pydoll's exports and its common exceptions. It prints the last expression's value. Exit 0 done, 1 the
  code raised or timed out (default 300 s), 2 Astro can't be reached or closed the browser socket (it watches the
  socket, so turning the setting off ends an idle run at once), 130 interrupted.
- `astro skills install --target general|codex|claude-code|cursor|opencode [--target …] [--project]` installs the
  agent skill (`astro_cli/skill`: `SKILL.md` and `references/pydoll.md`) into `~/.agents/skills` (general, codex),
  `~/.claude/skills`, `~/.cursor/skills` or `~/.config/opencode/skills`; with `--project`, into `./.agents/skills`,
  `./.claude/skills`, `./.cursor/skills` or `./.opencode/skills`. It replaces only its own `astro` folder.
- `astro scripts new|test|install|uninstall|list` writes, tests and installs userscripts (see Userscripts).
- `astro --version`, `astro --help`, `astro exec --help`, `astro scripts <command> --help`.

`exec` never quits Astro: it refuses `browser.stop()`, and every WebSocket it opens checks each outgoing message (and
refuses fragmented sends), so
`Browser.close`, `Browser.crash` and `Browser.crashGpuProcess` never leave the process, whether sent one at a time, in
an `execute_commands` batch (checked whole before anything is sent) or straight on the socket. On exit (normal, an
exception or Ctrl-C) it closes only its own page and browser WebSockets. Its WebSockets always connect directly,
ignoring `http_proxy`, `ws_proxy` and the like, so no proxy sees the token.

## Browsing data

For daily reports, `exec` has two helpers that read files in Astro's data dir. They're coroutines that run in a daemon
thread with one 20 s deadline from the call (the session read, the snapshot, every SQLite connection through a
progress handler that aborts past it, row fetching capped at 200,000), so the event loop and the browser socket stay
live (`await history()`; a bare last expression is awaited anyway), `exec --timeout` returns promptly even if a call
is stuck, and the worker deletes its temp snapshot in its own `finally`. At exit a hook sets a closing flag first
(workers check it before making a temp folder and at every backup or copy step), waits up to 1 s for live workers,
then deletes any temp folder still registered. The data dir is the token path's
(`--data-dir`, `$ASTRO_DATA_DIR`, else the installed app's); with `--port`, `--ws` or `$ASTRO_CDP_URL` it's only
`--data-dir` or `$ASTRO_DATA_DIR`, and without one they raise `BrowsingDataError`. Both run the same
`AstroControl.json` checks as the token path first (regular file, owned, 0600, live pid), so they work only while
Astro runs with control on. Neither reads cookies, passwords, Login Data or Web Data.

- `await pinned()` reads `<data dir>/session.json` (the app's persisted state, `apps/browser/src/lib/persist.ts`) and returns
  one dict per pin: `title` (custom title first), `url` (else the pinned URL), `pinned_url`, `kind` (`favorite` for a
  tile, `pinned` for a tab in a pinned folder), `folder`, `profile` (its name) and `parked` (pins of a profile no
  window shows, from `parkedPins`). Pins mirrored across windows count once. Incognito profiles are skipped.
- `await history(days=1, limit=200, profile=None, domains=False)` reads Chromium's `History` for each `Default` and
  `Profile <id>` folder under `<data dir>/Chromium/` (never incognito, guest or system profiles; `profile` must be a
  profile name or one of those folder names, never a path). Rows per URL, newest first: `url`, `title`, `visits` in
  the window, `total_visits`, `last_visit` (ISO 8601, local time), `profile`. Only http(s) pages; subframe
  navigations and hidden URLs are left out. `domains=True` rolls rows up per domain (`domain`, `visits`, `pages`,
  `last_visit`, `top_title`, `profile`), most visited first. It never touches the live file for writing: it opens it
  read-only (`mode=ro`) and copies it with SQLite's backup API into a private temp dir; the progress callback ends
  the backup once 0.5 s have passed. Chromium keeps `History` exclusively locked while Astro runs, so that usually
  fails, and it falls back to copying `History` plus its `-wal`/`-journal` (no symlinks, regular files only), checking
  the copy opens, up to 3 tries. A copy taken mid-write can miss the last few visits. The copy checks the deadline
  between 1 MB chunks.

## Userscripts

`astro scripts` runs Violentmonkey-style userscripts written in TypeScript or JavaScript. A `.user.js` from
Violentmonkey or Tampermonkey works as is. Keys read from the `// ==UserScript==` block: `@name` (the id is its slug),
`@namespace`, `@version`, `@description`, `@match`/`@exclude-match` (Chrome match patterns for content scripts:
`*`, `http`, `https`, `file`, `ftp` schemes, checked when parsed the way `URLPattern::Parse` does, a bit stricter:
hosts canonicalized as the browser does: lowercase, IDN to punycode (refused when it has ß, ς or a joiner, which
IDNA versions treat differently), WHATWG IPv4 forms like `127.1` or `2130706433` to dotted, compressed IPv6, no `%`
anywhere (so no IPv6 scope ids); ports 0 to 65535 without leading zeros and none with scheme `*`),
`@include`/`@exclude` (globs over the whole URL with `base::MatchPattern`: `*` any run, `?` zero or one character,
`\` escapes, matched left to right without backtracking; regexes are refused),
`@run-at` (`document-start`, `document-end` default, `document-idle`), `@inject-into` (`page` default and `auto` run
in the page's world, `content` in an isolated world), `@noframes`. `@grant` other than `none`, `@require` and
`@resource` are ignored with a warning. `@match` and `@include` add up, as in Violentmonkey.

Builds go through esbuild: `--bundle --format=iife --platform=browser --target=chrome130 --tsconfig-raw={}`, not
minified, so relative imports bundle in and no `tsconfig.json` is read (no `paths` aliases). Types are stripped, not
checked. Every input esbuild reports in its metafile must be a `.ts .tsx .mts .cts .js .jsx .mjs .cjs .css` source
(JSON, text and other loader types are refused), a regular file with no other hard links, and inside the script's
own folder tree; nothing may come from Astro's data dir (the `--data-dir`/`$ASTRO_DATA_DIR` one and the installed
app's), even inside the tree. Both are decided by file identity (`st_dev`, `st_ino` of each ancestor after
resolving symlinks), not by path spelling, since APFS is case-insensitive. A script directly in the home folder or
`/` may import nothing. Otherwise the build fails
before anything is injected or published, so a script can't bundle `AstroControl.json` or other files and send
them to a page. `data:` imports are allowed. The tarball ships esbuild in `astro_cli/bin/esbuild` and an installed
CLI uses only that one; from the repo (`python -m astro_cli`) it falls back to
`node_modules/@esbuild/darwin-arm64/bin/esbuild` in a parent folder of the package, then `esbuild` on PATH. It never
looks in the cwd.

- `astro scripts new NAME [--match PATTERN]…` writes `NAME.user.ts` in the cwd (default match
  `https://example.com/*`), never over an existing file.
- `astro scripts test FILE [--url URL] [--expect JS] [--wait S] [--screenshot PATH] [--keep] [--json] [--data-dir DIR]
  [--port N] [--ws URL]` finds Astro like `exec` (same exit 2), opens its own background target at `about:blank`,
  attaches a flat session, turns on Runtime and Page, registers the script with `Page.addScriptToEvaluateOnNewDocument`
  (no `worldName`: the token policy refuses named worlds), and only then navigates to `--url` (default: the first
  `@match` whose host has no wildcard, path up to its first `*`). The registered source is a wrapper around the
  build that applies the `@match`/`@include`/excludes rules, `@noframes` and `@run-at` like the extension would, and
  reports start/skip/done through `console.debug` with a random marker. Matching is a port of Chromium's
  `URLPattern::MatchesURL` (`extensions/common/url_pattern.cc`) and `base::MatchPattern` (`base/strings/pattern.cc`)
  in both the wrapper and Python: canonical hosts without trailing dots (`*.` takes subdomains, never of IP
  addresses), the effective port (`:443` matches `https://example.com/`; no port matches any), the path plus query
  unescaped by `UnescapeURLComponent`'s `NORMAL` rule, including its full list of characters left escaped (BiDi
  controls, spaces, default-ignorable and format characters, lock emoji) (`/café/*` matches `/caf%C3%A9`), with a
  raw fallback, and `/foo/*`
  matching `/foo`. `apps/cli/tests` runs both against cases taken from `url_pattern_unittest.cc` and
  `pattern_unittest.cc`, and they agreed with a real Astro on the glob and percent-encoding cases. Console output and uncaught exceptions count
  as the script's when a stack frame is the script's `sourceURL`; positions map back to the sources through esbuild's
  source map. Cross-origin iframes are reached by `Target.setAutoAttach` with `waitForDebuggerOnStart`, on the token
  path too: the token policy attaches a web frame while it waits to commit, so the script runs at its document start.
  Frames that show an extension's page (a password manager's inline menu, say), a `chrome://` or DevTools page are
  never attached over the token path; a frame that starts loading one cuts off the page's session, as Chrome does for
  `chrome.debugger`. The report says how many iframes never reported. After the top frame ran (or skipped) and the page loaded (at most 10 s
  more, 30 s in all), it listens `--wait` seconds (default 2; Chrome reports unhandled rejections about a second
  late), retrying `--expect` every 100 ms until `Boolean(value)` is true in the page (the report shows the value too). A
  first pass that starts and never finishes, in any frame, fails the test; when the top frame's doesn't finish in 30 s
  the test stops there. Then, in a bounded cleanup, it removes the registration and
  closes the target it made, unless `--keep`. `@inject-into content` is tested in the page's world, with a warning.
  Exit 0 ran without uncaught exceptions and `--expect` truthy, 1 otherwise, 2 Astro unreachable.
- `astro scripts install FILE [--data-dir DIR]`, `astro scripts uninstall NAME [--data-dir DIR]` (by `@name` or id),
  `astro scripts list [--json] [--data-dir DIR]`. Install and uninstall need control on (the `AstroControl.json`
  checks, else the exit-2 line); list doesn't.

### Install contract with the app

The data dir is `--data-dir`, else `$ASTRO_DATA_DIR`, else `~/Library/Application Support/so.oxy.Astro`.

1. The CLI takes an exclusive `flock` on `<data dir>/Scripts/.lock` (polled, 30 s deadline). The app takes a shared
   one while it reads and validates. `Scripts/`, `Scripts/scripts/`, record folders and `extension/` must be real
   folders the user owns: each is opened with `O_NOFOLLOW`, and everything below works relative to those folder
   descriptors (`renameatx_np`, `openat`, `rmtree(dir_fd=)`), so a planted symlink is refused, not followed.
2. It keeps its record in `Scripts/scripts/<id>/`: `meta.json` (the parsed metadata, `id`, `world`, `source_file`,
   `installed_at`, `updated_at`), `script.js` (the build) and `source.<ext>` (a copy of the entry file). A new record
   is staged in a temp sibling and only swapped in after the extension built from it validated and was published; if
   that swap fails, the previous extension is swapped back.
3. It regenerates `Scripts/extension/` in a temp sibling: `manifest.json` with only `manifest_version` 3, `name`
   "Astro Scripts", `version` (`1.<generation / 65536>.<generation % 65536>`), `description` and `content_scripts`;
   `js/<id>.js`; and `generation`. Each content script entry has exactly `matches`, `exclude_matches`,
   `include_globs`, `exclude_globs`, `js`, `run_at`, `all_frames` (false with `@noframes`) and `world` (`MAIN` or
   `ISOLATED`). The whole manifest is checked (keys, every pattern and glob, files, values) before it's published, so
   one bad script can't make the shared extension unloadable, along with the engine's limits: at most 256 content
   script entries, 256 files per entry, 512 distinct files, and a 256 KB manifest. A script with `@match` gets one entry; one with `@include` gets an entry with `matches` `*://*/*` and
   the globs, excluding its `@match` patterns so no page runs it twice. Entries follow install order. When
   `extension/` exists the new folder replaces it with `renamex_np(RENAME_SWAP)` and the old one is deleted, so the
   path never goes missing; a plain rename only when there's none. With no scripts left, `extension/` is removed.
4. It writes `Scripts/generation` (temp file and rename): one more than the largest of `Scripts/generation`,
   `extension/generation` and the last reported one. A crashed run is repaired by the next install or
   uninstall (they rebuild from the records) or `list`: when its data dir was named (`--data-dir`,
   `$ASTRO_DATA_DIR`) or has a live control file, it takes the lock, rebuilds the extension from the records if
   they disagree (`manifest.json` entries, the `js/` files and their bytes), and otherwise publishes
   `Scripts/generation = extension/generation` when the extension is ahead, rebuilds when it is behind, and
   publishes the next generation when there are no records and no `extension/` but `status.json` still reports the
   current generation as loaded. Uninstalling the last script writes `Scripts/generation` before it removes
   `extension/`, so a crash between them looks like an old extension, not a finished uninstall. `list --json` puts
   any repair in its `repaired` key, never ahead of the JSON. `scripts test` never writes to any `Scripts/` folder,
   and nothing creates `Scripts/` under a data dir that wasn't named or live. `extension/generation` holds the same number. A bumped generation with
   no `extension/` means every script was uninstalled.
5. It drops the lock, then polls `Scripts/status.json` for up to 10 s: `{"generation": N, "profiles": {"<profile>":
   {"ok": true} | {"error": "…"} | {"disabled": true} | {"removed": true}}}`; `removed` means no scripts are left and the extension is gone from that profile. Exit 0 when every profile loaded or is turned off, 1 on any
   error, 3 when Astro didn't report in 10 s (the outcome is unknown; it may still be loading), and 0 with "loads on
   its next launch" when Astro quit or turned control off while it waited. A newer generation in `status.json` means
   another change replaced this one, and its result is printed.

## How it finds Astro

1. `--ws URL`, a browser WebSocket URL.
2. `--port N`, a plain DevTools server on 127.0.0.1 (`/json/version`). For test servers only.
3. `$ASTRO_CDP_URL`, like `--ws`.
4. `<data dir>/Chromium/AstroControl.json`, with `--data-dir` or `$ASTRO_DATA_DIR`, else the installed app's
   `~/Library/Application Support/so.oxy.Astro/Chromium/AstroControl.json`.

The active-page route is `GET http://127.0.0.1:P/astro/active?token=<token>`: `{"targetId": "<id>"}`, or `null` when
New Tab or an Astro view is showing; anything else is a 404. The CLI calls it directly (no proxy, no Origin header)
with the token redacted like everywhere else, and falls back to the visibility check if it fails.

The app writes `AstroControl.json` when the setting is on:
`{"port":P,"browser":"/devtools/browser/<guid>","token":"…","pid":…,"generation":N}`. The CLI opens it without
following links and trusts it only when it's a regular file the user owns, mode 0600, and `pid` is alive. It connects
to `ws://127.0.0.1:P<browser>?token=<token>`; pydoll keeps the query on every `/devtools/page/<id>` URL, so page
sockets carry the token too. A missing, stale or unsafe file, or a refused connection, prints one line and exits 2:
`Astro isn't running, or "Let the astro command control Astro" is off in Settings.` There's no port scanning and no
`/json` fallback on this path. The token never reaches the output: stdout and stderr are redacted as a stream (a token
split across writes is held back until it's complete), and so are log records and everything a logging handler
formats, tracebacks included. pydoll's loggers stay at ERROR. The stream holds back only a tail that could start a
registered token and releases everything on `flush()`, at exit and on SIGTERM or SIGHUP (exit 143). A token printed in
two parts with an explicit flush between them gets through; that gap is accepted.

## Install and upgrade

`install.sh [--version V] [--sha256 DIGEST] [--uninstall]` (run with `/bin/sh`; `--help`):

- Downloads `https://github.com/OxyHQ/Astro/releases/download/v<V>/astro-cli-<V>-macos-arm64.tar.gz` (https only)
  into a private temp dir. Without `--version` it takes the latest release that has the asset. `--sha256` is the only
  digest it trusts (the app passes `Astro.app/Contents/Resources/astro-cli.sha256`, which the signed bundle pins), and
  a download needs it: a `.sha256` from the same release would only prove the tarball came from wherever the tarball
  came from. Only a `file://` `ASTRO_CLI_URL` (tests) may go without it, reading `<url>.sha256`. A Debug build has no
  pinned digest, so it installs only that way.
- Verifies the digest, refuses entries outside `astro-cli-<V>/`, `..` paths, hard links and links pointing outside the
  tree, plus names with control characters, backslashes or ` -> `, extracts to `$ASTRO_CLI_HOME/<V>.partial`, checks
  the extracted tree again (`find`, no line parsing), renames it to `<V>`, and swaps `current` atomically.
- It keeps the current and the previous version, and any version a running `astro` uses: `astro_cli` writes
  `<V>/.leases/<pid>` when it starts (from the launcher or `python -m astro_cli`) and removes it at exit. A lease
  counts only while a process with that pid runs and started no later than the lease was written (`ps -o lstart`
  against the lease's mtime), so a reused pid doesn't pin a version.
- Links `$ASTRO_CLI_BIN_DIR/astro` (default `~/.local/bin`) to `current/bin/astro`. It replaces only a link that
  already points into `$ASTRO_CLI_HOME` and refuses anything else. With the default bin dir off the login shell's
  PATH, it adds `export PATH="$HOME/.local/bin:$PATH"` to `~/.zprofile` once.
- A version that is already current is a no-op. Two runs never overlap: each takes a flock on
  `$ASTRO_CLI_HOME/.lock` through fd 9 (`/usr/bin/lockf -s -t 120 9`). The kernel drops it when the run exits, even on
  SIGKILL; a run that waits 120 s prints `error another install is still running`. Uninstall leaves the empty `.lock`
  file, since deleting a lock file other runs may have open would split the lock.
- Output for the app, one line each: `step resolve|download|verify|install|link`, `version <v>`, `path <rc file>`,
  then `installed <bin path>` or `uninstalled`, or `error <message>` with exit 1.

`$ASTRO_CLI_HOME` defaults to `~/Library/Application Support/Astro/CLI`. The installed version is
`basename "$(readlink "$ASTRO_CLI_HOME/current")"`; the app reads that link to decide whether to upgrade, and after an
app update it runs `install.sh --version <app version> --sha256 <pinned digest>` in the background. The CLI never
updates itself.

## Linux and Windows

The same `astro_cli` runs there; only the places differ (`astro_cli/places.py`). The data dir is Chromium's user data
dir: `~/.config/astro-browser` (or `$XDG_CONFIG_HOME/astro-browser`) on Linux, `%LOCALAPPDATA%\Oxy\Astro\User Data`
on Windows, or the `--user-data-dir` the engine was started with, passed as `--data-dir` or `$ASTRO_DATA_DIR`. In it:
`AstroControl.json` at the top (not under `Chromium/`), `Scripts/` (the engine's `ac_scripts_policy.cc` puts it beside
the profiles instead of one level up), the profiles' `History`, and the session in `Default/Astro Documents/session.json`.

- The engine writes `AstroControl.json` the same way (`ac_cli_control.cc`): a temp file and a rename, mode 0600 on
  Linux; on Windows the file keeps the user data dir's ACL, and the CLI skips the owner and mode checks. Whether
  `pid` is alive is `kill(pid, 0)` on Linux and `OpenProcess` plus `GetExitCodeProcess` on Windows (never
  `os.kill`, which terminates there).
- The scripts store uses folder descriptors on Linux as on macOS; the swap is `renameat2(RENAME_EXCHANGE)`, falling
  back to three renames where the file system refuses it. Windows has no folder descriptors: the store works by path,
  refuses reparse points (symbolic links and junctions) by their attributes, swaps with three renames and locks
  `Scripts/.lock` with `msvcrt.locking`, which conflicts with the engine's `LockFileEx` shared lock.
- The app side of userscripts is `ac_user_scripts.cc` (the engine call `ac_user_scripts`: `read`, `readStatus`,
  `writeStatus`, `watch`), a port of `UserScripts.swift`: it takes a shared lock (`flock` on Linux, `LockFileEx` on
  Windows), validates `Scripts/extension` the same way and watches `Scripts/` with a `FilePathWatcher`, sending the
  `userScripts` engine event when `generation` or the `extension` folder changes. `apps/webui/src/host/userScripts.ts`
  provides the shell functions, so `apps/browser/src/lib/userScripts.ts` runs unchanged, in the leader page only.
- `ac_scripts_policy.cc` builds on Windows too: real paths come from `GetFinalPathNameByHandleW`, links are reparse
  points.
- `exec` cancels on SIGTERM and SIGHUP on Linux; Windows' event loop takes no signal handlers, so only Ctrl-C stops
  it there. `history()` may fail on Windows while Astro runs, since Chromium can hold `History` open without sharing.

Packages ship the CLI beside the engine as `cli/` (`apps/cli/scripts/build.sh --platform linux-x64|windows-x64`,
called by `scripts/linux-package.sh` and `scripts/windows-package.sh` with the app's `MARKETING_VERSION`): Python,
`astro_cli`, esbuild, `VERSION`, and the launcher `cli/bin/astro` (`cli/bin/astro.cmd` on Windows). Nothing is
downloaded. Installing (`ac_cli_install.cc`, the engine call `ac_cli_install`: `status`, `install`) links
`~/.local/bin/astro` to the launcher on Linux, adding the PATH line to `~/.profile` once when that folder isn't on
PATH and `~/.profile` doesn't mention it; on Windows it writes `%LOCALAPPDATA%\Oxy\Astro\bin\astro.cmd`, which calls
the launcher, and adds that folder to the user's `Path` (HKCU\Environment). It replaces only a link or script that
already points at some Astro's `cli/bin`. `$ASTRO_CLI_BIN_DIR` picks another folder (and leaves PATH alone); an
instance started with `--user-data-dir` installs only with it set. `--astro-cli-dir=<dir>` points a development
engine at an unpacked CLI tree. The interface reports the bundled CLI as the app's own version when the link points
at this engine's `cli/`, and as `elsewhere` otherwise, so an app that moved relinks itself after launch.

The active page (`/astro/active`) comes from the window page that shows the focused window: it asks the tab bridge
for the tab's `SessionTabHelper` id (`astroTabCall` `sessionId`) and passes it to `ac_cli_control`.

## Build and release

`apps/cli/scripts/build.sh <version> <out dir>` writes `astro-cli-<version>-macos-arm64.tar.gz` and its `.sha256`:
python-build-standalone CPython 3.13 (release and sha256 pinned in the script), the locked dependencies and
`astro_cli` in its site-packages, pruned of tests, idlelib, Tk, ensurepip, the unused libpython dylib and
`__pycache__`, plus `bin/astro`, an sh launcher that resolves its links and runs `python3 -I -m astro_cli`, and
esbuild (the npm `@esbuild/darwin-arm64` tarball, version, sha256 and sha512 pinned in the script) in
`astro_cli/bin/esbuild`. About 18 MB; 52 MB installed. `astro --version` takes about 10 ms; the first `exec` about 1 s while Python writes its
bytecode cache, later ones about 0.15 s.

`scripts/release.sh` builds it into the release's dist dir after the export and writes its digest to
`Astro.app/Contents/Resources/astro-cli.sha256` before the app is signed. `publish-nightly.sh` and the stable
`gh release create` in the release skill upload the tarball and its `.sha256`.

## Test

Never against the real home. A hidden instance's plain DevTools port works with `--port`:

```sh
scripts/agent/ac launch <Astro.app> --data /tmp/astro-cli-test --onboarded
astro exec --port <port> 't = await new_tab("https://example.com"); await t.title()'
scripts/agent/ac quit /tmp/astro-cli-test
```

The `AstroControl.json` path needs the app's token server: Chrome's plain server accepts `?token=` on the browser
socket but answers 500 on page sockets with a query. For the installer:

```sh
apps/cli/scripts/build.sh 0.0.1 /tmp/astro-cli-out
HOME=/tmp/astro-cli-home ASTRO_CLI_URL=file:///tmp/astro-cli-out/astro-cli-0.0.1-macos-arm64.tar.gz \
  /bin/sh apps/cli/install.sh
HOME=/tmp/astro-cli-home astro skills install --target claude-code
```

`astro scripts test` needs a running instance; it reaches cross-origin iframes on both paths, and over `--port` also frames that show an extension's page. Install and the
helpers need the token path: an instance launched without `ASTRO_REMOTE_DEBUGGING_PORT` (the app doesn't start its
control server when the port switch is set) and with control on, for example a scratch dir whose `session.json` has
`"settings": {"cliControl": true}`, opened with `open -g -n --env ASTRO_BACKGROUND=1 --env ASTRO_DATA_DIR=<dir>`.
Unit tests (matching parity with node, import confinement, store rollback and recovery, symlink refusal):
`python -m unittest discover -s apps/cli/tests` with the locked dependencies installed.
