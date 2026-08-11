# Astro — De-Googled Chromium Browser by Oxy

Astro is a Chromium fork that removes all Google services and replaces them with Oxy platform equivalents. Built on 112 ungoogled-chromium patches plus 65 Astro-specific patches. All Oxy code lives in a self-contained overlay (`src/chrome/browser/oxy/`), following the Brave-style approach.

**This file carries the imperatives; `docs/` carries the evidence.** Every rule
below exists because something failed here in a way nobody predicted; the
measurement, the reproduction and the cost are on the linked page. Read the
page when you are about to touch the thing it is about.

## Commands

```bash
tools/sync-sources.sh            # Check out every source at its locked commit
tools/sync-ungoogled.sh          # Stage patches from the locked ungoogled checkout
tools/apply-patches.sh           # Apply all patches (ungoogled + Astro)
tools/sync-overlay.sh            # Copy Astro overlay into the Chromium tree
tools/build.sh [Debug]           # Full build, Release by default (all CPU cores)
ninja -C out/Release chrome      # Incremental, after tools/sync-overlay.sh
tools/install-local.sh           # Install to system
tools/tests/run.sh               # Build-safety suite (no Chromium checkout needed)
tools/verify-clean-head.sh       # That suite against ONLY what HEAD tracks
tools/baseline/generate-all.sh   # Regenerate the Astro Next baseline documents
cd webui/app && bun run dev      # The WebUI app, hot reload
```

`--dry-run` on `sync-sources.sh`, `apply-patches.sh`, `sync-overlay.sh` and
`build.sh` validates every required input and prints every planned operation
without touching a file. Packaging, branding, provenance, crate vendoring and
Chromium updates (`tools/package-release.sh`, `apply-branding.sh`,
`generate-provenance.sh`, `vendor-adblock-rust.sh`, `update-chromium.sh VER`)
are in `docs/build.mdx`.

**Read the port Vite prints; do not trust a number written down anywhere,
including here** — Vite's default on a busy port is to take the next one
silently, which produced a session that read another project's app as this
one's.

## Build pipeline rules (non-negotiable)

Enforced by `tools/tests/run.sh` and the **Build safety** CI job, not just by
convention. Do not work around one; if one blocks you, that is the signal to
stop and report it on the issue. Evidence: `docs/pipeline-guards.mdx`.

- **Never `rsync --delete` into the Chromium tree**, and never reintroduce a
  delete path in `tools/sync-overlay.sh`. The old copy removed every upstream
  file the overlay did not provide, `gclient`-fetched `third_party` included.
- **Never apply a patch fuzzily (`patch -F*`) or through `git apply --3way`.**
  Both produce a tree that is not the reviewed patch, and both did so silently.
  A patch applies exactly or the run stops.
- **Never swallow a failure.** No `|| true`, no `2>/dev/null` on a required
  step; a genuinely optional one is declared with `astro::optional <reason>`,
  so `grep -rn astro::optional tools/` is the complete list.
- **Never pipe `find` into `head`.** `head` closes the pipe, `find` takes
  SIGPIPE, `pipefail` surfaces exit 141 — a stack trace instead of a verdict.
  Never fires on the synthetic fixtures, fires reliably against a real
  checkout's 400,000 files. Bound the producer, or ask git; no scanner catches
  this shape.
- **Only *untracked* `.rej` / `.orig` files are patch artifacts.** Chromium
  ships 181 tracked `.orig` files, so a `find`-based check condemns a pristine
  checkout on sight. Ask git for untracked files only.
- **Before blaming a patch for a `gn` failure, prove the GN args are the
  committed ones.** `tools/build.sh` reports every key that differs from `HEAD`
  before configuring; read that block first. An uncommitted one-character edit
  reads exactly like a composition defect in a patch, and was nearly published
  as one.
- **A failed `gn gen` writes no build graph, and `gn check` against no build
  graph reports `0 errors`** — which reads exactly like "clean". The target
  count `gn gen` prints is the vacuity floor.
- **Never write into `chromium/src` without resolving it first** through
  `astro::resolve_chromium_src`. A `chromium/src` holding only the overlay
  resolves to the Astro repository, so a `git reset --hard` aimed at "the
  Chromium checkout" destroys the developer's own work.
- **That guards the scripts, not a bare `git` you type. Use
  `git -C /home/nate/Oxy/Astro` for every repository command**, and `git -C
  <path>` rather than `cd` for the build ones — the shell keeps `chromium/src`
  between commands, it carries 4,253 dirty paths, and one `git add -A` there
  puts them onto the pinned revision. To prove nothing was committed there,
  read the REFLOG, not `HEAD`.
- **Never ask git whether a Chromium checkout is clean without descending into
  submodules.** `gclient` writes `diff.ignoreSubmodules = dirty`, so a plain
  `git status --porcelain` prints NOTHING for a dirty submodule — two
  independent pristine assertions once agreed and both were wrong. Use
  `tools/lib/dirty_paths.py`; `--ignore-submodules=none` alone is not enough.
- **"modified path(s) Astro did not write" usually means the patch report
  predates a patch, not that the tree is foreign.** The discriminator is the
  patch NAMES in `build/reports/patch-report.json` against
  `patches/astro/series`: one missing name produces the refusal. The cure is a
  real pipeline run, never `ASTRO_ALLOW_DIRTY_CHROMIUM=1`. This gate cried wolf
  so reliably that a foreign 113 KB file was waved through beside the false
  positive and went into a user's binary.
- **Preserve developer work by default.** Mutating scripts refuse a checkout
  carrying changes Astro did not write. `ASTRO_ALLOW_DIRTY_CHROMIUM=1` is
  developer-only, CI asserts it is never set, and it has no effect under
  `--verify-only` — a gate an env var can wave through is not a gate.
- **Every overlay destination is declared** in `tools/overlay.allowlist`; an
  undeclared path, or an undeclared overwrite of an upstream-tracked file,
  fails the sync. Shared helpers live in `tools/lib/astro-common.sh` and every
  script sources them rather than re-implementing the guards.
- **Run `tools/tests/run.sh` before touching anything under `tools/`, and
  `tools/verify-clean-head.sh --commit <your-sha>` before pushing it.**
- **The whole series applying is a measurement, never an assumption.** Nothing
  fails when a patch stops applying; a patch is broken by editing the patch
  BEFORE it (later patches quote earlier ones' inserted lines as context); a
  green browser is no evidence when the tree was edited directly. Only the
  replay sees it, and `patch-report.json` is older than it.

## Working in a shared checkout

Several agents work this one clone at once, as the same git user, sharing one
index, one `out/` and one scratchpad path. Evidence:
`docs/agent-collaboration.mdx`.

- **Commit with `git commit --only <paths>`.** The index is shared, so anything
  that commits "what is staged" takes somebody else's work. `git add <path>`
  then `git commit` is NOT sufficient — it does not clear what somebody else
  added, and one commit here carried a stranger's 36 lines. `git add -A` is
  never correct here.
- **`git commit --dry-run -- <paths>` does not disturb the index** — but its
  DISPLAY renders out-of-pathspec staged entries as unstaged or untracked,
  which looks exactly like somebody having reset it. Trust `git diff --cached`.
- **Nobody here can be identified by git.** Every commit carries the same
  author, so attribute by mtime, task title and content, and use
  `git log -S '<a distinctive line>' -- <path>` for committed text. It is blind
  to a PENDING hunk, which is where guessing is most tempting: **never hand a
  shared file's uncommitted hunk to a named owner** — call it unclaimed.
- **A green suite against a working tree says nothing about the commit.** An
  untracked file on disk satisfies every test that needs it, so a coupled unit
  committed by halves stays green locally and breaks a clean checkout — four
  times here, both directions. `verify-clean-head.sh` verifies whatever `HEAD`
  is when you invoke it, often somebody else's commit, so pass
  `--commit <your-sha>`. Its assertion-count table is noise; read each case's
  `NOT EXERCISED:` line.
- **Bump a hand-maintained count in the same commit as the thing it counts.** A
  generated document read from `HEAD` is green precisely BECAUSE your change is
  uncommitted; re-run the suite after committing, before regenerating.
- **Two builds must not share one output directory.** The dirty-tree override
  governs the overlay sync and nothing else. Land both sets of sources and
  build ONCE — a relink is 20-40 minutes.
- **Never `pkill -f <your own scratchpad path>`** — the scratchpad is per
  SESSION, so it matches other agents' processes. Kill by a captured pid.
- **State a claim in whatever form is cheapest for the recipient to falsify** —
  a named command, an exit code, a before/after dump, a SHA. Every wrong claim
  here was caught by its recipient and never by its author.

## Source revisions are declared, never discovered

`browser.lock.json` holds the full commit SHA of Chromium, depot_tools and the
ungoogled patch set. Full account: `docs/reproducibility.mdx`.

- **Never `git pull` a build dependency**, and never let an env var or a CLI
  flag select a version. `tools/update-chromium.sh` resolves a version to one
  commit and updates the lock; the lock diff is the review.
- **Never fall back to a similar version.** No exact tag means the command
  fails. The old `git tag -l "$MAJOR.*" | tail -1` → `master` chain exited zero
  while silently targeting a different browser.
- **Never decide in CI whether to synchronise.** A job runs
  `tools/sync-sources.sh` unconditionally, then `--verify-only`. Testing for an
  existing `.git` treats a cache as source-of-truth state; the pattern scanner
  reads the workflow files too.
- **Checkouts are detached at the locked commit.** A branch at the right commit
  can be advanced afterwards; that is how a pinned build stops being pinned.
- Provenance is generated from the trees on disk, never from the lock — the
  disagreement between them is the fact worth recording.

## The baseline is generated, not hand-maintained

`docs/astro-next/baseline/` is produced by `tools/baseline/*` and CI runs
`generate-all.sh --check`. **Never hand-edit a file whose header says it is
generated** — the next check reverts the edit with no explanation. Dispositions
in `patch-dispositions.json` are the one hand-maintained input, joined against
the two patch series strictly in both directions.

Anything the baseline could not measure says `not-captured` and names the
command that will capture it. **Do not fill one in from reasoning:** the point
is that later issues can tell a measurement from an expectation.

## Known defects, declared rather than hidden

Do not "fix" these silently, and do not let a build imply they are resolved.
What was measured, and the lessons that outlive each: `docs/known-defects.mdx`.

- Domain substitution has never run (Python regexes fed to `sed`, error
  discarded). `apply-patches.sh` refuses; `--skip-domain-substitution`
  reproduces what previous builds did. #8.
- A whole-file overlay copy of `chrome_web_ui_configs.cc` once reverted four
  patches. It is gone and registration is a patch again — a checkout that
  reintroduces the copy reintroduces the defect with no warning. #7.
- The Oxy overlay compiled to zero objects until `057-oxy-webui-build-edge.patch`
  gave it an edge into `//chrome/browser/ui/webui:configs`. There is no
  dependency cycle through `//chrome/browser/ui`. #7.
- Four `gnrt` vendoring failures (059, 064, 065, 066), all fixed. The durable
  part: gnrt writes a value only where the key is ABSENT, so "the config came
  back byte-identical" is VACUOUS on an already-vendored tree.
- rmp-serde 0.15.5 against a current rmp, fixed by `069` as a CRATE PATCH — a
  vendored crate CAN be edited durably, and this file used to say the opposite.
  The real fix is an adblock engine upgrade, a product decision.
- The overlay's own C++ had never been compiled. 12 of the ad blocker's 13
  objects compile as of 2026-08-09; the repairs were API drift against Chromium
  146, and those spellings are worth reading before writing overlay C++. #14.
- The two LEGACY pages (`alia`, `whats-new`) serve their assets by reading a
  directory next to the executable, so neither carries Chromium's
  resource-bundling guarantees and each renders BLANK, with no error, when its
  directory is missing. `chrome://adblock` is a third shape — inline strings,
  in the binary, not in the pak. #14's remainder.

## Where the code is

- `src/chrome/browser/oxy/` — the whole C++ overlay: `oxy_auth_*`,
  `oxy_cookie_signin_observer`, `oxy_alia_side_panel`, `adblock/`,
  `astro_pref_names.h`, `astro_theme_service*`, `ui/` (generated colour tokens
  + the mixer) and `webui/` (controllers, `.mojom` files, and the Vite → grit →
  `.pak` chain in its `BUILD.gn`). Annotated tree: `docs/architecture.mdx`.
- `webui/app/` — the one Vite + Tailwind + Bloom application, one entry per
  WebUI host chosen from `location.hostname`, built into
  `astro_webui_resources.pak` by a GN action. Its committed `manifest.json` is
  the authority for what it emits.
- `patches/ungoogled/` (112) and `patches/astro/` apply in their `series`
  order. `gn_args/`, `branding/`, `tools/` are the rest.

## WebUI pages

Procedure, host table and the full scheme-composition list: `docs/webui.mdx`.

- **New frontend work is an entry in `webui/app`**, never a new top-level
  `webui/foo/`. The page sets `.resources = kAstroWebuiResources` and
  `.default_resource = IDR_ASTRO_WEBUI_INDEX_HTML` and there is nothing else to
  wire; a resource GRIT did not compile is a LINK error, not a blank page found
  by a user.
- **Taking a host upstream already registers means SWAPPING its line, never
  adding one** — `WebUIConfigMap::AddWebUIConfigImpl` CHECKs on a duplicate
  origin and the browser dies at startup. A whole-file overlay copy is not an
  option; that was defect #7.
- **A swap is only safe when nothing outside the config names the upstream
  controller's CONCRETE TYPE.** `GetAs<T>()` returns `nullptr` on a mismatch
  and the views layer dereferences it unchecked, so the takeover becomes a
  browser-process crash — and frontend line counts rank these surfaces
  backwards. Before planning one:
  `grep -rn 'WebUIContentsWrapperT<\|SidePanelWebUIViewT<\|GetAs<' chrome/browser/ui/views/`
- **Add the build edge.** A `BUILD.gn` under `chrome/browser/oxy/` that nothing
  depends on compiles to nothing, silently.
- **Never a generic `SetPref(string, value)`.** Narrow per-domain mojoms, one
  named method per decision. A new interface also needs an entry in the WebUI
  frame binder map (`063-astro-webui-mojo-binders.patch`), or `BindInterface`
  is never called and the page sees a pipe that never answers, silently on both
  sides.
- **No localStorage in a page, and no fetch from one.** Page state is profile
  prefs so the browser can see and validate it, and every URL is validated in
  the browser in BOTH directions — in from the page, and out of the pref store.
- **The `astro` scheme is spelled in TEN independent places** across the build,
  each found by a separate failure, and untrusted must be rewritten BEFORE
  trusted everywhere. Fixing some and not the rest leaves a browser broken in
  ways neither the build nor a test suite reports.

## Theming

`AstroThemeService` watches `browser.theme.color_scheme2` and Astro's
`astro.theme.preset`, pushes the preset into `astro::AddAstroColorMixers`
(patch 061, called last so it wins) and notifies the native themes the windows
observe. The five ways it looks broken when it is not: `docs/theming.mdx`.

- **`ui/astro_color_tokens.h` is GENERATED from Bloom's `tokens.json`.** Never
  hand-edit it; a build-safety case regenerates and compares.
- **`NotifyOnNativeThemeUpdated()` notifies only its OWN observers**, and on
  Linux the browser windows observe a different NativeTheme. Notify both. A
  colour read through `colors.css` is NOT evidence that a window repainted.
- **On Linux every fresh profile carries a theme supplier**, so reading
  `key.custom_theme` as a boolean stands the whole mixer down for every Linux
  user. Ask what KIND of supplier it is.
- **`astro.theme.preset` is spelled in three places** — `astro_pref_names.h`,
  `020-register-oxy-prefs.patch` and `pref-ids.ts`. An unregistered path reads
  empty rather than failing, so a rename that misses one produces a control
  that moves and changes nothing.

## Branding

`tools/apply-branding.sh` applies `branding/astro.conf` across the tree. The
defects behind these: `docs/build.mdx`.

- **Discover the `.grd`/`.grdp` files to rename, never hand-list them** —
  excluding `*google_chrome*` and `ChromiumOS`, which is a DIFFERENT product.
- **Never blanket-substitute `Chromium` → `Astro`.** It rewrites
  `IDS_ABOUT_VERSION_COMPANY_NAME` and `IDS_ABOUT_VERSION_COPYRIGHT` — a false
  copyright attribution, shipped, on a codebase whose licence requires the
  notice be retained. Attribution strings are excluded from the rename.
- **A `--dry-run` must exercise the same substitution the real run does**, not
  just count matches.

## C++ Conventions

- Chromium style guide (Google C++ style with Chromium extensions).
- All Oxy integrations in self-contained files under `src/chrome/browser/oxy/`.
- Minimal patches to existing Chromium files — surgical hooks, includes and
  registrations only.
- Astro's own mojoms live in `src/chrome/browser/oxy/webui/`, built by
  `mojom("mojo_bindings")` there. After changing one, rebuild the affected
  targets clean rather than incrementally — generated bindings are a classic
  stale-artifact source.

## Verification

Every entry has one shape: a check whose PASS and whose *nothing-was-measured*
produce the same output. Evidence: `docs/verification.mdx`.

- **`tools/cdp-navigate.py` is the only sanctioned way to measure navigation.**
  Three harnesses reported success while measuring nothing, one by reading the
  browser's own complaint and discarding it.
- **A check that can never fail is not a check — prove the negative case
  fires.** A CSP provocation using `<script src>` is blocked by Trusted Types
  before the scheme check runs; `<link rel=stylesheet>` reaches it.
- **A `.pak` stores each resource compressed**, so grepping it for a string
  returns zero even when the string is present. Read the live page, or probe
  for an asset's raw bytes.
- **`pgrep -f <pattern>` matches the command line of the shell running it**, so
  "is my build still going?" answers YES forever. `pgrep -x ninja`.
- **Two browsers can hold "the same" debugging port** (IPv4 and IPv6 both bind,
  neither reports a conflict). Launch with `--remote-debugging-port=0` and read
  `<your-user-data-dir>/DevToolsActivePort`. Resolve a window by a captured pid
  and refuse unless exactly one row matches — a failed lookup still produces a
  plausible screenshot of somebody else's browser.
- **The side panel is per TAB**, so CDP reporting it `visible` is not the same
  as it being on screen. **And count from the DOM, not from the pixels** —
  compare NAMED SETS, not totals.
