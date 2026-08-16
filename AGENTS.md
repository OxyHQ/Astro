# Astro — De-Googled Chromium Browser by Oxy

Astro is a Chromium fork that removes all Google services and replaces them with Oxy platform equivalents. Built on 112 ungoogled-chromium patches plus 65 Astro-specific patches. All Oxy code lives in a self-contained overlay (`src/chrome/browser/oxy/`), following the Brave-style approach.

## Build Commands

```bash
tools/sync-sources.sh            # Check out every source at its locked commit
tools/sync-ungoogled.sh          # Stage patches from the locked ungoogled checkout
tools/apply-patches.sh           # Apply all patches (ungoogled + Astro)
tools/sync-overlay.sh            # Copy Astro overlay into the Chromium tree
tools/build.sh                   # Release build (uses all CPU cores)
tools/build.sh Debug             # Debug build
tools/install-local.sh           # Install to system
tools/package-release.sh         # Package for distribution
tools/update-chromium.sh VER     # Propose a Chromium revision update
tools/apply-branding.sh          # Apply branding from branding/astro.conf
tools/vendor-adblock-rust.sh     # Vendor Rust adblock engine dependencies
tools/generate-provenance.sh     # Record what a build was made from
tools/baseline/generate-all.sh   # Regenerate the Astro Next baseline documents
tools/tests/run.sh               # Build-safety suite (no Chromium checkout needed)
tools/verify-clean-head.sh       # Run that suite against ONLY what HEAD tracks
```

`--dry-run` works on `sync-sources.sh`, `apply-patches.sh`, `sync-overlay.sh`
and `build.sh`: it
validates every required input and prints every planned operation without
touching a file.

> **For anything about how this works, read `docs/architecture.mdx` and
> `docs/astro-next/architecture/`.** The rules below are one line each; the
> defect behind each one is in `docs/engineering/`.
>
> **This file carries only RULES — things that break silently if you get them
> wrong.** Pipeline walkthroughs, file inventories and per-surface design go in
> `docs/`, never here. Org-wide standards are in `~/AGENTS.md` and
> `~/Oxy/AGENTS.md`; do not repeat them.
>
> **Budget: under 12 KB** (8 KB for any nested file), enforced by
> `tools/tests/cases/agents-md-stays-bounded.sh` in the build-safety suite. An
> addition that pushes it over is paid for in the SAME edit.

## Build pipeline rules (non-negotiable)

Every one of these came from a real defect. The defect, the measurement and the
fix are in **`docs/engineering/build-pipeline.md`**; violating one is wrong even
where the reasoning is not restated here.

- **Never `rsync --delete` into the Chromium tree**, and **never write into
  `chromium/src` without resolving it first**. To prove nothing was committed
  there, read the **REFLOG**, not `HEAD`.
- **Preserve developer work by default**, and **every overlay destination is
  declared** — never inferred.
- **Never swallow a failure**, and **never pipe `find` into `head`** (SIGPIPE
  turns a real error into a clean exit).
- **A green suite run against a WORKING TREE says nothing about the commit**, and
  **a generated document read from `HEAD` cannot fail before you commit** — use
  `tools/verify-clean-head.sh`, which runs the suite against only what HEAD
  tracks.
- **Never `git pull` a build dependency, never fall back to a similar version,
  and never decide in CI whether to synchronise.** Checkouts are DETACHED at the
  locked commit.
- **`pkill -f <your own scratchpad path>` kills other agents' processes.**
- **Count from the DOM, not from the pixels.**
- **The overlay's own C++ has never been compiled, and it does not compile.** Do
  not read the tree as if it had.
- **A vendored crate CAN be edited durably** — this file used to say the
  opposite.

## Branding

`tools/apply-branding.sh` applies `branding/astro.conf`. Full rules and the
defects behind them: **`docs/engineering/branding.md`**.

- **Discover the `.grd`/`.grdp` files to rename, never hand-list them** — a
  hand-written list of 4 left 27 untouched, so the browser said "Astro" on
  `about:version` and "About Chromium" in its own settings menu.
- **Never blanket-substitute `Chromium` → `Astro`.** It rewrites the company and
  copyright strings — a false attribution shipped to every user, on a codebase
  whose licence requires the notice be retained.
- **A `--dry-run` must exercise the same substitution the real run does**, not
  just count matches.
- **The in-UI logo is not `chrome/app/theme/chromium/`** (that is the
  application/installer icon), and the scale directories are a pixel-size
  contract — a wrong-size file installs cleanly, renders wrong, and reports
  nothing.

## Where the rest lives

`docs/engineering/build-pipeline.md` · `docs/engineering/branding.md` ·
`docs/engineering/file-paths.md` (the C++ overlay layout and every key path) ·
`docs/engineering/webui.md` (settings served out of the pak, the new tab page's
typed data plane, how to add a WebUI page, page URLs, scheme composition).

## C++ Conventions

- C++ code follows Chromium style guide (Google C++ style with Chromium extensions).
- All Oxy integrations in self-contained files under `src/chrome/browser/oxy/`.
- Minimal patches to existing Chromium files — surgical hooks, includes, and registrations only.
- Astro's own mojoms live in `src/chrome/browser/oxy/webui/` and are built by
  `mojom("mojo_bindings")` there — `astro_theme.mojom` and
  `astro_settings.mojom` as of 2026-08-09, the first two ever committed to this
  repository. Keep them narrow and per-domain, one named method per decision;
  never a generic `SetPref(string, value)`. After changing one, rebuild the
  affected targets clean rather than incrementally — generated bindings are a
  classic stale-artifact source. A new interface also needs an entry in the
  WebUI frame binder map (`063-astro-webui-mojo-binders.patch`), or the
  controller's `BindInterface` is never called and the page sees a pipe that
  never answers, with no error on either side.

## Development Workflow

### WebUI pages (hot reload)

```bash
cd webui/app && bun run dev          # http://localhost:5178  (strictPort)
cd webui/alia && bun run dev         # Vite default: 5173, or the next free port
cd webui/whats-new && bun run dev
```

Only `webui/app` pins a port, and the two reasons are worth carrying: 5173 is
taken by `~/Oxy/website`'s dev server on this machine, and Vite's default
behaviour on a busy port is to silently take the next one — which already
produced a session that curled another project's app and read its HTML as this
one's. The other two set no port at all, so their numbers depend on start
order. Read the port Vite prints; do not trust a number written down anywhere,
including here.

### Chromium incremental build

```bash
tools/sync-overlay.sh
ninja -C out/Release chrome          # Recompiles only changed files
```

### Full rebuild

```bash
tools/build.sh                       # Release
tools/build.sh Debug                 # Debug
```

## Verification

- **`tools/cdp-navigate.py` is the only sanctioned way to measure
  navigation.** Three different harnesses reported success while measuring
  nothing: a `--headless --dump-dom` run that never navigated to the
  requested URL at all; a run that hung and died at an outer timeout having
  printed nothing, losing every result gathered before it; and a harness
  that read CDP events and discarded them, so a page that loaded but logged
  a refused resource measured as clean — DOM present, title correct, the
  browser's own complaint went straight in the bin. `cdp-navigate.py`
  collects `Log.entryAdded` and `Runtime.exceptionThrown`, prints per-URL as
  it goes, and gives each CDP call its own timeout.
- **A check that can never fail is not a check — prove the negative case
  fires.** A first attempt to provoke a CSP violation used `<script src>`,
  which Trusted Types blocks BEFORE the scheme check runs, so the detector
  reported zero and looked broken rather than clean. `<link
  rel=stylesheet>` reaches the CSP scheme check and is the working
  provocation.
- **A `.pak` stores each resource compressed, so grepping it for a string
  returns zero even when the string is present.** Verify branding by reading
  the live page in a running browser, or by probing for the asset's raw
  bytes directly — PNGs are stored uncompressed inside a `.pak`, so a
  mid-file byte slice does match.
- **`pgrep -f <pattern>` matches the command line of the shell running it**,
  so "is my build still going?" answers YES forever, including after you kill
  it. Reported twice in one session as "STILL RUNNING" about a terminated
  ninja. `pgrep -x ninja` asks about the process instead of about a string
  that necessarily contains itself. Same family as the rest of this section:
  the check's pass and its nothing-was-measured are the same output.
