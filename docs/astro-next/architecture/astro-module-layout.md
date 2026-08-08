<!-- Hand-maintained. Design for issue #7. The tree below is #7's, with the
     reasoning for each split and three deviations that are argued rather than
     assumed. -->

# The initial `//astro` directory structure

#7 specifies the tree. This document gives the reasoning per split, so that a
later change to it is a decision rather than a drift, and records the three
places where the design here deviates from the issue's diagram and why.

---

## The tree

```text
astro/                                   # gclient places this at chromium/src/astro
├── BUILD.gn                             # group("astro"); no sources of its own
├── DEPS                                 # include_rules — the layering contract
├── OWNERS
├── README.md
├── build/
│   ├── chrome_browser.gni               # the ONE file Chromium-owned BUILD.gn imports
│   └── astro_features.gni               # enable_astro and Astro-owned buildflags
├── app/
│   ├── BUILD.gn
│   ├── product_config.gni               # product name, ids, channel  (#9 owns the values)
│   └── branding/
├── common/
│   ├── BUILD.gn
│   ├── features.{h,cc}
│   ├── switches.{h,cc}
│   └── url_constants.h                  # header-only — see below
├── browser/
│   ├── BUILD.gn
│   ├── astro_browser_main_extra_parts.{h,cc}    # the §A3 hook's implementation
│   ├── content_hooks/
│   ├── prefs/
│   ├── identity/                        # #16
│   ├── privacy/                         # #20
│   └── updater/                         # #19, #25
├── components/
│   ├── adblock/                         # #18, #19
│   └── alia/                            # #17
├── ui/
│   ├── views/                           # #24
│   └── webui/                           # #14, #15, #22
├── resources/
│   └── resource_ids.spec                # Astro's own grit id range — see below
├── test/
└── tools/
```

## Reasoning, per split

### `build/` — one import surface

**Not in #7's diagram; added deliberately.** #7 asks for "one central Astro build
configuration import rather than patching many BUILD.gn files independently". That
central file has to live somewhere, and it must not be `astro/BUILD.gn`: importing
a `BUILD.gn` from another `BUILD.gn` is not how GN works, and putting the
extension variables in a directory that also declares targets invites a cycle
between "the list Chromium reads" and "the targets the list names".

`//astro/build/chrome_browser.gni` is therefore the **only** Astro file a
Chromium-owned `BUILD.gn` ever imports. Its whole content is list variables plus
`enable_astro`. If a second Chromium `BUILD.gn` ever needs a hook, it gets its own
`//astro/build/<that_file>.gni` — one `.gni` per hooked Chromium file, so the
mapping between the allowlist and this directory is one-to-one and greppable.

This is Brave's `sources.gni` idea with one change: Brave's `.gni` files sit
beside the code they describe (`brave/browser/sources.gni`), keyed by the Brave
directory. Keying by the *Chromium file being hooked* instead makes the answer to
"what does this Chromium file import, and why" a filename.

### `common/` — the bottom layer, and the reason the layering rule is real

**`url_constants` is header-only, and this is a correction.** An earlier version
of this document wrote `url_constants.{h,cc}` by analogy with the usual
Chromium pair. Measured against the pinned tree, upstream's equivalent has no
`.cc` at all: `content/public/common/url_constants.cc` does not exist, and
`content/public/common/BUILD.gn:224` lists `"url_constants.h"` alone. The reason
is the declaration style — `content/public/common/url_constants.h:21` and `:23`
are `inline constexpr char kChromeUIScheme[] = "chrome";` and
`inline constexpr char kChromeUIUntrustedScheme[] = "chrome-untrusted";`, C++17
inline variables that need no translation unit. `//astro/common/url_constants.h`
mirrors that shape exactly. Note that upstream still **lists the header in
`sources`** despite there being no `.cc`; a header that belongs to no target is
not attributable for `gn check`, so do the same. Found by the #9 slice owner and
verified here independently.

`features`, `switches`, `url_constants`. Nothing in `common/` may depend on
`browser/`, `ui/` or `components/`. This is the layer Chromium code will
transitively see through `//chrome/browser`, so it must have no browser
dependencies at all — otherwise the circular-includes concession described in
[`minimum-chromium-hooks.md`](minimum-chromium-hooks.md) §A1 widens from "one
target" to "everything Astro owns".

### `browser/` — where the hook lands, and the only place that may see `//chrome`

`astro_browser_main_extra_parts.{h,cc}` implements the §A3 hook and is the single
entry point Chromium calls. Everything else under `browser/` is reached from it.

`browser/` is the only Astro directory permitted to depend on `//chrome/browser`,
because it is the only one that has to carry
`public_deps = [ "//chrome/browser:browser_public_dependencies" ]` and appear in
`allow_circular_includes_from`. Confining that concession to one directory is the
main structural reason `browser/` is separate from `components/`.

### `components/` — feature engines, browser-agnostic

`adblock/` and `alia/`. These are the pieces with real algorithms, real parsers
and real network protocols — and therefore the pieces #26 wants under fuzzing and
#28 wants behind versioned contracts. Keeping them out of `browser/` means they
can be unit-tested without a `Profile`, which is the practical test of whether the
layering is honest.

The adblock engine is the concrete case: it wraps a Rust FFI boundary. A component
that can be exercised with a byte buffer and no browser is fuzzable; one that
needs a `Profile` is not.

### `ui/` — the top layer

`views/` for native UI (#24), `webui/` for privileged pages (#14, #15, #22).
Depends on `browser/`; nothing depends on it. This is the direction that
`//astro/DEPS` exists to enforce, and it is #7's own requirement: *"Add dependency
rules that prevent low-level Astro components from depending on browser UI
layers."*

### `resources/resource_ids.spec` — Astro's own grit range

**Not in #7's diagram; added because it removes a Chromium-owned edit.**
`tools/grit/grit_rule.gni:272-275` lets a `grit()` target pass its own
`resource_ids` file:

```gn
    _resource_ids = grit_resource_id_file
    if (defined(invoker.resource_ids)) {
      _resource_ids = invoker.resource_ids
    }
```

So Astro `.grd` targets never need entries in Chromium's 1,653-line
`tools/gritsettings/resource_ids.spec`. The obligation this moves onto Astro,
rather than eliminating: grit does not check for overlap *across* two spec files,
so Astro must reserve a range and assert non-overlap itself. That assertion is
#14's, and it must exist — a silent ID collision produces the wrong resource at
runtime with no build error, which is the worst failure shape available.

### `app/`, `test/`, `tools/`

As #7 specifies. `app/product_config.gni` holds the product constants #9 will
generate; creating it now with placeholder values and an owner is better than
leaving #9 to invent the location.

## Namespaces

Per #7: `astro::` for browser-product code, `oxy::` for Oxy service integration.
The boundary is a useful one and worth stating as a test rather than a
preference: **if the code would still make sense in a browser that had no Oxy
account, it is `astro::`.** Ad blocking is `astro::`. Identity token storage is
`oxy::`. The Alia side panel's *shell* is `astro::`; its Oxy backend client is
`oxy::`.

This also means the migration from the legacy overlay is not a rename-everything
exercise: `src/chrome/browser/oxy/adblock/astro_adblock_*` is already named for
the right namespace.

## `astro/DEPS` — the layering contract

`checkdeps` reads `include_rules` from `DEPS` files down the tree
(`buildtools/checkdeps/checkdeps.py`), so `//astro/DEPS` is where the layering is
enforced, and per-directory `DEPS` files refine it:

```python
# astro/DEPS
include_rules = [
  "+astro/common",
  "+components",
  "+content/public",
  "+ui/base",
]

specific_include_rules = {}
```

with, for example, `astro/common/DEPS` adding `"-astro/browser"`,
`"-astro/ui"`, `"-astro/components"`, and `astro/components/DEPS` adding
`"-astro/ui"` and `"-chrome"`.

Two things this must get right, both of which are easy to get wrong and silent
when wrong:

- **`+chrome` belongs only in `astro/browser/DEPS`**, not at `astro/DEPS`. A
  top-level `+chrome` makes the layering rule decorative, because every
  subdirectory inherits it.
- **checkdeps is a presubmit, not a build step.** Nothing in `tools/build.sh`
  runs it today. A layering rule nobody runs is a comment. Wiring
  `buildtools/checkdeps/checkdeps.py --root <chromium/src> astro` into
  `tools/tests/run.sh` or the build-safety CI job is part of making this real, and
  it needs the same mutation test as everything else: break the layering
  deliberately, confirm the check fails **and names the file**.

## Deviations from #7's diagram, collected

| Deviation | Why |
|---|---|
| `build/` added | #7's "one central Astro build configuration import" needs a home that is not a `BUILD.gn`; one `.gni` per hooked Chromium file makes the allowlist and this directory one-to-one |
| `resources/resource_ids.spec` added | `grit_rule.gni:272-275` makes a Chromium-owned `resource_ids.spec` edit unnecessary — a Chromium-owned file saved |
| `astro/DEPS` given concrete `include_rules` | #7 asks for "dependency rules"; naming the mechanism (`checkdeps`) and its gap (nothing runs it) is the difference between a rule and an intention |

Everything else is #7's tree unchanged, including the empty directories: an empty
directory with an `OWNERS` file and a `group()` in its `BUILD.gn` is a declared
place for work to land, which is cheaper than deciding where a subsystem goes
while implementing it.

## The repository question this raises

`//astro` maps onto a checkout root: gclient places one git repository at
`chromium/src/astro`, and GN addresses it as `//astro`. That means the repository
whose root *is* this tree cannot be `OxyHQ/Astro` as it stands today, because
`OxyHQ/Astro`'s root holds `tools/`, `patches/`, `webui/`, `docs/`, `gn_args/`
and — critically — `chromium/`, which is where the Chromium checkout lives. A
gclient entry pointing at `OxyHQ/Astro` would nest a copy of the integration
repository inside the Chromium tree, and a developer editing `//astro` would be
editing a copy that is not their working checkout.

Two ways out, and this is a decision #7 has to take rather than inherit:

1. **A dedicated module repository** (e.g. `OxyHQ/astro-module`) whose root is
   exactly the tree above. `OxyHQ/Astro` stays the integration repository: lock,
   tools, CI, docs, and the legacy system until #8 and #30 retire it. This is what
   [`astro-checkout-mechanism.md`](astro-checkout-mechanism.md) §2 assumes, and it
   is the arrangement Brave and Electron both use — `brave-core` and `electron`
   are their own repositories placed at `src/brave` and `src/electron`.
2. **Move the Chromium checkout out of `OxyHQ/Astro`** and promote `astro/`'s
   contents to this repository's root. Fewer repositories, but it changes every
   path in `tools/`, and it makes the integration tooling and the product source
   share a review surface — which is the coupling this whole ADR is trying to
   remove.

**Recommendation: (1).** The cost is one more repository and one more pin in
`browser.lock.json`. The benefit is that `//astro`'s root and the module's root
are the same directory, which is what makes every GN label in the tree above mean
what it says.
