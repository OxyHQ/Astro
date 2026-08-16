# The WebUI surfaces: settings, the new tab page, adding a page

> Moved out of `AGENTS.md` unchanged.

## Settings: Astro serves it, out of the pak

There is still no Astro error page — it was deleted in `c9c4383` and nothing
replaced it. Settings is different: Astro owns it, and as of
`067-astro-webui-pak-repack.patch` it has assets to serve.

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

WHERE ITS ASSETS COME FROM. Not a directory beside the executable — that
arrangement is gone, along with the diagnostic document older revisions of
this section described. `//chrome/browser/oxy/webui:build_app` runs
`bun run build` in `webui/app` as a GN action, `generate_grd` and `grit` turn
the emitted set into `astro_webui_resources.pak`, and
`067-astro-webui-pak-repack.patch` adds that pak to `chrome_extra_paks` and
reserves its id range in `tools/gritsettings/resource_ids.spec`, so the bytes
land in `resources.pak`. `astro_webui_page.cc` serves them through
`AddResourcePaths` plus a `SetDefaultResource` fallback, which is what makes
`astro://settings/privacy` resolve to the app document and route client-side.

Measured 2026-08-09 on the applied series: 66 resources in the pak, all 66
inside the shipped `resources.pak`, and `index.html`, `astro_webui.js` and
`astro-webui-style.css` extracted from it byte-identical to what Vite emitted.
`astro-settings` is deliberately NOT in `build.sh`'s `REQUIRED_WEBUI_PAGES` —
the app is an input the BUILD consumes, not a bundle the script stages, and
the only thing `build.sh` checks for it is the `bun install` precondition a GN
action cannot satisfy for itself.

Three things follow that are easy to get wrong:

- **The app needs generated Mojo TypeScript bindings, and they are not in
  this repository.** The action depends on `:mojo_bindings_ts__generator` and
  passes its own `root_gen_dir` down as `ASTRO_MOJOM_GEN_DIR`. Without both
  halves Vite compiles against whichever `gen/` the app's `tsconfig.json`
  happens to name — a different build's, or none, which fails the build
  naming the target that fixes it.
- **`manifest.json` in `webui/app` is committed and is the authority** for the
  set of files the app emits. The action compares the build's output against
  it and stops if they disagree, so a resource set changing is a reviewable
  event rather than a silent repack.
- **A release binary contains no filesystem-reading path at all.**
  `astro_webui_dev_source.cc` and the `--astro-webui-dir` switch exist only
  under `astro_webui_dev_tools`, off in every committed configuration.

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
and calls `NotifyOnNativeThemeUpdated()` on the native themes the windows
observe, so they repaint with no restart. Both halves of that last sentence
are load-bearing and the second bullet below is why: dropping the cached
ColorProviders is not what makes an open window repaint.

Five things to know before touching it:

- **One band is still GTK's and it is not a bug in the mixer.** Measured
  2026-08-09 on the built browser: the tabs, toolbar, omnibox, menus and the
  page all take the preset, while the frame band around the tab strip paints
  GTK's colour (`#333333` under Adwaita dark, `#DBD7D3`-ish under Adwaita
  light — it follows `GTK_THEME`, which is how it was identified). The
  ColorProvider resolves `ui::kColorFrameActive` to the preset's `muted`
  correctly; that band is drawn from the GTK frame rather than read from the
  provider. Owned by #24.

- **On Linux the profile always carries a theme supplier, and nobody chose
  it.** `ThemeServiceAuraLinux` installs a `SystemThemeLinux` supplier —
  `ThemeType::kNativeX11` — whenever `extensions.theme.system_theme` names GTK
  or Qt, and `ThemeService` registers that pref with
  `ui::GetDefaultSystemTheme()`, which answers `kGtk` on a GTK desktop. So
  `key.custom_theme` is non-null on every fresh Linux profile. Reading it as a
  boolean — the shape a stand-down guard naturally takes — stands the whole
  mixer down for every Linux user, and looks fine from the pages, which theme
  through Mojo and never consult this key. Ask what KIND of supplier it is;
  `astro_color_mixer.cc` does it with an exhaustive switch so a new upstream
  `ThemeType` is a compile error.
- **`NotifyOnNativeThemeUpdated()` drops the ColorProvider cache globally but
  notifies only its OWN observers, and on Linux the browser windows are not
  among them.** `BrowserWidget::SelectNativeTheme` points every non-incognito
  window at `ui::LinuxUiTheme`'s NativeTheme (GTK or Qt) when one exists;
  incognito stays on `NativeTheme::GetInstanceForNativeUi()`. Notifying one
  instance produces the most misleading state available: every fresh read of a
  ColorProvider is correct — `chrome://theme/colors.css?sets=ui,chrome`
  included — while the open windows keep the pixels they already had and only
  catch up when something else forces a paint, such as a resize. Notify both,
  which is what `ThemeServiceAuraLinux` does when it starts and stops using
  the system theme. Corollary for verification: a colour read through
  colors.css is NOT evidence that a window repainted, and a screenshot taken
  after a resize is not evidence that it repainted on its own.
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

## The new tab page: an entry of the app, on a typed data plane

`webui/ntp` is deleted. The new tab page is `webui/app/src/pages/newtab/`,
React + Bloom, served from `astro_webui_resources.pak` by `AstroNtpUI` on the
shared `astro_webui_page` base — the same pak, the same shell and the same
BloomThemeProvider as `astro://settings`, which is what makes a colour change
in settings repaint the new tab page live, in every open tab, with no reload.

What it speaks is `astro_ntp.mojom`: `GetState` plus six push callbacks and
eleven named methods. What it replaced was six `chrome.send` messages, a
`data-ntp-prefs` attribute the controller spliced into the `<html>` tag, and
five localStorage keys. Rules that came out of the port:

- **No localStorage anywhere in the page.** The notes, the links, the widget
  order and the chosen search engine are profile prefs now, so the browser can
  see them: it validates a URL before the page renders it as a link, the same
  note is in every window (each WebUI host is its own origin, so localStorage
  never could be), and none of it is lost when the origin's storage is
  cleared. #22 requires it and nothing under `pages/newtab/` writes to it.
- **The search engine is the browser's, not the page's.** The page it replaced
  carried a table of five providers and its own choice, so searching from the
  new tab page and searching from the omnibox used different engines and
  nothing said so. The page now sends a query string and
  `AstroNtpPageHandler::SearchWithDefaultEngine` resolves it against
  `TemplateURLService`; the picker lists the profile's own engines and sets the
  real default, refusing when policy pins it. No search endpoint is spelled
  anywhere in the page.
- **Most-visited tiles come from `ntp_tiles::MostVisitedSites`**, which is
  Chromium's own infrastructure, and NOT in an off-the-record profile — the
  handler does not construct it there at all. `ChromeMostVisitedSitesFactory`
  is a source of `//chrome/browser`, which already depends on
  `//chrome/browser/oxy:webui_controllers`, so the include needs the
  `allow_circular_includes_from` entry patch 063 adds rather than a dependency
  edge that would be a cycle.
- **Every URL is validated in the browser, in both directions.** `IsLinkableUrl`
  admits http and https only, on the way in from the page AND on the way out of
  the pref store — the store is a profile file that can be edited, synced or
  written by an older build, and this is the last place before a URL becomes an
  anchor in a privileged page.
- **Two widgets are declared rather than working, and say so on the card.**
  Weather has no data source: a trusted page may not fetch, and #22 requires a
  browser-process broker with a declared endpoint before one exists. Discover
  is shipped static content, not a feed. Both were already non-functional in
  the shipped browser — weather rendered `--` with no explanation — so the port
  keeps the cards and puts the reason in them. Do not "fix" either by adding a
  fetch to the page; `connect-src 'none'` is on that page deliberately.
- **The customize panel exists because the controls did not.** The old page's
  markup carried a whole settings panel — wallpaper, engine, seven toggles, a
  link editor — and both buttons that were supposed to open it navigated to
  `chrome://settings` instead, which had no new-tab controls either. So the
  prefs were registered, watched and pushed live to a page nobody could
  adjust. The panel is on the new tab page rather than in settings so that
  `astro_ntp.mojom` stays bound by one surface.
- **Reordering is buttons, not drag,** and that is the one interaction the port
  did not preserve. react-native-web forwards no HTML5 drag props, and
  `onLayout` never fires for a className'd component on this NativeWind
  preview's web runtime, so the measurement a pointer-driven drag needs never
  arrives. The buttons are also the only version that was ever reachable from a
  keyboard.
- **Two things the port dropped outright**, both dead: the wallpaper setting
  (`applyWallpaper()` was an empty function, so the control never did anything
  even when it was reachable) and the temperature unit (weather-only, and
  weather has no data). The sidebar's Search/Discover tab pair and its empty
  "Recent" list went too — the tabs moved an indicator and nothing else, and
  the list was never populated by any code path.
- **The NTP prefs are spelled TWICE, not three times** — `astro_pref_names.h`
  and `020-register-oxy-prefs.patch`. There is no TypeScript spelling because
  the page names a decision rather than a pref path, which is the concrete
  benefit of the typed interface over the pref bridge it replaced.
  `tools/tests/cases/ntp-pref-ids-match-the-registration.sh` joins the two
  that remain, strictly, in both directions.

## How to Add a New WebUI Page

1. **Create the controller** (`astro_foo_ui.h` / `.cc`) in `src/chrome/browser/oxy/webui/`:
   - Inherit from `content::WebUIController` (simple page) or `ui::MojoWebUIController` (if Mojo IPC needed)
   - Define a `kAstroFooHost` constant for the URL host
   - Create a `UIConfig` class inheriting `content::DefaultWebUIConfig<AstroFooUI>`
   - Declare a `WebUIPage` and let `astro_webui_page.cc` build the data
     source; do not construct one by hand and do not read assets from disk

2. **Add the sources** to `source_set("webui_controllers")` in
   `src/chrome/browser/oxy/BUILD.gn`. `webui/BUILD.gn` holds the
   `mojom("mojo_bindings")` target, the `astro_webui_dev_tools` buildflag and
   the Vite -> `generate_grd` -> `grit` -> `.pak` chain — add a `.mojom` there
   if the page needs one, and bind it from a `MojoWebUIController`.

3. **Register the config** with a numbered patch to
   `chrome/browser/ui/webui/chrome_web_ui_configs.cc`, following
   `patches/astro/05{4,5,8}-*-webui-register.patch`. If upstream already
   registers the host, the patch must SWAP its line, never add one beside it —
   `WebUIConfigMap::AddWebUIConfigImpl` CHECKs on a duplicate origin and the
   browser dies at startup. A whole-file overlay copy is not an option: that
   was defect #7.

   **A swap is only safe when nothing outside the config names the upstream
   controller's CONCRETE TYPE.** `WebUIController::GetAs<T>()` returns
   `nullptr` on a mismatch rather than CHECKing, and the views layer
   routinely dereferences the result without a null check, so replacing the
   config turns into a browser-process crash rather than a page that fails to
   load. Measured: `read_later_side_panel_web_view.{h,cc}` names
   `ReadingListUI` three times — as the base of `SidePanelWebUIViewT<>`, in a
   `WebUIContentsWrapperT<>` constructed in the ctor, and in an unchecked
   `GetAs<ReadingListUI>()->SetActiveTabURL(...)` that runs on every tab
   switch while the panel is open. `first_run_flow_controller.cc` names
   `IntroUI` twice, one of them behind a `DCHECK` — which compiles out, so
   release crashes where a developer build asserts. Seven other surfaces
   (management, feedback, downloads, history, bookmarks, …) name none.
   Before planning any takeover:
   `grep -rn 'WebUIContentsWrapperT<\|SidePanelWebUIViewT<\|GetAs<' chrome/browser/ui/views/`.
   Frontend line counts cannot see this and rank these surfaces backwards:
   reading-list is the smallest of the eight and structurally the most
   entangled.

4. **Add the build edge.** A `BUILD.gn` under `chrome/browser/oxy/` that
   nothing depends on compiles to nothing, silently — the overlay sat in that
   state until `057-oxy-webui-build-edge.patch`. Check the target is reachable
   from `//chrome/browser/ui/webui:configs`.

5. **Create the frontend** as an entry in `webui/app/` (see above), not as a
   new top-level `webui/foo/`.

6. **Nothing to wire — that is the point.** A page whose frontend is an entry
   in `webui/app` sets `.resources = kAstroWebuiResources` and
   `.default_resource = IDR_ASTRO_WEBUI_INDEX_HTML` on its `WebUIPage`, the
   same two values every Astro page uses, because the whole app is one
   multi-entry build in one `.pak`. There is no path to stage, no directory to
   agree about, and a resource the map names but GRIT did not compile is a
   LINK error rather than a blank page found by a user.

   The two LEGACY pages still work the old way: the controllers read
   `<DIR_EXE>/resources/astro-<page>/`, `tools/build.sh` stages
   `webui/<page>/dist` to exactly that path, and the page name must be in
   `REQUIRED_WEBUI_PAGES` or nothing stages it. Those three things have to
   agree and nothing checks that they do — when the controllers read one path
   and build.sh wrote another, every page rendered blank and the build
   reported success. Do not add a third page to that arrangement.

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

The new tab page keeps the host `astro-ntp` and did NOT move to `newtab` when
it was ported, which #22 lists as a requirement. `newtab` is upstream's own
host string and `WebUIConfigMap::AddWebUIConfigImpl` CHECKs on a duplicate
origin, so taking it means swapping a registration rather than adding one —
the whats-new situation below. It also buys nothing yet:
`056-ntp-redirect-to-astro.patch` already points `search::GetNewTabPageURL` at
this host and teaches `IsInstantNTPURL` to recognise it, so every
browser-created new tab lands here and the omnibox already shows `newtab`.
The canonical spelling is settled by the scheme composition of #12; until
then a rename is a CHECK away from a browser that will not start.

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
setting: the same fact is spelled independently in ten places across the
build, and each was found by a separate, unrelated failure. Fixing some of
the ten and not the rest leaves a browser that is broken in ways neither
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
10. `content/browser/webui/url_data_manager_backend.cc` — `kAllDirectives`,
   a hard-coded list of sixteen `CSPDirectiveName` values, decides which
   directives a data source's `OverrideContentSecurityPolicy` ever reaches a
   response header. A directive outside that list is STORED and never asked
   for: no error, no warning, and the source reads as if the policy applied.
   `StyleSrcAttr` was outside it, so five controllers, the shared page base
   and the generated security baseline all correctly stated a directive the
   browser did not have — until a provoked `setAttribute('style', …)` applied
   anyway and the browser named `style-src 'self' 'unsafe-inline'` as the
   policy in force. `072-webui-csp-style-src-attr.patch` adds the one line;
   it is byte-identical for any source that does not set the directive.
   Anything that reads a CSP out of Astro's source rather than off the wire
   inherits this blindness, which is why the check is a provoked violation.

Rules that follow:

- Every one of the ten is applied ONLY when the scheme differs from
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

