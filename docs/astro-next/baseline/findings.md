<!-- Hand-maintained. Unlike its neighbours this file is not generated, because
     a finding is a judgement about what the measurements mean.
     Every number in it is measured; the command that produced each is given. -->

# Baseline findings

What the first real build of the current committed source actually showed.

Each finding was produced by running the pipeline against a genuine Chromium
checkout at the locked commit `ae03f7fb2cf1215853896d6a4c15fdceee2badb7`, not by
reading code. Several of them are invisible to any synthetic fixture.

---

## 1. The committed source is not a complete Astro build

> **The committed current Astro source contains the Oxy target, but the
> committed patch stack does not currently link that target into
> `chrome/browser`. Therefore a clean build of the current committed source
> does not represent the full Astro product.**

This is the finding that governs how every other baseline document should be
read, and how any binary built from this repository should be described.

### Evidence

`src/chrome/browser/oxy/BUILD.gn` **is** committed and does declare the target:

```
$ git ls-files src/chrome/browser/oxy/BUILD.gn
src/chrome/browser/oxy/BUILD.gn
$ git show HEAD:src/chrome/browser/oxy/BUILD.gn | head -4
source_set("oxy") {
  sources = [
    "oxy_alia_side_panel.cc",
```

Nothing adds it to the build graph. `007-oxy-auth-build-hook.patch` did — it
added `"//chrome/browser/oxy"` to `chrome/browser/BUILD.gn` — and it is a
**0-byte file**. It was 9,580 bytes at `264d449` and empty from `9cc1043`
onward. The previous patch runner counted its failure and carried on, so nothing
ever surfaced it.

Measured on a fully patched tree:

```
$ grep -rl 'browser/oxy' chromium/src --include='BUILD.gn' --include='*.gni' | wc -l
0
```

The committed patch stack does reference the target exactly once, and the
detail is worth stating precisely rather than rounding off: `008-os-crypt-visibility.patch`
adds `"//chrome/browser/oxy"` to a **visibility allowlist** in
`components/os_crypt/sync/BUILD.gn`. That grants the overlay permission to
depend on `os_crypt`; it does not put the overlay in the build. So the stack
grants the target a privilege it has no way to exercise — which is itself a
sign that the loss of 007 went unnoticed for a long time. And `008` is one of
the patches that no longer applies.

### What follows from it

- Any binary built from the current committed source is **Chromium plus the
  legacy patch base**, with **no Astro overlay**: no Oxy Identity, no Alia, no
  ad blocker, none of the five WebUI controllers. It must be described that way
  and never as "Astro".
- No behavioural criterion about Astro may be marked satisfied on the strength
  of such a binary.
- The runtime half of the baseline — behaviour, screenshots, network capture,
  `astro://` runtime origins, process locks, Alia, Identity, adblock UI —
  stays blocked until a real Astro build exists.

### What is deliberately NOT done

The historic 007 is **not** restored. It is not the isolated build hook its name
implies: **7 added lines against 36 removed**, and only one of the 7 is the oxy
target. The 36 removals strip Safe Browsing notification content detection,
accessibility (`ax_main_node_annotator_controller`, `tree_fixing`), Screen AI,
`download/download_danger_prompt` — the dangerous-download UI — the preloading
model, and enterprise interstitials.

Restoring it would reintroduce exactly the contaminated delta Astro Next exists
to remove, and would silently re-delete security-relevant components under a
patch named "build hook".

Connecting Chromium to `//astro` is [#7](https://github.com/OxyHQ/Astro/issues/7),
and it is to be done as a deliberate minimal hook derived from what `//astro`
actually needs — not by recovering this diff.

---

## 2. The inherited patch stack applies exactly *and configures* — the `gn` failure was a local GN arg

> **Corrects an earlier version of this document**, which reported this as a
> defect in the composition of two inherited ungoogled patches. It is not one.
> No upstream adaptation is missing, nothing was ported, and no Astro-owned
> correction was created.

All 112 ungoogled patches apply **exactly** — no fuzz, no three-way merge — and
the tree they produce **does** configure:

```
$ gn gen out/PipelineCheck --args="$(cat build/reports/gn-args-committed-linux.gn)"
Done. Made 29803 targets from 4348 files in 2957ms
```

The failure that was previously recorded here is real but has a different cause:

```
ERROR at //chrome/browser/safe_browsing/BUILD.gn:114:5: Undefined identifier.
    sources += [
```

It reproduces with the committed args **and one value changed**:

| GN args | `gn gen` result |
|---|---|
| committed (`safe_browsing_mode = 0`) | `Done. Made 29803 targets` |
| identical except `safe_browsing_mode = 1` | `ERROR … BUILD.gn:114:5: Undefined identifier` |

`safe_browsing_mode = 1` is an **uncommitted edit to `gn_args/linux.gn` on this
machine**. The committed value is `0` on all six configurations.

### Why the patch pair looks broken and is not

Two patches with nearly the same name modify that file:

| Patch | Effect on the file |
|---|---|
| `core/inox-patchset/0001-fix-building-without-safebrowsing.patch` | wraps `sources = [...]` in `if (false) { }` |
| `core/ungoogled-chromium/fix-building-without-safebrowsing.patch` | removes the `if (enable_extensions)` block sitting between the wrapper's braces |

Together they leave `sources` defined only inside `if (false)`. Line 114's
`sources += [` sits inside `if (safe_browsing_mode != 0)`. At mode `0` — the
configuration these patches target, and the one ungoogled-chromium's own
`flags.gn` sets — that branch is never evaluated, so nothing appends to a
`sources` that does not exist. At mode `1` it is evaluated and there is nothing
to append to.

The patch pair is therefore **correct for its target configuration**, and the
failure was a configuration the ungoogled stack does not support. Both files are
byte-identical to upstream's and remain so.

### What was ruled out, and how

- **A stale output directory.** Tested directly: `gn gen` into a directory
  previously generated with `safe_browsing_mode = 1` and passed the committed
  args succeeds (`Done. Made 29803 targets`). `gn` honours new args in an
  existing directory, so the earlier failing run was passed mode `1`, not
  poisoned by leftovers.
- **A different patch applier.** Upstream applies with GNU
  `patch -p1 --ignore-whitespace`; this pipeline uses `git apply`. Scoping both
  appliers to `chrome/browser/safe_browsing/BUILD.gn` alone
  (`git apply --include=<file>` against `patch -p1 --ignore-whitespace -F0`) on
  the pristine upstream file produced **byte-identical output**. The applier is
  not a variable here.
  A first version of that experiment was invalid and is recorded because the
  invalidity is the reusable part: run unscoped, the patches touch files absent
  from the fixture, so atomic `git apply` applied *nothing* while GNU `patch`
  applied *partially*, and the resulting difference measured the fixture rather
  than the appliers.

### What it cost, and the guard added

This was nearly published as an upstream-composition defect, with a temporary
Astro-owned correction written to repair it. The near-miss has one cause: a
build read its GN args from the working tree and reported nothing about them, so
a one-character local edit was indistinguishable from the repository's own
configuration. `tools/build.sh` now compares the GN args it is about to use
against the committed ones and reports every differing key before configuring.

`safe_browsing_mode = 0` remains what it was: a property of the legacy baseline,
**not** an Astro Next decision. Designing real phishing, malware and
dangerous-download protection without adopting Google's backend wholesale is
[#20](https://github.com/OxyHQ/Astro/issues/20).

---

## 3. Two patch files are empty, and seven are structurally malformed

Of 56 Astro patches, **38 apply and 16 do not**, plus 2 that are empty files.

**Empty (removed from the stack — an empty file is not a patch):**

- `007-oxy-auth-build-hook.patch` — see finding 1
- `035-auth-https-callback.patch` — 0 bytes throughout its recorded history

**Structurally malformed (7).** `git apply` reports `corrupt patch at line N`:
the `@@` header's declared line counts disagree with the hunk body, i.e. the
file was hand-edited without updating the header.

| Patch | Header says | Body has |
|---|---|---|
| `045-adblock-throttle-register.patch` | `-6 +16` | `-6 +19` |
| `054-adblock-webui-register.patch` | `-6 +7` | `-5 +6` |

Also `046`, `052`, `053`, `055`, `056` — all adblock or NTP registration.

This is the sharpest justification for removing the fuzzy fallback. `patch -F3`
and `-F10` tolerate a wrong hunk header and apply anyway; `git apply` does not.
The old runner was therefore not absorbing context drift — it was compensating
for seven malformed files, indefinitely and silently.

**Context drift (9):** `009`, `012`, `013`, `015`, `020`, `023`, `027`, `036`,
`039`. Well-formed patches whose surrounding Chromium code has moved.

**Since resolved.** All seven malformed files have been regenerated against the
locked revision — `054` and `055` in `7bb07f4`, and `045`, `046`, `052`, `053`,
`056` after that. Four of them had drifted as well as being malformed, so
correcting the headers alone would not have applied them: `045`'s include hunk
named an `#include <functional>` the locked revision no longer has, `052` and
`053` both anchored on symbols since renamed or deleted, and `046` anchored on
prefs that only exist if `020` applies, which it does not.

The "context drift (9)" list above is also wrong, and measurement rather than
reasoning is what showed it. It has now been measured twice, and the second
measurement corrected the first, so both are recorded.

Replaying both series in declared order against a scratch tree of pristine files
read out of `chromium/src` at the locked commit reported `009`, `012`, `013` and
`015` as applying, and `020`, `023`, `027`, `036`, `039` as not. Those five were
then repaired: each had been generated by diffing an already-ungoogled tree
against pristine, so each carried edits belonging to an ungoogled patch or to
domain substitution alongside its own intent. Slimmed to the Astro-specific
intent, all five apply.

**What the first replay could not read.** `chromium/src` records 13 of the files
the series touches inside gclient-fetched DEPS subrepos, as gitlinks —
`third_party/devtools-frontend/src` and
`third_party/search_engines_data/resources`. `git show HEAD:<path>` cannot read a
path inside a gitlink, so those 13 files were simply absent from the replayed
tree. Resolving them from each subrepo's own git, at exactly the commit the
gitlink records, changes the verdict on twelve patches:

- **All eight ungoogled failures disappear.** None is drift; none belongs to #8.
  They had one root cause. `fix-building-with-prunned-binaries` names a
  devtools-frontend file, so `git apply` skipped the patch whole, so its edits to
  `chrome/test/BUILD.gn` were missing, so `fix-building-without-safebrowsing`
  failed there, so `context_info_fetcher.h` was missing its edits, so
  `remove-unused-preferences-fields` failed, and `move-js-optimizer-unfamiliar-sites`
  and `remove-uneeded-ui` failed after it. Skipping that one patch in an otherwise
  complete tree reproduces exactly the other four failures.
- **`009`, `012`, `013` and `015` do not apply after all.** They collide with
  ungoogled patches that only now apply: the first three with `remove-uneeded-ui`,
  `015` with `remove-unused-preferences-fields`. Skipping each ungoogled patch
  makes its victims apply, which is how the attribution was established rather
  than inferred. These four are measured, not repaired.

Two checks keep this from being a story about the harness rather than the tree.
The 13 replayed subrepo files come out **byte-identical** to the real checkout on
disk, where an earlier run had already applied these patches. And a synthetic
superproject confirms `git apply --check` does reach inside a gitlink — the
behaviour `apply-patches.sh` depends on and had never stated.

`docs/astro-next/policy/endpoints.json` carries the measured list and the method.

---

## 4. The depot_tools pin did not hold

`depot_tools` self-updates to `origin/main` on every invocation unless
`DEPOT_TOOLS_UPDATE=0` is set. No script set it, so the pin in
`browser.lock.json` was decorative. Its own reflog records the jump:

```
5dae8da42 HEAD@{0}: checkout: moving from 41c40cfa... to origin/main
```

This was not found by inspection. A `gclient sync` moved it, and the next build
**refused** — the lock gate caught a drift nobody had introduced deliberately,
which is the first real demonstration that the gate does what it was built for.

`DEPOT_TOOLS_UPDATE=0` is now exported from `tools/lib/astro-common.sh`, so
every script that sources it is covered rather than each remembering.

---

## 5. Recovering from a pruning run needs gclient, not git

Binary pruning deletes 12,392 files. `docs/recovery.mdx` previously said to
recover with `git checkout -- .` and `git clean -fd`. Measured:

| Recovery method | Pruning-list paths still absent afterwards |
|---|---|
| `git checkout -- .` + `git clean -fd` | 9,172 |
| `gclient sync --force` | 0 (12,392 / 12,392 present) |

Much of what pruning removes is DEPS-provided and is not restored by the
checkout's own git. The recovery documentation has been corrected.

---

## 6. Working-tree state is not repository state

Several measurements differ between the committed repository and the working
tree this baseline was first drafted on. The baseline is now derived
**only** from committed content, with working-tree differences reported
separately, because a baseline that varies per machine cannot be a
compatibility reference.

Measured differences at the time of writing:

| Subject | Committed | Working tree |
|---|---|---|
| Astro preferences registered by `020` + `046` | 10 | 18 |
| `safe_browsing_mode` in `gn_args/linux.gn` | `0` | `1` |
| Overlay files under `src/` | 61 | 66 |

### The GN matrix carried five findings that the repository does not contain

`safe_browsing_mode` was not an isolated slip. The committed `platform-matrix.md`
had been generated from disk, so it asserted **10** partially-set keys and **5**
differing-value keys; regenerated from `HEAD` the repository has **8** and **3**.
The five that vanished:

| Key | The document asserted | `HEAD` |
|---|---|---|
| `safe_browsing_mode` | linux `1`, disagreeing with the rest | `0` on all six |
| `build_with_tflite_lib` | linux `true`, disagreeing with the rest | `false` wherever set |
| `enable_supervised_users` | `true` on `windows_arm64` | `false` there |
| `enable_rlz_support` | "set on `windows_arm64` only" | unset on all six |
| `fatal_linker_warnings` | "set on `windows_arm64` only" | unset on all six |

Two of them — `enable_rlz_support` and `fatal_linker_warnings` — were of exactly
the shape the document exists to surface: a flag set on one platform and missing
on the others, which the document itself describes as "almost always an oversight
rather than a decision". They were **fabricated oversights**. Nobody had made
that mistake; a generator reading one machine's working tree invented it, and a
later issue acting on the document would have gone looking for a decision that
was never taken.

`enable_supervised_users` needs one distinction to stay accurate: the committed
matrix *does* disagree across platforms for that key (linux `true`, the rest
`false`). Only the `windows_arm64` value was phantom.

Every generator now reads `HEAD` and reports its working-tree delta separately —
`inventory_gn_args.py` per key, the rest as a three-way set difference (added,
deleted, differing with `+N -M` line counts) under a header saying which baseline
findings would change if the uncommitted work landed.

The pref gap matters beyond tooling: the committed patch stack registers none of
the seven `astro.ntp_show_*` preferences the New Tab Page reads.

The `safe_browsing_mode` row is not a tooling detail either. That single
uncommitted character is what produced the `gn` failure in finding 2, and it was
very nearly published as a defect in upstream ungoogled-chromium.

---

## 7. There is no same-configuration pristine baseline to compare against

The obvious way to decide whether the patch stack introduced a `gn` complaint is
to run the same check on the unpatched tree. On this repository that comparison
**cannot be made**, and the reason is worth recording because it invalidates the
instinct rather than merely failing once.

With the tracked patch modifications stashed, the committed GN args do not
configure the pristine tree at all:

```
ERROR at //components/optimization_guide/core/inference/BUILD.gn:8:1: Assertion failed.
```

The committed args and the patch stack are **coupled**: the args select a
configuration that only the patched tree supports. A pristine run is therefore
not a baseline for the patched run — it is a different question.

**The failure mode this creates is silent.** `gn gen` failing means no build
graph is written, and `gn check` against a directory with no build graph reports
`0 errors` — which reads exactly like "clean". The first run of this experiment
produced that `0` and it meant nothing at all. Any check whose "pass" and
"nothing was measured" look identical needs a vacuity floor before it is
believed; here, the floor is the target count `gn gen` reports.

The stash experiment is safe to repeat and was verified as such: `git status
--porcelain` was byte-identical before and after (3,923 entries), and an md5 of
`chrome/browser/safe_browsing/BUILD.gn` matched.

---

## 8. `gn check` reports 26 errors, and they cannot be attributed by differencing

For the record, and bounded honestly:

```
$ gn check out/PipelineCheck
… 26 errors across 18 files
```

Six of those 18 files are modified by the patch stack; twelve are not. That is
not enough to attribute them, because `gn check` errors are about dependency
*edges*, and the stack modifies **68** `BUILD.gn`/`.gni` files — including
`chrome/browser/BUILD.gn`, `content/browser/BUILD.gn` and `chrome/test/BUILD.gn`,
which own three of the targets named in the errors. Per finding 7 there is no
same-configuration pristine run to difference against.

`gn check` is advisory rather than a build gate — the compile does not consume
it — so this is recorded as an observation with its attribution limits stated,
not as a pass or a failure. Curating it belongs with the rest of the aggregate
ungoogled work in [#8](https://github.com/OxyHQ/Astro/issues/8).

---

## 9. The first real compile failed on uncommitted overlay content

At 54,872 of 72,184 steps:

```
In file included from ../../chrome/browser/ui/webui/chrome_web_ui_configs.cc:4:
../../chrome/browser/oxy/webui/astro_settings_ui.h:10:10: fatal error:
    'chrome/browser/oxy/webui/astro_settings.mojom.h' file not found
```

This is declared defect 2 from `AGENTS.md` reaching a compiler for the first
time, and the chain is entirely mechanical:

1. `src/chrome/browser/ui/webui/chrome_web_ui_configs.cc` is a whole-file overlay
   copy — **untracked**, working-tree only. Measured: byte-identical (`md5
   2de90060…`) to the copy `sync-overlay.sh` had placed in the Chromium tree, and
   `git ls-files --error-unmatch` reports it is not known to git.
2. It `#include`s five Astro headers, pulling the overlay into a Chromium
   translation unit.
3. One of them needs the generated `astro_settings.mojom.h`, which nothing
   generates — because the overlay is not in the build graph (finding 1).

So the committed state alone does not produce this failure; one uncommitted file
does. That is the third instance in a single session of working-tree state being
mistaken for repository state, after the five phantom GN findings and the
`safe_browsing_mode` near-miss in finding 2.

The tree was returned to what the **committed** stack produces for that one file
— upstream plus `disable-ai.patch` and `first-run-page.patch`, zero Astro
includes. `054` and `055` do not apply (finding 3), which is consistent. The
untracked overlay copy in the Astro repository was not touched.

**Still open:** `sync-overlay.sh` copies uncommitted overlay files into the
Chromium tree and says nothing about it, so any build made through
`tools/build.sh` silently incorporates working-tree content. That is the same
gap `gn_args_drift.py` closed for GN args, one level down.

---

## 10. The build completes, and the packager named it Astro

The resumed build reported `Success` and produced a 465,137,912-byte ELF. It
launches against a temporary profile and renders.

> **This artifact is a `pipeline-validation build: Chromium + legacy base,
> Astro overlay absent`.** That is its full and only description. It is
> admissible evidence for #4 and #5 on everything strictly about the pipeline —
> bootstrap, DEPS, patch application, `gn gen`, compile, fail-closed behaviour,
> the tree summary, provenance and packaging validation. It is **not** admissible
> for any criterion requiring a working Astro: nothing about `astro://`, Oxy
> Identity, Alia, the ad blocker, the New Tab Page or any WebUI page may be
> marked satisfied on the strength of it.

**It contains no Astro overlay**, and the evidence is stated with its controls
because "we found nothing" is only meaningful if the search works:

| Probe | Astro | Control (same probe, Chromium subject) |
|---|---|---|
| `nm -C` overlay symbols | 0 | `ChromeContentBrowserClient` × 495 |
| Binary strings `astro-ntp` / `astro-error` / `chrome://alia` | 0 | `chrome://version` × 1, `chrome://settings` × 27 |

`chrome --version` reports `Chromium 146.0.7680.177`.

Two probes were discarded rather than reported, because each would have produced
a confident wrong answer:

- A `grep -icE 'OxyAuth'` over `nm` output returned **22 matches** that were all
  `ProxyAuth` — `ProxyAuth` contains the substring `oxyAuth`, and the search was
  case-insensitive. Printing the matched lines instead of the count is what
  caught it.
- A headless `--dump-dom` probe of `chrome://astro-ntp` reported the host as
  absent — and reported `chrome://version` as absent too, which is false in every
  Chromium ever built. Runtime WebUI origins are therefore **not-captured** here,
  not "confirmed absent"; capturing them needs a browser this harness cannot
  currently drive.

`tools/package-release.sh` then packaged that binary as
**`astro-0.1.0-linux-x64.tar.gz`**, reported success, and left it in `releases/`
beside genuine artifacts. Its only hint was one optional-member warning about
`adblock_resources/` — a warning by design, since the ad blocker's filter lists
are declared optional.

An artifact named after the product but not containing it is the most misleading
thing this pipeline can emit. `tools/lib/overlay_in_binary.py` now decides the
question before the archive is written, and the packager refuses by default.
`ASTRO_ALLOW_OVERLAYLESS_PACKAGE=1` produces the archive deliberately, renamed
`pipeline-validation-<version>-linux-x64-NO-ASTRO-OVERLAY.tar.gz`. The detector
reports `unmeasurable` separately from `absent`, so a wrong path cannot
impersonate the real defect, and the packager treats `unmeasurable` as a refusal
rather than as permission.

---

## 11. The banned-pattern scanner could be disarmed two ways, one of them free

The scanner enforcing the epic's non-negotiable rules had two independent
bypasses. Both were confirmed by experiment in both directions before either was
fixed — the same lines with the bypass removed exit non-zero and name the rule,
which is what distinguishes a real bypass from a regex that simply never
matched.

### The marker was a bare substring test

`astro-allow:` was accepted wherever the literal string appeared in the offending
line *or the line above it*, with no requirement that it be a comment, name a
rule, or justify itself. A string literal, a variable's value, or any executable
line granted an exception. Seven forged shapes each exited 0.

Because the marker named no rule, one occurrence disabled **every** rule on the
line. Measured on a line breaking three at once — `rsync --delete`,
`2>/dev/null` and `|| true` — a single unqualified marker cleared all three.

An exception is now valid only as a real comment, located by the same
quote-aware scan the strippers use, sitting on the offending line or on a
pure-comment line directly above it, naming a known rule id and carrying a
justification. It suppresses only the rule it names, and rule ids are derived
from the rule tables so a marker cannot name a rule that does not exist.

### Continued lines were invisible, and needed no marker at all

The scanner read physical lines. A string opened on one physical line and closed
on the next left the closing quote reading as an *opening* one, so everything
after it was treated as quoted text and never scanned:

```
astro::info "a message that spans \
    two physical lines" && rm -f /tmp/x || true
```

`scanned 1 file(s), no banned patterns`, exit 0. Any `|| true`, `2>/dev/null`,
`--delete`, `--3way` or `-F` on a continued logical line was undetectable. The
first bypass at least required somebody to type a marker; this one was free, and
it disarmed the rule the epic exists to enforce.

Physical lines are now joined into logical ones before scanning, so quote state
carries across the join. Two shapes deliberately do not continue a line and are
tested: an escaped backslash (`\\`), and a trailing backslash inside a comment.

**The sharpest evidence that this mattered: two of the repository's five
`astro-allow:` markers had never suppressed anything.** Both sit on exactly this
continued shape. Stripping all five markers and rescanning produced three
findings before the fix and five after it — so until now a reader could not tell
a reviewed exception from a decorative comment, and the suite asserts all five
are load-bearing precisely so that cannot recur.

---

## 12. The overlay gate covered one packager of six, and could not tell a crash from a verdict

`tools/package-release.sh` was gated after it shipped an overlayless build as
`astro-0.1.0-linux-x64.tar.gz`. The other five — deb, linux, windows, macos,
android — would each have done the same thing. The check now lives in
`astro::require_astro_overlay` in `tools/lib/astro-common.sh`, which every
packager already sources, so a new one cannot omit it by forgetting a second
`source` line.

Three verdicts, and the third is what makes the other two mean anything: present
may be named after the product, **absent refuses, and unmeasurable refuses too**
— including when the operator sets `ASTRO_ALLOW_OVERLAYLESS_PACKAGE=1`. That
override says "this build was measured and found empty"; it cannot say "nobody
measured it". Verified in the dispatch itself: the unmeasurable arm and the
crash arm both exit before the override is ever consulted.

**A crash is not a verdict.** The detector exits 1 for "absent", which is also
what an unhandled Python exception exits, and a signal-level death exits 128+n.
Both were observed here on real artifacts rather than theorised — a SIGSEGV on
the 118 MB `mini_installer.exe`, and a non-reproducible `TypeError` on the
465 MB ELF. Any status outside {0,1,2} is now unmeasurable, never absent.

### Two things only real artifacts could teach

Measured against the shipped Windows artifact, not inferred from Linux:

| Real file | Bytes | Verdict |
|---|---|---|
| `chrome.exe` from `astro-0.1.0-windows-arm64-portable.zip` | 2,575,872 | **unmeasurable** — a launcher stub carrying neither marker |
| `chrome.dll` beside it | 269,735,424 | **present** — `astro-error ×2, astro-ntp ×2, chrome://alia ×1` |

The obvious probe — gate on `chrome.exe` — would have refused every Windows
package permanently: fail-closed and useless. Both files are passed and the
verdict taken over the pair. macOS splits the same way, which is why its probe
walks the bundle for Mach-O images rather than naming a path. And
`mini_installer.exe` measures nothing at all, its payload being compressed, so
the gate is on the DLL the installer is built from — a tradeoff written into the
script along with what it does not catch.

Incidentally this is the detector's `present` direction confirmed on a genuine
Astro build: the April Windows artifact does contain the overlay. Today's Linux
build does not, and the same scan says so.

The markers in the real PE are **ASCII** — the same format-agnostic
printable-run scan reads an ELF and a PE unchanged. `chrome://version` also
occurs once as UTF-16LE there, so wide literals are scanned for too; that can
only turn a false `unmeasurable` into a correct `present`, never the reverse.

### A resource must not be allowed to answer

Every packaged artifact carries the WebUI dist, and `astro-ntp` in an HTML file
says nothing about whether any code was compiled in. Worse, `package-macos.sh`
copies those resources into the bundle inside the build directory, so its second
run would find its first run's copy. The macOS probe therefore scans only Mach-O
images, and the Android probe only `*.so` zip members.

### Declared, not hidden

**Android and macOS are gated but not calibrated against a real artifact**,
because neither can be produced on this machine. The zip-member scan is verified
on a real 313 MB archive, but whether a real Chromium APK's native library
carries the control marker is unmeasured. If it does not, `package-android.sh`
refuses until somebody calibrates it against a real APK. That is the correct
direction, and it is loud.

---

## 13. Builds silently incorporated uncommitted overlay content

`tools/sync-overlay.sh` copied `src/` from the working tree, so any build made
through `tools/build.sh` could include content no revision records — which is
exactly how finding 9's compile failure happened. The sync now compares against
`HEAD` before copying anything, classifies each difference as modified, deleted
or untracked, prints every path, and refuses. Measured against this repository,
whose `src/` genuinely carries local work, it names all of them and reports
`Nothing has been copied and nothing of yours has been touched` — nothing is
deleted, stashed or overwritten.

`ASTRO_ALLOW_DIRTY_OVERLAY=1` is a developer-only override. It records the build
as not reproducible in provenance, packaging then refuses to ship it as a
release, and CI is asserted never to set it. As with the overlay-in-binary gate,
provenance's "nothing was measured" state is a refusal rather than permission,
so the two gates fail the same way for the same reason.

---

## 14. A threshold cannot tell a shrinking source from a broken parser

The fixture generator carried `MIN_REGISTERED_PREFS = 15` against a committed
stack registering 10, so the suite was red — and the only two ways to clear it
were to commit somebody's uncommitted patch edits or to lower the number. Both
would have recorded a decision nobody made.

It is replaced by a structural invariant. A deliberately **looser** recogniser
finds where each declaration begins, and every site must pair one-to-one with a
strict parse. The asymmetry is the whole point: two counts derived from the same
regex agree by construction and prove nothing. Three distinct failures are
reported, because they have different causes — a site the strict parser missed,
one strict match covering several sites (the DOTALL run-on, which counting alone
cannot see), and a strict match covering no site, which is a vacuity guard on
the check itself.

Measured on committed state: **11 declaration sites detected, 11 parsed, 10
distinct Astro-owned preferences**. Mutation-tested by feeding it a registration
whose name is held in a constant and one whose name carries a character the
strict class excludes; both raise and name the exact line.

The absolute number is now free to be 10, 18 or 40. The eight preferences that
exist only in a working tree are recorded in `pref-dispositions.json` as
observed-local-only candidates — `astro.ntp_show_*` for
[#22](https://github.com/OxyHQ/Astro/issues/22) and
`oxy.adblock.lifetime_blocked_count` for
[#18](https://github.com/OxyHQ/Astro/issues/18)/[#19](https://github.com/OxyHQ/Astro/issues/19)
— not as part of the reproducible legacy baseline.
