# Astro — De-Googled Chromium Browser by Oxy

Astro is a Chromium fork that removes all Google services and replaces them with Oxy platform equivalents. Built on 112 ungoogled-chromium patches plus 56 Astro-specific patches. All Oxy code lives in a self-contained overlay (`src/chrome/browser/oxy/`), following the Brave-style approach.

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

## Build pipeline rules (non-negotiable)

These are enforced by `tools/tests/run.sh` and the **Build safety** CI job, not
just by convention. Do not work around them; if one blocks you, that is the
signal to stop and report it on the issue.

- **Never `rsync --delete` into the Chromium tree**, and never reintroduce a
  delete path in `tools/sync-overlay.sh`. The old overlay copy removed every
  upstream file the overlay did not provide, `gclient`-fetched `third_party`
  trees included.
- **Never apply a patch fuzzily (`patch -F*`) or through `git apply --3way`.**
  Both produce a tree that is not the reviewed patch, and both did so silently.
  A patch applies exactly or the run stops.
- **Never swallow a failure.** No `|| true`, no `2>/dev/null` on a required
  step. A genuinely optional step is declared with `astro::optional <reason>`,
  which prints a structured `WARN [optional:<reason>]` and continues, so
  `grep -rn astro::optional tools/` is the complete list of tolerated failures.
- **Never pipe `find` into `head`.** Once `head` has its N lines it closes the
  pipe, `find` takes SIGPIPE, and `set -o pipefail` surfaces exit 141 — killing
  the run with a stack trace instead of a verdict. It never fired on the
  synthetic fixtures because `find` always finished first; it fires reliably
  against a real checkout's 400,000 files. Bound the producer instead, or ask
  git, which is usually both exact and cheaper. No scanner rule catches this
  shape, which is why it is written down here.
- **Only *untracked* `.rej` / `.orig` files are patch artifacts.** Chromium
  ships 181 tracked `.orig` files — `cargo vendor` writes a `Cargo.toml.orig`
  for every vendored Rust crate — so a `find`-based artifact check condemns a
  pristine upstream checkout on sight. Measured on the real tree: 181 tracked
  `.orig`, 0 tracked `.rej`, 0 untracked of either. Both checks ask git for
  untracked files only: the pristine-tree guard before a run, the
  post-application scan after the series is applied.
- **Before blaming a patch for a `gn` failure, prove the GN args are the
  committed ones.** The build reads its args from a file in the working tree, so
  a one-character local edit is indistinguishable from the repository's own
  configuration. Measured: an uncommitted `safe_browsing_mode = 1` in
  `gn_args/linux.gn` produced `ERROR at //chrome/browser/safe_browsing/BUILD.gn:114:5:
  Undefined identifier`, which was very nearly published as a composition defect
  in two upstream ungoogled patches — with a temporary Astro-owned correction
  written to repair a defect that does not exist. The committed value is `0`, and
  at `0` the same tree generates 29,803 targets. `tools/build.sh` now reports
  every key that differs from `HEAD` before configuring; read that block before
  attributing a configuration failure to anything in `patches/`.
- **A `gn gen` that fails writes no build graph, and `gn check` against no build
  graph reports `0 errors`.** That reads exactly like "clean". Any check whose
  pass and whose *nothing-was-measured* look identical needs a vacuity floor —
  here, the target count `gn gen` prints. Related: the committed GN args and the
  patch stack are coupled, so there is no same-configuration unpatched baseline
  to difference against (the pristine tree fails at
  `components/optimization_guide/core/inference/BUILD.gn:8:1: Assertion failed`).
- **Never write into `chromium/src` without resolving it first** through
  `astro::resolve_chromium_src`. It requires the path to be a git work tree
  *whose top level is the path itself* — a `chromium/src` holding only the
  overlay resolves to the Astro repository, so an unguarded `git reset --hard`
  aimed at "the Chromium checkout" destroys the developer's own work.
- **Preserve developer work by default.** Mutating scripts refuse a checkout
  carrying changes Astro did not write. `ASTRO_ALLOW_DIRTY_CHROMIUM=1` is a
  developer-only override; CI asserts it is never set.
- **Every overlay destination is declared** in `tools/overlay.allowlist`. An
  undeclared path, or an undeclared overwrite of an upstream-tracked file,
  fails the sync.
- Shared helpers live in `tools/lib/astro-common.sh`; every script sources it
  rather than re-implementing strict mode, logging or the guards.
- Run `tools/tests/run.sh` before touching anything under `tools/`.
- **A green suite run against a working tree says nothing about the commit.**
  An untracked file on disk satisfies every test that needs it, so a coupled
  unit committed by halves stays green locally and breaks a clean checkout.
  Four times here already, in both directions — `tools/setup-win-sdk.sh` and
  two `.pyc` files swept IN, `tools/verify-build-outcome.sh` and
  `tools/policy/manifest.py` left OUT while the committed scripts requiring
  them went in. `tools/verify-clean-head.sh` materialises the commit on its
  own, runs the suite there, and fails when the verdicts differ from the
  working tree's; the static converse — every path a committed script names is
  tracked at that commit — is `tools/tests/cases/committed-inputs-are-tracked.sh`
  and its `NOT_TRACKED` table is where a legitimately-absent path is declared.
  Run the gate before pushing anything under `tools/`.

**Source revisions are declared, never discovered.** `browser.lock.json` holds
the full commit SHA of Chromium, depot_tools and the ungoogled patch set.

- **Never `git pull` a build dependency**, and never let an env var or a CLI
  flag select a version. `tools/update-chromium.sh` resolves a version to one
  commit and updates the lock; the lock diff is the review.
- **Never fall back to a similar version.** No exact tag means the command
  fails. The old `git tag -l "$MAJOR.*" | tail -1` → `master` chain exited zero
  while silently targeting a different browser.
- **Never decide in CI whether to synchronise.** A job runs
  `tools/sync-sources.sh` unconditionally, then `--verify-only`. Testing for an
  existing `.git` treats a cache as source-of-truth state and is rejected by
  the pattern scanner, which reads the workflow files too.
- **Checkouts are detached at the locked commit.** A branch at the right commit
  can be advanced afterwards; that is how a pinned build stops being pinned.
- `ASTRO_ALLOW_DIRTY_CHROMIUM=1` has no effect under `--verify-only`. A gate an
  env var can wave through is not a gate.
- Provenance is generated from the trees on disk, never from the lock — the
  disagreement between them is the fact worth recording.

**The baseline is generated, not hand-maintained.** `docs/astro-next/baseline/`
is produced by `tools/baseline/*` and CI runs `generate-all.sh --check`, so a
document that stops matching the repository fails the build. Never hand-edit a
file whose header says it is generated — the next check reverts the edit with
no explanation. Dispositions in `patch-dispositions.json` are the one
hand-maintained input, and the join against the two patch series is strict in
both directions.

Anything the baseline could not measure says `not-captured` and names the
command that will capture it. Do not fill one in from reasoning: the whole
point is that later issues can tell a measurement from an expectation.

**Known defects, declared rather than hidden.** Do not "fix" these silently, and
do not let a build imply they are resolved:

- Domain substitution has never run (Python regexes fed to `sed`, error
  discarded). `apply-patches.sh` refuses; `--skip-domain-substitution`
  reproduces what previous builds did. Owned by #8.
- A whole-file overlay copy of `chrome/browser/ui/webui/chrome_web_ui_configs.cc`
  once reverted four patches, so `AstroAdBlockUIConfig` was never registered.
  That copy is now gone: no such file exists under `src/`, tracked or
  untracked, and `tools/overlay.allowlist` carries no entry for it. Registration
  is a patch again. Kept here because a checkout that reintroduces the copy
  reintroduces the defect with no warning. Owned by #7.
- The Oxy overlay compiled to zero objects because no `BUILD.gn` outside
  `chrome/browser/oxy/` declared a dependency on it. Patch
  `057-oxy-webui-build-edge.patch` adds that edge to
  `//chrome/browser/ui/webui:configs`. The edge has been verified to APPLY,
  not to LINK — no `gn gen` has been run against it, so a dependency cycle
  through `//chrome/browser/ui` remains possible and unmeasured. Owned by #7.
- **Patches are not verified to apply, and at least two silently did not.**
  `docs/astro-next/policy/endpoints.json` declares nine non-applying patches,
  but that list was declared rather than measured, and it warns in its own
  comment that a change of apply status will not fail loudly. Measured on
  2026-08-08: `054` and `055` also did not apply to the locked revision —
  written against a Chromium where `RegisterChromeWebUIConfigs()` sat near
  line 150, since moved to 232 — and neither was on the list. Both have been
  regenerated against the locked revision and verified with `git apply
  --check`, which is the acceptance test `apply-patches.sh` itself uses.

  The declared nine were then measured too, by replaying BOTH series in
  declared order against a scratch tree holding the pristine version of every
  file any patch names (759 of them, read out of `chromium/src` at the locked
  commit — no checkout is mutated, and the acceptance test is the same `git
  apply --check`). The list is wrong in both directions, so do not cite it:
  - Five Astro patches are MALFORMED and nothing had noticed. `045`, `046`,
    `052`, `053` and `056` carry hunk headers whose line counts disagree with
    their bodies — blank context lines written with the leading space stripped
    — so `git apply` rejects each with `corrupt patch at line N` no matter what
    tree it is pointed at. `--recount` parses them, which is how the cause was
    identified; it is not a fix, and `apply-patches.sh` must never adopt it.
    All five have been that way since they were written in `4513abb`.
  - Four of the declared nine — `009`, `012`, `013`, `015` — applied cleanly in
    that replay. Treat this as weaker than the point above: four ungoogled
    patches fail and four more target `gclient`-fetched DEPS subrepos that are
    absent from `chromium/src`'s own git tree, so the replayed tree is not
    byte-identical to what a real run produces.
  - `020`, `023`, `027`, `036` and `039` did fail, as declared. `020` is worth
    knowing about: it applies perfectly to pristine upstream ON ITS OWN and
    fails only after the ungoogled series has edited `browser_prefs.cc`. A
    per-patch check against a pristine tree would have called it healthy.

  `apply-patches.sh` still dies partway, so the patch pipeline does not reach
  the end of the series today.
- Every WebUI page serves its assets by reading a directory next to the
  executable at runtime (`base::DIR_EXE` + `resources/astro-<page>`) rather
  than from a `.pak`, so none of them carries Chromium's resource-bundling
  guarantees, and each renders blank, with no error, if its directory is
  missing. Removing `DIR_EXE` entirely is owned by #14.

## Branding

`tools/apply-branding.sh` applies `branding/astro.conf` across the tree.
Rules from real defects found in it, not hypotheticals:

- **Discover the `.grd`/`.grdp` files to rename, never hand-list them.** A
  hand-written list of 4 files left the rest untouched, so the browser said
  "Astro" on `about:version` and "About Chromium" in its own settings menu —
  the tree currently has 31 such files. Discovery excludes `*google_chrome*`
  (inert when `google_chrome_branding = false`) and `ChromiumOS` (a
  DIFFERENT product — renaming it invents "AstroOS").
- **Never blanket-substitute `Chromium` → `Astro`.** That rewrites
  `IDS_ABOUT_VERSION_COMPANY_NAME` ("The Chromium Authors") and
  `IDS_ABOUT_VERSION_COPYRIGHT` — a false copyright attribution shipped to
  every user, produced by a substitution that looks purely cosmetic, on a
  codebase whose licence requires the notice be retained. Attribution
  strings are excluded from the rename.
- **A `--dry-run` must exercise the same substitution the real run does, not
  just count matches.** The old dry run counted files and never executed the
  `sed`, so it reported success for an expression `sed` then refused to run
  for real.
- **The in-UI logo is not `chrome/app/theme/chromium/`** — that directory is
  the application/installer icon. The in-UI logo is a `chrome_scaled_image`
  resolved from
  `chrome/app/theme/default_{100,200}_percent/chromium/product_logo_32.png`;
  a non-Google-branded build declares exactly one entry for it,
  `IDR_PRODUCT_LOGO_32`, in `theme_resources.grd`. The scale directories are
  a pixel-size contract — the 200% file must be 64px — and a wrong-size file
  installs cleanly, renders wrong, and reports nothing.

## Key File Paths

### C++ source overlay

```
src/chrome/browser/oxy/
├── oxy_auth_service.*               # Oxy account auth service
├── oxy_auth_callback_handler.*      # Auth callback URL handler
├── oxy_auth_navigation_throttle.*   # Navigation throttle for auth redirects
├── oxy_auth_token_store.*           # JWT token storage
├── oxy_cookie_signin_observer.*     # Cookie observer for auto sign-in detection
├── oxy_alia_side_panel.*            # Alia AI sidebar panel registration
├── adblock/                         # Rust-based ad blocker
│   ├── astro_adblock_engine.*       # Core blocking engine (wraps Rust FFI)
│   ├── astro_adblock_service.*      # Service + factory (KeyedService pattern)
│   ├── astro_adblock_tab_helper.*   # Per-tab ad block state
│   ├── astro_adblock_toolbar_button.* # Toolbar shield icon + bubble
│   ├── astro_adblock_url_loader_throttle.* # Network request interception
│   ├── astro_adblock_filter_list_*  # Filter list catalog + updater
│   ├── adblock_domain_resolver.*    # Domain matching
│   ├── astro_adblock_resource_type.* # Resource type classification
│   ├── webui/astro_adblock_ui.*     # chrome://adblock controller + handler
│   └── rs/                          # Rust source + BUILD.gn
└── webui/                           # WebUI page controllers
    ├── astro_ntp_ui.*               # chrome://astro-ntp controller
    ├── astro_alia_ui.*              # chrome://alia controller
    └── astro_whats_new_ui.*         # chrome://whats-new controller
```

### WebUI frontend pages

```
webui/
├── ntp/           # New Tab Page (Vite + Tailwind v4)
├── alia/          # Alia AI Panel
└── whats-new/     # What's New Page
```

### Other directories

```
patches/ungoogled/   # 112 inherited de-Google patches
patches/astro/       # 56 Astro-specific patches (numbered 001-058; 007 and 035 were
                     #   removed as empty files, so two numbers are unused)
gn_args/             # GN build args per platform (linux.gn, android.gn, macos.gn, windows.gn, etc.)
branding/            # Logos, icons, astro.conf, .desktop file
tools/               # Build, install, patch, packaging scripts
```

## Settings and the error page do not exist

There is no Astro settings page and no Astro error page. Both were deleted in
`c9c4383`. The Mojo settings backend this file used to describe never existed
at all — no `.mojom` has ever been committed to this repository, at any
revision. What `c9c4383` removed was a generic `chrome.send` handler carrying
six messages and thirty-four prefs. So `astro_settings.mojom`,
`AstroSettingsHandler`, `kProfilePrefMappings[]` and the "add a setting in
three steps" recipe were all describing something that was never built, which
is worse than describing nothing: it sent readers looking for a file to edit.

`astro://settings` today is served by upstream's own `settings::SettingsUIConfig`.

The direction is a single Vite + Tailwind + Bloom application serving every
`astro://` surface, one entry per WebUI host, with narrow typed Mojo per domain
rather than a generic `SetPref(string, value)`. That is issues #15 (as amended
2026-08-08), #14, #22, #17 and #24. Nothing about that architecture is
documented here until it exists.

## How to Add a New WebUI Page

1. **Create the controller** (`astro_foo_ui.h` / `.cc`) in `src/chrome/browser/oxy/webui/`:
   - Inherit from `content::WebUIController` (simple page) or `ui::MojoWebUIController` (if Mojo IPC needed)
   - Define a `kAstroFooHost` constant for the URL host
   - Create a `UIConfig` class inheriting `content::DefaultWebUIConfig<AstroFooUI>`
   - In the constructor, set up `WebUIDataSource` to serve the Vite-built assets from disk

2. **Add to BUILD.gn** in `src/chrome/browser/oxy/webui/BUILD.gn`

3. **Register the config** in the Chromium WebUI config registration site (requires a patch to `chrome_web_ui_configs.cc` or similar)

4. **Create the frontend** in `webui/foo/`:
   - Standard Vite + Tailwind v4 setup (`bun create vite` then add Tailwind)
   - Build output goes to a `dist/` directory

5. **Wire the build** so the Vite output is copied to the correct resources directory during `tools/build.sh`

## WebUI Page URLs

| Page | Internal URL | Displayed as |
|------|-------------|-------------|
| New Tab | `chrome://astro-ntp` | `astro://newtab` |
| Alia AI | `chrome://alia` | `astro://alia` |
| What's New | `chrome://whats-new` | `astro://whats-new` |

`chrome://settings` and `chrome://astro-error` are NOT in this table: Astro owns
neither. Settings is upstream's page and the error page was deleted.

`chrome://whats-new` is served by upstream's `WhatsNewUIConfig`, not by
Astro's controller. Astro's host string is byte-identical to upstream's, and
`WebUIConfigMap::AddWebUIConfigImpl` CHECKs on a duplicate origin, so
registering `AstroWhatsNewUIConfig` alongside it crashes the browser at
startup. Taking that host over means SWAPPING the upstream registration line,
not adding one — which is why only the NTP, Alia and the ad blocker appear in
`patches/astro/05{4,5,8}-*-webui-register.patch`.

The `astro://` URL scheme is aliased to `chrome://` via patch `011-astro-url-scheme-alias.patch`.

## WebUI Scheme Composition

Astro composes its internal WebUI scheme (`astro`) and its untrusted
counterpart (`astro-untrusted`) at build time. This is NOT a one-place
setting: the same fact is spelled independently in nine places across the
build, and each was found by a separate, unrelated failure. Fixing some of
the nine and not the rest leaves a browser that is broken in ways neither
the build nor a test suite reports — the list below exists so the next
rename of anything hits fewer of these blind.

1. `content/public/common/url_constants.h` — the scheme all WebUIConfigs
   (125 of them) register under, via `CONTENT_WEBUI_SCHEME_LITERAL`. One
   missed constant in this file (`kChromeUIUntrustedResourcesURL`) made
   `url::Origin::Create` return an OPAQUE origin, so
   `WebUIDataSourceImpl::GetOrigin` CHECK-failed on the first navigation to
   any WebUI page — the loader config for every page walks every registered
   data source.
2. `chrome/common/webui_url_constants.h` + `chrome/common/url_constants.h` —
   189 internal URL literals, composed via `CHROME_UI_URL_PREFIX` /
   `CHROME_UI_UNTRUSTED_URL_PREFIX` (and their UTF-16 `*16` forms).
3. WebUI resource CONTENT, rewritten in `tools/grit/preprocess_if_expr.py`
   via a `--webui-scheme FROM=TO` flag, wired from
   `tools/grit/preprocess_if_expr.gni`. 407 preprocess actions carry it.
4. TypeScript module resolution — `tools/typescript/path_mappings.py` (the
   shared `//resources` keys) and `tools/typescript/ts_library.py`
   (per-target keys). Without it: `TS2307: Cannot find module
   'astro://resources/js/cr.js'`.
5. The rollup bundler's own path validation —
   `ui/webui/resources/tools/bundle_js.gni` normalises caller-supplied
   `external_paths` and `excludes`; `ui/webui/resources/tools/bundle_js_excludes.gni`.
   Symptom: `Invalid absolute path: astro://... is not in |excludes| or
   |external_paths|`.
6. `ui/webui/resources/tools/bundle_js.py` built the absolute host URL as
   `'chrome://%s/' % host`, hard-coded. That is what emitted
   `chrome://settings/strings.m.js` into a bundle whose page CSP then
   refused to load it: no crash, no build failure, the page still rendered
   — found only by reading a real browser console.
7. The wrapper generators `tools/polymer/css_to_wrapper.py` /
   `html_to_wrapper.py` run AFTER `preprocess_if_expr`, so their emitted
   files are born with the scheme already spelled and nothing downstream
   ever rewrites them.
8. Extension API grant patterns in
   `chrome/common/extensions/api/_api_features.json` and
   `extensions/common/api/_api_features.json` — 211 `matches` patterns,
   rewritten in `tools/json_schema_compiler/feature_compiler.py`. These
   GRANT private APIs (`developerPrivate` → extensions, `settingsPrivate` →
   settings, `bookmarkManagerPrivate` → bookmarks). Left unrewritten, the
   bindings are never installed and the affected pages throw
   `TypeError: Cannot read properties of undefined` on first use, while
   otherwise looking correct.
9. A handful of source files bypass preprocessing entirely: exactly one
   `.ts` (`components/security_interstitials/content/resources/connection_help.ts`)
   and seven `.js` under `components/security_interstitials/core/browser/resources/`
   and `components/neterror/resources/`. Fixed by making their imports
   SCHEME-RELATIVE (`//resources/js/util.js`) — Chromium's own supported
   form, identical in behavior to an unmodified Chromium.

Rules that follow:

- Every one of the nine is applied ONLY when the scheme differs from
  Chromium's default, so an unmodified configuration stays byte-identical.
  Preserve that property in anything new touching this list.
- Untrusted must be rewritten BEFORE trusted, everywhere (sort candidates by
  descending source length). Reversed, an untrusted URL silently becomes a
  trusted one — a security boundary crossed by an ordering mistake, not a
  deliberate one.
- Normalise at the ONE point the data passes through, never at the N
  upstream call sites. 190 mapping entries across 116 `BUILD.gn` files were
  normalised inside `ts_library.py` and `bundle_js.gni` rather than edited
  directly, because those `BUILD.gn` files churn with every Chromium roll.
- `WebUIConfigMap::AddWebUIConfigImpl` CHECKs for a duplicate origin. Once
  `kChromeUIScheme` itself reads `astro`, any Astro-side config that
  registers an upstream page under `astro://` a second time crashes at
  startup — `AstroSettingsUIConfig` did this and was deleted. Only pages
  Astro OWNS belong in `RegisterAstroWebUIConfigs()`.
- `tools/policy/webui_scheme_literals.py`, gated by
  `tools/tests/cases/webui-configs-use-the-scheme-constant.sh`, bans a
  hard-coded scheme string in any WebUIConfig construction — it already
  caught an ungoogled patch spelling `"chrome"` by hand. The other eight
  layers above have no such gate yet.

## C++ Conventions

- C++ code follows Chromium style guide (Google C++ style with Chromium extensions).
- All Oxy integrations in self-contained files under `src/chrome/browser/oxy/`.
- Minimal patches to existing Chromium files — surgical hooks, includes, and registrations only.
- After any Mojo/IPC changes, do a clean rebuild of affected targets rather than incremental.

## Development Workflow

### WebUI pages (hot reload)

```bash
cd webui/ntp && bun run dev          # http://localhost:5173
cd webui/alia && bun run dev         # http://localhost:5174
cd webui/whats-new && bun run dev    # http://localhost:5176
```

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
