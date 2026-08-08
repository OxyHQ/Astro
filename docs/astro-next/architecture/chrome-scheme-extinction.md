# `chrome://` scheme extinction — inventory, classification and costed plan

Costing input for the product decision:

> **Astro does not expose `chrome://` as a supported internal URL namespace.
> `astro://` is the canonical trusted internal namespace and `astro-untrusted://`
> is the canonical untrusted internal namespace.**

This **supersedes** the earlier roadmap position (#13) that Chromium diagnostics
would remain at `chrome://version`, `chrome://flags`, `chrome://gpu`. Target end
state: `astro://version` works; `chrome://version` does not work as an Astro
WebUI.

This document is a **plan, not an implementation**. Nothing outside this file was
modified. It is hand-maintained (not generated) and every claim carries a
`file:line` citation.

---

## 0. Provenance

| | |
|---|---|
| Chromium | `146.0.7680.177`, commit `ae03f7fb2cf1215853896d6a4c15fdceee2badb7` (`browser.lock.json`) |
| Checkout | `/home/nate/Oxy/Astro/chromium/src` |
| Tree state | **Not pristine.** The ungoogled+Astro patch stack is applied *and* an in-progress `//astro` integration is present. All line numbers below are **post-patch working-tree numbers**, i.e. what `sed -n '<line>p' <file>` prints today. |
| Binary consulted | `out/PipelineCheck/chrome` (Linux x64 release, built 2026-08-07 12:22, `out/PipelineCheck/args.gn`) — used only to read **built resource bundles**, not run. |

Two pre-existing facts about the tree that a reader will otherwise mistake for
findings of this document:

- `content/public/browser/webui_config_map.cc:84-99` already carries an
  Astro-authored generalisation: `TrustedWebUISchemes()` / `UntrustedWebUISchemes()`
  fed by the **new** hooks `ContentBrowserClient::GetAdditionalTrustedWebUISchemes`
  and `GetAdditionalUntrustedWebUISchemes`
  (`content/public/browser/content_browser_client.h:609`, `:616`). These do **not**
  exist upstream — `docs/astro-next/architecture/astro-scheme-hooks.md:107-115`
  explicitly said this shape "does not exist upstream and should not be
  invented". It has since been invented. That is a decision already taken, and
  this plan builds on it rather than relitigating it.
- Two `LOG` statements marked temporary instrumentation are live in the tree:
  `content/public/browser/webui_config_map.cc:165-167` (`astro-stage: A getconfig`,
  runs on **every** WebUI config lookup) and
  `content/browser/loader/navigation_url_loader_impl.cc:687-695`
  (`astro-stage: E loader-select`, `LOG(WARNING)` on **every** WebUI navigation,
  and it string-builds the scheme list each time). Neither belongs in a shipped
  build. Flagged here because this document's readers are the people who will
  ship it; owner is whoever authored the staging patch.

Reproduce a pristine-upstream line number with
`git -C chromium/src show HEAD:<path> | sed -n '<line>p'`.

**Companion document.** `docs/astro-next/architecture/astro-scheme-hooks.md`
answers "what does Chromium offer an embedder that wants a first-class WebUI
scheme". This document answers the different question "what does it cost to take
`chrome://` away". They overlap only in §4 here, which supersedes that document's
§2 where the tree has moved.

---

## 1. Executive summary

| Question | Answer |
|---|---|
| WebUI hosts registered on desktop | **160** (136 trusted `chrome://` from `chrome/`, 16 trusted `chrome://` from `content/`, 8 untrusted `chrome-untrusted://`) |
| …plus ChromeOS/ash, not compiled for Astro | 85 (69 trusted + 16 untrusted) — **245 registrations tree-wide** |
| …plus hosts served with **no** `WebUIConfig` | 3 declared (`chrome/browser/ui/webui/chrome_urls/chrome_urls_handler.cc:31-37`) + 3 hard-wired in the loader (`content/browser/webui/web_ui_url_loader_factory.cc:306`, `:320-321`) + ~10 data-source-only hosts (§3.3) |
| Registration mechanism | `WebUIConfigMap` for **all 160**. `ChromeWebUIControllerFactory` retains **zero** `chrome://` hosts — it returns a controller only for `devtools://` (`chrome/browser/ui/webui/chrome_web_ui_controller_factory.cc:166-181`) |
| Classification totals (proposed) | over the **158 distinct host names**: KEEP_AND_MOVE_TO_ASTRO **51** · REPLACE_WITH_ASTRO **20** · REMOVE_FROM_PRODUCT **65** · DEV_ONLY **22** |
| Can existing controllers be reused under `astro://`? | **Yes for the C++ controller. No for the config object, and no for the shipped JS.** See §5 — the JS is the real cost. |
| Minimum delta to stop `chrome://` being navigable | De-registration is **not sufficient** (§6 lists six residues that survive it). Needs de-registration **plus** an explicit refusal **plus** one `content/` change. |
| Test cost | **677 C++ test files / 2,623 occurrences**, concentrated in 60 files under `content/browser/`; plus 1,780 TS files in `chrome/test/data/webui/` whose cost is one build-config change, not 1,780 edits (§7) |
| Biggest risk | **§10.1** — a reused Chromium WebUI's shipped bundle imports `chrome://resources/...` at runtime, and `content/browser/webui/web_ui_url_loader_factory.cc:284-295` answers a cross-scheme request by **killing the renderer**. Measured in the real build. |

---

## 2. Host inventory

### 2.1 Counts by registration mechanism

| Mechanism | File | Trusted | Untrusted | Compiled for Astro desktop? |
|---|---|---:|---:|---|
| `WebUIConfigMap` | `chrome/browser/ui/webui/chrome_web_ui_configs.cc:243-473` | 136 | — | yes |
| `WebUIConfigMap` | `chrome/browser/ui/webui/chrome_untrusted_web_ui_configs.cc:47-68` | — | 8 | yes |
| `WebUIConfigMap` | `content/browser/webui/content_web_ui_configs.cc:36-57` | 16 | — | yes |
| `WebUIConfigMap` | `chrome/browser/ui/webui/ash/config/chrome_web_ui_configs_chromeos.cc` | 69 | — | **no** (ChromeOS) |
| `WebUIConfigMap` | `chrome/browser/ui/webui/ash/config/chrome_untrusted_web_ui_configs_chromeos.cc` | — | 16 | **no** (ChromeOS) |
| `ChromeWebUIControllerFactory` | `chrome/browser/ui/webui/chrome_web_ui_controller_factory.cc:166-181` | 0 | 0 | n/a — `devtools://` only |
| **Desktop total** | | **152** | **8** | **160** |

Method (reproducible):

```bash
cd chromium/src
tr '\n' ' ' < chrome/browser/ui/webui/chrome_web_ui_configs.cc \
  | grep -oE 'map\.AddWebUIConfig\([[:space:]]*std::make_unique<[^>]*>' | wc -l   # 136
```
Every registration in all five files uses `std::make_unique<…>`; a grep for
`map.Add…WebUIConfig(` forms *without* `std::make_unique<` returns nothing, so the
count is complete for this mechanism. Hosts were resolved by locating each config
class's declaration, extracting the `k…Host` constant it passes to
`WebUIConfig(scheme, host)`, and resolving that constant against 784
`k…Host[]`/`k…URL[]` definitions harvested tree-wide. 4 of 245 needed manual
resolution; all 4 are named in §2.4.

**`ChromeWebUIControllerFactory` is no longer a `chrome://` registration
mechanism.** `GetWebUIFactoryFunction`
(`chrome/browser/ui/webui/chrome_web_ui_controller_factory.cc:166-181`) early-returns
`nullptr` for anything that is not `content::kChromeDevToolsScheme` (`:171-173`).
The factory still carries two non-registration duties that a plan must not
overlook: favicon bytes per host (`:373-476`, 15 hard-coded host comparisons) and
`GetWebUIType` dispatch. Both are `chrome://`-host-keyed and both become dead for
any host Astro moves.

### 2.2 Desktop trusted hosts (152)

From `chrome/browser/ui/webui/chrome_web_ui_configs.cc` (136):

```
access-code-cast accessibility actor-internals actor-overlay app-service-internals
app-settings apps autofill-internals batch-upload bluetooth-internals bookmarks
bookmarks-side-panel.top-chrome browser-switch cast-feedback certificate-manager
chrome-signin chrome-urls color-pipeline-internals comments-side-panel.top-chrome
commerce-internals components conflicts connection-help connection-monitoring-detected
connectors-internals constrained-test contextual-tasks crashes credits
customize-chrome-side-panel.top-chrome data-sharing-internals debug-webuis-disabled
default-browser-modal device-log discards dlp-internals download-internals downloads
extensions extensions-zero-state family-link-user-internals feedback flags
gcm-internals glic glic-fre history history-clusters-internals
history-clusters-side-panel.top-chrome history-side-panel.top-chrome
history-sync-optin infobar-internals inspect internals interstitials intro
legion-internals linux-proxy-config local-state location-internals
managed-user-profile-notice management media-engagement media-router-internals
memory-internals metrics-internals net-export net-internals new-tab-page
new-tab-page-third-party newtab newtab-footer notifications-internals
ntp-tiles-internals omnibox omnibox-popup.top-chrome on-device-internals
on-device-translation-internals optimization-guide-internals password-manager
password-manager-internals policy predictors print privacy-sandbox-dialog
privacy-sandbox-internals profile-customization profile-internals profile-picker
read-later.top-chrome regional-capabilities-internals reset-password safe-browsing
sandbox saved-tab-groups-unsupported search-engine-choice segmentation-internals
settings shopping-insights-side-panel.top-chrome signin-dice-web-intercept.top-chrome
signin-email-confirmation signin-error signin-internals signout-confirmation
site-engagement skills snippets-internals suggest-internals support-tool
sync-confirmation sync-internals system tab-group-home tab-search.top-chrome
tab-strip-internals tab-strip.top-chrome terms topics-internals translate-internals
unexportable-keys-internals ungoogled-first-run updater usb-internals user-actions
user-education-internals version view-cert watermark webapks web-app-internals
webrtc-logs webui-browser webui-gallery webuijserror webui-toolbar.top-chrome
whats-new
```

From `content/browser/webui/content_web_ui_configs.cc` (16):

```
attribution-internals gpu histograms indexeddb-internals media-internals
network-errors private-aggregation-internals process-internals quota-internals
serviceworker-internals traces traces-internals tracing ukm webrtc-internals
webxr-internals
```

`ungoogled-first-run` is **not upstream** — it is added by the ungoogled patch
stack and is the only registration in the tree that passes scheme and host as
raw string literals rather than constants:
`chrome/browser/ui/webui/ungoogled_first_run.h:132`
(`DefaultWebUIConfig("chrome", "ungoogled-first-run")`). It disappears with the
patch stack (#8).

### 2.3 Desktop untrusted hosts (8)

`chrome/browser/ui/webui/chrome_untrusted_web_ui_configs.cc:47-68`:

```
compose  data-sharing  lens  lens-overlay  ntp-microsoft-auth  print
privacy-sandbox-dialog  read-anything-side-panel.top-chrome
```

`print` and `privacy-sandbox-dialog` exist under **both** schemes — trusted shell
plus untrusted content frame. They are two hosts, not one, because
`url::Origin` includes the scheme.

### 2.4 Configs whose host needed manual resolution

| Config | Resolution | Cite |
|---|---|---|
| `UngoogledFirstRunUIConfig` | raw literals `"chrome"`, `"ungoogled-first-run"` | `chrome/browser/ui/webui/ungoogled_first_run.h:132` |
| `extensions::ZeroStatePromoControllerConfig` | `chrome::kChromeUIExtensionsZeroStatePromoHost` = `extensions-zero-state` | `chrome/browser/ui/webui/extensions_zero_state_promo/zero_state_promo_ui.h:63` |
| `vc_background_ui::VcBackgroundUIConfig` | `kChromeUIVcBackgroundHost` (ChromeOS) | `ash/webui/vc_background_ui/vc_background_ui.cc:61-64` |
| `borealis::BorealisMOTDUIConfig` | ChromeOS, declaration not in `chrome/**/*.h` | `not-determined`; settle with `grep -rn 'BorealisMOTDUIConfig' chromium/src --include=*.h` |

### 2.5 Upstream bug worth knowing about

`profile-internals` is registered as a config
(`chrome/browser/ui/webui/chrome_web_ui_configs.cc:351`, class at
`chrome/browser/ui/webui/profile_internals/profile_internals_ui.h:22-27`) **and**
listed in `WebUIHostsWithoutConfigs()`
(`chrome/browser/ui/webui/chrome_urls/chrome_urls_handler.cc:32`), so it appears
twice on `chrome://chrome-urls`. The true count of "hosts without configs" is
therefore **3**, not the 4 the array declares. Anyone porting that array should
drop the stale entry rather than carry it.

---

## 3. Navigable vs internal — the crux

This is the distinction that decides whether removing a host is a product change
or a broken browser. Chromium provides **three** mechanical signals, and they do
not agree with each other, which is exactly why this must be read off the tree
rather than guessed.

### 3.1 Signal 1 — `ChromeURLHosts()`: the *listed and typeable* set

`chrome/common/webui_url_constants.cc:75-241` declares **107** host constants.
This array is what `chrome://chrome-urls` shows and what the built-in omnibox
provider offers as user types
(`components/omnibox/browser/autocomplete_provider_client.h:134,140`; the file's
own header comment says so at `chrome/common/webui_url_constants.cc:27-28`).

Diffing it against the 152 registered desktop trusted hosts:

- **88 registered hosts are in `ChromeURLHosts()`** → declared user-facing.
- **64 registered hosts are NOT** → internal by upstream's own declaration.
- **20 hosts are in `ChromeURLHosts()` but registered nowhere on desktop** → 14
  are ChromeOS (`os-settings`, `oobe`, `network`, `power`, …) and 6 are served by
  a mechanism other than `WebUIConfig` (§3.3): `about`, `blob-internals`, `dino`,
  `extensions-internals`, `help`, `prefs-internals`.

`ChromeDebugURLs()` (`chrome/common/webui_url_constants.cc:244-279`) is a
separate list of ~20 crash/hang/quit URLs that are **not WebUIs at all** — see
§3.4.

### 3.2 Signal 2 — `.top-chrome`: WebUI rendered into browser chrome, never a tab

13 desktop hosts carry the `.top-chrome` suffix. `IsTopChromeWebUIURL`
(`chrome/common/webui_url_utils.cc:12-15`) tests
`url.SchemeIs(content::kChromeUIScheme) && url.DomainIs(chrome::kChromeUITopChromeDomain)`
and drives process-model decisions at
`chrome/browser/chrome_content_browser_client.cc:2357`, `:3926`, `:5575`, `:7935`.

**The dot is load-bearing, not cosmetic.** `IsWebUIAndUsesTLDForProcessLockURL`
(`content/browser/site_info.cc:53-74`) gives any WebUI host with two or more
non-empty dot-separated domains a process lock keyed on the **TLD**, so all 13
`.top-chrome` hosts deliberately share one renderer process lock
(`chrome://top-chrome`) while keeping distinct site URLs. That function is
already scheme-generic — it tests membership in
`URLDataManagerBackend::GetWebUISchemes()` at `:54-57` — so `astro://x.top-chrome`
would inherit the same sharing automatically.

Consequence for the plan: **if Astro flattens these names** (`astro://tab-search`
instead of `astro://tab-search.top-chrome`) it silently converts one shared
renderer into up to 13, with no warning anywhere. `astro-scheme-hooks.md:506-511`
flagged dotted hosts as a hazard; the measurement here shows upstream is
*relying* on the behaviour, so for these hosts the dotted form is the correct
choice, not the trap.

### 3.3 Signal 3 — served without a `WebUIConfig`

These are the ones that break the browser if treated as ordinary pages.

| Host | Served by | Navigable? | Cite |
|---|---|---|---|
| `chrome://resources/*` | data source constructed unconditionally in `URLDataManagerBackend`'s ctor | **yes, and serves bytes** | `content/browser/webui/url_data_manager_backend.cc:88-92` |
| `chrome-untrusted://resources/*` | same, origin-keyed name | yes | `content/browser/webui/url_data_manager_backend.cc:95-99` |
| `chrome://blob-internals` | hard-wired branch in the WebUI loader factory, **no WebUI object** | yes | `content/browser/webui/web_ui_url_loader_factory.cc:306-314` |
| `chrome://dino`, `chrome://network-error/<n>` | hard-wired branch, synthesises a net error | yes | `content/browser/webui/web_ui_url_loader_factory.cc:319-329`, `content/browser/webui/network_error_url_loader.cc:17-39` |
| `chrome://theme/*` | `ThemeSource` via `URLDataSource::Add`, 54 registration sites incl. profile-scoped `InstantService` | yes | `chrome/browser/ui/webui/theme_source.cc` `GetSource()`; `chrome/browser/search/instant_service.cc:84` |
| `chrome://favicon/*`, `chrome://favicon2/*`, `chrome-untrusted://favicon2/` | `FaviconSource` | yes | `chrome/browser/ui/webui/favicon_source.cc` `GetSource()` |
| `chrome://image/*` | `SanitizedImageSource` | yes | `chrome/browser/ui/webui/sanitized_image_source.cc` `GetSource()` |
| `chrome://app-icon/*`, `chrome://extension-icon/*`, `chrome://fileicon/*` | icon sources | yes | `chrome/browser/apps/app_service/app_icon_source.cc`; `chrome/browser/ui/webui/extensions/extension_icon_source.cc`; `chrome/browser/ui/webui/fileicon_source.cc` |
| `chrome://prefs-internals`, `chrome://extensions-internals` | plain `URLDataSource`, no controller | yes | `chrome/browser/ui/webui/prefs_internals_source.cc:25`; `chrome/browser/ui/webui/extensions/extensions_internals_source.cc:605` |
| `chrome://about`, `chrome://credits`, `chrome://terms`, … | `AboutUIHTMLSource`, source name is a runtime string | yes | `chrome/browser/ui/webui/about/about_ui.cc:466-473` |
| `chrome-untrusted://new-tab-page/`, `chrome-untrusted://theme/` | `UntrustedSource`, `ThemeSource(untrusted)` | yes | `chrome/browser/ui/webui/new_tab_page/untrusted_source.cc`; `chrome/browser/ui/webui/theme_source.cc` |

**`chrome://resources` is the one that matters most**, because it is not a page —
it is the shared asset root every WebUI's JavaScript imports from. §5 and §10.1
follow from it.

### 3.4 Not WebUI at all — do not classify these as hosts

- **Debug URLs.** `chrome://crash`, `chrome://kill`, `chrome://hang`,
  `chrome://gpuhang`, `chrome://quit`, `chrome://restart`, … are intercepted
  before any WebUI machinery: `content/browser/renderer_host/debug_urls.cc:57`
  and `:126`, and Blink's `third_party/blink/common/chrome_debug_urls.cc:37`,
  which tests the **raw literal** `url.SchemeIs("chrome")` with no constant and
  no hook. `chrome://quit` and `chrome://restart` are additionally handled by
  `HandleNonNavigationAboutURL` (`chrome/browser/browser_about_handler.cc:73-104`).
- **URL rewrites.** `chrome://about` → `chrome://chrome-urls`
  (`chrome/browser/browser_about_handler.cc:59-62`); `chrome://help` →
  `chrome://settings/help` (`chrome/browser/chrome_content_browser_client.cc:7058-7063`);
  plus three `chrome://settings/<path>` rewrites at `:7069-7099`. These run in the
  `BrowserURLHandler` chain registered at
  `chrome/browser/chrome_content_browser_client.cc:4976-4977`.
- **Other schemes that look like WebUI.** `devtools://`, `chrome-search://`
  (`most-visited`), `chrome-native://`, `chrome-error://`. All four are listed in
  `ChromeContentBrowserClient::GetAdditionalWebUISchemes`
  (`chrome/browser/chrome_content_browser_client.cc:2094-2100`) or registered in
  `content/common/url_schemes.cc:69-72`. Out of scope for `chrome://` extinction,
  but `devtools://` in particular must keep working (§8).

### 3.5 The distinction, stated

A host is **internal** — removing it breaks the browser rather than changing the
product — if **any** of these hold:

1. It is absent from `ChromeURLHosts()` (64 of 152), i.e. upstream does not
   consider it typeable.
2. It carries `.top-chrome` (13), i.e. it is rendered into browser chrome by C++.
3. It is loaded by C++ as a dialog, modal, or iframe rather than by the user.
   Mechanically visible as a `k…URL[]` constant naming a full `chrome://…` URL
   that browser code passes to a navigation: there are **169** such constants
   tree-wide and **35** `chrome-untrusted://` ones, and
   **663 hard-coded `"chrome://…"` string literals in non-test C++** under
   `chrome/`, `components/`, `content/`, `ui/`
   (`grep -rn '"chrome://' --include=*.cc --include=*.h chrome/ components/ content/ ui/ | grep -v test | wc -l`).
4. It is in §3.3 (served without a config) or §3.4 (not a WebUI).

`chrome://newtab` alone has **206** non-test references to
`kChromeUINewTabURL`/`kChromeUINewTabHost` under `chrome/browser/` and `content/`.
Moving it is not a one-line change.

---

## 4. Classification

### 4.1 Rules applied

| Class | Rule |
|---|---|
| `KEEP_AND_MOVE_TO_ASTRO` | Astro needs the capability, Chromium's implementation is the right one, and the page is either user-facing (in `ChromeURLHosts()`) or loaded by retained C++. Reuse the controller, re-register under `astro://`. |
| `REPLACE_WITH_ASTRO` | Astro already ships, or has decided to ship, its own page for this surface. The Chromium controller is dropped, not moved. |
| `REMOVE_FROM_PRODUCT` | The page exists only to serve a Google service, a Chrome-brand feature, or a subsystem Astro does not build. Dropped with its feature. |
| `DEV_ONLY` | Debug/diagnostic surface with no end-user purpose. **Kept, moved to `astro://`, and gated off by default** — see §4.6 for why this needs an explicit justification and what the justification is. |

Classes 1–3 are product judgments and are offered as a **proposal**. Class 4 is
mechanically derived from upstream's own marker (§4.6) and is not a judgment.

### 4.2 Totals

The 160 registrations of §2.1 span **158 distinct host names** — `print` and
`privacy-sandbox-dialog` each exist under both `chrome://` and
`chrome-untrusted://` and are two registrations of one name. The partition below
is over the 158 names; each name is in exactly one class.

| Class | Count | Share |
|---|---:|---:|
| `REMOVE_FROM_PRODUCT` | 65 | 41% |
| `KEEP_AND_MOVE_TO_ASTRO` | 51 | 32% |
| `DEV_ONLY` | 22 | 14% |
| `REPLACE_WITH_ASTRO` | 20 | 13% |
| **Total** | **158** | |

Precedence, applied in this order so the partition is deterministic: a host whose
**feature** Astro drops is `REMOVE_FROM_PRODUCT` even if upstream marks it
internal; then a host Astro replaces with its own page is `REPLACE_WITH_ASTRO`;
then upstream's internal marker (§4.6) decides `DEV_ONLY`; everything left is
`KEEP_AND_MOVE_TO_ASTRO`. That ordering is why three `InternalWebUIConfig` hosts
(`history-clusters-internals`, `interstitials`, `network-errors`) appear under
`REPLACE_WITH_ASTRO` and twelve more under `REMOVE_FROM_PRODUCT` rather than in
the `DEV_ONLY` block.

Outside the 158: the ~14 data-source-only hosts of §3.3 are all
`KEEP_AND_MOVE_TO_ASTRO` (they are infrastructure, not pages), and the ~20 debug
URLs of §3.4 are `DEV_ONLY` but need their own mechanism because they are not
WebUIs at all.

### 4.3 `KEEP_AND_MOVE_TO_ASTRO` (51)

Chromium diagnostics and browser features Astro keeps. Reuse the controller
verbatim; re-register the host under `astro://` (§5.1).

```
accessibility              attribution-internals      autofill-internals
bluetooth-internals        bookmarks                  certificate-manager
components                 conflicts                  crashes
device-log                 downloads                  extensions
flags                      gpu                        histograms
history                    indexeddb-internals        inspect
linux-proxy-config         management                 media-internals
net-export                 net-internals              password-manager
password-manager-internals policy                     predictors
print                      private-aggregation-internals
process-internals          quota-internals            sandbox
serviceworker-internals    site-engagement            system
traces                     traces-internals           translate-internals
usb-internals              version                    view-cert
web-app-internals          webrtc-internals
```

plus the 8 `.top-chrome` hosts backing retained browser UI, whose **dotted names
must be preserved** (§3.2):

```
bookmarks-side-panel.top-chrome        history-side-panel.top-chrome
omnibox-popup.top-chrome               read-anything-side-panel.top-chrome
read-later.top-chrome                  tab-search.top-chrome
tab-strip.top-chrome                   webui-toolbar.top-chrome
```

`read-anything-side-panel.top-chrome` is the untrusted one; it moves to
`astro-untrusted://`, not `astro://`. `print` moves under both schemes — the
trusted shell and the untrusted PDF frame — and they must move together.

### 4.4 `REPLACE_WITH_ASTRO` (20)

Astro ships its own page. The Chromium controller is deleted, not moved.

```
app-settings          apps                  chrome-urls
credits               customize-chrome-side-panel.top-chrome
default-browser-modal history-clusters-internals                interstitials
intro                 network-errors        new-tab-page
new-tab-page-third-party                    newtab
newtab-footer         profile-customization profile-picker
search-engine-choice  settings              terms
whats-new
```

Overlay pages already in `src/chrome/browser/oxy/webui/` (`astro_ntp_ui`,
`astro_settings_ui`, `astro_alia_ui`, `astro_whats_new_ui`, `astro_error_ui`) map
onto `newtab`/`new-tab-page`, `settings`, `alia`, `whats-new` and `error`.
`astro://identity`, `astro://adblock` and `astro://resources` are new hosts with
no `chrome://` predecessor and therefore appear in no row here.

`network-errors` is content's `chrome://network-errors` **listing page**; it is
replaced by `astro://error`. It is **not** the same thing as
`chrome://network-error/<n>`, which is loader machinery (§3.3) and must be kept.

### 4.5 `REMOVE_FROM_PRODUCT` (65)

Google-service, Chrome-brand, or unbuilt-subsystem surfaces.

```
access-code-cast          actor-internals           actor-overlay
app-service-internals     batch-upload              browser-switch
cast-feedback             chrome-signin             color-pipeline-internals
comments-side-panel.top-chrome                      commerce-internals
compose                   connection-help           connection-monitoring-detected
connectors-internals      contextual-tasks          data-sharing
data-sharing-internals    dlp-internals             extensions-zero-state
family-link-user-internals                          feedback
gcm-internals             glic                      glic-fre
history-clusters-side-panel.top-chrome              history-sync-optin
legion-internals          lens                      lens-overlay
managed-user-profile-notice                         media-engagement
media-router-internals    metrics-internals         ntp-microsoft-auth
ntp-tiles-internals       on-device-internals       on-device-translation-internals
optimization-guide-internals                        privacy-sandbox-dialog
privacy-sandbox-internals regional-capabilities-internals
reset-password            safe-browsing             saved-tab-groups-unsupported
segmentation-internals    shopping-insights-side-panel.top-chrome
signin-dice-web-intercept.top-chrome                signin-email-confirmation
signin-error              signin-internals          signout-confirmation
skills                    snippets-internals        suggest-internals
support-tool              sync-confirmation         sync-internals
tab-group-home            topics-internals          ungoogled-first-run
updater                   watermark                 webapks
webui-browser
```

`privacy-sandbox-dialog` is one name and two registrations (both schemes); both
go.

**These are not free.** Each is a feature-removal change with C++ call sites that
must go with it, not a scheme change. Sequence them with the feature (§8 Step 6),
not with the scheme work. `ungoogled-first-run` is the exception: it disappears
with the ungoogled patch stack (#8) at no cost to this plan.

### 4.6 `DEV_ONLY` (22) — and the explicit justification the class requires

```
constrained-test          debug-webuis-disabled     discards
download-internals        infobar-internals         internals
local-state               location-internals        memory-internals
notifications-internals   omnibox                   profile-internals
tab-strip-internals       tracing                   ukm
unexportable-keys-internals                         user-actions
user-education-internals  webrtc-logs               webui-gallery
webuijserror              webxr-internals
```

**19 of these are not a judgment.** Upstream marks them itself by deriving from
`InternalWebUIConfig` rather than `WebUIConfig`
(`content/public/browser/internal_webui_config.h:29`, `:38`), which registers the
host in a process-wide set (`content/public/browser/internal_webui_config.cc:29-31`)
queried by `IsInternalWebUI` (`:37-39`). 34 desktop hosts carry that marker; 15
of them are claimed by an earlier class under the §4.2 precedence rule, leaving
19 here. The remaining 3 (`constrained-test`, `internals`, `debug-webuis-disabled`)
are debug scaffolding that upstream did not mark but that has no end-user purpose.

**Justification for the exception.** The product decision says `astro://` is *the*
namespace, and a `DEV_ONLY` class looks like a loophole. It is not, for three
reasons that are properties of the tree rather than of the argument:

1. **These pages already ship disabled.** `ChromeContentBrowserClient` refuses to
   create them unless a local-state pref is set:
   `chrome/browser/chrome_content_browser_client.cc:6146-6152`
   (`if (!content::IsInternalWebUI(url)) { … } return !local_state->GetBoolean(chrome_urls::kInternalOnlyUisEnabled);`).
   Off by default, the navigation lands on `chrome://debug-webuis-disabled`
   (`chrome/browser/ui/webui/internal_debug_pages_disabled/internal_debug_pages_disabled_ui.cc:38-55`).
   `DEV_ONLY` is not a new privilege Astro invents; it is an existing gate Astro
   inherits.
2. **The gate is host-keyed and therefore scheme-portable.** `IsInternalWebUI`
   tests `GetInternalWebUIHostSet().contains(url.GetHost())`
   (`content/public/browser/internal_webui_config.cc:37-39`) — it never reads the
   scheme, so it works verbatim under `astro://`.
3. **But `InternalWebUIConfig` itself is a blocker.** Its constructor hard-codes
   `WebUIConfig(content::kChromeUIScheme, host)`
   (`content/public/browser/internal_webui_config.cc:29`). An Astro internal page
   cannot use this base class as-is. One 1-line `content/` change (take the scheme
   as a parameter), and it is the only thing standing between these 22 and the
   rest of the plan.

The class therefore means "moved to `astro://`, gated off by default, with the
gate inherited from upstream" — **not** "left on `chrome://`". No host in this
plan stays on `chrome://`.

---

## 5. The load-bearing question: can Astro re-register existing controllers under `astro://`?

**Short answer: the C++ controller is reusable through a generic hook. The config
object is not, but its replacement is a three-line template. The shipped
JavaScript is not reusable at all, and that is where the cost is.**

### 5.1 What already works — the scheme is data

`WebUIConfig` stores the scheme as a constructor parameter
(`content/public/browser/webui_config.h:35`), exposes it via `scheme()` (`:41`)
and holds it in a `const std::string scheme_` (`:70`). `DefaultWebUIConfig<T>` is
templated on the **controller** type and takes `(scheme, host)`
(`content/public/browser/webui_config.h:80`). `WebUIConfigMap::AddWebUIConfigImpl`
builds `GURL(scheme + "://" + host)` and keys the map on `url::Origin::Create`
(`content/public/browser/webui_config_map.cc:145-152`) — no literal anywhere.

The trust CHECKs are already embedder-driven in this tree:
`AddWebUIConfig` tests `Contains(TrustedWebUISchemes(), config->scheme())`
(`content/public/browser/webui_config_map.cc:129-134`) and `GetConfig` tests both
sets (`:153-163`), sourced from `GetAdditionalTrustedWebUISchemes` /
`GetAdditionalUntrustedWebUISchemes`
(`content/public/browser/content_browser_client.h:609`, `:616`).

So this compiles and works today, reusing Chromium's `VersionUI` verbatim:

```cpp
template <typename Controller>
class AstroWebUIConfig : public content::DefaultWebUIConfig<Controller> {
 public:
  explicit AstroWebUIConfig(std::string_view host)
      : content::DefaultWebUIConfig<Controller>(astro::kAstroUIScheme, host) {}
};
// …
map.AddWebUIConfig(std::make_unique<AstroWebUIConfig<VersionUI>>("version"));
```

**One generic adapter, zero duplicated controllers, zero new Chromium files.**
That is the answer to the question as posed. The existing `//astro` module
already does exactly this shape for its own page
(`chromium/src/astro/browser/webui/astro_web_ui_configs.cc:12-25`).

What cannot be reused is the *config object* — `VersionUIConfig`'s own
constructor bakes in `content::kChromeUIScheme`, and there is no setter. That is
fine: the config is a 3-line declaration, the controller is the asset.

### 5.2 What blocks it — five things, in ascending order of cost

**(a) `RemoveConfig` was missed by the generalisation.**
`content/public/browser/webui_config_map.cc:182-183` still `CHECK`s the literal
pair, while `AddWebUIConfig` and `GetConfig` in the same file no longer do.
Unregistering an `astro://` config crashes the browser. One line, same fix as its
neighbours.

**(b) `InternalWebUIConfig` hard-codes the scheme.**
`content/public/browser/internal_webui_config.cc:29`. Blocks all 34 `DEV_ONLY`
hosts. One line.

**(c) The data source refuses to serve the new scheme.**
Every retained controller registers a `WebUIDataSource` whose default
`ShouldServiceRequest` allows only `devtools`, `chrome`, `chrome-untrusted`
(`content/public/browser/url_data_source.cc:133-138`). The intended override is
`WebUIDataSource::SetSupportedScheme`
(`content/browser/webui/web_ui_data_source_impl.cc:196-197`, setter at `:431-435`)
— but it is **single-shot**: `CHECK(!supported_scheme_.has_value())` at `:432`.
So a controller can serve exactly one scheme; there is no dual-registration
migration window through this API, and calling it means editing each retained
upstream controller's constructor. Either accept ~51 one-line upstream edits, or
make the default consult the embedder's WebUI-scheme list (one `content/` change,
and the header at `content/public/browser/url_data_source.h` already names
`GetAdditionalWebUISchemes` as the intended companion).

**(d) CSP defaults name the old scheme literally.**
`content/public/browser/url_data_source.cc:78-79` emits
`script-src chrome://resources 'self';` (or the `chrome-untrusted://resources`
variant). An `astro://` page receives a policy that permits `chrome://resources`
and forbids its own. Worse, the trusted/untrusted branch is chosen by
`IsChromeUntrustedDataSource()` (`content/public/browser/url_data_source.cc:20-28`),
which prefix-matches `chrome-untrusted://` — so an `astro-untrusted://` source is
misclassified as **trusted** and silently loses `default-src 'self'` (`:70`),
`base-uri 'none'` (`:87`) and `form-action 'none'` (`:90`). That is a security
regression with no console output. Related: `AddFrameAncestor` hard-`CHECK`s the
literal pair (`content/browser/webui/web_ui_data_source_impl.cc:352-353`) — a
browser-process crash, not a silent failure.

**(e) The shipped JavaScript. This is the real cost.**

Measured in the actual build, not inferred. `chrome://settings`'s rollup bundle:

```
$ grep -oh "chrome://[a-z0-9-]*" \
    out/PipelineCheck/gen/chrome/browser/resources/settings/bundled/*.js \
  | sort | uniq -c | sort -rn
     23 chrome://resources
     21 chrome://settings
     19 chrome://theme
      5 chrome://image
      5 chrome://extensions
      2 chrome://favicon2
      2 chrome://app-icon
      1 chrome://extension-icon
```

and these are **live ES module specifiers**, not comments:

```
$ grep -o ".\{60\}chrome://resources.\{40\}" \
    out/PipelineCheck/gen/chrome/browser/resources/settings/bundled/settings.rollup.js
…pingMixin, afterNextRender, beforeNextRender, flush } from 'chrome://resources/polymer/v3_0/polymer/polymer_bundled.mi…
```

Tree-wide the production resource surface is **1,564 files / 7,899 occurrences**
under `chrome/browser/resources/` and **18 files / 42** under `ui/webui/`.

So reusing `SettingsUI` under `astro://settings` gives a page that requests
`chrome://resources/...` at runtime — and §10.1 explains why that is a renderer
kill rather than a 404.

### 5.3 Verdict

| Layer | Reusable under `astro://`? |
|---|---|
| `WebUIController` C++ class | **Yes**, unchanged, via one templated `AstroWebUIConfig<T>` adapter |
| `WebUIConfig` subclass | No, but replacing it is 3 lines per host |
| `WebUIDataSource` registration | Only with `SetSupportedScheme` per controller (single-shot) **or** one `content/` change to `URLDataSource::ShouldServiceRequest` |
| CSP defaults | No — `content/` change required (`url_data_source.cc:20-28`, `:70-90`) |
| Shipped JS/TS bundle | **No.** Every `chrome://resources`, `chrome://theme`, `chrome://image`, `chrome://favicon2` specifier must be rewritten at build time |

The honest statement of (5) is therefore: **yes for controllers, through a
generic hook, with no duplication — provided the resource-URL rewrite is solved
first.** Solve it in the `ts_library`/rollup path (one build-config change,
mirroring what already makes 1,780 test files' specifiers resolvable, §7), not by
editing 1,564 source files.

---

## 6. Minimum delta to stop `chrome://` being navigable

### 6.1 "Not registered" — what it actually gets you

Suppose Astro registers zero `chrome://` `WebUIConfig`s. Then for
`chrome://settings`:

1. `WebUIConfigMap::GetConfig` misses and returns `nullptr`
   (`content/public/browser/webui_config_map.cc:168-171`), so
   `WebUIControllerFactoryRegistry::GetWebUIType` answers `kNoWebUI` and no WebUI
   object and no bindings are created.
2. The navigation still enters the WebUI loader path, because that branch keys on
   the **scheme**, not the host
   (`content/browser/loader/navigation_url_loader_impl.cc:696-698`).
3. `StartURLLoader` finds no data source and answers `net::ERR_INVALID_URL`
   (`content/browser/webui/web_ui_url_loader_factory.cc:133-138`).

Good outcome — for hosts that had a config. **It leaves six residues live:**

| Residue | Why de-registration misses it | Cite |
|---|---|---|
| `chrome` is permanently a WebUI scheme | `GetWebUISchemesSlow()` seeds `{kChromeUIScheme, kChromeUIUntrustedScheme}` **before** calling the embedder. An embedder can only **add**. | `content/browser/webui/url_data_manager_backend.cc:62-67` |
| `chrome://resources/*` still serves bytes | data source built in `URLDataManagerBackend`'s ctor, unconditionally | `content/browser/webui/url_data_manager_backend.cc:88-92` |
| `chrome-untrusted://resources/*` likewise | same ctor | `:95-99` |
| `chrome://blob-internals` still loads | hard-wired loader branch, no config involved | `content/browser/webui/web_ui_url_loader_factory.cc:306-314` |
| `chrome://dino`, `chrome://network-error/<n>` still load | hard-wired loader branch | `:319-329` |
| `chrome://theme/*`, `chrome://favicon2/*`, `chrome://image/*`, … still serve | `URLDataSource::Add` from `InstantService` and 53 other sites, independent of configs | `chrome/browser/search/instant_service.cc:84` |
| Debug URLs still fire | intercepted before WebUI; Blink's check is a raw `SchemeIs("chrome")` literal | `content/browser/renderer_host/debug_urls.cc:57`, `third_party/blink/common/chrome_debug_urls.cc:37` |

So "not registered" is **necessary but not sufficient**, and its failure mode is
the bad one: it looks complete (`chrome://settings` errors out) while leaving a
scheme that still resolves, still serves assets, and still has a live process-lock
identity.

### 6.2 "Registered but refused"

The refusal point with the least Chromium delta and the widest coverage is a
navigation throttle registered through
`ContentBrowserClient::CreateThrottlesForNavigation`
(`content/public/browser/content_browser_client.h:1758-1759`) — a fully generic
embedder hook with no scheme knowledge. An Astro-owned throttle that cancels any
navigation whose URL scheme is `chrome` or `chrome-untrusted` covers
browser-initiated and renderer-initiated navigations alike, is one Astro-owned
file, and fails closed.

It does **not** cover subresources, because throttles do not run for them.

### 6.3 The minimum delta, stated

Three parts. All three are required; any two leave a hole.

1. **Register nothing under `chrome://`.** Astro-owned. Removes the WebUI objects
   and the bindings — the part that actually matters for privilege.
2. **Refuse navigation.** One Astro-owned `NavigationThrottle` via
   `CreateThrottlesForNavigation`. Covers the residues in §6.1 rows 4–6 that are
   reachable by navigation. Must be tested with a **counterfactual** — an
   assertion that the throttle fired, not merely that the page failed, because a
   404 and a refusal are indistinguishable from the outside.
3. **Stop the shared asset roots serving `chrome://`.** One `content/` change:
   the two data sources constructed at
   `content/browser/webui/url_data_manager_backend.cc:88-99` must take their
   scheme from the embedder rather than from `kChromeUIResourcesHost` /
   `kChromeUIUntrustedResourcesURL`. Without this, `chrome://resources/js/cr.js`
   remains a navigable URL that returns real content in an Astro build.

**Which is safer.** "Registered but refused" is safer than "not registered", and
the reason is not defence-in-depth rhetoric — it is that de-registration cannot
reach four of the six residues at all, because they never consult the config map.
The refusal is also the only one of the two that is *observable*: a throttle can
be counted in a test, whereas the absence of a registration can only be inferred.

**What must not be done.** Removing `chrome` from the standard-scheme registration
(`content/common/url_schemes.cc:69-71`) or from `GetWebUISchemes()`. If `chrome`
stops being a WebUI scheme, `CanRequestURL`'s final line
(`return !GetContentClient()->browser()->IsHandledURL(url)`,
`content/browser/child_process_security_policy_impl.cc:1538`) makes a
`chrome://` URL eligible for external-protocol handling — the browser would offer
`chrome://…` to the OS. `chrome` must stay a *handled* scheme
(`chrome/browser/profiles/profile_io_data.cc:58-59` already lists it) precisely
so that it fails **inside** the browser. This is the same reasoning the `//astro`
module already documents for `astro://`
(`chromium/src/astro/common/astro_schemes.h`, `IsAstroScheme` comment).

---

## 7. Test cost

Method: one `rg` pass for `chrome://` ∪ `chrome-untrusted://` ∪ `kChromeUIScheme`
∪ `kChromeUIUntrustedScheme`; test-file predicate = basename matches
`*unittest*.{cc,mm}` / `*browsertest*.{cc,mm}` / `*_test.{cc,mm}`, or path
contains a `/test/` component. Counts **include comments**.

### 7.1 C++ tests

| Directory | files | occurrences |
|---|---:|---:|
| chrome/ | 454 | 1,644 |
| content/ | 63 | 397 |
| components/ | 69 | 201 |
| ios/, android_webview/, net/, url/, services/, … | 55 | 229 |
| third_party/blink/ | 12 | 58 |
| extensions/ | 10 | 45 |
| ash/ | 9 | 27 |
| ui/ | 5 | 22 |
| **Total** | **677** | **2,623** |

**~24% of those occurrences are comments** (582 of 2,464 in the `.cc`-only view
sit on lines beginning `//`, `*` or `/*`; trailing comments are not counted, so
the true fraction is higher). The top-5 files under `content/browser/webui/` each
have prose as their *first* hit — do not read the raw number as edit count.

The concentrated core is **60 test files under `content/browser/` (412
occurrences)**, of which `content/browser/webui/` is 12 files / 232:

| File | occ |
|---|---:|
| `content/browser/webui/web_ui_browsertest.cc` | 56 |
| `content/browser/webui/web_ui_security_browsertest.cc` | 46 |
| `content/browser/webui/web_ui_navigation_browsertest.cc` | 37 |
| `content/browser/webui/web_ui_main_frame_observer_unittest.cc` | 34 |
| `content/browser/webui/web_ui_impl_unittest.cc` | 26 |
| `content/browser/webui/web_ui_managed_interface_browsertest.cc` | 11 |
| `content/browser/webui/webui_config_map_unittest.cc` | 8 |
| `content/browser/webui/web_ui_data_source_unittest.cc` | 6 |
| others (5 files) | 8 |

The semantically expensive tier is outside `webui/` — these encode "the WebUI
scheme" as a *security* invariant:
`content/browser/service_worker/service_worker_container_host_unittest.cc` (16),
`content/browser/renderer_host/navigation_controller_impl_browsertest.cc` (11),
`content/browser/renderer_host/render_process_host_unittest.cc` (8),
`content/browser/storage_partition_impl_unittest.cc` (6),
`content/browser/renderer_host/debug_urls_unittest.cc` (6),
`content/browser/child_process_security_policy_unittest.cc` (5).

### 7.2 The leverage point

`GetWebUIURL` / `GetWebUIURLString` are defined at
`content/public/test/test_utils.cc:256` and `:260` and are **already
scheme-parameterised** —
`std::string(content::kChromeUIScheme) + url::kStandardSchemeSeparator + host`.
They have **241 call sites across 58 files** (content/ 27 files/174 occ, chrome/
26/40, extensions/ 4/20, ios/ 1/7). Parameterising that one function carries all
241; leaving it means 241 individual edits.

Helper files that must be parameterised rather than sed-edited:

| File:line | What |
|---|---|
| `content/public/test/test_utils.cc:256,260` | the leverage point, 241 downstream call sites |
| `content/public/test/web_ui_browsertest_util.cc:238,243,256` | untrusted URL builder; `WebUIConfig(kChromeUIScheme, host)`; `supported_scheme_(kChromeUIScheme)` |
| `content/public/test/web_ui_browsertest_util.cc:61` | hard-coded literal `"child-src 'self' chrome://web-ui-subframe/;"`, not constant-derived |
| `content/public/test/scoped_web_ui_controller_factory_registration.cc:28,33` | dispatches on `scheme() == kChromeUIScheme` |
| `chrome/test/base/web_ui_mocha_browser_test.cc:109,127,152` | `test_loader_scheme_`, plus a `CHECK` restricting to the two schemes — **gates all 1,780 WebUI TS tests** |
| `chrome/test/base/web_ui_test_data_source.cc` | registers `chrome://webui-test` |

`content/public/test/browser_test_utils.{cc,h}` is clean — zero hits.

### 7.3 JS/TS tests — a build-config change, not 1,780 edits

`chrome/test/data/webui/` is 1,780 files / 12,179 occurrences. **10,318 of those
(85%) are ES-module import specifiers** across 1,752 files:

```bash
rg --count-matches -g '*.ts' -g '*.js' \
   -e "from '(chrome|chrome-untrusted)://" -e "import\(.chrome://" chrome/test/data/webui/
```

Host breakdown confirms it: `webui-test` 3,815 and `resources` 3,200 — two-thirds
of all hits are module paths resolved by the TS path-mapping/build rules. Only
~1,860 occurrences are runtime URL usage. Outside the WebUI bundle,
`chrome/test/data/` is only **114 files / 192 occurrences**.

**This is the same lever as §5.2(e).** Whatever rewrites production
`chrome://resources/...` specifiers rewrites the test ones too. Budget it once.

### 7.4 Honest total

- ~677 C++ test files touched, ~2,000 real (non-comment) occurrences, of which
  ~60 files carry security invariants and need reading rather than editing.
- 1 build-config change covering ~10,300 TS import specifiers.
- ~9 test-helper files parameterised, which carries another 241 call sites.

`third_party/(other)` 7 files / 9 occurrences is vendored DevTools/perfetto — not
Chromium's suite; subtract it. `third_party/blink/` 12 files / 58 occurrences is
real and genuinely scheme-coupled.

---

## 8. Migration order

Ordered so that each step is independently shippable and each has an observable
verdict. Steps 1–4 are already partly landed in this tree.

**Step 0 — retire the temporary instrumentation.** Remove the two `astro-stage`
`LOG` statements (§0) before anything is measured, so a performance or behaviour
observation is not an artefact of a `LOG(WARNING)` on every navigation.

**Step 1 — finish the `content/` generalisation (5 changes, each 1–3 lines).**
`RemoveConfig` (`webui_config_map.cc:182-183`), `InternalWebUIConfig`
(`internal_webui_config.cc:29`), `URLDataSource::ShouldServiceRequest`
(`url_data_source.cc:133-138`), the CSP branch + `IsChromeUntrustedDataSource`
(`url_data_source.cc:20-28`, `:70-90`), `AddFrameAncestor`
(`web_ui_data_source_impl.cc:352-353`). Verdict: `content_unittests` green **with
`SetDisallowWebUISchemeCachingForTesting(true)`** — without it the memoised
`GetWebUISchemes()` (`url_data_manager_backend.cc:69-83`) can make a scheme
invisible and the failure reads as "never registered".

**Step 2 — the resource-URL rewrite.** Make the `ts_library`/rollup path emit
`astro://resources/...`, and make the shared data sources
(`url_data_manager_backend.cc:88-99`) serve under the Astro scheme. **This
gates everything else** — until it lands, no reused Chromium WebUI can render.
Verdict: `grep -c "chrome://" ` on a built bundle for a migrated page is 0, and
the page loads without a renderer kill.

**Step 3 — one reused controller end to end.** Pick `version` (small, no Mojo, no
side panel, in `ChromeURLHosts()`). Register `AstroWebUIConfig<VersionUI>("version")`.
Verdict: the 12 acceptance properties of
`docs/astro-next/architecture/astro-scheme-hooks.md:393-406` applied to
`astro://version`, including property 9's static gate.

**Step 4 — the rest of `KEEP_AND_MOVE_TO_ASTRO` (51)**, diagnostics first
(`gpu`, `flags`, `histograms`, `net-internals`), then `.top-chrome` (keeping the
dotted names, §3.2), then the Mojo-heavy ones (`downloads`, `history`,
`bookmarks`, `extensions`, `print`).

**Step 5 — `REPLACE_WITH_ASTRO` (20).** Astro's own pages already exist for most;
the work is deleting the Chromium controller and repointing the C++ that
navigates to it — 206 references for `newtab` alone.

**Step 6 — `REMOVE_FROM_PRODUCT` (65).** Sequenced with feature removal, not with
the scheme work.

**Step 7 — `DEV_ONLY` (22)** behind the inherited `kInternalOnlyUisEnabled` gate.

**Step 8 — the refusal (§6.3).** Land the throttle **last**, once nothing in the
product needs `chrome://`. Landing it early turns every unmigrated page into a
hard failure with no diagnostic.

### 8.1 Compatibility for legacy profiles — needed, and how its removal is enforced

Legacy profiles carry `chrome://` URLs in session restore, bookmarks, history and
pinned tabs. Two are unavoidable: a restored session containing
`chrome://settings` and a bookmark to `chrome://downloads`.

The narrowest shape that solves it without becoming a route:

- **A one-shot data migration, not a URL rewriter.** On profile version bump,
  rewrite stored `chrome://<host>` strings to `astro://<host>` in the bookmark,
  session and pinned-tab stores for hosts in the KEEP/REPLACE map. Nothing is
  rewritten at navigation time, so **no `BrowserURLHandler` pair is ever
  registered** — which is what
  `docs/astro-next/architecture/astro-scheme-hooks.md:185` and the "no cosmetic
  aliasing" constraint forbid, and what `patches/astro/011-astro-url-scheme-alias.patch`
  did wrong.
- **Versioned.** Keyed on a profile schema version, so it runs once per profile
  and never again.
- **Migration-only.** A live `chrome://` navigation is still refused by the §6.3
  throttle. There is no code path where typing `chrome://settings` reaches an
  Astro page.

**How its removal is enforced.** Three gates, because a removal date in a comment
is not a mechanism:

1. A **build-time expiry**: the migration is compiled behind a
   `static_assert`-style check against the product version, so a build after the
   sunset version fails to compile until the code is deleted. Astro already has
   the version input (`VERSION`, `browser.lock.json`).
2. A **repo test in `tools/tests/run.sh`** (the existing build-safety suite)
   asserting that the migration symbol appears in exactly one file and that no
   navigation-path file references it — mutation-tested by breaking it and
   confirming the check fails and names the offending path.
3. A **baseline document row.** `docs/astro-next/baseline/` is generated and
   CI-checked (`tools/baseline/generate-all.sh --check`), so a migration that
   outlives its declared sunset shows up as a baseline mismatch rather than as
   nothing at all.

---

## 9. `not-determined`

| Question | Command that settles it |
|---|---|
| Exactly how many of the 136 `chrome/` configs are compiled in an Astro **Linux** build (the source count includes Windows-, Mac-, Android- and ChromeOS-gated registrations; the buildflag distribution is 49 unconditional, 45 `!IS_ANDROID`, 7 `!IS_CHROMEOS && !IS_ANDROID`, 5 `IS_WIN\|\|IS_MAC\|\|IS_LINUX`, plus ~20 single-flag rows) | `out/PipelineCheck/chrome --headless=new --disable-gpu --user-data-dir=<scratch> --dump-dom chrome://chrome-urls`. **Not run here**: `/tmp` was at 99% (671 MB free) and has hit 100% twice today; a browser profile plus any crash dump is not a safe allocation against that budget. |
| Whether any `//chrome`-layer `URLDataSource` subclass already overrides `ShouldServiceRequest`, which would blunt §5.2(c) for some sources | `grep -rn 'ShouldServiceRequest' chromium/src/chrome/ chromium/src/components/ --include=*.cc --include=*.h` |
| `borealis::BorealisMOTDUIConfig`'s host (ChromeOS, not compiled for Astro) | `grep -rn 'BorealisMOTDUIConfig' chromium/src --include=*.h` |
| Whether Blink's `SecurityOrigin` agrees with `url::Origin` for `astro://` in a **sandboxed** frame | build + `content_browsertests --gtest_filter=AstroScheme*` with a sandboxed-iframe fixture |
| Whether `chrome://devtools` (the host, distinct from the `devtools://` scheme) needs its own disposition | `grep -rn 'kChromeUIDevToolsHost' chromium/src --include=*.cc \| grep -v test` |

Settled while writing this document, and previously open:

- `features::kWebUIInProcessResourceLoadingV2` is
  **`FEATURE_DISABLED_BY_DEFAULT`** (`content/public/common/content_features.cc:1200-1201`).
  So `content/renderer/local_resource_url_loader_factory.cc:218`'s
  `CHECK(request.url.GetScheme() == kChromeUIScheme)` and
  `content/browser/webui/web_ui_impl.cc:109`'s `ShouldIncludeDataSource` early
  return are **not on the default path**. Do not enable that feature during the
  migration.
- `WebUIDataSourceImpl::GetOrigin`'s old
  `CHECK(url.SchemeIs(kChromeUIUntrustedScheme))` has **already been fixed** in
  this tree (`content/browser/webui/web_ui_data_source_impl.cc:390-404`); the
  origin is now derived from the source name. That blocker is retired.

---

## 10. Risks, ranked

### 10.1 A reused WebUI's shipped JS kills the renderer — the biggest one

An `astro://settings` page whose bundle imports
`from 'chrome://resources/polymer/...'` does not get a 404. It gets its renderer
killed.

The chain, all in the tree:

1. A WebUI document with bindings has its **default** subresource factory replaced
   by `CreateWebUIURLLoaderFactory(this, effective_scheme, {})`, where
   `effective_scheme` comes from the committed origin
   (`content/browser/renderer_host/render_frame_host_impl.cc:12616-12633`,
   `:12645-12647`).
2. That factory holds one scheme and answers any request whose scheme differs
   with `mojo::ReportBadMessage("Incorrect scheme")`
   (`content/browser/webui/web_ui_url_loader_factory.cc:284-295`).
3. Upstream's own comment at
   `content/browser/renderer_host/render_frame_host_impl.cc:12649-12650` states it
   plainly: *"WebUIURLLoaderFactory will kill the renderer if it sees a request
   with a non-chrome scheme."* It is why `about:` gets its own factory registered
   two lines later.

Measured, not inferred: §5.2(e) shows 23 live `chrome://resources` specifiers in
the built `settings.rollup.js`.

Why it is the biggest risk rather than merely the largest task: the failure is a
renderer kill at *first paint of a migrated page*, it will be reported as "the
new settings page is blank", and the stack will point at mojo rather than at a
build-config file. Anyone debugging it from the symptom will look in the wrong
layer. **Land §8 Step 2 before Step 3.**

### 10.2 `content::IsWebUIScheme` has no embedder hook, and `IsSafeRedirectTarget` depends on it

`content/public/common/url_utils.cc:27-31` is a three-element literal
(`chrome`, `chrome-untrusted`, `devtools`) with no hook, in
`content/public/common` — which must answer in the **renderer**, where there is no
`ContentBrowserClient`. `IsSafeRedirectTarget` early-returns `false` for
`HasWebUIScheme(to_url)` at `:91-92`; with `astro` absent, **an HTTP redirect chain
can target an `astro://` URL** where it could not target `chrome://`. 46
`HasWebUIScheme` call sites (content/ 27, chrome/ 18) and 47 `IsSafeRedirectTarget`
(content/ 30, net/ 10). This is the one gap that needs a genuine upstream design
(a common-layer store populated during `RegisterContentSchemes`), not a
literal-to-predicate swap. It **must** land before any product host ships.

### 10.3 Silent security downgrades that produce no output

Three, all confirmed:

- `astro-untrusted://` misclassified as trusted by
  `IsChromeUntrustedDataSource` (`content/public/browser/url_data_source.cc:20-28`)
  → loses `default-src` (`:70`), `base-uri` (`:87`), `form-action` (`:90`). Console-silent.
- `content/browser/devtools/protocol/page_handler.cc:891-892` refuses navigation
  to `chrome-untrusted://` and `devtools://` from an untrusted DevTools client;
  `astro-untrusted://` is not in the list.
- `content/browser/webui/web_ui_impl.cc:204` seeds `requestable_schemes_` with
  `{kChromeUIScheme, url::kFileScheme}`. An Astro page is granted `"chrome"` and
  not `"astro"`. It survives today only because `CanRequestURL`'s WebUI carve-out
  (`content/browser/child_process_security_policy_impl.cc:1524-1526`) covers
  same-scheme requests — i.e. the grant is wrong and something else happens to
  compensate. The escape hatch is `WebUIImpl::AddRequestableScheme`
  (`:364-366`), and all 10 existing callers pass `kChromeUIUntrustedScheme`
  literally.

### 10.4 A whole class of subsystems refuses non-`chrome` WebUI schemes

Each is an early return or an allowlist, each silently disables a capability for
`astro://`: workers (`content/browser/worker_host/worker_script_fetcher.cc:191-197`),
service workers (`content/browser/service_worker/service_worker_context_wrapper.cc:1961-1979`,
`embedded_worker_instance.cc:919-931`, `service_worker_security_utils.cc:19`),
code cache (`content/browser/renderer_host/code_cache_host_impl.cc:75-99`,
`content/browser/code_cache/generated_code_cache.cc:58-59`, `:83-84` — and
`code_cache_host_impl.cc:81-87` can `ReportBadMessage` → renderer kill), local
network access (`content/browser/renderer_host/local_network_access_util.cc:262-264`),
`chrome.send()` availability (`content/renderer/web_ui_extension.cc:50`), saving
and downloads (`content/browser/download/save_file_manager.cc:322`,
`download_manager_impl.cc:1461`), manifest icons
(`content/browser/manifest/manifest_icon_downloader.cc:33`), clipboard
(`content/browser/renderer_host/clipboard_host_impl.cc:153`). None of these
appears in the `astro-scheme-hooks.md` hook table; they are the tail this document
adds.

### 10.5 The Blink registration has no embedder hook at all

`content/renderer/render_thread_impl.cc:814-877` registers `chrome` and
`chrome-untrusted` with Blink — display-isolated, no-javascript-URLs,
`RegisterURLSchemeAsWebUI`, fetch-API, code cache — with **no
`ContentRendererClient` callback anywhere in the function**. `:821`
`WebSecurityPolicy::RegisterURLSchemeAsWebUI(chrome_scheme)` is the only non-test
caller in the tree and is what makes Blink's own `SchemeRegistry::IsWebUIScheme`
(`third_party/blink/renderer/platform/weborigin/scheme_registry.cc:452`) answer
true. Blink's side is registry-driven and fine; the **caller** is hard-coded. The
sanctioned workaround is to call `WebSecurityPolicy::RegisterURLSchemeAs*` from
Astro's `ContentRendererClient::RenderThreadStarted`, mirroring
`chrome/renderer/chrome_content_renderer_client.cc:425-558` — **not** to patch
`RegisterSchemes`.

### 10.6 Flattening `.top-chrome` names would multiply renderer processes

§3.2. Thirteen hosts currently share one process lock by virtue of the dot.
Nothing warns if that changes. A test must assert
`SiteInfo::GetProcessLockURL()` is equal across the `.top-chrome` set and
distinct for every other pair in the host catalog.

---

## 11. What this document deliberately does not decide

- The omnibox surface (#13): `components/url_formatter/url_fixer.cc:40` carries its
  **own** `const char kChromeUIScheme[] = "chrome"` with no hook, and several
  omnibox providers compare `content::kChromeUIScheme` directly. Enumerated in
  `docs/astro-next/architecture/astro-scheme-hooks.md:273-279`; unchanged by this
  plan.
- Android. The 245-registration count includes 3 Android-gated rows; Astro's
  Android disposition is an explicit documented gap elsewhere.
- Whether the `GetAdditionalTrustedWebUISchemes` / `GetAdditionalUntrustedWebUISchemes`
  pair should be proposed upstream. It exists in this tree; upstreamability is a
  separate conversation with `content/public/browser/OWNERS`.
