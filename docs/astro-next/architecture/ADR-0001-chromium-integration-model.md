<!-- Hand-maintained. Not produced by tools/baseline/*; the baseline generator
     writes only into docs/astro-next/baseline (tools/baseline/generate-all.sh:31). -->

# ADR-0001 — How Astro source is joined to Chromium

- **Status:** Proposed. Decides the architecture for
  [#7](https://github.com/OxyHQ/Astro/issues/7) (ASTRO-NEXT-004) under epic
  [#3](https://github.com/OxyHQ/Astro/issues/3).
- **Date:** 2026-08-07
- **Supersedes:** the undocumented overlay-copy arrangement described in
  `AGENTS.md` and `tools/overlay.allowlist`.
- **Measured against:** Chromium `146.0.7680.177`, commit
  `ae03f7fb2cf1215853896d6a4c15fdceee2badb7` (`browser.lock.json:7`), checked
  out at `chromium/src`. Every `chromium/src/...:N` citation below is a line in
  that tree. depot_tools citations are against the checkout at `depot_tools/`,
  commit `41c40cfaec7ee3bf0423c59925d8b23982a601f1` (`browser.lock.json:13`).

---

## Context

`docs/astro-next/baseline/findings.md` §1 establishes the fact this ADR has to
answer: **nothing in the committed pipeline links Astro into the build graph.**
`007-oxy-auth-build-hook.patch` is a 0-byte file, and on a fully patched tree
`grep -rl 'browser/oxy' chromium/src --include='BUILD.gn' --include='*.gni'`
returns 0. The one committed reference is `008-os-crypt-visibility.patch`, which
grants `//chrome/browser/oxy` a visibility privilege it has no way to exercise.

The historic 007 is not to be restored: it was 7 added lines against 36 removed,
and the removals strip Safe Browsing notification content detection,
accessibility, Screen AI and the dangerous-download UI. So the connection has to
be designed rather than recovered, which is what this ADR does.

Two further facts constrain the design:

- The committed GN args and the patch stack are **coupled**; there is no
  same-configuration unpatched baseline (findings §7). So "does the delta break
  anything" cannot be answered by differencing against a pristine build, and the
  delta therefore has to be small enough to review by reading it.
- `tools/overlay.allowlist` already declares one `overwrite` entry — a whole-file
  copy of `chrome/browser/ui/webui/chrome_web_ui_configs.cc` — which silently
  reverts four patches. That entry names #7 as its removal owner.

## The question is three questions

The four alternatives in the brief (`//astro` top-level directory; DEPS-pulled
separate repository; overlay copied in; git submodule) are not four points on one
axis. They conflate three decisions that can be made independently, and the
conflation is why the current arrangement is incoherent — it picked an answer to
(1) and (2) that made (3) impossible to keep small.

| # | Decision | What it determines |
|---|---|---|
| **P** | **Placement** — where Astro C++ lives inside the Chromium source root | GN label prefix, `gn check` coverage, whether Astro can be confused with upstream code |
| **A** | **Acquisition** — how a clean checkout obtains it | determinism, provenance, `gclient sync` behaviour, developer override |
| **H** | **Hooks** — how Chromium-owned files come to reference it | the size and reviewability of the upstream delta, and the cost of a version bump |

Every option below is scored on all three, because an option that is good at one
and silent about another is not a candidate — it is half a candidate.

---

## Options

### P1 — `//astro`, a top-level directory in the Chromium source root

**Precedent inside the pinned tree.** This is not novel; Chromium itself carries
two DEPS-supplied top-level directories:

- `chromium/src/DEPS:3094-3097` maps `src/internal` to
  `chrome/src-internal.git`, conditional on `checkout_src_internal or
  checkout_src_internal_infra`.
- `chromium/src/BUILD.gn:814-815` — `if (enable_src_internal) { deps += [
  "//internal:all" ] }`.
- `chromium/src/BUILD.gn:426-428` — `if (enable_chrome_android_internal) { deps
  += [ "//clank" ] }`, with `src/clank` at `DEPS:1627-1631`.
- The gating idiom: gclient variable → `gclient_args.gni` → GN arg, at
  `build/config/chrome_build.gni:15-17`.

So a top-level directory whose contents arrive from a separate repository is a
shape upstream builds, tests and ships. That matters more than elegance: it means
the GN, `gn check`, `checkdeps` and `gclient` code paths are exercised by Google.

**`gn check` coverage is automatic.** `chromium/src/.gn` sets `no_check_targets`
(`.gn:84`) but sets no `check_targets`, so header checking defaults to the whole
build. `//astro` needs no registration to be checked, and cannot be silently
excluded without an edit to `.gn` that a reviewer would see.

**Namespace hygiene.** `//astro/...` cannot be mistaken for upstream code in a
diff, a stack trace, a `gn desc` output or a `git status`. `//chrome/browser/oxy`
can, and has been: findings §9 records a compile failure whose root cause took a
`git ls-files --error-unmatch` to establish, because Astro code sitting under a
Chromium-owned path looked like Chromium code.

**Cost:** the label prefix appears in every Astro `BUILD.gn`. That is the point.

### P2 — Astro under `//chrome/browser/oxy` (status quo)

Rejected. It is the arrangement that produced the current state, and the
mechanism is the reason: because Astro files sit under a Chromium-owned
directory, the only way to get them there is to write into the Chromium tree, and
the only way to make Chromium reference them is to edit Chromium files in place.
The overlay allowlist (`tools/overlay.allowlist`) exists to make that survivable,
not to make it correct — its own header says every `overwrite` entry is "a
temporary, owned exception with a removal issue, not a permanent arrangement."

---

### A1 — `.gclient` `custom_deps`, rendered from `browser.lock.json` — **recommended**

`gclient`'s `custom_deps` can **add** a dependency the solution's `DEPS` does not
declare, not merely override one. `depot_tools/gclient.py:698-711`:

```
            # If a line is in custom_deps, but not in the solution, we want to
            # append this line to the solution.
            for dep_name, dep_info in self.custom_deps.items():
                ...
                if (dep_name not in processed_deps and dep_info
                        and not dep_info.endswith('@unmanaged')):
                    processed_deps[dep_name] = {
                        'url': dep_info,
                        'dep_type': 'git'
                    }
```

`gclient.py:678-694` handles the `managed: False` path (which is what
`tools/gclient.template:29` sets) and adds custom_deps entries there too.

**This was measured, not read.** A scratch solution whose `DEPS` was literally
`deps = {}`, with `managed: False` and one `custom_deps` entry, produced:

| Probe | Result |
|---|---|
| `gclient sync --nohooks` with `"src/astro": "<url>@<sha>"` | module present at `src/astro`, `git rev-parse HEAD` = the pinned SHA |
| HEAD state of the created checkout | **detached** — satisfies the repository's "checkouts are detached at the locked commit" rule without extra work |
| `gclient revinfo --output-json` | `{"src/astro": {"url": ..., "rev": "384166c6…"}}` — the pin is recorded, so provenance is covered by the existing `deps-revinfo.json` capture at `tools/sync-sources.sh:576` |
| pin changed to a second commit, re-sync | HEAD moved to the new SHA, still detached, exit 0 |
| pin set to a nonexistent SHA | `gclient sync` **exit 1**, `fatal: … not our ref` |

Both directions of that last row were measured, because a gate that has only ever
been observed passing is not a gate. The failure lands during `gclient sync`,
which `tools/sync-sources.sh:557` runs before anything invokes `gn`, so "a wrong
Astro revision fails before GN generation" is satisfied by the mechanism itself.

**What makes this the recommendation: it changes zero Chromium-owned files.**
The acquisition of `//astro` costs nothing against the upstream-delta budget. The
delta can then be spent entirely on hooks.

**The known sharp edge, stated rather than discovered later.** `gclient_args.gni`
is generated from Chromium's own `DEPS`, and the set of variables it exports is
an explicit allowlist at `chromium/src/DEPS:40-56` (`gclient_gn_args`). A
`custom_vars` entry naming a variable that is not on that list does not reach
`gclient_args.gni`. So the `checkout_x → enable_x` idiom that `//internal` uses
(`build/config/chrome_build.gni:15-17`) is **not available** to a
`custom_deps`-added `//astro` without editing Chromium's `DEPS`. The presence
flag must therefore be Astro-owned — see
[`minimum-chromium-hooks.md`](minimum-chromium-hooks.md) §"`enable_astro`".

### A2 — a `src/astro` entry in Chromium's own `DEPS`

Works, and is what `//internal` does. Two costs:

1. It spends a Chromium-owned file on acquisition, which A1 gets for free.
2. It puts the Astro revision inside a Chromium-repository commit. Every Astro
   module change would then need a commit on the Chromium downstream branch to
   re-pin it — coupling two repositories whose release cadences are not related.
   `browser.lock.json` already exists to be the single revision authority
   (`AGENTS.md`: "Source revisions are declared, never discovered"), and this
   would create a second one.

Rejected on (2), which is the substantive objection. Kept as the fallback if a
future requirement makes a hand-written `.gclient` unacceptable.

### A3 — git submodule

Rejected, on three specific grounds rather than taste:

- **Chromium's own tooling fights it.** `gclient sync` manages `src`'s working
  tree; a submodule pointer inside `src` is a tracked file, so any submodule
  update is an uncommitted modification to the Chromium checkout. That is exactly
  the state `astro::require_attributable_chromium`
  (`tools/lib/astro-common.sh:625`) is built to refuse, and
  `tools/sync-sources.sh:133-208` would report it as an unattributable change on
  every developer machine.
- **It cannot live at `//astro` without a Chromium commit anyway.** The
  `.gitmodules` entry and the gitlink are both files in `chromium/src`, so this
  option is A2 with worse ergonomics.
- **It has no provenance story.** `gclient revinfo` does not enumerate
  submodules of a solution's working tree, so the recorded revision set would be
  silently incomplete — and findings §10 is a record of what an artifact that is
  described by something other than its contents costs.

### A4 — copy the source in (status quo overlay)

Rejected by the epic's global definition of done ("No source-copy overlay is
required") and by measurement. The specific failures are on record:

- The copy runs **after** patches, so it reverts them silently
  (`tools/overlay.allowlist`, the `chrome_web_ui_configs.cc` entry: four patches
  reverted, one of them the adblock WebUI registration, which therefore never
  reached any build).
- It copied working-tree content into the build with no record (findings §13),
  which is how findings §9's compile failure happened.
- A copy has no revision. `git -C chromium/src log` cannot tell you what Astro
  code a binary contains; findings §10 is the consequence — an overlayless binary
  packaged as `astro-0.1.0-linux-x64.tar.gz`.

---

### H1 — a downstream integration branch in an Astro-owned Chromium repository — **recommended**

The hooks are edits to Chromium-owned files. There are only three ways to hold
such edits: a patch series, a git branch, or a compiler-level shadowing trick.
The epic forbids the first ("No `.patch` file is required to construct Astro
Next"). H3 below covers the third.

A branch gives four things a patch series does not:

1. **`git diff <upstream-tag>..astro-next` *is* the downstream-delta report.**
   #7 asks for one to be generated; with a branch it is not generated, it is
   read off the repository, which is stronger.
2. **A version bump is `git rebase --onto`.** A conflict is a conflict — it stops,
   with markers, in a work tree. Compare findings §3: seven Astro patch files are
   structurally malformed (`@@` headers disagreeing with their bodies) and were
   applied for an unknown length of time only because `patch -F3` tolerates a
   wrong hunk header. A rebase has no fuzz setting to tolerate.
3. **The merge base is checkable.** `git merge-base --is-ancestor
   <locked-chromium-commit> <downstream-commit>` answers "is this branch really
   based on the Chromium we locked" in one command, which is #7's "verify the
   downstream branch has the expected upstream merge base."
4. **History survives.** `git log --follow` on a hooked file shows why the hook
   exists. A patch file records only its current text.

**The cost, stated honestly.** It means hosting a Chromium fork. Iridium does
exactly this — `iridium-browser/iridium-browser` reports `size: 30354749` KB
(≈30 GB) with per-milestone branches `m89 … m110 …` — so it is proven possible
and it is not cheap. Two mitigations make the cost bounded rather than open-ended:

- The delta is small enough (see [`minimum-chromium-hooks.md`](minimum-chromium-hooks.md))
  that the branch can be **reconstructed from scratch** at each bump by
  cherry-picking N commits onto the new tag. Losing the fork is an inconvenience,
  not a data loss.
- Only the integration branch has to be pushed. The upstream history is fetched
  from `chromium.googlesource.com` by `tools/sync-sources.sh` exactly as today.

### H2 — extension variables in Astro-owned `.gni` files, imported by the hooked Chromium `BUILD.gn` files

Not an alternative to H1 — a **discipline applied on top of it**, and the single
most valuable thing to copy from another downstream. Brave's hook into
`chrome/browser/BUILD.gn` is two lines, and only one of them is a literal
dependency (`brave-core/patches/chrome-browser-BUILD.gn.patch`):

```
+  public_deps += [ "//brave/browser:core" ]
...
+  import("//brave/browser/sources.gni") public_deps += brave_chrome_browser_public_deps
```

The second line is the shape that matters: the *list* is Astro-owned, so adding
an Astro target never grows the Chromium-side delta. Brave documents both the
technique and its limits in `brave-core/docs/gni_sources.md`, including the
warning that `sources.gni` into `//chrome/browser` and `//chrome/browser/ui`
should be avoided in favour of interface/impl splits.

### H3 — compiler source-override (`chromium_src` / `redirect_cc`)

Brave's mechanism, verified from source rather than from its documentation.
`brave-core/tools/redirect_cc/redirect_cc.cc:30-32` declares:

```cpp
const base::FilePath::StringViewType kIncludeQuotedFlag =
    FILE_PATH_LITERAL("-iquote");
const base::FilePath::StringViewType kBraveChromiumSrc =
    FILE_PATH_LITERAL("brave/chromium_src");
```

A compiler wrapper prepends `-iquote brave/chromium_src`, so
`#include "chrome/browser/profiles/profile.h"` resolves to Brave's shadow copy
when one exists. `brave-core/docs/patching_and_chromium_src.md` states the rule
directly and gives the `#define BRAVE_BROWSER_H` idiom for injecting into upstream
headers.

**Rejected for now, and kept as a named escape hatch.** Reasons:

- It does not solve the problem #7 actually has. `-iquote` shadowing cannot alter
  a `BUILD.gn`, so the build-graph hook still needs H1 or a patch. Brave proves
  this: it carries **952 files in `brave-core/patches/`** *alongside*
  `chromium_src`. Astro today carries 168 (112 ungoogled + 56 Astro). Adopting
  Brave's model wholesale is not a route to a smaller delta.
- It makes a header's meaning depend on the compiler wrapper, which makes
  `gn check`, `clangd`, `compile_commands.json` and stack traces all subtly wrong
  unless every one of them is taught the same trick — Brave carries
  `is_redirect_cc_build` (`brave-core/build/redirect_cc.gni`) precisely because
  some of its own builds cannot use the mechanism.
- It is the exact shape of "a check whose pass and whose nothing-was-measured
  look identical": a shadow file that stops matching upstream after a rebase
  still compiles, and reverts upstream behaviour silently. That is the same class
  of defect as the `chrome_web_ui_configs.cc` copy.

Revisit only if a specific behaviour turns out to be unreachable through a hook,
and then per-file with an owner and a removal issue, in the shape
`tools/overlay.allowlist` already uses.

### H4 — CEF, Electron, or a custom shell

**Explicitly rejected**, as epic #3 requires. The product outcome list in #3
("tab strip and window management, omnibox behavior and autocomplete quality,
Picture-in-Picture …, profiles …, password manager and autofill, extension
support and DevTools, session restore, PDF viewing and printing, accessibility
and task manager") is a list of things `//chrome` implements and CEF/Electron do
not. Electron's own arrangement makes the tradeoff visible: it is the DEPS root
solution pulling `src` beneath it (`electron/DEPS:1` `gclient_gn_args_from =
'src'`, `:78-79` `deps = { 'src': …`) and it builds a *shell*, not Chrome — none
of the `//chrome` browser product is in it. Choosing Electron is choosing to
rewrite that product, which is not what #7 is for.

---

## Decision

**P1 + A1 + H1 + H2.**

Astro C++ lives at `//astro`, a top-level directory in the Chromium source root.
A clean checkout obtains it through one `custom_deps` entry in `.gclient`,
rendered by `tools/sync-sources.sh` from `tools/gclient.template` with the
revision taken from `browser.lock.json`. The Chromium-owned edits that make
`//astro` reachable live as commits on an Astro-owned integration branch of a
Chromium fork, pinned by full SHA in the same lock, and every such edit is a
single import-plus-append against an Astro-owned `.gni`, or a single function
call, and nothing else.

### Flat comparison, as requested

| | `//astro` top-level dir (**P1**) | DEPS-pulled separate repo (**A1/A2**) | Overlay copied in (**A4**) | Git submodule (**A3**) |
|---|---|---|---|---|
| **Clean checkout obtains it** | n/a — placement only | `gclient sync` from a full SHA in `browser.lock.json`; measured to land detached at the pin | `rsync`/`cp` from a working tree; no revision | `git submodule update`, requires a tracked gitlink inside `chromium/src` |
| **Enters the build graph** | `//astro/...` labels; checked by `gn check` with no registration (`.gn` sets no `check_targets`) | same as placement | never did — findings §1 | same as placement |
| **Chromium version bump** | unaffected | unaffected; re-pin in the lock | copy silently reverts whatever the new Chromium changed | unaffected, but the gitlink conflicts on every Chromium-side change |
| **`gclient sync` interaction** | n/a | native; `gclient revinfo` records the rev (measured) | fights it — the copy is unattributable working-tree state (findings §13) | fights it — a permanent uncommitted modification inside `src` |
| **Reviewability of the downstream delta** | high: `//astro` is visibly not upstream | high | nil: a copy is not a diff | medium; the delta is a SHA nobody reads |
| **Chromium-owned files spent** | 0 | **0** for A1, 1 for A2 | 1 per overwritten file, growing | ≥2 (`.gitmodules` + gitlink) |

### Source ownership, update flow, CI, licensing

- **Ownership.** `//astro` is Astro-owned in full. Chromium-owned files are
  upstream's, and Astro's claim on them is only the allowlist in
  [`upstream-allowlist-and-delta-report.md`](upstream-allowlist-and-delta-report.md).
  Namespaces follow #7: `astro::` for browser-product code, `oxy::` for Oxy
  service integration.
- **Update flow.** `tools/update-chromium.sh` resolves a version to one commit and
  updates `browser.lock.json` (`AGENTS.md`). It gains a second step: rebase the
  integration branch onto the new upstream commit, push, and record the new
  downstream SHA in the same lock entry. The lock diff remains the review.
- **CI.** Unchanged in shape: `tools/sync-sources.sh` unconditionally, then
  `--verify-only` (`AGENTS.md`: "Never decide in CI whether to synchronise").
  `--verify-only` gains the `//astro` HEAD check and the merge-base check.
- **Licensing.** Chromium is BSD-3-Clause; a downstream branch of it is a
  derivative work distributed under the same terms, and the `LICENSE` file at the
  Chromium root travels with it. `//astro` is a separate repository and may carry
  its own licence; because it is compiled into the same binary, that licence must
  be BSD-3-Clause-compatible. Brave's choice of MPL-2.0 for `brave-core` is one
  worked precedent (`brave-core/package.json`, `"license": "MPL-2.0"`). Whichever
  is chosen, `chrome://credits` generation must see `//astro` — Brave carries a
  `generate_about_credits` script for exactly this (`brave-core/package.json`
  scripts). Recorded here as a decision #9 must not skip, not as a decision this
  ADR makes.

## Consequences

**Positive**

- The acquisition of Astro source costs zero Chromium-owned files (measured).
- The upstream delta becomes a git range, so it is generated by construction and
  cannot drift from what is built.
- `tools/overlay.allowlist`'s single `overwrite` entry becomes removable: see
  [`minimum-chromium-hooks.md`](minimum-chromium-hooks.md) §"WebUI configs need no
  hook at all", which establishes that
  `chrome/browser/ui/webui/chrome_web_ui_configs.cc` never needed to be touched.
- `//astro` is inside `gn check`'s default scope, so #7's "`gn check` covers Astro
  targets and their integration edges" needs no new configuration — only that the
  edges be declarable, which §"the circular dependency" addresses.

**Negative, and not hidden**

- A Chromium fork repository has to exist and be maintained. ~30 GB, one-time,
  with a reconstruct-from-scratch fallback.
- `//astro/browser` will sit on the wrong side of Chromium's `//chrome/browser`
  dependency cycle and must use `allow_circular_includes_from`, whose own
  upstream comment (`chromium/src/chrome/browser/BUILD.gn:8392-8414`) warns that
  it can hide generated-file dependencies from the build graph. The mitigation is
  upstream's own: depend on `//chrome/browser:browser_public_dependencies`.
- Two revisions now have to agree (Chromium upstream, Astro downstream branch),
  and the merge-base check is what keeps them honest. If that check is skipped,
  the failure is silent — the branch builds fine against the wrong upstream.
- A developer who runs `gclient sync` by hand from a `.gclient` that Astro did not
  render will get a checkout with no `//astro`. `tools/sync-sources.sh` re-renders
  `.gclient` on every run and `--verify-only` fails on a mismatch
  (`tools/sync-sources.sh:526-541`), so the pipeline is covered; a hand-run is not.

## Related documents

| Document | Answers |
|---|---|
| [`astro-checkout-mechanism.md`](astro-checkout-mechanism.md) | The exact config and commands for A1 |
| [`minimum-chromium-hooks.md`](minimum-chromium-hooks.md) | Which Chromium files change, what changes, why it cannot be avoided |
| [`upstream-allowlist-and-delta-report.md`](upstream-allowlist-and-delta-report.md) | The allowlist format, the presubmit and the generated delta report |
| [`astro-module-layout.md`](astro-module-layout.md) | The initial `//astro` tree and the reasoning per split |
| [`downstream-survey.md`](downstream-survey.md) | Brave, Vivaldi, Iridium, Thorium, ungoogled, Electron — measured, with what to copy and what not to |
| [`clean-checkout-preconditions.md`](clean-checkout-preconditions.md) | The ordered, checkable list for "a clean checkout compiles `//astro`" |
