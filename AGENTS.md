# Astro — De-Googled Chromium Browser by Oxy

Astro is a Chromium fork that removes all Google services and replaces them with Oxy platform equivalents. Built on 112 ungoogled-chromium patches plus 60 Astro-specific patches. All Oxy code lives in a self-contained overlay (`src/chrome/browser/oxy/`), following the Brave-style approach.

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
  `//chrome/browser/ui/webui:configs`. Measured on 2026-08-08 against the
  applied series: GN now LOADS the overlay, and there is **no dependency
  cycle** through `//chrome/browser/ui` — the cycle this entry used to warn
  about does not exist. Owned by #7.
- `gn gen` then failed on a crate-privilege collision — nothing in `patches/`
  or the overlay — because pulling the ad blocker's Rust target into the graph
  made it fail the test-only rule. Resolved by
  `059-itertools-shipping-group.patch`, which reclassifies `itertools` from
  Chromium's `test` crate group to `safe` in
  `third_party/rust/chromium_crates_io/gnrt_config.toml`. Measured on
  2026-08-08 with the patch applied and the crates re-vendored:
  `Done. Made 29928 targets from 4409 files`, exit 0. Owned by #7.

  Three things from it are durable and outlive the defect:

  - **The override cannot go on the consuming crate.** gnrt's privilege is
    `min(ancestor_privilege, dependency_privilege)` and a group declared on a
    crate replaces only its ANCESTORS, so `[crate.adblock] group = 'safe'`
    changes nothing — the classification has to move on the dependency that
    carries it.
  - **The edit cannot be epoch-scoped, even though the config syntax offers
    it.** `fill_allow_unsafe_settings` in `tools/crates/gnrt/vendor.rs` keys
    its edits on the bare package name, so the next `gnrt vendor` writes a
    bare `[crate.itertools]` beside any `[crate."itertools@v0_13"]` and
    `BuildConfig::validate` then rejects the file for mixing the two forms.
  - **`group` is not an audit verdict.** It records where Chromium itself uses
    a crate. Moving one to `safe` is nonetheless a claim about its source, so
    the patch header carries the unsafe audit backing it — do that for the
    next one too rather than treating the reclassification as clerical.
- **Nothing fails when a patch stops applying — the whole series applying is
  a measurement, never an assumption.** All 172 apply today (112 ungoogled +
  60 Astro), measured 2026-08-09 by the replay described below: 745 files
  seeded pristine (732 from `chromium/src` HEAD, 13 from DEPS
  sub-repositories), 172/172 applied in declared order, no fuzz.
  `build/reports/patch-report.json` is OLDER than that and says so —
  `applied_count: 168` from the last full run against the real checkout — so
  read the replay, not the report, for whether the series applies. Also,
  `docs/astro-next/policy/endpoints.json` declares the non-applying list
  EMPTY, with the replay that emptied it and the three waves of repairs
  written up there. Read it there rather than here; what belongs here is the
  part that has not changed:

  - The declared list is checked only for "is this name in
    `patches/astro/series`". It has never been able to detect a change of
    apply STATUS, and an empty list makes that sharper, not milder — with
    nothing named, the validator examines zero entries and cannot fail.
  - What keeps the list honest is a replay of both series in declared order
    against a scratch tree holding the pristine version of every file any
    patch names, with `git apply --check --whitespace=nowarn` as the
    acceptance test — the same test `apply-patches.sh` uses. No fuzz, no
    `--3way`, no `--recount`. It needs a Chromium checkout, so no gate runs
    it automatically.
  - The replay must read pristine input from TWO places. Thirteen of the
    files the series touches live inside `gclient`-fetched DEPS subrepos
    recorded as gitlinks, so `git show HEAD:<path>` cannot read them and a
    replay that skips them reports failures that are its own blindness — that
    mistake once produced eight phantom ungoogled failures from a single
    root cause.
  - Two failure shapes recur and look nothing alike. A MALFORMED patch (hunk
    headers whose line counts disagree with their bodies) is rejected against
    any tree at all, so it has never applied anywhere; `--recount` parses it,
    which identifies the cause and is not a fix. A patch generated by diffing
    an ALREADY-PATCHED tree against pristine carries edits belonging to
    somebody else's patch, so it applies to the pristine file and fails in
    series. A per-patch check against a pristine tree calls the second kind
    healthy, which is why the replay runs the series in order.
- Every WebUI page serves its assets by reading a directory next to the
  executable at runtime (`base::DIR_EXE` + `resources/astro-<page>`) rather
  than from a `.pak`, so none of them carries Chromium's resource-bundling
  guarantees. Removing `DIR_EXE` entirely is owned by #14 (packaging: #16).
  The three legacy pages still render BLANK, with no error, when their
  directory is missing. Pages built on `astro_webui_page.cc` do not: it logs
  the absolute path it tried and serves a document naming it. Settings is the
  only such page today, and it has no assets at all in this pipeline — see
  the settings section below before reporting the takeover as working.

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
├── astro_pref_names.h               # Astro's own pref paths, as constants
├── astro_theme_service.*            # KeyedService: watches the mode and preset
│   astro_theme_service_factory.*    #   prefs, repaints the native UI, notifies
│                                    #   the pages. Built with the profile.
├── ui/astro_color_tokens.h          # GENERATED from Bloom's tokens.json by
│                                    #   tools/generate-color-mixer.py. Never
│                                    #   hand-edit: a build-safety case
│                                    #   regenerates it and compares.
├── ui/astro_color_mixer.*           # Bloom token -> Chromium ColorId, by hand.
│                                    #   Called last from AddChromeColorMixers
│                                    #   (patch 061); computes no colour.
└── webui/                           # WebUI page controllers
    ├── BUILD.gn                     # mojom("mojo_bindings") ONLY. The
    │                                #   controllers are sources of the parent
    │                                #   target //chrome/browser/oxy:webui_controllers.
    ├── astro_theme.mojom            # GetTheme + OnThemeChanged. READ ONLY, and
    │                                #   bound by every Astro page.
    ├── astro_settings.mojom         # SetThemeMode / SetColorPreset. Named
    │                                #   methods only — never SetPref(string,…).
    ├── astro_webui_page.*           # Shared base: asset serving (the one seam
    │                                #   #16 replaces), per-host CSP, and the
    │                                #   plain and Mojo controller bases.
    ├── astro_theme_provider.*       # Serves astro_theme.mojom for one page.
    ├── astro_settings_ui.*          # astro://settings controller + config
    ├── astro_settings_page_handler.* # Browser side of astro_settings.mojom
    ├── astro_ntp_ui.*               # chrome://astro-ntp controller
    ├── astro_alia_ui.*              # chrome://alia controller
    └── astro_whats_new_ui.*         # chrome://whats-new controller
```

### WebUI frontend pages

```
webui/
├── app/           # WHERE NEW WORK GOES. One Vite + Tailwind v4 + Bloom
│                  #   application serving every astro:// surface, one entry
│                  #   per WebUI host (each host is a separate origin, so the
│                  #   entry is chosen from location.hostname). Not yet served
│                  #   by any controller and not in build.sh's staging list —
│                  #   the GN/grit/pak wiring is #14.
├── ntp/           # New Tab Page (Vite + Tailwind v4)
├── alia/          # Alia AI Panel
└── whats-new/     # What's New Page
```

The three legacy pages keep their current from-disk serving until the app
absorbs them; do not start a fourth one beside them.

### Other directories

```
patches/ungoogled/   # 112 inherited de-Google patches
patches/astro/       # 60 Astro-specific patches (numbered 001-063; 007 and 035 were
                     #   removed as empty files and 012 was retired by 060, so
                     #   three numbers are unused)
gn_args/             # GN build args per platform (linux.gn, android.gn, macos.gn, windows.gn, etc.)
branding/            # Logos, icons, astro.conf, .desktop file
tools/               # Build, install, patch, packaging scripts
```

## Settings: Astro serves it, and it has no assets yet

There is still no Astro error page — it was deleted in `c9c4383` and nothing
replaced it. Settings is different now, and the difference has a sharp edge.

HISTORY, because this file used to lie about it. The Mojo settings backend
older revisions of this document described never existed: no `.mojom` was
committed to this repository at any revision before 2026-08-09. What `c9c4383`
removed was a generic `chrome.send` handler carrying six messages and
thirty-four prefs. `AstroSettingsHandler`, `kProfilePrefMappings[]` and the
"add a setting in three steps" recipe all described something never built.

WHAT IS TRUE NOW. `060-settings-webui-takeover.patch` swaps upstream's
`settings::SettingsUIConfig` for `astro::AstroSettingsUIConfig`, under
upstream's own host. The controller binds two typed Mojo interfaces
(`astro_theme.mojom` read-only, `astro_settings.mojom` for the writes) and
adopts four upstream handlers wholesale — `BrowserLifetimeHandler`,
`ClearBrowsingDataHandler`, `SearchEnginesHandler`, `AboutHandler`.

THE SHARP EDGE, declared rather than hidden: **the page has no assets.**
`webui/app` is not built by `tools/build.sh` and `astro-settings` is not in
its `REQUIRED_WEBUI_PAGES`, so `<DIR_EXE>/resources/astro-settings/` does not
exist in any build this pipeline produces. Navigating to `astro://settings`
in such a build gets the diagnostic document `astro_webui_page.cc` generates:
a page naming the absent directory, plus a `LOG(ERROR)` naming it. That is
deliberate — the deleted settings surface rendered BLANK with no error, and
that is what condemned it — but it means this branch's browser has no working
settings page until the packaging in #16 lands. Do not report the takeover as
"settings works".

WHY THE SAME HOST. `settingsPrivate` and seven other extension APIs are
granted by host pattern in the two `_api_features.json` files, and the pattern
names the settings host — `grep -n 'chrome://settings/\*'` finds six in
`chrome/common/extensions/api/` and two in `extensions/common/api/`. Any other
host gets no bindings, silently. Registering a second
config for the same origin is not an option either:
`WebUIConfigMap::AddWebUIConfigImpl` CHECKs on a duplicate. Swapping the line
is the only shape that satisfies both.

The rest of the direction — one Vite + Tailwind + Bloom application serving
every `astro://` surface, one entry per host, narrow typed Mojo per domain and
never a generic `SetPref(string, value)` — is issues #15, #14, #22, #17 and
#24. Nothing about it is documented here until it exists.

### Theming reaches the native UI

Changing the theme in settings re-colours the browser, not just the page. The
mode is upstream's `browser.theme.color_scheme2`; the Bloom colour preset is
Astro's own `astro.theme.preset`. `AstroThemeService` watches both, pushes the
preset into `astro::AddAstroColorMixers` (patch 061, called last so it wins),
and calls `NativeTheme::NotifyOnNativeThemeUpdated()`, which drops the cached
ColorProviders so open windows repaint with no restart.

Two things to know before touching it:

- **The preset is process-global in v1.** A `ColorProvider` is keyed by
  `ui::ColorProviderKey`, which carries no profile, so with two profiles open
  the last write wins for every window. Recorded on #24, not fixed here.
- **`astro.theme.preset` is spelled in three places** — `astro_pref_names.h`,
  the registration inside `020-register-oxy-prefs.patch`, and
  `pref-ids.ts` — because a patch edits an upstream file and cannot include an
  overlay header. `PrefService::GetString` on an unregistered path returns
  empty rather than failing, so a rename that misses one produces a control
  that moves and changes nothing.
  `tools/tests/cases/theme-pref-ids-match-across-the-boundary.sh` is the only
  thing that compares them.

## How to Add a New WebUI Page

1. **Create the controller** (`astro_foo_ui.h` / `.cc`) in `src/chrome/browser/oxy/webui/`:
   - Inherit from `content::WebUIController` (simple page) or `ui::MojoWebUIController` (if Mojo IPC needed)
   - Define a `kAstroFooHost` constant for the URL host
   - Create a `UIConfig` class inheriting `content::DefaultWebUIConfig<AstroFooUI>`
   - In the constructor, set up `WebUIDataSource` to serve the Vite-built assets from disk

2. **Add the sources** to `source_set("webui_controllers")` in
   `src/chrome/browser/oxy/BUILD.gn`. `webui/BUILD.gn` holds the
   `mojom("mojo_bindings")` target and nothing else — add a `.mojom` there if
   the page needs one, and bind it from a `MojoWebUIController`.

3. **Register the config** with a numbered patch to
   `chrome/browser/ui/webui/chrome_web_ui_configs.cc`, following
   `patches/astro/05{4,5,8}-*-webui-register.patch`. If upstream already
   registers the host, the patch must SWAP its line, never add one beside it —
   `WebUIConfigMap::AddWebUIConfigImpl` CHECKs on a duplicate origin and the
   browser dies at startup. A whole-file overlay copy is not an option: that
   was defect #7.

4. **Add the build edge.** A `BUILD.gn` under `chrome/browser/oxy/` that
   nothing depends on compiles to nothing, silently — the overlay sat in that
   state until `057-oxy-webui-build-edge.patch`. Check the target is reachable
   from `//chrome/browser/ui/webui:configs`.

5. **Create the frontend** as an entry in `webui/app/` (see above), not as a
   new top-level `webui/foo/`.

6. **Wire the assets.** Today the controllers read
   `<DIR_EXE>/resources/astro-<page>/`, `tools/build.sh` stages
   `webui/<page>/dist` to exactly that path, and the page name must be in
   `REQUIRED_WEBUI_PAGES` or nothing stages it. Those three have to agree, and
   nothing checks that they do: when the controllers read one path and
   build.sh wrote another, every page rendered blank and the build reported
   success. Removing `DIR_EXE` in favour of a `.pak` is #14.

## WebUI Page URLs

| Page | Internal URL | Displayed as |
|------|-------------|-------------|
| New Tab | `chrome://astro-ntp` | `astro://newtab` |
| Settings | `chrome://settings` | `astro://settings` |
| Alia AI | `chrome://alia` | `astro://alia` |
| What's New | `chrome://whats-new` | `astro://whats-new` |

Settings is Astro's since `060-settings-webui-takeover.patch`, on upstream's
own host and by swapping upstream's registration — see the settings section
above, including the part where it has no assets to serve yet.

`chrome://astro-error` is NOT in this table: the error page was deleted and
nothing replaced it.

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
cd webui/ntp && bun run dev          # Vite default: 5173, or the next free port
cd webui/alia && bun run dev
cd webui/whats-new && bun run dev
```

Only `webui/app` pins a port, and the two reasons are worth carrying: 5173 is
taken by `~/Oxy/website`'s dev server on this machine, and Vite's default
behaviour on a busy port is to silently take the next one — which already
produced a session that curled another project's app and read its HTML as this
one's. The other three set no port at all, so their numbers depend on start
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
