<!-- Hand-maintained. Every claim was read from the project's own source, not from
     its marketing or from a blog post about it. Sources are named per row so a
     later reader can re-measure rather than re-trust. Measured 2026-08-07. -->

# How other Chromium downstreams keep their delta small

Six projects, read from source. The question each one is being asked is not "is
this a good browser" but **"where does its downstream delta live, and what does
that cost at a Chromium version bump."**

The headline finding is worth stating before the detail, because it contradicts
the premise the current Astro architecture was built on. `AGENTS.md` describes the
overlay as "following the Brave-style approach". Brave carries **952 files in
`brave-core/patches/`** *in addition to* its `chromium_src` override tree. Astro
carries 169 (112 ungoogled + 57 Astro). **Copying Brave is not a route to a
smaller delta.** What is worth copying from Brave is one specific technique, and
it is not `chromium_src`.

---

## Summary

| Project | Where Astro-equivalent code lives | Upstream delta held as | Delta size (measured) | Version bump costs | Worth copying? |
|---|---|---|---|---|---|
| **Brave** | `src/brave` (own repo, gclient) | `patches/` **+** `chromium_src/` include-shadowing | **952** patch files | rebase patches + re-audit shadow files | **The `sources.gni` extension variable — yes. Everything else — no.** |
| **Vivaldi** | `//vivaldi`, build root inverted | a **forked GN** (`set_path_map`, `update_template_instance`) + `*_updates.gni` | **no `patches/` directory at all** | low — but they own a build tool | No — unless Astro wants to maintain a GN fork |
| **Iridium** | in-tree, no separate module | commits on per-milestone branches (`m89`…`m110`…) of a full Chromium fork | ~30 GB repository | `git rebase --onto` | **Yes — the branch model.** |
| **Thorium** | `src/` in its own repo | `cp -r` of 16 top-level Chromium directories | 16 directory copies + ad-hoc patches | re-copy and hope | No — it is the failure Astro is leaving |
| **ungoogled-chromium** | none (it removes, it does not add) | `patches/` + `domain_substitution.list` + `pruning.list` | 112 patches, **17,722** substitution entries, **12,392** pruned files | reapply the whole stack | No — and Astro already inherits its cost |
| **Electron** | `src/electron`, DEPS root solution | `patches/` applied by a gclient hook | — | — | The DEPS-root shape is informative; the product is not comparable |

---

## Brave

**Checkout.** `brave-core` is a separate repository placed at `src/brave`;
`brave-core/DEPS` (`use_relative_paths = True`) pulls Brave's own vendored
dependencies beneath it. The Chromium revision is declared in
`brave-core/package.json` under `config.projects.chrome`:

```json
      "chrome": {
        "dir": "src",
        "tag": "151.0.7922.83",
        "repository": { "url": "https://chromium.googlesource.com/chromium/src.git" },
        "custom_deps": { "src/testing/libfuzzer/fuzzers/wasm_corpus": null, ... },
        "custom_vars": { "checkout_clang_coverage_tools": true, ... }
      }
```

**What not to copy: the pin is a tag string, not a commit.** Astro's
`browser.lock.json` records the full 40-character SHA and its schema
(`browser.lock.schema.json`, `$defs/sha`) rejects anything else, with the reason
written into the schema: abbreviated SHAs, branch names and tag names "can resolve
to different commits over time". Astro is already stronger here and must not
regress to match a bigger project.

**What to copy: the extension variable.** `brave-core/patches/chrome-browser-BUILD.gn.patch`
is two added lines:

```
+  public_deps += [ "//brave/browser:core" ]
...
+  import("//brave/browser/sources.gni") public_deps += brave_chrome_browser_public_deps
```

The second is the one that matters — the *list* is downstream-owned, so adding a
Brave target never grows the Chromium-side delta. This is adopted directly in
[`minimum-chromium-hooks.md`](minimum-chromium-hooks.md) §A1.

Brave documents the technique and its own reservations in
`brave-core/docs/gni_sources.md`. Two of its cautions are worth inheriting whole:

- `sources.gni` was introduced *to work around circular dependencies* between
  `BraveContentBrowserClient` and `//chrome/browser`, and Brave now says its use
  to add **sources** to `//chrome/browser` and `//chrome/browser/ui` "should be
  avoided", while adding **deps** is "generally ok". Astro's `.gni` should
  contribute deps only.
- The recommended alternative is an interface/impl split, citing Chromium's own
  `tabs:tabs_public` / `tabs:impl` pattern.

**What not to copy: `chromium_src` / `redirect_cc`.** The mechanism, read from
source rather than from the docs: `brave-core/tools/redirect_cc/redirect_cc.cc:30-33`
declares `kIncludeQuotedFlag = "-iquote"` and `kBraveChromiumSrc =
"brave/chromium_src"`; a compiler wrapper prepends that include path, so
`#include "chrome/browser/profiles/profile.h"` resolves to Brave's shadow copy
when one exists. `brave-core/docs/patching_and_chromium_src.md` states the rule
plainly and gives the `#define BRAVE_BROWSER_H` idiom for injecting into upstream
headers.

Three reasons Astro should not adopt it, in order of weight:

1. **It does not solve #7's problem.** `-iquote` shadowing cannot alter a
   `BUILD.gn`. Brave still needs 952 patches.
2. **A stale shadow file compiles.** After a Chromium rebase, a `chromium_src`
   file that no longer matches its upstream counterpart still builds, and silently
   reverts whatever upstream changed. That is the same failure shape as the
   `chrome_web_ui_configs.cc` whole-file copy in `tools/overlay.allowlist`, which
   reverts four patches including the adblock WebUI registration.
3. **Brave itself warns against the whole-file case.** From
   `docs/patching_and_chromium_src.md`: *"One way electron went wrong is they
   copied entire files for changes inside a similar setup, do NOT do this. This
   will lead to newer Chromium rebases over time using old stale code which causes
   problems and makes rebasing much harder."* Astro currently does exactly this,
   for one file, and it is a declared defect.

Brave also carries `is_redirect_cc_build` (`brave-core/build/redirect_cc.gni`)
because some of its own builds cannot use the mechanism — a build mode whose
existence is the mechanism's cost, made visible.

---

## Vivaldi

**The most interesting case, and the least copyable.** Vivaldi has **no
`patches/` directory** — the GitHub source mirror `ric2b/Vivaldi-browser` has no
such path — and the delta is nonetheless small. The trick is in its `.gn`:

```gn
set_path_map([
    [ "//vivaldi", "//" ],
    [ "//out",     "//out" ],
    [ "//",        "//chromium" ],
  ])
import("//chromium/.gn")
buildconfig = "//vivaldi/gn/config/BUILDCONFIG.gn"
```

The build root is **Vivaldi**, and Chromium is a subdirectory remapped so that
Chromium's own `//`-relative labels keep working. Sources and deps are contributed
through `//vivaldi/gn/source_updates.gni`, `deps_updates.gni`,
`compile_updates.gni` and `product_updates.gni`, using an
`update_template_instance(target) { ... }` construct.

**Neither `set_path_map` nor `update_template_instance` exists in upstream GN.**
Measured against the GN binary this repository builds with —
`chromium/src/buildtools/linux64/gn --version` reports `2324 (304bbef6c7e9)` —
`gn help set_path_map` returns `ERROR No help on "set_path_map"`. Vivaldi ships a
forked build tool.

**Verdict: not copyable.** The near-zero patch count is bought with a GN fork, and
a GN fork is a larger maintenance commitment than the 6-line delta
[`minimum-chromium-hooks.md`](minimum-chromium-hooks.md) arrives at.

**One thing that is copyable, and free.** Vivaldi's `extraparts/` and
`clientparts/` directories contain `vivaldi_browser_main_extra_parts*.{h,cc}` and
`vivaldi_content_browser_client_parts.{h,cc}` — i.e. Vivaldi's product
initialization also hangs off `ChromeBrowserMainExtraParts` and
`ChromeContentBrowserClientParts`. Two independent downstreams reaching for the
same two upstream seams is good evidence those seams are the right ones, and it is
what [`minimum-chromium-hooks.md`](minimum-chromium-hooks.md) §A3 and §B choose.

---

## Iridium

**The closest match to what ADR-0001 recommends.** `iridium-browser/iridium-browser`
is a full Chromium fork (the GitHub API reports `size: 30354749` KB, ≈30 GB) with
per-milestone branches — `m89`, `m91`, `m95` … `m110` and onward — and the
downstream changes are ordinary commits on top. Sampled commit subjects on
`master`:

```
common: set Iridium version / User-Agent
all: add trk: prefixes to possibly evil connections
net: add "trk:" scheme and help identify URLs being retrieved
```

Small, purposeful, individually reviewable commits — which is precisely the
artifact `git diff <upstream-tag>..astro-next` would produce for Astro, and
exactly what a `.patch` file cannot be (a patch has no author, no message and no
history).

**What to copy:** the model — a branch per milestone, downstream commits rebased
onto each new upstream tag. **What it proves:** that hosting a Chromium fork on
GitHub is practical, and roughly what it costs.

**What not to copy:** Iridium has no `//iridium` module. Its changes are edits to
Chromium files in place, so its delta grows with every feature. That is exactly
what `//astro` exists to prevent — the branch model and the module model are
complementary, and Iridium demonstrates only the first half.

---

## Thorium

`setup.sh:70-86` copies sixteen top-level Chromium directories over the checkout:

```bash
cp -r -v src/BUILD.gn ${CR_SRC_DIR}/ &&
cp -r -v src/ash ${CR_SRC_DIR}/ &&
cp -r -v src/build ${CR_SRC_DIR}/ &&
cp -r -v src/chrome ${CR_SRC_DIR}/ &&
...
cp -r -v src/v8 ${CR_SRC_DIR}/ &&
```

plus copying `.patch` files into the tree to be applied later (`:93-96`).

This is Astro's current overlay mechanism at fifteen times the scale, and it has
every property findings §9, §10 and §13 record: no revision for the copied
content, silent reversion of anything upstream changed under those paths, and no
way to ask a built binary what it contains.

**Verdict: this is the thing being left behind.** It is included here because it is
useful to have measured the endpoint of the road Astro is currently on.

---

## ungoogled-chromium

Astro's inherited base, measured from the locked checkout at
`.ungoogled-chromium` (`browser.lock.json:20`, commit
`ecd0ec03e0d8b1ec59d3b32f3145575ada937490`):

| Mechanism | Size |
|---|---|
| `patches/` | 112 patch files |
| `domain_substitution.list` | **17,722** files listed for regex rewriting |
| `domain_regex.list` | 21 regex rules |
| `pruning.list` | **12,392** files deleted from the checkout |
| `flags.gn` | 22 GN args |

Three lessons Astro has already paid for:

1. **Domain substitution has never actually run in Astro** — Python regexes fed to
   `sed`, error discarded (`AGENTS.md`, declared defect owned by #8). A 17,722-file
   rewrite that silently did nothing is the clearest possible argument for
   `astro::optional` and fail-closed steps.
2. **Pruning is not recoverable with git.** findings §5: `git checkout -- .` +
   `git clean -fd` left 9,172 of the 12,392 pruned paths still absent, because
   much of what pruning removes is DEPS-provided; only `gclient sync --force`
   restored all 12,392.
3. **A patch stack that "works" can be compensating for broken inputs.** findings
   §3: seven of Astro's 56 patch files are structurally malformed — `@@` headers
   disagreeing with their bodies — and applied only because `patch -F3` tolerates a
   wrong hunk header. The old runner was not absorbing context drift; it was hiding
   seven broken files, indefinitely.

**Verdict: nothing to copy.** #8 owns replacing the aggregate behaviour with
curated decisions. What is worth carrying forward is `flags.gn` as *evidence*: it
records which de-Googling is achievable through GN args alone, and a GN arg is not
a patch.

---

## Electron

Included because it is the counter-example epic #3 asks to be explicitly rejected,
and because its checkout shape is informative.

`electron/DEPS:1` is `gclient_gn_args_from = 'src'` and `:78-79` begins
`deps = { 'src': …` — Electron is the **root gclient solution**, and Chromium is
pulled beneath it as `src`. Its patches are applied by a gclient hook
(`electron/DEPS:134-138`, running `src/electron/script/apply_all_patches.py`
against `src/electron/patches/config.json`).

**Rejected, per epic #3, on product grounds rather than mechanism.** The epic's
product-outcome list — tab strip and window management, omnibox behaviour and
autocomplete quality, Picture-in-Picture, profiles, downloads, permissions,
history, bookmarks, password manager, autofill, extensions, DevTools, session
restore, PDF and printing, accessibility, task manager — is a list of things
`//chrome` implements. Electron builds a shell and contains none of it. Choosing
Electron (or CEF, or a custom shell) is choosing to rewrite the browser product,
which is the opposite of what #7 is for.

**One shape worth noting anyway:** making the downstream the root solution is a
real alternative to A2 in [`ADR-0001`](ADR-0001-chromium-integration-model.md), and
it is how Brave works too. It was not chosen for Astro because it would make
`tools/gclient.template` describe an Astro-rooted checkout, moving the Chromium
tree's location and every path in `tools/` — a large change to working machinery
in exchange for a property (`custom_deps` in a rendered `.gclient`) that Astro
already has.

---

## What Astro takes, in one place

| From | Take | Reject |
|---|---|---|
| Brave | `sources.gni` extension variables; the deps-not-sources discipline; the explicit warning against whole-file copies | `chromium_src`/`redirect_cc`; tag-based Chromium pins; 952 patches |
| Vivaldi | confirmation that `ChromeBrowserMainExtraParts` + `ChromeContentBrowserClientParts` are the right seams | the forked GN, and therefore the whole `*_updates.gni` architecture |
| Iridium | the integration-branch model, rebased per milestone | in-place edits with no downstream module |
| Thorium | nothing | `cp -r` over the Chromium tree |
| ungoogled | `flags.gn` as evidence of what GN args alone can achieve | patches, domain substitution, pruning |
| Electron | awareness that a downstream-rooted gclient solution is viable | the product model, categorically |
