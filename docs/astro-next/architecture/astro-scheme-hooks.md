# `astro://` scheme integration — Chromium 146 hook survey

Research input for **#11 (ASTRO-NEXT-008)** and **#12 (ASTRO-NEXT-009)**. This
document is not generated; it is hand-maintained and every claim carries a
`file:line` citation into Chromium `146.0.7680.177`.

It answers one question: *what does Chromium 146 already offer an embedder that
wants a first-class WebUI scheme, and where does it offer nothing?* It proposes
no product code and designs no omnibox behaviour (#13).

---

## 0. Provenance and how to reproduce a citation

| | |
|---|---|
| Chromium version | `146.0.7680.177` (`chrome/VERSION`) |
| Commit | `ae03f7fb2cf1215853896d6a4c15fdceee2badb7` (`browser.lock.json`) |
| Checkout | `chromium/src`, `git rev-parse HEAD` matches the lock |

**The working tree is not pristine.** `tools/apply-patches.sh` has been run, so
the ungoogled series is applied on top of the locked commit. Files carrying
ungoogled edits that this document cites include
`content/common/url_schemes.cc`, `content/public/common/url_utils.cc`,
`url/url_util.cc`, `url/url_constants.h`,
`content/browser/child_process_security_policy_impl.cc`,
`chrome/browser/chrome_content_browser_client.cc`,
`chrome/renderer/chrome_content_renderer_client.cc`,
`content/renderer/render_frame_impl.cc`,
`components/url_formatter/url_fixer.cc` and
`chrome/browser/autocomplete/chrome_autocomplete_scheme_classifier.cc`. Their
line numbers in the working tree are shifted by up to a few lines.

**Every line number below is the number in the *pristine upstream blob*, not in
the working tree**, because Astro Next targets an exact upstream commit and
deletes the patch stack (#8). Reproduce any citation with:

```
git -C chromium/src show HEAD:<path> | sed -n '<line>p'
```

Two ungoogled edits are directly relevant to this work and are called out where
they matter. Upstream, `IsSavableURL` consults `GetSavableSchemes()`
(`content/public/common/url_utils.cc:43-48`); the applied ungoogled patch
replaces that whole body with `return true`. Separately, ungoogled adds
`url::kTraceScheme` ("trk") to the no-access and web-safe lists in
`url/url_util.cc`.

---

## 1. Executive summary

Chromium 146 is in much better shape for this than the `chrome://`-everywhere
folklore suggests. The work splits into three tiers, and the tier boundaries are
what should drive the upstream-delta budget.

**Tier A — already data-driven. Zero Chromium-owned change.**
Two embedder entry points do almost all of the heavy lifting:

- `ContentClient::AddAdditionalSchemes` (`content/public/common/content_client.h:116-158`)
  feeds the single chokepoint `content::RegisterContentSchemes`
  (`content/common/url_schemes.cc:53-139`), which runs in **every** process from
  `content/app/content_main_runner_impl.cc:908`. Standard, secure, local,
  no-access, CORS-enabled, CSP-bypassing, savable, service-worker and empty-document
  status are all per-scheme vectors on one struct. Astro registers `astro` and
  `astro-untrusted` as `SCHEME_WITH_HOST` + secure, and deliberately adds
  *nothing* to `cors_enabled_schemes`, `csp_bypassing_schemes`,
  `service_worker_schemes` or `savable_schemes` — exactly the #11 policy table.
- `ContentBrowserClient::GetAdditionalWebUISchemes`
  (`content/public/browser/content_browser_client.h:590-595`) feeds
  `URLDataManagerBackend::GetWebUISchemes()`
  (`content/browser/webui/url_data_manager_backend.cc:63-83`), and **that one
  list is consulted by every security-critical WebUI decision in content/**:
  process locking, dedicated-process requirement, `CanRequestURL`,
  `AllowBindings`, the navigation URL loader factory and the subresource URL
  loader factory. This is the single highest-leverage line of code in the whole
  integration.

`WebUIControllerFactory` is entirely scheme-agnostic
(`content/public/browser/web_ui_controller_factory.h:22-54`), so Astro can own
its own factory with no upstream change at all.

**Chromium ships a test that proves the whole Tier A path works.**
`AdditionalSchemesWebUINavigationBrowserTest`
(`content/browser/webui/web_ui_navigation_browsertest.cc:1194-1249`) registers
the custom standard scheme `test-webui-scheme`, declares it via
`GetAdditionalWebUISchemes`, points a scheme-parameterised
`WebUIControllerFactory` at it, and asserts
`EXPECT_EQ(success_url, shell()->web_contents()->GetLastCommittedURL())` on a
`test-webui-scheme://web-ui/title2.html` URL. That is the vertical slice, in
upstream, today.

**Tier B — small predicate generalisations. Each is one commit, each is
plausibly upstreamable.** A handful of sites hard-code the literal pair
`{kChromeUIScheme, kChromeUIUntrustedScheme}` where the surrounding data
structure is already generic. The worst is `WebUIConfigMap`, which is keyed by
`url::Origin` — fully scheme-generic underneath — and then gated by four
hard-coded comparisons. Roughly **six** such sites stand between Astro and a
clean integration. That is the realistic size of the content/ delta.

**Tier C — genuinely no embedder hook.** `components/url_formatter/url_fixer.cc`
carries its *own* `const char kChromeUIScheme[] = "chrome"` at line 40 and is
not parameterised at all; several omnibox providers compare against
`content::kChromeUIScheme` directly. These are the #13 surface and there is no
honest way to describe a fork-local conditional there as "the intended design".

**The one shape that does not exist upstream and should not be invented:** there
is no `ContentBrowserClient::GetAdditionalTrustedWebUISchemes` /
`GetAdditionalUntrustedWebUISchemes` pair. Trusted-vs-untrusted is expressed
*per-controller* (`WebUIController::TrustPolicy`,
`content/public/browser/web_ui_controller.h:35-38, 100`) and *per-config-map-method*
(`AddWebUIConfig` vs `AddUntrustedWebUIConfig`), not per-scheme. Astro's central
descriptor registry (#11) is therefore the right place for that distinction, and
it maps onto Chromium by choosing which base controller class each host
inherits — not by teaching content/ about a second Astro scheme.

---

## 2. Hook table

Columns are: **upstream file** → **extension point that exists today** →
**minimum change needed** → **test that proves it**.
"None (Astro-owned)" in column 3 means no Chromium-owned file changes.

### 2.1 Scheme registration

| Upstream file | Extension point today | Minimum change | Test that proves it |
|---|---|---|---|
| `url/url_util.h:58-141` — `AddStandardScheme`, `AddSecureScheme`, `AddLocalScheme`, `AddNoAccessScheme`, `AddCorsEnabledScheme`, `AddCSPBypassingScheme`, `AddEmptyDocumentScheme`, `LockSchemeRegistries` | Public, embedder-callable, but **must** run before `LockSchemeRegistries()` and are explicitly not thread-safe (`url/url_util.h:54-56`) | None. Never call these directly from Astro — route through `AddAdditionalSchemes`, per #11's "route registration through ContentClient" | `url/url_util_unittest.cc` + `url::ScopedSchemeRegistryForTests` (`url/url_util.h:30-37`) |
| `content/public/common/content_client.h:116-158` — `struct Schemes` + `virtual void AddAdditionalSchemes(Schemes*)` | **The** embedder hook. 12 independent per-scheme vectors, each mapping to one policy row in #11's table | None (Astro-owned): `AstroContentClient::AddAdditionalSchemes` pushes `astro` + `astro-untrusted` onto `standard_schemes` and `secure_schemes` only | unit test on `AstroContentClient` asserting the exact vector membership, mirroring `content/shell/common/shell_content_client.cc:75-85` |
| `content/common/url_schemes.cc:53-139` — `RegisterContentSchemes` | Single chokepoint. Calls `AddAdditionalSchemes` at :59, then applies each vector, then locks the registry at :129 | None | `content/common/url_utils_unittest.cc` (`ReRegisterContentSchemesForTests`, `url_schemes.cc:141-145`) |
| `content/app/content_main_runner_impl.cc:908` | `RegisterContentSchemes(delegate_->ShouldLockSchemeRegistry())` runs in browser, renderer and utility alike — so one `ContentClient` override covers every process | None | any `content_browsertest` asserting `url::IsStandardScheme("astro")` from a renderer, e.g. via `EvalJs` on `location.origin` |
| `content/public/common/url_constants.h:19-24` | Scheme name constants are `inline constexpr` in `namespace content`; embedders define their own elsewhere (`chrome::kChromeSearchScheme`, `extensions::kExtensionScheme`) | None (Astro-owned): `//astro/common/url_constants.h` per #11 | compile-time; plus a startup `CHECK` that no Astro scheme collides with a content or chrome scheme |
| `url/scheme_host_port.cc:66-144` — `IsValidInput` | Not an extension point; the consequence of registration. `SCHEME_WITH_HOST` (:120-136) rejects a non-zero port and requires a canonical host | None, but it dictates policy: registering as `SCHEME_WITH_HOST` is what makes `astro://test:8080/` invalid, satisfying #11's "reject ports" | `url/origin_unittest.cc:318` `UnsafelyCreate` / `:364` `UnsafelyCreateUniqueOnInvalidInput` |

### 2.2 `ContentClient` / `ContentBrowserClient` / `ContentRendererClient`

| Upstream file | Extension point today | Minimum change | Test that proves it |
|---|---|---|---|
| `content/public/browser/content_browser_client.h:590-595` — `GetAdditionalWebUISchemes` | Exists. Its doc comment says the schemes "act as aliases to the chrome: scheme", and Chrome's own comment (`chrome/browser/chrome_content_browser_client.cc:2087-2088`) says they "do not get WebUI bindings" — **both are describing Chrome's usage, not a content/ restriction.** Nothing in content/ denies bindings on the basis of this list; `AllowBindings` (§2.7) in fact *requires* membership | None (Astro-owned) | `content/browser/webui/web_ui_navigation_browsertest.cc:1224-1227` shows the exact override shape |
| same, `:599-600` — `GetAdditionalViewSourceSchemes` | Defaults to `GetAdditionalWebUISchemes` (`content/public/browser/content_browser_client.cc:259-261`) | Override to return **nothing** for Astro schemes — #11 wants view-source driven by the central descriptor, and the default would silently grant it | `content/browser/child_process_security_policy_unittest.cc:669` `ViewSource` |
| same, `:607` — `IsInternalScheme` | Exists; only affects back/forward visibility. Chrome returns true for `chrome-native` only (`chrome/browser/chrome_content_browser_client.cc:2096-2098`) | None (Astro-owned) | browser_test on session history, cf. `web_ui_navigation_browsertest.cc:1154` |
| same, `:531` — `DoesWebUIUrlRequireProcessLock` | Exists. Default `true` (`content/public/browser/content_browser_client.cc:230`). Consulted at three sites: `site_info.cc:718`, `child_process_security_policy_impl.cc:291` and `:1527` | None (Astro-owned) — return `true` unconditionally for both Astro schemes | `content/browser/webui/web_ui_navigation_browsertest.cc:1066` `WebUIOriginsRequireDedicatedProcess` |
| same, `:631` — `IsHandledURL` | Exists. Chrome delegates to `ProfileIOData::IsHandledProtocol` (`chrome/browser/profiles/profile_io_data.cc:30-67`), a `FixedFlatSet` | None (Astro-owned): add `astro` + `astro-untrusted` to Astro's set. **This is what stops an unknown `astro://` host reaching the OS** — see §3.3 | browser_test asserting `ExternalProtocolHandler` is never invoked for `astro://nonexistent/` |
| same, `:627` — `IsWebUIAllowedToMakeNetworkRequests` | Exists; gates whether a bound WebUI renderer keeps a network factory (`render_frame_host_impl.cc:12645-12647`) | None (Astro-owned) — return `false`, matching epic #3's "no privileged WebUI loading remote scripts" | `content/browser/webui/web_ui_security_browsertest.cc:590` `DisallowWebRequestToSharedResources` |
| `content/renderer/render_thread_impl.cc:815-880` — `RegisterSchemes` | **Hard-coded**: registers `chrome` as display-isolated / no-javascript-URLs / `RegisterURLSchemeAsWebUI`, and `chrome-untrusted` as fetch-API-supporting, with no embedder call | None (Astro-owned). `ChromeContentRendererClient::RenderThreadStarted` (`chrome/renderer/chrome_content_renderer_client.cc:378`) already calls `WebSecurityPolicy::RegisterURLSchemeAs*` for its own schemes at `:425-558`; Astro does the same for `astro` / `astro-untrusted`. **This is the pattern — do not patch `RegisterSchemes`.** | `third_party/blink/renderer/platform/weborigin/scheme_registry_test.cc:88-112` is the unit-level precedent; a `content_browsertest` asserting a web page cannot frame `astro://test/` is the integration proof |

### 2.3 `WebUIConfigMap` and `WebUIConfig`

| Upstream file | Extension point today | Minimum change | Test that proves it |
|---|---|---|---|
| `content/public/browser/webui_config_map.cc:83-89` — `AddWebUIConfigImpl` | Already generic: builds `GURL(scheme + "://" + host)` and keys the map on `url::Origin::Create(url)`. Duplicate hosts already `CHECK` at :88, satisfying #11's "prevent duplicate registration" for free | None | `content/browser/webui/webui_config_map_unittest.cc:42` `AddAndRemoveChromeUrl` |
| same, `:72-81` — `AddWebUIConfig` / `AddUntrustedWebUIConfig` | **Blocker.** `CHECK_EQ(config->scheme(), kChromeUIScheme)` at :73 and `kChromeUIUntrustedScheme` at :79 | Replace the two `CHECK_EQ`s with a predicate (`IsTrustedWebUIScheme` / `IsUntrustedWebUIScheme`) sourced from the embedder. Upstreamable as "let embedders register WebUIConfigs for their own WebUI schemes" | extend `webui_config_map_unittest.cc` with a third case registering a config on a custom scheme; assert `GetConfig` returns it and that a trusted config cannot be added through the untrusted method |
| same, `:91-114` — `GetConfig` | **Blocker.** `:97-100` returns `nullptr` for any scheme that is not exactly `chrome` or `chrome-untrusted`. The comment explains the real intent: strip `filesystem:`/`blob:` so they cannot obtain bindings | Same predicate. Note the comment's intent is preserved — `url::Origin::Create` already drops those schemes, the literal comparison is belt-and-braces | as above; plus assert `GetConfig(ctx, GURL("blob:astro://test/guid"))` is `nullptr` |
| same, `:116-128` — `RemoveConfig` | Same literal pair at `:117-118` | Same predicate | as above |
| `content/public/browser/webui_config.h:33-72` | Fully generic — `WebUIConfig(scheme, host)` stores the scheme as data | None | — |
| `content/public/browser/internal_webui_config.cc:28-31` | `InternalWebUIConfig` hard-codes `content::kChromeUIScheme` in its constructor | None *if* Astro does not use `InternalWebUIConfig`. #11 says "keep diagnostic Chromium pages under `chrome://`", so Astro's diagnostics page should be a plain `WebUIConfig` on `astro://`, or a genuine `chrome://` internal page | `content/browser/webui/internal_webui_config_unittest.cc` |

### 2.4 `WebUIControllerFactory`

| Upstream file | Extension point today | Minimum change | Test that proves it |
|---|---|---|---|
| `content/public/browser/web_ui_controller_factory.h:22-54` | Fully generic. `RegisterFactory` (`content/browser/webui/web_ui_controller_factory_registry.cc:23-25`) appends to a global vector; the registry queries factories in order and takes the first non-`kNoWebUI` answer (`:50-61`) | None (Astro-owned). Astro registers one factory per trust level, or leans on `WebUIConfigMap`'s internal factory once §2.3 lands | `content/public/test/scoped_web_ui_controller_factory_registration.h`; behavioural precedent `content/browser/webui/web_ui_navigation_browsertest.cc:1194-1249` |
| `content/public/test/web_ui_browsertest_util.h:67-93` — `TestWebUIControllerFactory::SetSupportedScheme` | Exists (`content/public/test/web_ui_browsertest_util.cc:283-285`), used by the additional-schemes browser test | None — reuse it for Astro's own browser tests | it *is* the test |
| `chrome/browser/ui/webui/chrome_web_ui_controller_factory.cc:166-181` | In 146 this factory has been reduced to DevTools only; every other Chrome WebUI now goes through `WebUIConfigMap` (`chrome/browser/ui/webui/chrome_web_ui_configs.cc:232` `RegisterChromeWebUIConfigs`, called from `chrome/browser/chrome_browser_main.cc:1830`) | None. **Worth noting for #7**: the overlay collision on `chrome_web_ui_configs.cc` is a collision with the *modern* registration path, not a legacy one | — |

### 2.5 `URLDataManager` / `URLDataSource`

| Upstream file | Extension point today | Minimum change | Test that proves it |
|---|---|---|---|
| `content/browser/webui/url_data_manager_backend.cc:63-83` — `GetWebUISchemes` | `{chrome, chrome-untrusted} + GetAdditionalWebUISchemes`. **Cached in a `NoDestructor` static at :79** | None. But: `SetDisallowWebUISchemeCachingForTesting` (`url_data_manager_backend.h:80-83`) must be used in any unit test that injects a scheme, or a previously-run test poisons the cache — see the warning at `site_instance_impl_unittest.cc:2093-2097` | `content/browser/site_instance_impl_unittest.cc:2092` `DoesSiteRequireDedicatedProcess` |
| same, `:137-161` — `GetDataSourceFromURL` | Three lookups: `chrome-untrusted://` keyed on serialized origin (:140-145), then bare host (:149), then `scheme://` (:155). Returns `nullptr` on miss (:160) | Generalise :140 so `astro-untrusted://` uses the origin key too. Alternative with **zero** upstream change: name Astro untrusted sources so the bare-host lookup at :149 matches — but that collapses the trusted/untrusted namespaces and #11 forbids a host under both trust levels, so take the upstream change | `content/browser/webui/url_data_manager_backend_unittest.cc` |
| same, `:253-266` — `CheckURLIsValid` | `DCHECK` over the same literal pair plus `GetAdditionalWebUISchemes` (:255-259) — already covers Astro once §2.2 is done | None | debug-build browser_test navigating `astro://test/` |
| `content/public/browser/url_data_source.cc:133-138` — `ShouldServiceRequest` | Default allows `devtools`, `chrome`, `chrome-untrusted`. The header (`url_data_source.h:111-118`) explicitly names `GetAdditionalWebUISchemes` as the intended companion for embedder schemes | None (Astro-owned): override in Astro's data sources, or use the generic hook below | `content/browser/webui/web_ui_security_browsertest.cc:590` |
| `content/public/browser/web_ui_data_source.h:181-182` — `SetSupportedScheme` | **Exists and is the intended generic hook.** `WebUIDataSourceImpl::ShouldServiceRequest` honours it at `web_ui_data_source_impl.cc:196-197` | None (Astro-owned) — call `SetSupportedScheme("astro")` | `content/browser/webui/web_ui_data_source_unittest.cc`; behavioural proof at `web_ui_navigation_browsertest.cc:1244-1248` |
| `content/browser/webui/web_ui_data_source_impl.cc:380-401` — `GetOrigin` | **Blocker.** A source name that parses as a URL must be `chrome-untrusted://` — `CHECK(url.SchemeIs(kChromeUIUntrustedScheme))` at :392 — otherwise it is a bare host meaning `chrome://` (:397-398). An `astro-untrusted://alia-content/` source name crashes here | Derive the origin from the scheme actually present, validated against the embedder's WebUI-scheme list. Small and self-contained | `content/browser/webui/web_ui_data_source_unittest.cc:466-468` already asserts both existing rows of the table documented at `web_ui_data_source.h:175-178` |
| same, `:349-355` — `AddFrameAncestor` | `CHECK` restricts frame ancestors to `chrome://` or `chrome-untrusted://` (:352-353) — this is the wildcard guard | Same predicate. Needed for `astro://` → `astro-untrusted://` embedding (#11 "iframe/embed rules") | `content/browser/webui/web_ui_navigation_browsertest.cc:484` `FrameAncestorsDisallowEmbedding` / `:528` `FrameAncestorsAllowEmbedding` |
| `content/browser/webui/web_ui_impl.cc:101-120` — `ShouldIncludeDataSource` | Hard-codes `origin.scheme() != kChromeUIScheme` at :109; feeds the in-renderer local-resource loader | Same predicate | `content/browser/webui/web_ui_impl_unittest.cc` |
| `content/browser/webui/web_ui_impl.cc:203-209` | `requestable_schemes_` is initialised to `{kChromeUIScheme, url::kFileScheme}`; `AddRequestableScheme` (:364-366) is the public escape hatch, granted at `render_frame_host_impl.cc:13284-13287` | None (Astro-owned) — call `AddRequestableScheme("astro")` from Astro's controllers | `content/browser/child_process_security_policy_unittest.cc:400` `StandardSchemesTest` shape, asserting `CanRequestURL` |

### 2.6 Navigation handling and `NavigationThrottle`

| Upstream file | Extension point today | Minimum change | Test that proves it |
|---|---|---|---|
| `content/browser/browser_url_handler_impl.cc:88-96` — constructor | `BrowserURLHandlerCreated(this)` (:95) is the embedder hook for URL rewriting | **None, deliberately.** #12 forbids registering any handler that maps `astro://` → `chrome://`. The correct Astro delta here is the *absence* of a handler; `patches/astro/011-astro-url-scheme-alias.patch` is exactly what must not be reproduced | a browser_test asserting `BrowserURLHandlerImpl::GetPossibleRewrites` (`:115-...`) returns no rewrite for `astro://test/` |
| same, `:24-55` — `HandleViewSource` | `all_allowed_sub_schemes` seeded with 5 schemes then extended by `GetAdditionalViewSourceSchemes` (:44-45) | None (Astro-owned) — see §2.2 | `child_process_security_policy_unittest.cc:669` `ViewSource` |
| `content/browser/loader/navigation_url_loader_impl.cc:683-715` | For any scheme in `GetWebUISchemes()` the navigation **short-circuits before interceptors** into `CreateWebUIURLLoaderFactory(rfh, scheme, {})` (:698-699) and returns at :714 | None | `content/browser/webui/web_ui_navigation_browsertest.cc:217` `WebFrameInChromeSchemeIsAllowed` |
| same, `:1293-1330` | `HandleExternalProtocol` is only reached on the *unknown-scheme* path, which the :683-715 short-circuit skips entirely for WebUI schemes | None | see §3.3 — this is the mechanism behind "unknown Astro hosts fail internally" |
| `content/public/browser/content_browser_client.h:1758-1759` — `CreateThrottlesForNavigation(NavigationThrottleRegistry&)` | Fully generic embedder hook; no scheme knowledge | None (Astro-owned) | standard throttle browser_test |
| `content/browser/renderer_host/navigation_request.cc:11488-11508` | WebUI creation is driven purely by `WebUIControllerFactoryRegistry::GetWebUIType`; `kNoWebUI` at :11492 means no WebUI is created | None | `web_ui_navigation_browsertest.cc:1238` |
| `content/browser/webui/web_ui_controller_factory_registry.cc:75-84` — `IsURLAcceptableForWebUI` | `UseWebUIForURL` OR `about:blank` OR a renderer debug URL | None | `content/browser/webui/web_ui_security_browsertest.cc:525` `WebUIFailedNavigation` |
| `content/public/common/url_utils.cc:27-41` — `IsWebUIScheme` / `HasWebUIScheme` / `HasWebUIOrigin` | **Blocker, and the sharpest one.** A three-element literal (`chrome`, `chrome-untrusted`, `devtools`) with **no embedder hook at all**. 25+ call sites across `content/`, `chrome/` and `components/`, including `content/renderer/render_frame_impl.cc:5578` (should-fork decision) and `content/public/common/url_utils.cc:95` (`IsSafeRedirectTarget` — the redirect-escalation guard #11 asks for) | Make it consult the same embedder-supplied list `GetWebUISchemes()` already exposes. The complication is that `url_utils.cc` lives in `content/public/common` and must answer in the **renderer** too, where there is no `ContentBrowserClient` — so the list has to come from a common-layer store populated during `RegisterContentSchemes`, not from the browser client. That is the one non-trivial upstream design question in this document | `content/common/url_utils_unittest.cc:20-31` `HasWebUIScheme` — extend with an Astro-scheme case |

### 2.7 `ChildProcessSecurityPolicy`

| Upstream file | Extension point today | Minimum change | Test that proves it |
|---|---|---|---|
| `content/browser/child_process_security_policy_impl.cc:1028-1046` — constructor | `RegisterWebSafeScheme` / `RegisterPseudoScheme`. `astro` appears in **neither** list, which is the property that makes it privileged | None. Never register an Astro scheme as web-safe | `content/browser/child_process_security_policy_unittest.cc:363` `IsWebSafeSchemeTest`, `:382` `IsPseudoSchemeTest` |
| same, `:1468-1538` — `CanRequestURL` | At `:1523-1534`: if the URL's scheme is in `GetWebUISchemes()` and `DoesWebUIUrlRequireProcessLock` says yes, the process must be locked *and* `lock.MatchesScheme(url.GetScheme())`. Falls through to `!IsHandledURL(url)` at :1537 | None | `child_process_security_policy_unittest.cc:400` `StandardSchemesTest` (`:442` asserts `CanRequestURL(kRendererID, GetWebUIURL("foo/bar"))` is false) |
| same, `:1570-1662` — `CanCommitURL` | Scheme-generic: pseudo-scheme rejection (:1582), then `CanAccessMaybeOpaqueOrigin` against the process lock (:1623-1630), then the per-process grant table (:1657) | None | `child_process_security_policy_unittest.cc:450-456` |
| same, `:1944-...` — `CanCommitOriginAndUrl` | Scheme-generic; combines `CanCommitURL` with `CanAccessOrigin` and a `ProcessLock::Create` comparison (:1985-1990) | None | see §4.1 property 10 |
| same, `:1425-...` — `GrantWebUIBindings` | Called only from `RenderFrameHostImpl::AllowBindings` (`render_frame_host_impl.cc:7941-7942`) | None | `child_process_security_policy_unittest.cc:1120` `CanServiceWebUIBindings` |
| `content/browser/renderer_host/render_frame_host_impl.cc:7879-7953` — `AllowBindings` | **Critical and already generic**: `:7895-7906` refuses (via `NOTREACHED`) to grant WebUI bindings unless the process lock is a site lock *and* its scheme is in `URLDataManagerBackend::GetWebUISchemes()`. Adding `astro` to that list is therefore a **prerequisite** for Astro pages getting bindings at all — the "aliases only, no bindings" reading of `GetAdditionalWebUISchemes` is wrong at the content/ layer | None | `content/browser/webui/web_ui_security_browsertest.cc:101` `WebUIBindings`; `content/browser/security_exploit_browsertest.cc:1569` `AllowBindingsForNonWebUIProcess` |
| same, `:13245-13293` — `SetWebUI` | Generic: converts the SiteInstance to a site (:13263-13267), grants requestable schemes (:13284-13287), then `AllowBindings(web_ui_->GetBindings())` (:13292) | None | — |
| `content/browser/renderer_host/render_process_host_impl.cc:4625-4665` — `FilterURL` | Blocks any URL failing `CanRequestURL` and rewrites it to `about:blank#blocked` (:4650-4663) | None | §4.1 property 10 |

### 2.8 `SiteInstance`, site URL derivation and process locks

| Upstream file | Extension point today | Minimum change | Test that proves it |
|---|---|---|---|
| `content/browser/site_info.cc:1052-1059` — `GetSiteForOrigin` | Fully generic: `SchemeAndHostToSite(origin.scheme(), domain-or-host)` (:1057-1058), where `SchemeAndHostToSite` is `scheme + "://" + host` (`:82-84`). For `astro://test/` the registry-domain lookup finds nothing, so the host is used verbatim → site URL `astro://test` | None | `content/browser/site_instance_impl_unittest.cc:771` `GetSiteForURL` |
| same, `:697-730` — `ShouldLockProcessToSite` | `:716-720`: any scheme in `GetWebUISchemes()` defers to `DoesWebUIUrlRequireProcessLock` and **bypasses** the embedder's general `ShouldLockProcessToSite` opt-out at :724 | None | `content/browser/webui/web_ui_security_browsertest.cc:1072` `EnsureProcessLockWithoutSiteIsolation` |
| same, `:1099-1160` — `RequiresDedicatedProcessInternal` | `:1156-1160`: any scheme in `GetWebUISchemes()` requires a dedicated process, unconditionally, before the embedder is consulted at :1165 | None | `content/browser/site_instance_impl_unittest.cc:2092` `DoesSiteRequireDedicatedProcess` — which already exercises a custom `my-webui://` scheme via `GetAdditionalWebUISchemes` |
| same, `:44-75` — `IsWebUIAndUsesTLDForProcessLockURL` | WebUI hosts of the form `astro://foo.bar/` would share a process lock keyed on the TLD `astro://bar/` while keeping distinct site URLs | None, but a **policy trap**: #11's host catalog must avoid dotted hosts, or `astro://a.alia` and `astro://b.alia` silently share a process | assert `SiteInfo::GetProcessLockURL()` differs for every pair in the host catalog |
| same, `:755-765` — `GetStoragePartitionConfigForUrl` | Delegates to `ContentBrowserClient::GetStoragePartitionConfigForSite`; Chrome's version (`chrome/browser/chrome_content_browser_client.cc:1676`) special-cases extensions and IWAs, defaulting everything else | None (Astro-owned) — default partition unless #11 decides otherwise | `content/browser/site_instance_impl_unittest.cc:2085-2089` |
| `content/browser/site_info.cc:836-1050` — AgentClusterKey derivation | Generic; for a tuple origin with a non-empty host and a non-`file` scheme it lands at :980 `AgentClusterKey::CreateSiteKeyed(GetSiteForOrigin(origin))` | None | — |

### 2.9 Origin serialization

| Upstream file | Extension point today | Minimum change | Test that proves it |
|---|---|---|---|
| `url/origin.cc:38-65` — `Origin::Create` | Delegates to `SchemeHostPort`; `DCHECK`s at :57-59 that a valid tuple implies `url.IsStandard()` or a registered local scheme | None — registering `astro` as standard is what makes `url::Origin::Create(GURL("astro://test/"))` a **tuple** origin serializing to `astro://test` | `url/origin_unittest.cc:250` `Serialization`, `:225` `ConstructFromTuple` |
| `url/scheme_host_port.cc:66-144` — `IsValidInput` | :81-96 is the decisive branch: a **non-standard** scheme yields an invalid `SchemeHostPort` unless it is a registered *local* scheme or the Android WebView hack is on | None. See §3.2 for what breaks if this is skipped | `url/origin_unittest.cc:824` `IsSameOriginLocalNonStandardScheme` |
| `url/origin.cc:138-...` — `Serialize` | Returns `"null"` for opaque origins; otherwise the tuple | None | `url/origin_unittest.cc:250` |
| `content/browser/webui/web_ui_data_source_impl.cc:397-400` | `CreateFromNormalizedTuple(kChromeUIScheme, source_name_, 0)` then `CHECK(!result.opaque())` | See §2.5 `GetOrigin` | `web_ui_data_source_unittest.cc:466` |

### 2.10 Storage keys

| Upstream file | Extension point today | Minimum change | Test that proves it |
|---|---|---|---|
| `content/browser/renderer_host/render_frame_host_impl.cc:5536-5579` | `blink::StorageKey::CreateFirstParty(new_rfh_origin)` (:5544) for a top-level document — derived entirely from the committed origin, no scheme allowlist | None. A tuple origin `astro://test` yields a first-party storage key of `astro://test`; an **opaque** origin yields a nonce-keyed one, which is precisely the failure mode of §3.2 | `content/browser/renderer_host/render_frame_host_impl_browsertest.cc` (`GetStorageKey()` precedent); assert `rfh->GetStorageKey().origin().Serialize() == "astro://test"` |
| `content/browser/site_info.cc:755-765` | Storage **partition** is separate from storage **key** and is embedder-chosen | None (Astro-owned) | `content/browser/site_instance_impl_unittest.cc:2085` |
| `content/common/url_schemes.cc:120-121` | `service_worker_schemes` is pushed the two Chrome schemes unconditionally; Astro's schemes must **not** be added | None — the omission *is* the policy (#11: "service workers: no initially") | browser_test asserting `navigator.serviceWorker.register` rejects from `astro://test/` |

### 2.11 Renderer-side URL loader factories

| Upstream file | Extension point today | Minimum change | Test that proves it |
|---|---|---|---|
| `content/browser/renderer_host/render_frame_host_impl.cc:12609-12668` | `effective_scheme` is taken from the committed origin (:12615-12618) and matched against `GetWebUISchemes()` (:12627-12628); a matching document gets `CreateWebUIURLLoaderFactory(this, effective_scheme, {})` (:12633) and, if bound, **loses** its network factory (:12645-12657) | None | `content/browser/webui/web_ui_url_loader_factory_unittest.cc`; behavioural: `web_ui_security_browsertest.cc:714` `ChromeUntrustedFetchRequestToSelf` |
| `content/browser/webui/web_ui_url_loader_factory.cc:284-295` | The factory is constructed with a scheme and **kills the renderer** (`ReportBadMessage("Incorrect scheme")` at :295) on any request whose scheme differs | None — fully generic, and it is the per-scheme isolation guarantee | mojo bad-message browser_test |
| `content/renderer/local_resource_url_loader_factory.cc:218` | **Blocker (narrow).** `CHECK(request.url.GetScheme() == kChromeUIScheme)` in the in-renderer resource fast path. Reached only under `features::kWebUIInProcessResourceLoadingV2`, which is `FEATURE_DISABLED_BY_DEFAULT` (`content/public/common/content_features.cc:1200-1201`) | Either generalise the `CHECK`, or simply do not enable that feature for milestone 1. **The latter needs no action at all** given the default | unit test on the factory's `CanServe`; plus an Astro browser_test asserting resources still load with the feature explicitly disabled |
| `content/renderer/render_thread_impl.cc:846-856` | `kWebUICodeCache` / `kWebUIBundledCodeCache` register code-cache-with-hashing for the two Chrome schemes only | None (Astro-owned) via `ContentRendererClient` if wanted; skip for milestone 1 | — |

### 2.12 Trusted vs untrusted bindings, and how `chrome-untrusted://` is actually built

`chrome-untrusted://` is **not** special-cased as a scheme in any security
decision. It is built out of five reusable pieces, and every one of them is
available to `astro-untrusted://`:

| Upstream file | What it does | Reusable for `astro-untrusted://`? |
|---|---|---|
| `content/common/url_schemes.cc:63, 81, 95, 121` | Registers it standard + secure + CORS-enabled + service-worker-capable, alongside `chrome` | **Yes** — same `Schemes` struct. Astro omits the CORS and service-worker rows per #11 |
| `ui/webui/untrusted_web_ui_controller.cc:13-24` | `UntrustedWebUIController` calls `web_ui->SetBindings(BindingsPolicySet())` in its constructor (:16) and returns `TrustPolicy::kUntrusted` (:21-24) | **Yes, verbatim.** This is a `ui/webui` base class with no scheme knowledge whatsoever. Astro's untrusted controllers inherit it unchanged |
| `content/browser/webui/web_ui_impl.cc:303-311` | `GetRegistryFor` routes to `WebUIBrowserInterfaceBrokerRegistry::GetTrustedRegistry()` or `GetUntrustedRegistry()` purely on `controller.GetTrustPolicy()` | **Yes** — per-controller, not per-scheme |
| `content/public/browser/webui_config_map.cc:77-81` | `AddUntrustedWebUIConfig` — the only scheme-literal piece | Needs the §2.3 predicate |
| `content/browser/webui/url_data_manager_backend.cc:140-145` | Origin-keyed data-source lookup for the untrusted scheme | Needs the §2.5 generalisation |

**Answer to "is `chrome-untrusted://` reusable or special-cased":** the *trust
mechanism* is fully reusable and requires no upstream change; only two
*lookup/registration* sites carry the scheme literal. `ui/webui/untrusted_web_ui_controller_factory.cc:48-63`
is a separate, older factory that does hard-code the scheme at :52 — but it is
a `ui/webui` convenience, not a content/ chokepoint, and Astro should not use it.

The separation that matters is enforced at
`render_frame_host_impl.cc:7910-7912` (`CHECK_EQ(web_ui_->GetBindings(), webui_bindings)`)
and by the process lock, not by the scheme string. So an
`astro-untrusted://` host is isolated from `astro://` for exactly the same
reason `chrome-untrusted://` is isolated from `chrome://`: different origin →
different site URL → different process lock → `AllowBindings` refuses.

### 2.13 Omnibox — touchpoints only (#13, do not design here)

| Upstream file | State today |
|---|---|
| `components/url_formatter/url_fixer.cc:40` | Declares its **own** `const char kChromeUIScheme[] = "chrome"`, used at `:479, 494, 624, 628, 747-748`. `about:` → `chrome:` conversion lives at :628. **No embedder hook of any kind.** |
| `components/omnibox/browser/autocomplete_provider_client.h:128` | `GetEmbedderRepresentationOfAboutScheme()` — a real embedder hook, returning one scheme. Chrome returns `content::kChromeUIScheme` (`chrome/browser/autocomplete/chrome_autocomplete_provider_client.cc:374-378`) |
| same, `:134` / `:140` | `GetBuiltinURLs()` / `GetBuiltinsToProvideAsUserTypes()` — embedder-supplied host lists, fed from `chrome::ChromeURLHosts()` (`chrome/common/webui_url_constants.cc:75-241`). This is where Astro's #11 host catalog would surface |
| `chrome/browser/autocomplete/chrome_autocomplete_scheme_classifier.cc:66-101` | Classifies a typed scheme as `URL` if `ProfileIOData::IsHandledProtocol(scheme)` (:72) — so adding `astro` to Astro's handled-protocol set makes `astro://` type as a URL **for free** |
| `components/omnibox/browser/verbatim_match.cc:35`, `open_tab_provider.cc:43`, `tab_group_provider.cc:71, 185`, `most_visited_sites_provider.cc:486` | Direct `content::kChromeUIScheme` comparisons, no hook |

---

## 3. The four evidence questions

### 3.1 Is `chrome-untrusted://` registered through a reusable mechanism?

**Yes, for the security model; two lookup sites are special-cased.** See §2.12.
`RegisterContentSchemes` treats it identically to any embedder scheme
(`content/common/url_schemes.cc:63, 81, 95, 121`), the no-bindings guarantee
lives in a scheme-agnostic base class
(`ui/webui/untrusted_web_ui_controller.cc:13-24`), and interface-broker routing
keys off `WebUIController::TrustPolicy`
(`content/browser/webui/web_ui_impl.cc:303-311`). The scheme string only appears
in `WebUIConfigMap` (§2.3) and the data-source origin lookup (§2.5).

### 3.2 What breaks if a WebUI scheme is **not** in the standard-scheme list?

`SchemeHostPort::IsValidInput` returns `false` for a non-standard scheme unless
it is a registered *local* scheme (`url/scheme_host_port.cc:81-96`). The cascade:

1. `url::Origin::Create(GURL("astro://test/"))` returns an **opaque** origin
   (`url/origin.cc:62-63`).
2. `WebUIConfigMap` breaks immediately: it keys the map on
   `url::Origin::Create` (`webui_config_map.cc:86`), so every host collapses to a
   distinct nonce-bearing opaque origin and `GetConfig` (`:102`) can never
   match. **The host catalog would be unreachable.**
3. Site URL derivation falls off the `!origin.host().empty()` branch
   (`site_info.cc:924`) into the terminal `GURL(url.GetScheme() + ":")` at
   `:1046-1048` — every Astro host would share the site URL `astro:` and
   therefore **one process lock**, defeating #11's per-host isolation entirely.
4. `blink::StorageKey::CreateFirstParty` (`render_frame_host_impl.cc:5544`)
   receives the opaque origin, producing a nonce-keyed storage key that changes
   on every navigation — no durable storage, and no relationship between two
   loads of the same page.
5. `WebUIDataSourceImpl::GetOrigin`'s `CHECK(!result.opaque())`
   (`web_ui_data_source_impl.cc:400`) crashes the browser.

The `local_schemes` escape hatch (`content_client.h:125-128`,
`scheme_host_port.cc:89-91`) does produce a tuple origin, but carries `file://`
semantics and is documented upstream as a migration wart
(`scheme_host_port.cc:85-86`). **Register standard.**

### 3.3 How are `chrome://` hosts looked up, and what does an unknown host do?

Lookup is a two-stage miss-tolerant chain, and both stages fail *inside* the
browser:

1. **Controller lookup.** `WebUIConfigMap::GetConfig`
   (`webui_config_map.cc:91-114`) does an exact `url::Origin` match against the
   registered configs; a miss returns `nullptr` (:104), so
   `WebUIControllerFactoryRegistry::GetWebUIType` returns `kNoWebUI`
   (`web_ui_controller_factory_registry.cc:60`) and `NavigationRequest` creates no
   WebUI (`navigation_request.cc:11492`). No bindings are ever granted.
2. **Resource lookup.** The navigation still enters the WebUI loader path,
   because that branch keys on the *scheme*, not the host
   (`navigation_url_loader_impl.cc:687-688`).
   `URLDataManagerBackend::GetDataSourceFromURL` misses all three of its lookups
   and returns `nullptr` (`url_data_manager_backend.cc:160`), and
   `StartURLLoader` answers `net::ERR_INVALID_URL`
   (`web_ui_url_loader_factory.cc:136-139`).

**The requirement that unknown `astro://` hosts fail internally is satisfied by
construction, provided two things hold**: the scheme is in `GetWebUISchemes()`
(so the :687 short-circuit fires and the external-protocol path at
`navigation_url_loader_impl.cc:1293-1330` is never reached), **and** the scheme
is in Astro's `IsHandledURL` set — otherwise `CanRequestURL`'s final line
(`child_process_security_policy_impl.cc:1536-1537`,
`return !IsHandledURL(url)`) would treat `astro://` as a ShellExecute target.
Both are Astro-owned one-liners; neither needs a Chromium change. A browser test
must assert both halves, because either alone still produces a plausible-looking
error page.

### 3.4 Could a compromised HTTP/HTTPS renderer commit an `astro://` URL?

**No — three independent checks, all already scheme-generic.**

1. **Request filter.** Any URL a renderer asks the browser to navigate to passes
   `RenderProcessHostImpl::FilterURL`
   (`render_process_host_impl.cc:4625-4665`) → `CanRequestURL`. `astro` is not
   web-safe (§2.7) and the process has no grant, so `:1523-1534` requires the
   process lock to match the Astro scheme. An HTTP renderer's lock does not, so
   the URL is rewritten to `about:blank#blocked` (:4661).
2. **Commit validation.** If a compromised renderer forges a `DidCommit` for
   `astro://test/`, `RenderFrameHostImpl::ValidateURLAndOrigin` reaches
   `CanCommitOriginAndUrl` (`render_frame_host_impl.cc:15486`) →
   `CPSPI::CanCommitOriginAndUrl` (`child_process_security_policy_impl.cc:1944`)
   → `CanCommitURL` → `CanAccessMaybeOpaqueOrigin` against the process lock
   (`:1623-1630`). Failure kills the process with
   `bad_message::RFH_CAN_COMMIT_URL_BLOCKED`
   (`render_frame_host_impl.cc:15499-15502`).
3. **Bindings.** Even if a commit somehow landed, `AllowBindings`
   (`render_frame_host_impl.cc:7895-7906`) `NOTREACHED`s unless the process lock
   is a site lock whose scheme is in `GetWebUISchemes()`.

All three are driven by the process lock and by `GetWebUISchemes()`. The
security posture of `astro://` is therefore **identical to `chrome://`** the
moment the scheme joins that list — no new enforcement code is required, and
writing any would be a red flag. Blink adds a fourth, renderer-side layer via
`RegisterURLSchemeAsDisplayIsolated` (§2.2), but that one is defence in depth.

---

## 4. Vertical slice: acceptance spec for `astro://test/`

A diagnostic host with no product content. The twelve properties below are the
milestone-1 definition of done; each row is directly implementable.

Assume a browser test fixture `AstroSchemeBrowserTest` modelled on
`content/browser/webui/web_ui_navigation_browsertest.cc:1194-1235`
(`AdditionalSchemesWebUINavigationBrowserTest`), which is the closest precedent
for the whole slice and should be read before writing any of these.

| # | Property | Test type | Closest existing precedent | Assertion |
|---|---|---|---|---|
| 1 | Visible URL is `astro://test/` | browser_test (Astro, needs `chrome/browser/ui`) | `chrome/browser/ui/views/omnibox/omnibox_view_views_browsertest.cc:204` (`browser()->window()->GetLocationBar()->GetOmniboxView()`) | `EXPECT_EQ(u"astro://test/", browser()->window()->GetLocationBar()->GetOmniboxView()->GetText())` — and, separately, `EXPECT_EQ(entry->GetVirtualURL(), entry->GetURL())` to prove no virtual-URL rewrite is in play |
| 2 | Last committed URL is `astro://test/` | content_browsertest | `web_ui_navigation_browsertest.cc:1248` | `EXPECT_EQ(GURL("astro://test/"), shell()->web_contents()->GetLastCommittedURL())` |
| 3 | `NavigationEntry` URL and `GURL` are `astro://test/` | content_browsertest | `web_ui_navigation_browsertest.cc:1154` `SessionHistoryToFailedNavigation` | `EXPECT_EQ(GURL("astro://test/"), controller.GetLastCommittedEntry()->GetURL())` **and** `...->GetVirtualURL()`; assert `BrowserURLHandlerImpl::GetPossibleRewrites(GURL("astro://test/"), ctx)` contains no `chrome://` entry |
| 4 | Serialized origin is `astro://test` | **unit test** (`url_unittests`) + content_browsertest | `url/origin_unittest.cc:250` `Serialization`; `:225` `ConstructFromTuple` | Unit: `EXPECT_EQ("astro://test", url::Origin::Create(GURL("astro://test/")).Serialize())` and `EXPECT_FALSE(...opaque())`. Browser: `EXPECT_EQ("astro://test", EvalJs(shell(), "self.origin"))` — the second is the one that proves the **renderer** registered the scheme too |
| 5 | SiteURL uses `astro` | unit test (`content_unittests`) | `content/browser/site_instance_impl_unittest.cc:771` `GetSiteForURL` | `EXPECT_EQ(GURL("astro://test"), GetSiteForURL(GURL("astro://test/")))`; assert `.GetScheme() == "astro"` and `.GetHost() == "test"` explicitly, so a `chrome://` fallback cannot pass by accident |
| 6 | Process lock uses `astro` | content_browsertest | `web_ui_security_browsertest.cc:1072` `EnsureProcessLockWithoutSiteIsolation` | `ProcessLock lock = rfh->GetProcess()->GetProcessLock(); EXPECT_TRUE(lock.IsLockedToSite()); EXPECT_TRUE(lock.MatchesScheme("astro")); EXPECT_EQ(GURL("astro://test"), lock.GetProcessLockURL())`. **Run this variant with `--disable-site-isolation` too** — the precedent exists precisely because the guarantee must hold there |
| 7 | The WebUI controller is Astro's | content_browsertest | `web_ui_security_browsertest.cc:101` `WebUIBindings`; `web_ui_navigation_browsertest.cc:1189` | `EXPECT_TRUE(rfh->web_ui())` and `EXPECT_NE(nullptr, rfh->web_ui()->GetController()->GetAs<AstroTestUI>())` using the `WEB_UI_CONTROLLER_TYPE_DECL` machinery (`content/public/browser/web_ui_controller.h:109-111`) — a type-identity check, not a "some WebUI exists" check |
| 8 | Resources are served as Astro | content_browsertest | `web_ui_navigation_browsertest.cc:1238` `AdditionalSchemesWebUINavigation` (asserts a real resource loads over a custom scheme) | `EXPECT_TRUE(NavigateToURL(shell(), GURL("astro://test/title2.html")))` **plus** `EXPECT_EQ("astro://test", EvalJs(shell(), "new URL(document.currentScript ? ... : location.href).origin"))`; and a negative: with `SetSupportedScheme("astro")` set, a request for the same source over `chrome://` must fail |
| 9 | No `chrome://` underneath | content_browsertest + **static gate** | none upstream — this is Astro-specific | Runtime: assert properties 2, 3, 5, 6 all name `astro`, and that `rfh->GetLastCommittedOrigin().scheme() == "astro"`. Static: a repo test asserting no Astro source or patch registers a `BrowserURLHandler` pair mapping `astro`↔`chrome`, and that `patches/astro/011-astro-url-scheme-alias.patch` is absent. The runtime half alone cannot prove a rewrite is absent — it can only prove this particular URL was not rewritten |
| 10 | An HTTP/HTTPS renderer cannot take the privilege | content_browsertest ×3 | `web_ui_navigation_browsertest.cc:935` `DisallowWebWindowOpenToChromeURL` (a `WebUINavigationDisabledWebSecurityBrowserTest`, i.e. `--disable-web-security`, which is how upstream simulates a compromised renderer); `security_exploit_browsertest.cc:1569` `AllowBindingsForNonWebUIProcess`; `:1584` `BindToWebUIFromWebViaMojo` | (a) From an `http://` page under `--disable-web-security`, `window.open("astro://test/")` must not commit — `EXPECT_NE(GURL("astro://test/"), new_contents->GetLastCommittedURL())`. (b) `EXPECT_FALSE(policy->CanRequestURL(http_process_id, GURL("astro://test/")))`. (c) A forged commit is caught by `RenderProcessHostBadIpcMessageWaiter` (`content/test/content_browser_test_utils_internal.h:310`) — `EXPECT_EQ(bad_message::RFH_CAN_COMMIT_URL_BLOCKED, kill_waiter.Wait())`, the exact shape documented at `:302-304`. **All three are needed** — (a) and (b) test different layers and (c) tests the layer that actually kills |
| 11 | Unknown `astro://` hosts fail internally | content_browsertest | `web_ui_security_browsertest.cc:525` `WebUIFailedNavigation` | `EXPECT_FALSE(NavigateToURL(shell(), GURL("astro://no-such-host/")))`; `EXPECT_EQ(net::ERR_INVALID_URL, observer.last_net_error_code())` (`content/public/test/test_navigation_observer.h:148`); `EXPECT_FALSE(rfh->web_ui())`; `EXPECT_TRUE(rfh->GetEnabledBindings().empty())`. Plus a **counterfactual**: a test `ContentBrowserClient` installed via `ScopedContentBrowserClientSetting` (`content/public/test/test_utils.h:449`) that counts `HandleExternalProtocol` calls, asserting zero — without this the test passes identically whether the URL failed internally or was silently handed to the OS and rejected |
| 12 | `astro-untrusted://` is properly separated | content_browsertest ×2 | `web_ui_security_browsertest.cc:61` `UntrustedNoBindings`; `web_ui_navigation_browsertest.cc:1107` `UntrustedWebUIOriginsRequireDedicatedProcess` | (a) After navigating to `astro-untrusted://test-content/`: `EXPECT_FALSE(policy->HasWebUIBindings(process_id))` and `EXPECT_TRUE(rfh->GetEnabledBindings().empty())`. (b) `EXPECT_NE(astro_site_info, astro_untrusted_site_info)` via `SiteInfo::CreateForTesting`, and after navigating from one to the other, `EXPECT_NE(first_process_id, second_process_id)` |

**Two traps in this list, both learned from the upstream code rather than
guessed:**

- Property 5's unit test **must** call
  `URLDataManagerBackend::SetDisallowWebUISchemeCachingForTesting(true)` first
  and `false` at the end. `GetWebUISchemes()` memoises into a `NoDestructor`
  static (`url_data_manager_backend.cc:79`), so an unrelated unit test running
  earlier in the same binary can poison the cache and make the Astro scheme
  invisible. Upstream hit this exact problem and documented it at
  `site_instance_impl_unittest.cc:2093-2097`.
- Properties 9 and 11 both have a shape where **pass and "nothing was measured"
  look identical** — an error page for an unknown host looks the same whether it
  came from the internal loader or from a rejected OS handoff, and a single URL
  keeping its scheme does not prove no rewriter is registered. Both rows above
  carry an explicit counterfactual for that reason.

---

## 5. Shortest credible path to `astro://test/`

Six steps. Steps 1–4 need **zero** Chromium-owned changes; the first Chromium
edit appears at step 5 and is four lines.

1. **`//astro/common/url_constants.*`** — `kAstroScheme = "astro"`,
   `kAstroUntrustedScheme = "astro-untrusted"`, plus the #11 descriptor registry
   skeleton with a single host, `test`.
2. **`AstroContentClient::AddAdditionalSchemes`** — push both schemes onto
   `standard_schemes` and `secure_schemes`. Nothing else. Mirror
   `content/shell/common/shell_content_client.cc:75-85`.
3. **`AstroContentBrowserClient`** — override `GetAdditionalWebUISchemes`
   (both schemes), `IsHandledURL` (both schemes),
   `DoesWebUIUrlRequireProcessLock` (`true`),
   `GetAdditionalViewSourceSchemes` (empty),
   `IsWebUIAllowedToMakeNetworkRequests` (`false`).
   *After this step, properties 4, 5, 6, 10 and — for the wrong reason —
   11 already hold, because every check in §2.7/§2.8 is fed by
   `GetWebUISchemes()`.*
4. **`AstroContentRendererClient::RenderThreadStarted`** — the Blink
   registrations `RegisterURLSchemeAsDisplayIsolated`,
   `RegisterURLSchemeAsNotAllowingJavascriptURLs`,
   `RegisterURLSchemeAsWebUI` for `astro`, and the
   not-allowing-javascript-URLs registration for `astro-untrusted`. Model on
   `chrome/renderer/chrome_content_renderer_client.cc:425-558`, **not** on
   `content/renderer/render_thread_impl.cc:815`.
5. **The one Chromium edit: `content/public/browser/webui_config_map.cc`** —
   replace the four scheme literals at `:73`, `:79`, `:97-98` and `:117-118`
   with predicates. This is the minimum change that lets `astro://test` be a
   registered `WebUIConfig`.
   *Alternative that avoids even this*: register an Astro-owned
   `WebUIControllerFactory` (§2.4) instead of using `WebUIConfigMap` — exactly
   what `AdditionalSchemesWebUINavigationBrowserTest` does. **Take this route
   for milestone 1.** It reduces the Chromium delta for the vertical slice to
   *zero* and defers the `WebUIConfigMap` generalisation to the point where
   product hosts are ported.
6. **`//astro/browser/webui/astro_test_ui.*`** — a `WebUIController` serving one
   HTML string from a `WebUIDataSource` created with
   `SetSupportedScheme("astro")` (`content/public/browser/web_ui_data_source.h:182`),
   plus `AddRequestableScheme("astro")`. Register it through Astro's factory.

**What is deliberately deferred past the slice, with the reason:**

- `content::IsWebUIScheme` (§2.6). The vertical slice does not need it —
  `HasWebUIScheme` gates a renderer fork heuristic
  (`render_frame_impl.cc:5578`), the `IsSafeRedirectTarget` guard
  (`url_utils.cc:95`) and assorted UI polish. `astro://test/` commits and locks
  correctly without it. It **must** land before any product host ships, because
  `IsSafeRedirectTarget` returning `true` for `astro://` means an HTTP redirect
  chain can target an Astro URL. Track it as a blocking item on #12, and note
  that it is the one hook needing a genuine upstream design decision (a
  common-layer store, since the renderer has no `ContentBrowserClient`).
- `WebUIDataSourceImpl::GetOrigin` (§2.5). Only bites when an
  `astro-untrusted://` **data source** is registered; the trusted slice never
  reaches the `CHECK`. Required for property 12(b) with real resources.
- `local_resource_url_loader_factory.cc:218` (§2.11). No action needed:
  `features::kWebUIInProcessResourceLoadingV2` is disabled by default
  (`content/public/common/content_features.cc:1200-1201`). Revisit only if Astro
  enables it.
- Everything in §2.13. That is #13.

---

## 6. What makes this harder than it looks

Ranked by how likely each is to be discovered late.

1. **`content::IsWebUIScheme` has no embedder hook and cannot trivially get
   one.** Every other gap in this document is "swap a literal for a predicate
   sourced from `ContentBrowserClient`". This one lives in
   `content/public/common` and is called from the renderer
   (`render_frame_impl.cc:5578`), where no browser client exists. The fix needs
   a common-layer scheme store populated during `RegisterContentSchemes` — a
   different and larger change than the rest, and the only place where "small
   upstreamable generalisation" is an overstatement.
2. **The `GetWebUISchemes()` cache is a correctness hazard in unit tests, not
   just a nuisance.** `url_data_manager_backend.cc:70-83` memoises across the
   whole test binary. A green `content_unittests` run proves nothing about Astro
   scheme handling unless caching was disabled, and the failure presents as "the
   scheme was never registered" rather than as a caching bug.
3. **Dotted hosts silently share a process lock.**
   `IsWebUIAndUsesTLDForProcessLockURL` (`site_info.cc:44-75`) gives
   `astro://a.alia/` and `astro://b.alia/` the *same* process lock
   (`astro://alia`) while keeping distinct site URLs. #11's host catalog must
   either ban dots or accept that pairing deliberately — and a test must assert
   which, because nothing warns.
4. **`ungoogled`'s `IsSavableURL` stub interacts with the savable-schemes
   policy.** #11 says Astro schemes must not be savable. Upstream enforces that
   through `GetSavableSchemes()`; the applied ungoogled patch replaces the whole
   body with `return true` (upstream body:
   `content/public/common/url_utils.cc:43-49`). Under Astro Next this
   disappears with the patch stack (#8), but if
   any part of the ungoogled behaviour is retained as a curated decision, the
   savable-schemes row of #11's table is unenforceable and the descriptor
   registry would be asserting something false.
5. **Two acceptance properties are unfalsifiable if written naively** —
   properties 9 and 11 in §4. Both are called out there with counterfactuals.
6. **`chrome://` is not going away, and that is correct.** #11 says diagnostic
   pages stay on `chrome://`. So `GetWebUISchemes()` will contain both, and
   every "is this WebUI" check will answer yes for both. The invariant Astro
   must test is not "`chrome://` is absent" but "no `astro://` URL has a
   `chrome://` identity underneath it" — a different and narrower claim, which
   is why property 9 needs a static gate rather than a runtime probe alone.

---

## 7. `not-determined`

Items this survey could not settle from the tree, with the command that would
settle each. None blocks the vertical slice.

| Question | Command that settles it |
|---|---|
| Whether the Blink-side `SecurityOrigin`/`ShouldTreatAsOpaqueOrigin` path agrees with `url::Origin` for `astro://` in a *sandboxed* frame | build + `content_browsertests --gtest_filter=AstroScheme*` with a sandboxed iframe fixture; read `third_party/blink/renderer/platform/weborigin/security_origin.cc` alongside |
| Whether `astro://` needs an entry in the Android `WebView`/`clank` scheme paths | `grep -rn "kChromeUIScheme" android_webview/ clank/` on the real tree; #11's Android row is already flagged as "explicit documented gap" |
| Whether any `components/` subsystem outside omnibox (bookmarks, history, sessions) filters on `content::kChromeUIScheme` in a way that would drop `astro://` entries | `grep -rn "kChromeUIScheme" components/ --include=*.cc \| grep -v omnibox` and triage; not attempted here because it is #13/#14 surface, not #11/#12 |
| Exact upstreamability of the `WebUIConfigMap` predicate change (whether Chromium owners would prefer a `WebUIConfig`-side declaration) | file a Chromium bug against `content/public/browser/OWNERS` for `webui_config_map.*` before writing the CL |
