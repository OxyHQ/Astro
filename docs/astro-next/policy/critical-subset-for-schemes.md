<!-- Hand-maintained. Not generated; do not add this file to tools/baseline or
     tools/policy generators. It is a proposal about issue dependencies, not a
     measurement of the repository. -->

# The critical subset of #10 that blocks #11

> **Status: accepted and enacted.** This was written as a proposal; the
> integrator took it, and §5's recommendations are now in the manifests. What
> changed, and where to read the result rather than the argument:
>
> | §5 recommendation | Where it now lives |
> |---|---|
> | Add entries for the surviving WebUI scheme set | `features.json` → `chrome-search-scheme` (**DISABLE_BUILD**), `dom-distiller-scheme` (**INVESTIGATE**, and §3.1 did not anticipate the platform split — see below) |
> | Add an entry for the savable-schemes bit | `features.json` → `page-saving-savable-schemes` (**DISABLE_BUILD**) |
> | Derive the per-page network posture | `features.json` → `webui-scheme-trust-split`, plus a `scheme_trust` / `webui_host` row on each page entry and an **Internal page inventory** table in `feature-manifest.md` |
> | Adopt the host-name disjointness rule | `features.json` → `webui-host-namespace` |
> | Re-express the seven page back-edges as inputs | a new `inputs_to` / `inputs_reason` field, distinct from `blocks`, enforced by `tools/policy/manifest.py`; see README.md |
> | Re-sign the CSP and font entries to #11 → #14 | the edge moved onto `astro-internal-schemes`; the `chrome://resources` trap of §3.6 is recorded in `webui-csp-and-trusted-types`'s `inputs_reason` |
>
> **Two things this document got wrong, corrected in the entries, not here.**
> §3.5 describes the savable patch as replacing `IsSavableURL`'s body; it has
> four hunks, and the one that matters most rewrites `chrome::CanSavePage` to
> `return true`, so restoring `IsSavableURL` alone would leave the row
> unenforced while looking fixed. §3.1 treats `chrome-distiller://` as one
> question with `chrome-search://`; it is not — on desktop the scheme has no
> product entry point at all, on Android it is Reader Mode's transport, and
> Astro ships both, so it is the one item of the five that could not be decided
> here.
>
> The body below is left as written. It is the measurement and the argument; the
> manifests are the decision.

| | |
|---|---|
| Question asked | Does *all* of [#10](https://github.com/OxyHQ/Astro/issues/10) (ASTRO-NEXT-007) have to block [#11](https://github.com/OxyHQ/Astro/issues/11) (ASTRO-NEXT-008), or does a small critical subset? |
| Chromium measured | `146.0.7680.177`, commit `ae03f7fb2cf1215853896d6a4c15fdceee2badb7` (`browser.lock.json`) |
| Checkout | `chromium/src`, `git rev-parse HEAD` matches the lock |
| Inputs read | `docs/astro-next/policy/` (#10), `docs/astro-next/architecture/astro-scheme-hooks.md` (#11), `docs/astro-next/baseline/findings.md` |

**Line numbers are pristine-upstream, not working-tree.** `tools/apply-patches.sh`
has been run in this checkout, so several cited files carry ungoogled edits.
Every citation below reproduces with:

```
git -C chromium/src show HEAD:<path> | sed -n '<line>p'
```

Where an *applied* patch matters to the argument it is called out explicitly and
cited as a working-tree diff instead.

---

## 1. The dependency as it stands today

Two statements of it exist and they do not agree.

**The epic's ordering.** `features.json`'s `astro-internal-schemes` entry
declares `"blocks": [12, 13]` with the reason *"the epic orders #11 → #12 →
#13"*. Nothing there says #10 blocks #11.

**The manifest's own back-edges.** Ten `features.json` entries declare
`"blocks": [11]`:

```
alia  astro-adblock-webui  astro-error-page  astro-newtab  astro-settings
astro-whats-new  first-run-page  oxy-identity  webui-csp-and-trusted-types
webui-fonts
```

Read literally, #11 waits on ten #10 entries. Read as "#10 is a blocker",
#11 waits on all 91.

### The measurement that reframes the question

Every one of those ten entries **already carries a decided `state`. None is
`INVESTIGATE`.**

```sh
python3 - <<'PY'
import json
f=json.load(open('docs/astro-next/policy/features.json'))['features']
print([x['id'] for x in f if 11 in (x.get('blocks') or []) and x['state']=='INVESTIGATE'])
PY
# []
```

Meanwhile 35 entries *are* `INVESTIGATE` — the manifest's own marker for "no
decision" — and **not one of them declares `blocks: [11]`**. Of those 35, 16 are
routed to [#20](https://github.com/OxyHQ/Astro/issues/20) and are out of scope
here by the routing rule; the remaining 19 are listed and disposed of in §4.

So by #10's own vocabulary the ten back-edges are not pending decisions. What
they carry is *input data* #11 reads — a different relation from a blocker, and
one that does not require #10 to finish first. That is the whole of the case for
unblocking, and it is why the rest of this document is about finding the items
where the relation really *is* a prerequisite, rather than about arguing the ten
away.

### One field points the wrong way, and it matters

`webui-csp-and-trusted-types` declares `"blocks": [11]`, and its own
`blocks_reason` argues the opposite direction:

> "What a trusted astro:// document may execute is part of the scheme's trust
> model, not a per-page choice. **#11 has to fix the floor before #14 packages
> pages onto it.**"

The prose describes #11 → #14. The field encodes #14 → #11. One of the two is
wrong; §3.6 shows the prose is right and the field is not, and that the real
coupling in that area is a different one nobody has written down.

---

## 2. Method, and what would falsify each finding

Each blocking claim below has to survive one test: **name the Chromium mechanism
that makes #11 unable to proceed, at a `file:line`, and say what breaks.** "It
seems related" fails that test, and so does "#11 will need this eventually" —
needing something later is not a blocker, it is a sequence.

Two properties of Chromium 146 do most of the discriminating, and both were
measured rather than assumed:

**(a) Scheme registration is one-shot and then locked.** `RegisterContentSchemes`
calls `AddAdditionalSchemes` once (`content/common/url_schemes.cc:59`), applies
every per-scheme vector, and calls `url::LockSchemeRegistries()`
(`:129`). The registry API's own header says the Add\*Scheme functions "will
assert if the lists of schemes have been locked" and are "not threadsafe"
(`url/url_util.h:54-56`, `:128-141`). It runs in **every** process from
`content/app/content_main_runner_impl.cc:908`. So anything expressed as a row of
`ContentClient::Schemes` (`content/public/common/content_client.h:116-156`) is
fixed for the life of the process, and changing it later is a code change plus a
restart — not a runtime toggle. **A decision that changes a `Schemes` row is a
genuine prerequisite.**

**(b) One list drives every WebUI security decision.**
`URLDataManagerBackend::GetWebUISchemes()` is `{chrome, chrome-untrusted}` plus
`ContentBrowserClient::GetAdditionalWebUISchemes`
(`content/browser/webui/url_data_manager_backend.cc:63-68`), and it is
**memoised into a process-lifetime `NoDestructor` static**
(`:70-84`, `:282-288`). That one list is read by:

| Consumer | Site |
|---|---|
| WebUI bindings grant | `content/browser/renderer_host/render_frame_host_impl.cc:7899-7901` |
| `CanRequestURL` | `content/browser/child_process_security_policy_impl.cc:1523-1531` |
| Navigation short-circuit (bypasses interceptors and the external-protocol path) | `content/browser/loader/navigation_url_loader_impl.cc:687-688` |
| Subresource factory / network-factory revocation | `content/browser/renderer_host/render_frame_host_impl.cc:12627-12628` |
| Dedicated process + process lock | `content/browser/child_process_security_policy_impl.cc:286`, `content/browser/site_info.cc:55-58` |

**A decision that changes the membership of that list is a genuine
prerequisite.** A decision that does not touch either (a) or (b), and cannot
reach an `astro://` document, is not.

---

## 3. The blocking subset — five items

Ranked by severity. Three are security prerequisites; two are correctness
prerequisites that are cheap to settle. **Two of the five are not currently
covered by #10 at all**, which is the substantive finding of this document.

### 3.1 The WebUI **scheme set**: do `chrome-search://` and `chrome-distiller://` survive? — *not covered by #10*

**Decision needed.** Does Astro ship the Instant/local-NTP scheme
`chrome-search://` and the Reader-Mode scheme `chrome-distiller://`?

**Why registration cannot proceed without it.** Astro must write
`AstroContentBrowserClient::GetAdditionalWebUISchemes`, and that function's
return value *is* the WebUI scheme set. Chrome's version returns three schemes:

```
chrome/browser/chrome_content_browser_client.cc:2089-2094
  additional_schemes->emplace_back(chrome::kChromeSearchScheme);      // :2091
  additional_schemes->emplace_back(dom_distiller::kDomDistillerScheme); // :2092
  additional_schemes->emplace_back(content::kChromeDevToolsScheme);   // :2093
```

`chrome-search` is not a passive alias. It is registered standard
(`chrome/common/chrome_content_client.cc:187-201`, entry at `:196`), savable
(`:225`) and secure (`:229`); it is in the handled-protocol set
(`chrome/browser/profiles/profile_io_data.cc:30-66`); and — the part that
matters — Chrome grants it an explicit **exemption from the WebUI process
lock**:

```
chrome/browser/chrome_content_browser_client.cc:2001-2017
  if (url.SchemeIs(chrome::kChromeSearchScheme) &&
      url.GetHost() == chrome::kChromeSearchMostVisitedHost) {
    return false;   // DoesWebUIUrlRequireProcessLock
  }
```

That exemption is consumed by `CanRequestURL`
(`child_process_security_policy_impl.cc:1527-1533`): for a scheme in
`GetWebUISchemes()` whose URL is exempt, **the process-lock check is skipped
entirely, for any process**. It exists so most-visited tiles can stay in a
third-party NTP's web process.

**What goes wrong if #11 proceeds without it.** Two failure modes, in opposite
directions, and the memoised static (§2(b)) means neither is fixable at runtime:

- *Omit them, and they were meant to survive.* `chrome-search://` and
  `chrome-distiller://` stop being WebUI schemes. The :687 short-circuit no
  longer fires for them, so their navigations fall through to the unknown-scheme
  path and `HandleExternalProtocol`, and `CanRequestURL`'s last line
  (`child_process_security_policy_impl.cc:1537`, `return !IsHandledURL(url)`)
  becomes the only thing standing between them and a ShellExecute handoff.
- *Include them, and they were meant to go.* Astro ships a WebUI scheme carrying
  a documented process-lock exemption, for a Google NTP the product does not
  have — a security relaxation inherited by copy-paste, and exactly the class of
  contaminated delta that Astro Next exists to remove (baseline finding 1's
  "What is deliberately NOT done").

**Why this is #10's decision and not #11's.** `chrome-search` is the Instant
Extended NTP; `chrome-distiller` is Reader Mode. Both are *capabilities*, which
is what #10 enumerates. #11 cannot invent a disposition for a Google-provider
feature.

**Status: #10 has no entry for either.** `features.json` contains no
`chrome-search`, no `distiller`, no `Instant`. The three entries that come
closest — `astro-newtab`, `ntp-tiles`, `google-search-default`, all `REPLACE` —
do not name the scheme, and the WebUI scheme set is not derivable from a feature
id. **Recommendation: add two `features.json` entries and block #11 on those two
only.**

### 3.2 `oxy-identity`: may a remote origin reach the trusted scheme? — *security prerequisite, already declared*

**Decision needed.** Does Astro's identity flow deliver its callback over the
trusted `astro://` scheme?

**Why.** The committed overlay says yes, and says it in the worst possible
shape:

```
src/chrome/browser/oxy/oxy_auth_service.h:22-23    kOxyAuthCallbackScheme = "astro"
                                                    kOxyAuthCallbackPath  = "auth/callback"
src/chrome/browser/oxy/oxy_auth_callback_handler.h:15
    astro://auth/callback?session_id=X&access_token=X&refresh_token=X&user_id=X&...
```

A privileged page that reads credentials out of its own query string. Now the
mechanism: Chromium's guard against a web redirect chain landing on a privileged
URL is `IsSafeRedirectTarget`, and it is the **one** hook in this whole area with
no embedder extension point:

```
content/public/common/url_utils.cc:27-31
  bool IsWebUIScheme(std::string_view scheme) {
    return scheme == content::kChromeUIScheme ||
           scheme == content::kChromeUIUntrustedScheme ||
           scheme == content::kChromeDevToolsScheme;
  }

content/public/common/url_utils.cc:81-105
  if (HasWebUIScheme(to_url))    // :95
    return false;
```

`astro` is not in that three-element literal, and it is not in the function's
`kUnsafeSchemes` set either (`:82-93`) — so `IsSafeRedirectTarget` returns
**true** for an `https://…` → `astro://…` redirect, and
`content/browser/loader/navigation_url_loader_impl.cc:1575-1577` therefore does
**not** raise `net::ERR_UNSAFE_REDIRECT`. Any HTTPS site — not merely
`auth.oxy.so` — can 302 a top-level navigation into an `astro://` URL with
attacker-chosen query parameters.

**What goes wrong if #11 proceeds without it.** If the auth host ships on the
trusted scheme before `IsWebUIScheme` is generalised, an arbitrary website can
drive the browser to `astro://auth/callback?access_token=<attacker's>` — session
fixation directly into the browser's own identity store. The scheme-hooks survey
already flags `IsWebUIScheme` as the one gap needing a real upstream design (a
common-layer scheme store, because the renderer has no `ContentBrowserClient`);
this is the decision that determines whether that work is on #11's critical path
or #12's.

**Status: correctly declared.** `oxy-identity` already carries `blocks: [11]`
with substantively this reason. Keep it. **It does not block scheme
*registration*** — only the shipping of an auth host on the trusted scheme, and
the two can be sequenced (§5).

### 3.3 Per-page network posture, which is the trusted/untrusted split

**Decision needed.** For each Astro product page, does its JavaScript make
network requests?

**Why registration cannot proceed without it.** Network reachability for a WebUI
document is decided at the **loader** layer, not by CSP:

```
content/browser/renderer_host/render_frame_host_impl.cc:12627-12663
  if (std::ranges::contains(webui_schemes, effective_scheme)) {
    ... factory_for_webui = CreateWebUIURLLoaderFactory(this, effective_scheme, {});
    if (enabled_bindings_.HasAny(kWebUIBindingsPolicySet) &&
        !GetContentClient()->browser()->IsWebUIAllowedToMakeNetworkRequests(   // :12646
            ...origin())) {
      pending_default_factory = std::move(factory_for_webui);   // no network factory
    } else {
      // WebUI scheme without bindings: keeps the network default factory
      pending_scheme_specific_factories().emplace(effective_scheme, ...);
    }
  }
```

So: **bound page → no network, full stop; unbound page → network.** Chrome's
allowlist escape hatch is four hosts and is explicitly a bug-tracked workaround
(`chrome/browser/ui/webui/chrome_web_ui_controller_factory.cc:347-362`).

This is the answer to "does network policy affect `URLDataSource`/CSP for
WebUI": *for a bound page it does not need to*, because there is no network
factory for a CSP to constrain. Which means the assignment of each page to the
trusted or the untrusted scheme is fixed by whether that page talks to the
network — and the untrusted scheme's existence and its registration vectors are
locked at startup (§2(a)). Chrome registers `chrome-untrusted` as
CORS-enabled and service-worker-capable (`content/common/url_schemes.cc:92-93`,
`:120-121`); Astro must decide those rows for `astro-untrusted` *before* the
lock, and cannot decide them without knowing what the untrusted scheme is for.

**What goes wrong if #11 proceeds without it.** A page assumed trusted and later
found to need the network has three exits, all bad: move it to the untrusted
scheme (a different origin, so persisted URLs, bookmarks and session entries all
break), add it to Astro's `IsWebUIAllowedToMakeNetworkRequests` allowlist
(re-creating the exact `crbug.com/829412` debt on day one), or ship a privileged
page with a network loader. The whole point of the trust split is to make that
choice once.

**Status: the data already exists.** `webui-fonts` is `REPLACE` (self-hosted
WOFF2 — so no font host), and `endpoints.json` carries `owning_feature` per
host, which is exactly the per-page yes/no this needs. **Recommendation: derive
a one-column table (page → makes network requests y/n) from the existing
endpoint manifest and hand it to #11. That is hours of work, not an epic.**

### 3.4 Host-name disjointness against the surviving `chrome://` host set

**Decision needed.** Which `chrome://` hosts survive — or, equivalently and much
more cheaply, a naming rule that makes the question moot.

**Why.** The WebUI data-source registry is a **flat map keyed on the bare host,
shared across every WebUI scheme except `chrome-untrusted`**:

```
content/browser/webui/url_data_manager_backend.cc:116-123   // AddDataSource
  data_sources_[source->source_name()] = source;            // :122

content/browser/webui/url_data_manager_backend.cc:137-160   // GetDataSourceFromURL
  if (url.GetScheme() == kChromeUIUntrustedScheme) { ...origin-keyed... }
  auto i = data_sources_.find(url.GetHost());               // :149  bare host
```

`WebUIDataSource::CreateAndAdd(browser_context, source_name)` names the source
with the bare host (`content/browser/webui/web_ui_data_source_impl.cc:57-62`),
and `WebUIDataSourceImpl` does **not** override
`URLDataSource::ShouldReplaceExistingSource`, whose default is `true`
(`content/public/browser/url_data_source.cc:52-54`) — so a later same-named
registration silently replaces the earlier one. The displaced scheme then fails
the survivor's scheme check:

```
content/browser/webui/web_ui_data_source_impl.cc:193-201
  if (parent_->supported_scheme_.has_value())
    return url.SchemeIs(parent_->supported_scheme_.value());
```

**This is not hypothetical in this repository.** The committed overlay already
uses two names that are real Chrome hosts:

| Overlay | Chrome |
|---|---|
| `src/chrome/browser/oxy/webui/astro_settings_ui.h:25` — `kAstroSettingsHost[] = "settings"` | `chrome/common/webui_url_constants.h:273` — `kChromeUISettingsHost[] = "settings"` |
| `src/chrome/browser/oxy/webui/astro_whats_new_ui.h:14` — `kAstroWhatsNewHost[] = "whats-new"` | `chrome/common/webui_url_constants.h:579` — `kChromeUIWhatsNewHost[] = "whats-new"` |

Today those are harmless, because `patches/astro/011-astro-url-scheme-alias.patch`
makes `astro://` an alias for `chrome://`, so it is one page, not two. #11
deletes that alias — and then they are two pages sharing one map key.

**What goes wrong if #11 proceeds without it.** The data source is added when the
controller is constructed, so the winner is **whichever of `chrome://settings`
and `astro://settings` the user opened last in that profile**. The loser returns
`net::ERR_INVALID_URL`. Order-dependent, per-profile, per-session, silent, and
`WebUIConfigMap` does not catch it — its duplicate `CHECK`
(`content/public/browser/webui_config_map.cc:83-89`) keys on `url::Origin`, so
`astro://settings` and `chrome://settings` are distinct there and both register
happily.

**Why the `DISABLE_BUILD` / `DISABLE_RUNTIME` distinction is load-bearing here,**
and this is the direct answer to "does disabling at build time vs runtime change
what `astro://` must handle": `RegisterChromeWebUIConfigs()`
(`chrome/browser/ui/webui/chrome_web_ui_configs.cc:232`) makes 137
`AddWebUIConfig` calls under 105 `BUILDFLAG` guards. A `DISABLE_BUILD` decision
removes the registration, so the controller can never be constructed and the
name is free. A `DISABLE_RUNTIME` decision leaves the config registered and only
makes `IsWebUIEnabled` false (`webui_config_map.cc:108-112`) — the page is
unreachable, but nothing guarantees the name stays free, and #10's own README
says a `DISABLE_RUNTIME` capability "is still reachable by a bug, a flag, an
enterprise policy or a `--enable-features` command line". **So the two states
give different answers to a question #11 must answer, which is the sharpest
demonstration in this document that #10's central distinction is not academic.**

**Recommendation, and it converts a blocker into a naming rule.** #11 does not
need to know which `chrome://` hosts survive if no `astro://` host name is a
`chrome://` host name. `ChromeURLHosts()`
(`chrome/common/webui_url_constants.cc:75-241`) is a single enumerable array;
`chrome/common/webui_url_constants.h` holds the rest. A repo test asserting
Astro's host catalog is disjoint from it closes this permanently, at any point
in #10's lifetime, and costs #11 two renames (`settings` → e.g.
`astro-settings`, `whats-new` → `astro-whats-new`). **With that rule adopted,
this item leaves the blocking subset.** Without it, it stays, and it blocks on
the disposition of every `chrome://`-host-owning feature — which is most of #10.

### 3.5 The savable-schemes row — *not covered by #10*

**Decision needed.** Does the inherited `enable-page-saving-on-more-pages`
behaviour survive #8's curation?

**Why.** #11's policy table says the Astro schemes must not be savable. Upstream
enforces that through `Schemes::savable_schemes`
(`content/public/common/content_client.h:121`, applied at
`content/common/url_schemes.cc:131-136`) and read by `IsSavableURL`
(`content/public/common/url_utils.cc:43-49`). Measured in this working tree, the
applied patch `patches/ungoogled/extra/ungoogled-chromium/enable-page-saving-on-more-pages.patch`
replaces that body outright:

```
$ git -C chromium/src diff HEAD -- content/public/common/url_utils.cc
   bool IsSavableURL(const GURL& url) {
  -  for (auto& scheme : GetSavableSchemes()) {
  -    if (url.SchemeIs(scheme))
  -      return true;
  -  }
  -  return false;
  +  return true;
   }
```

**What goes wrong if #11 proceeds without it.** #11 ships a descriptor registry
asserting a row — "not savable" — whose enforcement mechanism has been stubbed
to `return true`. The registry would be stating something false about the
product, which is precisely the failure mode #10's separation of `state` from
`observed_state` exists to prevent.

**Status: unowned.** `grep -in savable docs/astro-next/policy/features.json`
returns nothing. Under Astro Next the patch stack is deleted (#8), so the stub
goes with it — but only if #8 does not curate the behaviour back in. **This is a
one-bit answer from #8, not work.** Recommendation: add a `features.json` entry
so the bit has an owner, and block #11 on that entry.

### 3.6 What the CSP entries were reaching for, stated correctly

`webui-csp-and-trusted-types` and `webui-fonts` both declare `blocks: [11]`.
Neither is a pending decision (both `REPLACE`), and §3.3 covers the fonts
consequence. But there is a real coupling in this area that neither entry names,
and it is a trap rather than a decision:

The default WebUI CSP hands **any** non-`chrome-untrusted` data source a
`script-src` naming `chrome://resources`:

```
content/public/browser/url_data_source.cc:19-28   // the predicate
  bool IsChromeUntrustedDataSource(...) {
    return base::StartsWith(source->GetSource(), "chrome-untrusted://", ...);
  }

content/public/browser/url_data_source.cc:74-79
  case ScriptSrc:
    return IsChromeUntrustedDataSource(this)
             ? "script-src chrome-untrusted://resources 'self';"
             : "script-src chrome://resources 'self';";
```

An `astro://` source is not prefixed `chrome-untrusted://`, so it takes the
second branch — and its subresource factory is scheme-bound to `astro`, which
**kills the renderer** on any other scheme:

```
content/browser/webui/web_ui_url_loader_factory.cc:284-296
  if (request.url.GetScheme() != scheme_) { ... mojo::ReportBadMessage("Incorrect scheme"); }
```

So the default CSP grants an `astro://` page a scheme its own loader will kill
it for using. Upstream's answer is that every WebUI scheme carries its own
`resources` host (`content/browser/webui/url_data_manager_backend.cc:86-99`
registers both `chrome://resources` and `chrome-untrusted://resources`), and
Astro must do the same or override the directive. That is **#11's own work**, not
a #10 decision.

**Recommendation: re-sign both entries to #11 → #14** (which is what
`webui-csp-and-trusted-types`'s own `blocks_reason` prose already says), and
record the `chrome://resources` trap where #11 will read it.

---

## 4. What does **not** block #11, and why — mechanism, not intuition

The test applied to every remaining entry: does it change a `ContentClient::Schemes`
row (§2a), or the membership of `GetWebUISchemes()` (§2b), or can it be reached
from an `astro://` document?

### 4.1 Everything routed to #20 — 16 entries

`astro-updates`, `canvas-fingerprint-noise`, `certificate-transparency`,
`client-hints`, `component-updater`, `download-quarantine`,
`download-reputation`, `ev-certificates`, `http-accept-headers`,
`referrer-policy`, `safe-browsing`, `tls-grease`, `update-integrity`,
`web-store-and-update-urls`, `webgl-spoofing`, `webrtc-ip-handling`.

**Routed, not classified** — Safe Browsing, certificate verification, sandbox
and update integrity belong to #20 and this document takes no position on any of
them. What it does establish is that none is on #11's path: none appears in
`ContentClient::Schemes`, none appears in `GetAdditionalWebUISchemes`, and none
is consulted by any of the five `GetWebUISchemes()` consumers tabulated in §2.

### 4.2 Network-stack and Google-provider policy — the largest group

`dns-over-https`, `ipv6-probing`, `intranet-redirect-detector`,
`captive-portal-detection`, `google-static-assets`, `google-suggestions`,
`domain-reliability`, `variations-field-trials`, `metrics-uma-ukm`, `gcm-push`,
`privacy-sandbox`, `remoting`, `rlz`, `safesearch`, `supervised-users`,
`profile-avatar-download`, `google-calendar-drive-modules`,
`google-history-footprints`, `google-host-detection`, `commerce-shopping`,
`lens`, `glic-ai`, `chrome-sync`, `google-account-gaia`, `cast-media-router`,
`on-device-models`, `spellcheck`, `translation`, `astro-metrics`, `oxy-sync`,
`astro-crash-reporting`.

**Mechanism.** An `astro://` navigation never reaches the network stack: the
navigation short-circuits into `CreateWebUIURLLoaderFactory` **before
interceptors** and returns (`content/browser/loader/navigation_url_loader_impl.cc:685-715`,
whose own comment reads *"Requests to WebUI scheme won't get redirected to/from
other schemes or be intercepted"*), and a bound WebUI document has no network
factory at all (`render_frame_host_impl.cc:12645-12657`, §3.3). A policy that
changes what the network stack does — resolver, headers, field trials, an
endpoint's provider — therefore cannot change what `astro://` serves or how it
is secured.

**One qualification, stated rather than smoothed over.** Several of these own
`chrome://` hosts (`glic`, `sync-confirmation`, `commerce-internals`, …), so
their `DISABLE_BUILD` dispositions feed §3.4's namespace question — in the
*safe* direction, by freeing names. They constrain when §3.4 can be *closed*;
they do not constrain #11, and adopting §3.4's disjointness rule removes even
that.

### 4.3 Core-browser `KEEP` — 18 entries, including `extensions`

All already decided. `extensions` deserves its own paragraph because it is the
one place where a `KEEP` decision could plausibly have reached a privileged
scheme, and the measured answer is that it does not:

```
extensions/common/url_pattern.cc:31-38     kValidSchemes = { http, https, file, ftp,
                                              chrome, chrome-extension, filesystem,
                                              ws, wss, data, uuid-in-package }
extensions/common/url_pattern.cc:137-145   URLPattern::IsValidSchemeForExtensions
extensions/common/permissions/permissions_data.cc:137-148
    if (!URLPattern::IsValidSchemeForExtensions(document_url.GetScheme()) && ...)
      return true;   // restricted
```

`astro` is absent from that array, so `IsRestrictedUrl` returns *restricted* and
an extension cannot script an `astro://` page — **fail-closed by construction,
one guard earlier than the explicit `SchemeIs(kChromeUIScheme)` literal at
`permissions_data.cc:155-160`.** Two consequences worth carrying forward:

- The protection is an **omission, not a decision** — #10's own `DORMANT`
  shape. It must become a #11/#12 regression test, not a note.
- `chrome-extension` is registered CSP-bypassing
  (`chrome/common/chrome_content_client.cc:255`), so an `astro://` page's CSP
  does not constrain `chrome-extension://` subresources. That is defence-in-depth
  lost, not the primary guard, and it is `KEEP`'s known price.

`protocol-handlers` (`KEEP`) was checked for the same reason and is also
fail-closed: `registerProtocolHandler`'s safelist is a closed literal
(`third_party/blink/common/custom_handlers/protocol_handler_utils.cc:108-113`)
containing neither `astro` nor a wildcard, so no web page can claim the scheme.
See §6 for the one residual path.

`devtools` (`KEEP`) is decided and its scheme is already in Chrome's
`GetAdditionalWebUISchemes` (`chrome_content_browser_client.cc:2093`) and in
`IsWebUIScheme`'s literal (`url_utils.cc:30`); §3.1's decision is about the other
two, not this one.

### 4.4 Storage partitioning — checked, and it is not a #10 surface at all

`astro://` takes the default storage partition: Chrome's
`GetStoragePartitionConfigForSite`
(`chrome/browser/chrome_content_browser_client.cc:1676-1721`) special-cases only
`chrome-extension://` and `isolated-app://`, defaulting everything else — the
same treatment `chrome://` gets. Isolation comes from the storage **key**, which
is derived from the committed origin with no scheme allowlist
(`render_frame_host_impl.cc:5544`), and a tuple origin `astro://test` yields a
first-party key of `astro://test`. No #10 entry touches either path.

### 4.5 The one inherited patch that does mutate the scheme registry

`trk-scheme-blocking` (`REPLACE`, owner #8) is the only #10 entry that writes to
the same registry #11 must write to. Measured in the working tree, it adds `trk`
to two **static** lists in `url/url_util.cc` — `secure_schemes` (block at
`:78-84`) and `no_access_schemes` (block at `:93-98`) — rather than going through
`ContentClient::AddAdditionalSchemes`:

```
$ git -C chromium/src diff HEAD -- url/url_util.cc
  @@ -80,6 +80,7 @@   +      kTraceScheme,     # into secure_schemes
  @@ -94,6 +95,7 @@   +      kTraceScheme,     # into no_access_schemes
```

Non-blocking: `trk` collides with nothing Astro registers, is not a WebUI scheme,
and its `REPLACE` decision is already taken. Worth naming only because it is the
in-tree example of the pattern #11 must **not** copy — the scheme-hooks survey's
"never call `url::Add*Scheme` directly, route through `ContentClient`" rule, with
a live counter-example sitting in the applied stack.

### 4.6 The 19 open (`INVESTIGATE`) decisions not routed to #20

`astro-crash-reporting`, `astro-metrics`, `beforeunload-disabled`,
`captive-portal-detection`, `cast-media-router`, `disabled-ui-entries`,
`dns-over-https`, `fedcm`, `google-static-assets`, `google-suggestions`,
`history-expiration`, `ipv6-probing`, `js-optimizer-unfamiliar-sites`,
`manifest-v2`, `on-device-models`, `oxy-sync`, `popup-to-tab`, `spellcheck`,
`translation`.

These are #10's genuinely unfinished work. **None names a component in the
scheme-registration path** (`//url`, `//content/common/url_schemes.cc`,
`//content/public/common/content_client.h`, `//content/browser/webui`,
`chrome_content_client.cc`, `chrome_content_browser_client.cc`) in its
`upstream_component` field:

```sh
python3 - <<'PY'
import json
f=json.load(open('docs/astro-next/policy/features.json'))['features']
print([ (x['id'], x['upstream_component']) for x in f if x['state']=='INVESTIGATE' ])
PY
```

The two nearest misses were checked individually rather than waved through:
`manifest-v2` (`//extensions/common/manifest`) is covered by §4.3's fail-closed
result, and `fedcm` (`//content/browser/webid`) is reached from page JavaScript,
which a bound `astro://` document cannot perform (§3.3) — and its deciding
entry, `oxy-identity`, is already `REPLACE`.

---

## 5. The proposal

**Current dependency:** #10 blocks #11 — read either as ten `blocks: [11]`
back-edges or as the whole of #10.

**Proposed dependency:** #11 blocks on **four** items, of which two need
`features.json` entries that do not exist yet:

| # | Item | In #10 today? | Blocks |
|---|---|---|---|
| 1 | `chrome-search://` and `chrome-distiller://` dispositions (§3.1) | **No — must be added** | Scheme *registration* |
| 2 | Savable-schemes disposition (§3.5) | **No — must be added; a #8 one-bit answer** | The #11 policy table |
| 3 | Per-page network posture → trusted/untrusted split (§3.3) | Yes, as data in `endpoints.json` | Scheme *registration* |
| 4 | `oxy-identity` callback transport (§3.2) | Yes, `blocks: [11]`, correctly | Shipping an auth host, **not** registration |

Plus one item that is not a #10 dependency at all once a rule is adopted:

| 5 | Host-name disjointness from `ChromeURLHosts()` (§3.4) | Adopt the naming rule and this closes; otherwise it blocks on most of #10 |

**And the sequencing that makes item 4 non-blocking for the slice.** The
scheme-hooks survey's vertical slice (`astro://test/`, §5 of that document) needs
**no** product host. Items 1–3 gate the registration; item 4 gates only the
moment an auth host appears on the trusted scheme. So:

- **#11 milestone 1** — register both schemes, one diagnostic host, zero Chromium
  edits. Needs items 1, 2, 3.
- **#11 milestone 2** — port product hosts. Needs item 4 and the
  `content::IsWebUIScheme` generalisation.

**What the integrator would change if they accept this:**

1. Add two `features.json` entries — `chrome-search-scheme` and
   `page-saving-savable-schemes` — each with `blocks: [11]`.
2. Re-sign `webui-csp-and-trusted-types` and `webui-fonts` from `blocks: [11]` to
   #11 → #14 (matching their own `blocks_reason` prose), and record the
   `chrome://resources` CSP trap (§3.6) where #11 will read it.
3. Re-express the seven page-inventory back-edges (`alia`, `astro-adblock-webui`,
   `astro-error-page`, `astro-newtab`, `astro-settings`, `astro-whats-new`,
   `first-run-page`) as *inputs* rather than blockers — they are all `REPLACE`,
   i.e. decided, and what #11 actually needs from them is item 3's one-column
   table.
4. Adopt the host-name disjointness rule and gate it with a repo test.

**No security is traded for speed by any of this.** Item 4 stays blocking even
though it is inconvenient; §3.1 stays blocking specifically *because* getting it
wrong ships a process-lock exemption; §3.4 is retired by a stricter rule, not a
weaker one; and the extension result in §4.3 is downgraded from an assumption to
a required regression test rather than being assumed away.

---

## 6. `not-determined`

Items this analysis could not settle from the tree. None changes the split above;
each names the command that settles it.

| Question | Command that settles it |
|---|---|
| Whether an Isolated Web App can claim `astro:`/`astro-untrusted:` in the protocol-handler registry to any *observable* effect. The IWA branch of `IsValidCustomHandlerScheme` (`third_party/blink/common/custom_handlers/protocol_handler_utils.cc:92-106`) accepts "any scheme of ASCII-alpha blocks separated by dashes, length ≥ 2", which matches both names — but the WebUI navigation short-circuit (`navigation_url_loader_impl.cc:685-715`) bypasses `ProtocolHandlerThrottle`, so the registry entry may be inert for navigations while still affecting `HasCustomSchemeHandler` (`chrome_content_browser_client.cc:2144-2154`) and the omnibox. **#10 has no Isolated Web Apps entry at all**, and IWA schemes are registered on all of Astro's desktop platforms (`chrome/common/chrome_content_client.cc:190-193, 218, 267-270`) | build, then a browser_test registering an IWA handler for `astro` and asserting `NavigateToURL(GURL("astro://test/"))` still commits to `astro://test/`; plus `git -C chromium/src grep -n "HasCustomSchemeHandler" -- chrome/ content/` to enumerate the non-navigation consumers |
| Whether any `chrome://` host that survives `enable_extensions`/`ENABLE_EXTENSIONS_CORE` and the other 105 buildflag guards collides with Astro's final host catalog | `gn gen` with the committed args, then compile `chrome/common/webui_url_constants.cc` and diff the realised `ChromeURLHosts()` against Astro's catalog. Not attempted here: the target list is buildflag-dependent and reading the source over-counts |
| Whether `ShouldTreatURLSchemeAsFirstPartyWhenTopLevel` / `ShouldIgnoreSameSiteCookieRestrictionsWhenTopLevel` (`chrome_content_browser_client.cc:2019-2042`, both hard-coding `content::kChromeUIScheme`) matter to Astro. They grant a SameSite-cookie bypass to `chrome://` pages embedding a secure origin. Whether Astro needs the equivalent depends on #16's identity design, which is `INVESTIGATE` for `fedcm` | settled by #16's design, then a browser_test embedding a secure origin in an `astro://` page and asserting SameSite cookie behaviour |
| Whether any `components/` subsystem outside the omnibox filters on `content::kChromeUIScheme` in a way that silently drops `astro://` entries (bookmarks, history, sessions) | `git -C chromium/src grep -n "kChromeUIScheme" -- components/ ':!*omnibox*'` and triage. Deliberately not attempted: #13/#14 surface, and the scheme-hooks survey already records it as open there |

---

## 7. Confidence

| Claim | Confidence | What it rests on |
|---|---|---|
| §3.1 — the WebUI scheme set blocks registration, and #10 does not cover it | **High** | Three independent code paths cited; the absence in `features.json` was grepped, not assumed |
| §3.3 — per-page network posture determines the trust split, and the split is locked at startup | **High** | The bindings/network branch is quoted verbatim; the registry lock is in the API's own header |
| §3.4 — the flat data-source namespace makes same-name hosts collide | **High** on the mechanism; **medium** on the *ordering* of the failure | The map key, the replacement default and the scheme check are all cited. The "whichever page was opened last wins" claim is derived from where `CreateAndAdd` is called (controller construction), which is read from the overlay, not observed in a running browser — no Astro binary exists (baseline finding 1) |
| §3.2 — `IsSafeRedirectTarget` lets an HTTPS page redirect into `astro://` | **High** that the guard does not fire; **medium** that a commit follows | The literal and the call site are exact. Whether the redirected navigation then *commits* depends on the commit-time process-lock path, which is unmeasured here and needs the browser test named in the scheme-hooks survey's property 10 |
| §3.5 — savable-schemes is unenforceable under the applied stack and unowned in #10 | **High** | Working-tree diff quoted; the `features.json` absence was grepped |
| §4.1/§4.2 — network-stack and #20 policy cannot reach `astro://` | **High** | The short-circuit and the factory revocation are both quoted, and both are unconditional on the WebUI path |
| §4.3 — extensions cannot script `astro://` | **High** on the static reading; **not verified at runtime** | The array, the predicate and the caller are cited; no binary exists to confirm behaviourally, which is exactly why it is proposed as a regression test rather than as a settled fact |
| The overall split (four blockers, not 91) | **Medium-high** | It rests on the measurement that all ten declared blockers are already `state`-decided while all 35 `INVESTIGATE` entries are not among them. That is a property of the manifest, so it is only as good as the manifest — a #10 entry that is decided on paper but wrong in substance would not be caught by it, and §3.1 and §3.5 are two cases where the manifest was silent rather than wrong |
