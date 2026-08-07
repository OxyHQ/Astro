<!-- Hand-maintained. Design for issue #7. Every Chromium citation is a line in
     chromium/src at commit ae03f7fb2cf1215853896d6a4c15fdceee2badb7
     (Chromium 146.0.7680.177), the commit browser.lock.json:7 pins. -->

# The minimum set of Chromium-owned hooks

What has to change in Chromium-owned files for `//astro` to be **built** and
**reachable**, and why each one cannot be avoided.

The scope is #7's, not the product's. #7 says explicitly: *"At this stage, add
only the hooks needed to prove the architecture builds. Do not port product
features yet."* Its out-of-scope list is identity, Alia, adblock, WebUI product
pages and `astro://`. So this document separates:

- **§A — the minimum now.** Three files. Nothing else is needed to compile, link
  and reach `//astro` from a running browser.
- **§B — hooks later issues will need,** each with the file, the shape, and the
  issue that owns it. Pre-declared so the allowlist can be written once rather
  than grown by surprise.
- **§C — hooks that turn out not to exist.** Three integration points that look
  like they need a Chromium edit and do not. One of them retires a declared
  defect.

---

## §A The minimum now: three files

### A1. `chrome/browser/BUILD.gn` — the build-graph edge

**What changes.** One `import()` of an Astro-owned `.gni`, and two appends inside
`static_library("browser")` (`chrome/browser/BUILD.gn:193`):

```gn
import("//astro/build/chrome_browser.gni")   # Astro-owned; see below
...
  deps += astro_chrome_browser_deps
  allow_circular_includes_from += astro_chrome_browser_circular_deps
```

`deps` is at `chrome/browser/BUILD.gn:1735`; `allow_circular_includes_from` is at
`:1531`.

**Why it cannot be avoided.** GN builds what is reachable from the root targets
and nothing else. `//astro` can be present on disk, syntactically valid and
completely absent from the binary — which is precisely the state findings §1
measured: `src/chrome/browser/oxy/BUILD.gn` is committed and declares a target,
and `grep -rl 'browser/oxy' chromium/src --include='BUILD.gn' --include='*.gni'`
returns **0**. There is no `.gclient`, DEPS, GN-arg or dotfile mechanism that
makes an unreferenced directory build. `chromium/src/.gn` has no `secondary_source`
and no mechanism for extra roots; its `default_args` block (`.gn:30-78`) can only
set variables.

**Why `chrome/browser` and not somewhere cheaper.** Two candidates were checked
and rejected:

- **Root `BUILD.gn`.** `group("gn_all")` (`BUILD.gn:87`) is `testonly` and is not
  what `//chrome` links. This is where `//internal:all` (`BUILD.gn:814-815`) and
  `//clank` (`BUILD.gn:426-428`) attach, which is exactly why those two are meta
  targets rather than product integration: `src-internal`'s actual product code
  reaches the binary through `is_internal_chrome_branded` conditionals scattered
  across individual `BUILD.gn` files (`build/config/chrome_build.gni:54`), which
  is the many-files shape #7 forbids.
- **`chrome/BUILD.gn`** (the final binary). Works, but puts Astro *outside*
  `//chrome/browser`, which makes the circular-dependency problem below worse
  rather than better, and leaves no place for the `allow_circular_includes_from`
  that upstream itself prescribes.

**The circular dependency, and upstream's own answer.** `//astro/browser` will
depend on `//chrome/browser` (Profile, PrefService, KeyedService). If
`//chrome/browser` also depends on `//astro/browser`, that is a GN cycle. Chromium
has this problem with its own sub-targets and documents the resolution in place —
`chrome/browser/BUILD.gn:1529-1530`:

```
  # Any circular includes must depend on the target
  # "browser_public_dependencies".
```

with **79** targets already listed in the first block (`:1531-1719`) and 21
further `allow_circular_includes_from +=` blocks elsewhere in the file. The full
rationale is at `chrome/browser/BUILD.gn:8392-8414`, and it names the hazard
rather than hiding it: the build graph "may miss generated dependencies, which
will result in compile errors."

So `//astro/browser` must carry
`public_deps = [ "//chrome/browser:browser_public_dependencies" ]`
(`chrome/browser/BUILD.gn:8415`), and appear in
`allow_circular_includes_from`. Neither `static_library("browser")` nor
`static_library("browser_public_dependencies")` declares `visibility`, so both
default to public and **no visibility hook is needed** — which is worth stating,
because `008-os-crypt-visibility.patch` exists in the current stack for exactly
that reason and findings §1 records that it grants a privilege the target cannot
exercise.

**Why an extension variable rather than a literal label.** If the hook were
`deps += [ "//astro/browser" ]`, then every later Astro target added to
`//chrome/browser` would grow the Chromium-side delta. Reading the list from an
Astro-owned `.gni` fixes the delta at one line forever. This is the one technique
worth copying wholesale from Brave — `brave-core/patches/chrome-browser-BUILD.gn.patch`
adds exactly:

```
+  import("//brave/browser/sources.gni") public_deps += brave_chrome_browser_public_deps
```

Brave documents both the technique and its limits in
`brave-core/docs/gni_sources.md`, including the caution that `sources.gni` into
`//chrome/browser` and `//chrome/browser/ui` should be preferred *last*, after an
interface/impl split. Astro should follow that: the `.gni` should contribute
**deps**, never **sources**. Contributing `sources` compiles Astro `.cc` files
inside the `//chrome/browser` target, which erases the boundary this ADR exists
to draw.

**The hook must name a label in `//astro/BUILD.gn`, and the reason is not stylistic.**
GN loads a directory's `BUILD.gn` only when a label *in that directory* is
referenced. `//astro/browser` refers to the directory `astro/browser`, so it
loads `astro/browser/BUILD.gn` and **never opens `astro/BUILD.gn` at all**.
Measured against the synced tree at `out/AstroModule`: `gn ls "//astro/*"`
returns `//astro/browser:browser`, `//astro/common:astro_schemes` and
`//astro/common:url_constants`, while `gn ls "//astro:*"` returns **no rows** —
same command, same build directory, so it discriminates rather than merely
failing. The module's own roll-up groups do not exist in the graph.

Two consequences, the second of which is the sharper one:

- The "one entry, forever" property is lost. Each new Astro target that Chromium
  must reach becomes another Chromium-owned edit — already demonstrated, since
  reaching `//astro/common:astro_schemes` from `chrome/common` cost a fourth
  Chromium-owned file.
- **An unreferenced `BUILD.gn` is never parsed, so it can be malformed
  indefinitely without any build saying so.** Confirmed in both directions in a
  standalone GN project: a deliberate syntax error in an unreferenced
  `BUILD.gn` leaves `gn gen` at exit **0** with zero errors; once any label in
  it is referenced the same file fails with
  `ERROR at //sub/BUILD.gn:1:6: Expecting assignment or function call.`
  A module root that looks load-bearing and is not is worse than no file.

**The fix is asymmetric between the two hook sites, and the asymmetry is
measured.** `deps` may name the roll-up (`//astro:browser`), which loads
`astro/BUILD.gn` and restores the property. `allow_circular_includes_from`
should keep naming the concrete `//astro/browser:browser`, because every entry
sampled from Chromium's own 79-entry list is a `static_library` or `source_set`
and **none is a `group`** (`//chrome/browser/autofill`, `//chrome/browser/devtools`
→ `static_library`; `//chrome/browser/permissions`, `//chrome/browser/favicon`
→ `source_set`). A group there is accepted by `gn gen` without complaint — so
choosing wrong fails silently, which is the one failure mode this document
exists to avoid.

Stated limit: whether a group in `allow_circular_includes_from` is merely
unconventional or actually ineffective is **not** established here. Two
synthetic fixtures failed to make `gn check` report a known-bad include even
with the target directly in the graph, so they were vacuous for that question
and their results were discarded rather than reported. The recommendation above
rests on upstream precedent plus the silent-acceptance risk, not on a
demonstration that the group form breaks.

### A2. `chrome/browser/DEPS` — the include rule

**What changes.** One line added to the `include_rules` list
(`chrome/browser/DEPS:1`):

```python
  "+astro",
```

**Why it cannot be avoided.** `chrome/browser/DEPS` is a `checkdeps` allowlist —
`buildtools/checkdeps/checkdeps.py` — and the root `include_rules`
(`chromium/src/DEPS:4002-4027`) permits only `+base`, `+build`, `+ipc`, `+url`,
`+testing` and a short list of `third_party` paths. `#include "astro/..."` from a
file in `chrome/browser` is rejected without an explicit rule. This is a
*different* check from `gn check`, which A1 satisfies; both have to pass, and each
is blind to the other's failure.

Keep it in `chrome/browser/DEPS`, **not** in the root `DEPS`. A root rule would
let any Chromium file anywhere include Astro headers, which is exactly the
property the allowlist in
[`upstream-allowlist-and-delta-report.md`](upstream-allowlist-and-delta-report.md)
exists to prevent — and it would make the allowlist unenforceable, because
checkdeps would no longer object to a new reference from an undeclared file.

### A3. `chrome/browser/chrome_browser_main.cc` — the product-initialization entry point

**What changes.** One include, and one call inside
`ChromeBrowserMainParts::Create()` (`chrome/browser/chrome_browser_main.cc:707`):

```cpp
#include "astro/browser/astro_browser_main_extra_parts.h"
...
  astro::AddExtraParts(main_parts.get());
```

**Why it cannot be avoided.** Something has to call into Astro, or Astro is linked
and inert. `ChromeBrowserMainExtraParts`
(`chrome/browser/chrome_browser_main_extra_parts.h:22-47`, the class body running
from `class ChromeBrowserMainExtraParts {` at `:22` to
`virtual void PostDestroyThreads() {}` at `:46`) is the generic embedder
extension point for exactly this — its own header says so: *"Interface class for
Parts owned by ChromeBrowserMainParts. The default implementation for all methods
is empty."* It exposes `PreEarlyInitialization`, `PostEarlyInitialization`,
`ToolkitInitialized`, `PreCreateThreads`, `PostCreateThreads`, `PreProfileInit`,
`PostProfileInit(Profile*, bool)`, `PreBrowserStart`, `PostBrowserStart`,
`PreMainMessageLoopRun`, `PostMainMessageLoopRun`, `PostDestroyThreads` — the full
startup sequence, without a single Astro conditional appearing in Chromium code.

**The call is the shape Chromium already uses for this.**
`ChromeBrowserMainParts::Create()` contains sixteen `AddParts` calls, and two of
them are exactly the one-function-call form proposed here:

- `chrome/browser/chrome_browser_main.cc:746` — `AddProfilesExtraParts(main_parts.get());`
- `chrome/browser/chrome_browser_main.cc:786` — `chrome::AddMetricsExtraParts(main_parts.get());`

So `astro::AddExtraParts(main_parts.get());` is not a new pattern being introduced
downstream; it is the existing pattern with a different namespace. All the Astro
logic — what parts to create, in what order, under what conditions — lives behind
that call in `//astro`, satisfying epic #3's integration rule.

**Placement in the sequence.** Add it last, after
`ChromeBrowserMainExtraPartsSegmentationPlatform` (`:801-802`) and before
`return main_parts;` (`:804`), so it cannot change the relative ordering of any
upstream part. The comment at `:749-750` — *"Construct additional browser parts.
Stages are called in the order in which they are added."* — is what makes "append
at the end" the minimal-consequence position rather than an arbitrary one.

### The complete §A delta

| File | Change | Lines | Anchors |
|---|---|---|---|
| `chrome/browser/BUILD.gn` | 1 `import()` + 2 `+=` appends | 3 | `:193`, `:1531`, `:1735` |
| `chrome/browser/DEPS` | 1 `include_rules` entry | 1 | `:1` |
| `chrome/browser/chrome_browser_main.cc` | 1 `#include` + 1 call | 2 | `:707`, precedent at `:746`, `:786` |

**Six lines across three files.** For comparison, `007-oxy-auth-build-hook.patch`
was 7 added lines against 36 removed, and the 36 removals stripped Safe Browsing
notification content detection, accessibility, Screen AI, the dangerous-download
UI, the preloading model and enterprise interstitials (findings §1). The
difference is not the added-line count; it is that this delta removes nothing.

### `enable_astro` — a gate Astro must own, and why

The natural instinct is to copy `//internal`'s gating: a gclient variable becomes
a GN arg (`build/config/chrome_build.gni:15-17`), so the tree builds with or
without the extra checkout. **That idiom is not available here**, and the reason is
specific: `gclient_args.gni` is generated from Chromium's own `DEPS`, and the set
of exported variables is an explicit allowlist at `chromium/src/DEPS:40-56`
(`gclient_gn_args`). A `custom_vars` entry naming a variable absent from that list
never reaches `gclient_args.gni`, so a `custom_deps`-added `//astro` cannot
produce a `checkout_astro` flag without editing Chromium's `DEPS` — which would
spend a fourth Chromium-owned file on something worth nothing.

The resolution: declare `enable_astro` in the Astro-owned
`//astro/build/chrome_browser.gni`, defaulting to `true`. The three hook sites
read it. A build with `enable_astro = false` yields empty lists and a no-op
`astro::AddExtraParts`, which is what makes the delta bisectable — "is this
regression ours?" becomes one GN arg rather than a revert.

The honest cost: the hooked Chromium files no longer build against a checkout
with no `//astro` at all, because `import("//astro/build/chrome_browser.gni")`
fails if the file is absent. That is acceptable and should be stated rather than
worked around: the integration branch is not intended to build without `//astro`,
and a missing `//astro` **should** be a loud `gn gen` failure rather than a build
that silently produces Chromium. Findings §10 is the record of what a silently
Astro-less artifact costs.

---

## §B Hooks later issues will need

Pre-declared so the allowlist is written once. Each is a single call or a single
append; none is a feature implementation in a Chromium file.

| Chromium file | Hook | Owner |
|---|---|---|
| `chrome/common/chrome_content_client.cc:203` (`ChromeContentClient::AddAdditionalSchemes`) | `astro::AddAdditionalSchemes(schemes);` — the `Schemes*` out-parameter is upstream's own extension mechanism (`content/public/common/content_client.h:158`, virtual, default empty) | [#11](https://github.com/OxyHQ/Astro/issues/11) |
| `chrome/browser/prefs/browser_prefs.cc:1373` (`RegisterLocalState`) and `:1687` (`RegisterProfilePrefs`) | `astro::RegisterLocalStatePrefs(registry);` / `astro::RegisterProfilePrefs(registry);` — one call each, replacing `020-register-oxy-prefs.patch` | [#15](https://github.com/OxyHQ/Astro/issues/15) |
| `chrome/browser/chrome_content_browser_client.cc:1390-1420` (constructor) | one `extra_parts_.push_back(std::make_unique<astro::AstroContentBrowserClientPart>());`. Note `ChromeContentBrowserClient::AddExtraPart` (`chrome_content_browser_client.h:1221`) is **`protected`** — the `protected:` specifier is at `:1214` — so it is reachable only from a subclass. Constructing in the constructor is the one-line alternative to subclassing `ChromeContentBrowserClient`, which is what Brave does and which is a much larger commitment | [#18](https://github.com/OxyHQ/Astro/issues/18), [#20](https://github.com/OxyHQ/Astro/issues/20) |
| `chrome/BUILD.gn` / `chrome/chrome_paks.gni` | one repack entry for an Astro `.pak`. Brave's equivalent is `brave-core/brave_paks.gni` | [#14](https://github.com/OxyHQ/Astro/issues/14) |
| `chrome/app/theme/…`, version/branding inputs | product name, icons, `chrome/VERSION`-adjacent constants | [#9](https://github.com/OxyHQ/Astro/issues/9) |

`ChromeContentBrowserClientParts` (`chrome/browser/chrome_content_browser_client_parts.h:49`)
is the second generic embedder seam, covering `RenderProcessWillLaunch`,
`SiteInstanceGotProcessAndSite`, `OverrideWebPreferences`, URL-handler and Mojo
binder registration. Between it and `ChromeBrowserMainExtraParts`, most of what
#18 and #20 need has an upstream extension point rather than requiring a new one.

---

## §C Hooks that turn out not to exist

Three integration points that look like they need a Chromium-owned edit, and do
not. Each was checked in the pinned tree.

### C1. WebUI configs need no hook at all — and this retires a declared defect

`AGENTS.md` declares as a known defect that a whole-file overlay copy of
`chrome/browser/ui/webui/chrome_web_ui_configs.cc` reverts four patches, so
`AstroAdBlockUIConfig` is never registered; `tools/overlay.allowlist` names #7 as
the owner of the removal.

**The file never needed to be touched.** `content/public/browser/webui_config_map.h:29-32`:

```cpp
// Class that holds all WebUIConfigs for the browser.
//
// Embedders wishing to register WebUIConfigs should use
// AddWebUIConfig and AddUntrustedWebUIConfig.
```

`WebUIConfigMap::GetInstance()` (`:38`) is a public runtime singleton;
`AddWebUIConfig` (`:47`) and `AddUntrustedWebUIConfig` (`:55`) are public.
`chrome_web_ui_configs.cc` is not a registration *mechanism* — it is one caller,
and `RegisterChromeWebUIConfigs()` (`:233`) is invoked from exactly one place in
the browser: `chrome/browser/chrome_browser_main.cc:1830`, inside
`ChromeBrowserMainParts::PreMainMessageLoopRunImpl()` (which begins at `:1648`).

Astro can therefore register its configs from its own `ChromeBrowserMainExtraParts`
— the hook already bought in §A3 — with **zero additional Chromium-owned
change**. The ordering inside `PreMainMessageLoopRunImpl()` was read out:

| Line | Event |
|---|---|
| 1787 | `PreProfileInit()` → dispatches to extra parts (`chrome_browser_main.cc`, `PreProfileInit` body iterates `chrome_extra_parts_`) |
| **1830** | **`RegisterChromeWebUIConfigs()`** |
| 1854 | `PostProfileInit()` |
| 1947 | `PreBrowserStart()` |
| 2009 | `PostBrowserStart()` |

So `PostProfileInit` or `PreBrowserStart` runs *after* Chrome's own registrations
and before any navigation — the correct place. `PreProfileInit` would run *before*
line 1830 and is therefore the wrong choice if Astro ever needs to replace an
upstream config rather than add one.

**This is a cost reduction for #7 and #14**, and it deletes the only `overwrite`
entry in `tools/overlay.allowlist`.

**The boundary of this claim, stated precisely so it is not over-read.** It holds
for configs on the **`chrome://` and `chrome-untrusted://` schemes** — which is
every Astro WebUI page today (`AGENTS.md`'s URL table: `chrome://astro-ntp`,
`chrome://alia`, `chrome://astro-error`, …) and everything #7 and #14 need. It
does **not** extend to `astro://`, because `WebUIConfigMap` hard-codes the scheme:

```cpp
void WebUIConfigMap::AddWebUIConfig(std::unique_ptr<WebUIConfig> config) {
  CHECK_EQ(config->scheme(), kChromeUIScheme);          // :73
```

with the same literals again in `AddUntrustedWebUIConfig` (`:79`) and in
`GetConfig` (`:97-98`) and `RemoveConfig` (`:117-118`), all in
`content/public/browser/webui_config_map.cc`. Registering an `astro://` config
therefore needs a `content/`-layer change, which is
[#11](https://github.com/OxyHQ/Astro/issues/11)'s and is analysed in
`astro-scheme-hooks.md`. #7's own out-of-scope list excludes `astro://`, so the
two statements are consistent — but a reader who takes "WebUI configs need no
hook" as unconditional will be wrong by exactly one `CHECK_EQ`.

### C2. Resource IDs need no `tools/gritsettings/resource_ids.spec` edit

The `grit()` template accepts a per-target `resource_ids` argument —
`tools/grit/grit_rule.gni:272-275`:

```gn
    _resource_ids = grit_resource_id_file
    if (defined(invoker.resource_ids)) {
      _resource_ids = invoker.resource_ids
    }
```

So Astro `.grd` targets can pass `resource_ids = "//astro/resources/resource_ids.spec"`,
an Astro-owned file, instead of adding entries to Chromium's 1,653-line
`tools/gritsettings/resource_ids.spec`. The remaining obligation is Astro's, not
Chromium's: allocate a reserved ID range and assert it does not overlap the
upstream ranges, because grit will not check across two spec files. That check
belongs with #14.

### C3. `gn check` needs no registration

`chromium/src/.gn` sets `no_check_targets` (`.gn:84`) and sets **no**
`check_targets`, so header checking defaults to every target in the build. `//astro`
is covered the moment it is in the graph, and it cannot be quietly excluded
without an edit to `.gn` that a reviewer would see in the delta.

The related caution from findings §7 applies to how this is verified: a `gn gen`
that fails writes no build graph, and `gn check` against no build graph reports
`0 errors`, which reads exactly like "clean". Any `gn check` result for `//astro`
must be reported alongside the target count `gn gen` printed —
`tools/lib/gn_check_baseline.py` and `tools/gn-check-baseline.json` already exist
for the surrounding machinery.

---

## What this changes about what #7 costs

Five findings, in descending order of how much they move the estimate:

1. **Acquisition is free.** `gclient` `custom_deps` adds `//astro` with zero
   Chromium-owned files changed — measured, see
   [`astro-checkout-mechanism.md`](astro-checkout-mechanism.md) §8. The entire
   upstream-delta budget goes to hooks.
2. **The minimum hook set is three files and six lines**, and it removes nothing
   from Chromium — unlike the historic 007, whose removals are why findings §1
   refuses to restore it.
3. **The `chrome_web_ui_configs.cc` overwrite is deletable outright** (§C1). It is
   the only `overwrite` entry in `tools/overlay.allowlist`, and it never needed to
   exist.
4. **`checkdeps` is a second, independent gate** (§A2) that `gn check` does not
   cover. Easy to miss; cheap once known.
5. **The `checkout_x → enable_x` idiom does not transfer** (§A's `enable_astro`),
   because `gclient_gn_args` is an allowlist (`DEPS:40-56`). Astro owns its own
   flag. Small, but the kind of thing that costs half a day when discovered during
   implementation instead of during design.

One risk that does *not* shrink: `allow_circular_includes_from` is a real
concession with a documented failure mode — missed generated-file dependencies
producing compile errors (`chrome/browser/BUILD.gn:8392-8414`). Astro inherits
that, mitigated only by doing what upstream says: depend on
`//chrome/browser:browser_public_dependencies`. The long-term fix is the
interface/impl split Brave's own docs recommend
(`brave-core/docs/gni_sources.md`), which belongs to whichever issue first hits
the problem, not to #7.
