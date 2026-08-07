<!-- Hand-maintained index. These documents are NOT produced by tools/baseline/*,
     which scopes itself to docs/astro-next/baseline (tools/baseline/generate-all.sh:31). -->

# Astro Next architecture

Design for [#7](https://github.com/OxyHQ/Astro/issues/7) (ASTRO-NEXT-004) under
epic [#3](https://github.com/OxyHQ/Astro/issues/3): the clean Chromium downstream
and a real `//astro` module.

**Nothing here has been implemented.** These are design documents. No product
code, no patches and no build-pipeline changes accompany them.

## What is here

| Document | Answers |
|---|---|
| [`ADR-0001-chromium-integration-model.md`](ADR-0001-chromium-integration-model.md) | Which integration model, compared against the alternatives, with the reasoning visible |
| [`astro-checkout-mechanism.md`](astro-checkout-mechanism.md) | The exact config and commands for a deterministic `//astro`, wired into `browser.lock.json`, `tools/gclient.template` and `tools/sync-sources.sh` |
| [`minimum-chromium-hooks.md`](minimum-chromium-hooks.md) | The minimum set of Chromium-owned changes: file, change, why it cannot be avoided — plus the hooks that turn out not to be needed |
| [`upstream-allowlist-and-delta-report.md`](upstream-allowlist-and-delta-report.md) | The allowlist format, the presubmit that rejects undeclared references, and the generated delta report |
| [`astro-module-layout.md`](astro-module-layout.md) | The initial `//astro` tree, with the reasoning per split and the layering contract |
| [`downstream-survey.md`](downstream-survey.md) | Brave, Vivaldi, Iridium, Thorium, ungoogled-chromium and Electron — measured from their own sources, with what to copy and what not to |
| [`clean-checkout-preconditions.md`](clean-checkout-preconditions.md) | The ordered, checkable list for "a clean checkout compiles `//astro`" |

Design for [#9](https://github.com/OxyHQ/Astro/issues/9) (ASTRO-NEXT-006), the
product manifest that generates every Astro identity value. It depends on #7 and
says per deliverable what is blocked on it:

| Document | Answers |
|---|---|
| [`product-manifest.md`](product-manifest.md) | The manifest's shape, the public name chosen per platform and why, the version/channel and User-Agent policies, how each value reaches Chromium, and what is blocked on #7 or #11 |
| [`product-identity-tests.md`](product-identity-tests.md) | The eight Windows acceptance criteria as implementable checks — each naming what it inspects, its vacuity floor and its blocking — plus the Linux, macOS, Android, UA and generator checks |
| [`product.schema.json`](product.schema.json) | The manifest's contract. Uses only keywords `tools/lib/lock.py`'s validator implements, so it is enforceable today |
| [`product.example.json`](product.example.json) | A valid instance carrying the chosen names. Validates with 0 errors; 10 of 11 deliberate mutations are rejected by name |

## The decision, in one paragraph

Astro C++ lives at `//astro`, a top-level directory in the Chromium source root,
obtained by one `custom_deps` entry in a `.gclient` that `tools/sync-sources.sh`
renders from `browser.lock.json` — which costs **zero** Chromium-owned files, and
was measured rather than assumed. The Chromium-owned edits that make `//astro`
reachable are **three files and six lines**, held as commits on an Astro-owned
integration branch of a Chromium fork rather than as patches, so
`git diff <upstream>..astro-next` *is* the downstream-delta report. Every hook is
an import-plus-append against an Astro-owned `.gni`, or a single function call
into `astro::`; no hook removes an upstream line, and the allowlist format cannot
express one.

## What these documents are measured against

- **Chromium `146.0.7680.177`**, commit `ae03f7fb2cf1215853896d6a4c15fdceee2badb7`
  (`browser.lock.json:7`), read at `chromium/src`. Every `chromium/src` citation
  is a line in that tree.
- **depot_tools** at `41c40cfaec7ee3bf0423c59925d8b23982a601f1`
  (`browser.lock.json:13`), read at `depot_tools/` and exercised in a live probe.
- **`docs/astro-next/baseline/findings.md`** — measured facts about the current
  system, built on rather than re-derived. Findings §1 (nothing links the overlay
  into the build), §2 (the GN args and the patch stack are coupled), §7 (there is
  no same-configuration pristine baseline) and §13 (builds silently incorporated
  uncommitted content) are the ones that shape this design most.
- **Other downstreams' own repositories**, read via the GitHub API on 2026-08-07 —
  not their documentation or third-party descriptions of them.

## Findings that change what #7 costs

1. `gclient` `custom_deps` **adds** dependencies the solution's `DEPS` does not
   declare, not just overrides existing ones (`depot_tools/gclient.py:698-711`).
   Measured end to end: the module lands detached at the pinned SHA, `gclient
   revinfo` records it, a wrong SHA exits 1. Acquiring `//astro` costs no Chromium
   file at all.
2. `content::WebUIConfigMap` is a **public runtime embedder API**
   (`content/public/browser/webui_config_map.h:29-32`, `:38`, `:47`). The
   whole-file overlay copy of `chrome/browser/ui/webui/chrome_web_ui_configs.cc` —
   a declared defect in `AGENTS.md`, the only `overwrite` entry in
   `tools/overlay.allowlist`, and the thing that silently unregistered the adblock
   WebUI — **never needed to exist**. Bounded: it holds for `chrome://` and
   `chrome-untrusted://` configs, which is every Astro page today. `astro://`
   needs a `content/`-layer change that #11 owns, because
   `content/public/browser/webui_config_map.cc:73` is
   `CHECK_EQ(config->scheme(), kChromeUIScheme)`.
3. `tools/grit/grit_rule.gni:272-275` lets a `grit()` target name its own
   `resource_ids` file, so Astro never edits Chromium's 1,653-line
   `tools/gritsettings/resource_ids.spec`.
4. `checkdeps` is a **second, independent gate** that `gn check` does not cover;
   `chrome/browser/DEPS` needs one added line, and nothing in the current build
   runs checkdeps at all.
5. The `checkout_x → enable_x` idiom that `//internal` uses does **not** transfer,
   because `gclient_gn_args` is an explicit allowlist (`chromium/src/DEPS:40-56`).
   Astro owns its own `enable_astro`.
6. **Brave carries 952 patch files** alongside `chromium_src`. `AGENTS.md`
   describes Astro's overlay as "following the Brave-style approach"; copying Brave
   is not a route to a smaller delta. One technique from it is worth taking — the
   `sources.gni` extension variable — and the rest is not.
7. **Vivaldi's near-zero patch count is bought with a forked GN.** `set_path_map`
   and `update_template_instance` do not exist upstream — verified against the GN
   this repository builds with, `2324 (304bbef6c7e9)`: `gn help set_path_map`
   errors.
