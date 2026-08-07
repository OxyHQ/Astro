# Astro — De-Googled Chromium Browser by Oxy

Astro is a Chromium fork that removes all Google services and replaces them with Oxy platform equivalents. Built on 112 ungoogled-chromium patches plus 56 Astro-specific patches. All Oxy code lives in a self-contained overlay (`src/chrome/browser/oxy/`), following the Brave-style approach.

## Build Commands

```bash
tools/fetch-chromium.sh          # Fetch Chromium source (~55 GB, first time only)
tools/sync-ungoogled.sh          # Get matching ungoogled-chromium patches
tools/apply-patches.sh           # Apply all patches (ungoogled + Astro)
tools/sync-overlay.sh            # Copy Astro overlay into the Chromium tree
tools/build.sh                   # Release build (uses all CPU cores)
tools/build.sh Debug             # Debug build
tools/install-local.sh           # Install to system
tools/package-release.sh         # Package for distribution
tools/update-chromium.sh VER     # Update to a new Chromium version
tools/apply-branding.sh          # Apply branding from branding/astro.conf
tools/vendor-adblock-rust.sh     # Vendor Rust adblock engine dependencies
tools/tests/run.sh               # Build-safety suite (no Chromium checkout needed)
```

`--dry-run` works on `apply-patches.sh`, `sync-overlay.sh` and `build.sh`: it
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

**Known defects, declared rather than hidden.** Do not "fix" these silently, and
do not let a build imply they are resolved:

- Domain substitution has never run (Python regexes fed to `sed`, error
  discarded). `apply-patches.sh` refuses; `--skip-domain-substitution`
  reproduces what previous builds did. Owned by #8.
- A whole-file overlay copy of `chrome/browser/ui/webui/chrome_web_ui_configs.cc`
  reverts four patches, so `AstroAdBlockUIConfig` is never registered. The copy
  is currently untracked working-tree content, not committed state; the
  collision is declared in `tools/overlay.allowlist` so any checkout carrying
  it behaves loudly. Owned by #7.

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
│   └── rs/                          # Rust source + BUILD.gn
└── webui/                           # WebUI page controllers
    ├── astro_ntp_ui.*               # chrome://astro-ntp controller
    ├── astro_settings_ui.*          # chrome://settings controller (Mojo PageHandlerFactory)
    ├── astro_settings_handler.*     # Settings Mojo PageHandler implementation
    ├── astro_settings.mojom         # Mojo interface definition for settings IPC
    ├── astro_alia_ui.*              # chrome://alia controller
    ├── astro_whats_new_ui.*         # chrome://whats-new controller
    └── astro_error_ui.*             # chrome://astro-error controller
```

### WebUI frontend pages

```
webui/
├── ntp/           # New Tab Page (Vite + Tailwind v4)
├── settings/      # Settings Page (Vite + Tailwind v4, uses Mojo bindings)
├── alia/          # Alia AI Panel
├── whats-new/     # What's New Page
└── error/         # Error Page
```

### Other directories

```
patches/ungoogled/   # 112 inherited de-Google patches
patches/astro/       # 56 Astro-specific patches (numbered 001-056)
gn_args/             # GN build args per platform (linux.gn, android.gn, macos.gn, windows.gn, etc.)
branding/            # Logos, icons, astro.conf, .desktop file
tools/               # Build, install, patch, packaging scripts
```

## Mojo Architecture (Settings Page)

The settings page uses Chromium's Mojo IPC for type-safe communication between the JavaScript frontend and the C++ browser process. This is the same pattern used by Chrome's internal pages.

### How it works

1. **Interface definition** (`astro_settings.mojom`): Defines three interfaces:
   - `PageHandlerFactory` — Creates the PageHandler when the page loads
   - `PageHandler` — Browser-side: `GetAllPrefs()`, `SetPref()`, `SetTheme()`, `ClearBrowsingData()`, `OpenPage()`
   - `Page` — WebUI-side: `OnPrefChanged()` for live push notifications

2. **Controller** (`astro_settings_ui.*`): Inherits `MojoWebUIController` and implements `PageHandlerFactory`. Binds the Mojo interface and creates `AstroSettingsHandler` instances on demand.

3. **Handler** (`astro_settings_handler.*`): Implements `PageHandler`. Contains the pref mapping table that maps frontend setting IDs to real Chromium `PrefService` paths. Uses `PrefChangeRegistrar` to watch for changes and push updates to the page via `Page::OnPrefChanged()`.

4. **Frontend** (`webui/settings/`): Uses the generated Mojo JS bindings to call `PageHandler` methods and receive `Page` callbacks.

### Pref mapping table

The handler contains two static arrays:

- `kProfilePrefMappings[]` — Per-profile prefs (autofill, appearance, privacy, NTP widgets, etc.)
- `kLocalStatePrefMappings[]` — Global prefs (memory saver, energy saver, hardware acceleration)

Each entry maps a `settings_id` (string used in the frontend JS, matches `data-toggle-id` / `data-select-id` / `data-slider-id` HTML attributes) to a `pref_path` (Chromium PrefService path).

## How to Add a New Setting

1. **Register the pref** in patch `020-register-oxy-prefs.patch`. Profile prefs go in `RegisterProfilePrefs()`, local state prefs in `RegisterLocalState()`.

2. **Add the mapping** in `astro_settings_handler.cc`:
   - Add to `kProfilePrefMappings[]` or `kLocalStatePrefMappings[]`
   - Format: `{"frontend-setting-id", "chromium.pref.path"}`

3. **Add the UI** in `webui/settings/`:
   - Add the control (toggle, select, slider) in the appropriate section
   - Set `data-toggle-id="frontend-setting-id"` (or `data-select-id` / `data-slider-id`) matching the mapping

The Mojo plumbing, pref watching, and live sync all happen automatically through the existing infrastructure.

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
| Settings | `chrome://settings` | `astro://settings` |
| Alia AI | `chrome://alia` | `astro://alia` |
| What's New | `chrome://whats-new` | `astro://whats-new` |
| Error | `chrome://astro-error` | `astro://error` |

The `astro://` URL scheme is aliased to `chrome://` via patch `011-astro-url-scheme-alias.patch`.

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
cd webui/settings && bun run dev     # http://localhost:5175
cd webui/whats-new && bun run dev    # http://localhost:5176
cd webui/error && bun run dev        # http://localhost:5177
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
